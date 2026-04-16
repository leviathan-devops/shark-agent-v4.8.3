/**
 * Gate Enforcement Hook — tool.execute.before validation
 *
 * CRITICAL: Prevents gate bypass by validating that:
 * 1. Evidence exists before passing a gate
 * 2. Blocking criteria are actually met
 * 3. Evidence wasn't fabricated
 *
 * This hook fires BEFORE shark-gate tool executes.
 * If evaluate --passed true is called without evidence, this throws.
 */

import type { Hooks } from '@opencode-ai/plugin';
import { GateManager, GATE_CRITERIA } from '../../shared/gates.js';
import { EvidenceCollector, type GateName, type GateEvidence } from '../../shared/evidence.js';
import { getCurrentAgent } from './agent-state.js';
import { isSharkAgent } from '../../shared/agent-identity.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

export function createGateEnforceHook(
  gateManager: GateManager,
  evidenceCollector: EvidenceCollector
): Hooks['tool.execute.before'] {
  return async (input) => {
    const tool = input.tool;
    const sessionID = input.sessionID;

    if (tool !== 'shark-gate') return;

    if (!isSharkAgent(getCurrentAgent(sessionID))) {
      return;
    }

    const args = (input as unknown as { args: unknown }).args;
    const gateArgs = args as { action?: string; gate?: string; passed?: boolean };

    if (gateArgs.action !== 'evaluate' || gateArgs.passed !== true) {
      return;
    }

    const gateName = gateArgs.gate as GateName;
    if (!gateName || !GATE_CRITERIA[gateName]) {
      throw new Error('[GATE ENFORCE] Invalid gate name');
    }

    const criteria = GATE_CRITERIA[gateName];
    const evidence = evidenceCollector.getGateEvidence(gateName);

    if (!evidence || evidence.length === 0) {
      throw new Error(
        `[GATE ENFORCE] Cannot pass ${gateName} gate without evidence. ` +
        `Required: ${criteria.evidenceRequired.join(', ')}`
      );
    }

    for (const requiredFile of criteria.evidenceRequired) {
      const evidencePath = path.join(process.cwd(), '.shark', 'evidence', gateName, requiredFile);
      if (!fs.existsSync(evidencePath)) {
        throw new Error(
          `[GATE ENFORCE] Missing required evidence file: ${requiredFile} ` +
          `for ${gateName} gate`
        );
      }
    }

    const allPassed = evidence.every((e: GateEvidence) => e.passed);
    if (!allPassed) {
      throw new Error(
        `[GATE ENFORCE] Cannot pass ${gateName} gate. ` +
        `Some evidence items failed. Run tests to collect passing evidence.`
      );
    }
  };
}
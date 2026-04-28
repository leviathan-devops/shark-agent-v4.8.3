/**
 * Messages Transform Hook — agent OUTPUT anti-derailment enforcement (TUI mode)
 * 
 * V4.8.3 CP4.8: RESTORED L5 BLOCKING. Silent strip was unacceptable — 
 * derailment MUST be blocked, not silently cleaned. Short one-liner errors.
 * 
 * Only checks AGENT responses (role === 'assistant'), never user messages.
 * Throws to BLOCK derailment. Error format: [L5.x] Short message.
 */
import type { Hooks } from '@opencode-ai/plugin';
import { setCurrentAgent } from './agent-state.js';
import { isSharkAgent } from '../../shared/agent-identity.js';
import {
  HOST_FALLBACK_PATTERNS, SUCCESS_CLAIM_PATTERNS, MODEL_RESTRICTION_PATTERNS,
  MOCK_STUB_PATTERNS, SIMPLIFICATION_PATTERNS, CONFUSION_PRETENSE_PATTERNS,
  SCOPE_CREEP_PATTERNS, CROSS_AGENT_PATTERNS, UNDERMINING_PATTERNS,
  IMPATIENCE_PATTERNS, SELF_REFERENCE_PATTERNS, BEHAVIORAL_PATTERNS,
  CONTAINER_TEST_RESULT_FILE,
} from '../../shared/firewall-patterns.js';
import * as path from 'path';
import * as fs from 'node:fs';

function hasContainerTestEvidence(): boolean {
  const evidencePath = path.join(process.cwd(), '.shark', 'evidence', 'delivery', CONTAINER_TEST_RESULT_FILE);
  if (!fs.existsSync(evidencePath)) return false;
  try {
    const result = JSON.parse(fs.readFileSync(evidencePath, 'utf-8'));
    return result.overallPassed === true && result.passRate >= 0.96;
  } catch { return false; }
}

function extractAgentText(output: { messages?: Array<{ info?: { role?: string; agent?: string }; parts?: Array<{ type?: string; text?: string }> }> }): { agentText: string; agent: string | undefined } {
  const messages = output?.messages;
  if (!messages || messages.length === 0) return { agentText: '', agent: undefined };
  let agentText = '', agent: string | undefined;
  for (const msg of messages) {
    if (msg?.info?.role === 'assistant') {
      if (msg?.info?.agent && !agent) agent = msg.info.agent;
      if (msg?.parts) for (const part of msg.parts) { if (part?.type === 'text' && part?.text) agentText += (agentText ? ' ' : '') + part.text; }
    }
  }
  return { agentText, agent };
}

// ============================================================================
// L5 ANTI-DERAILMENT CHECKS — all throw on detection with short one-liners
// ============================================================================

function check(text: string, patterns: RegExp[], label: string, requireEvidence?: boolean): void {
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      if (requireEvidence && hasContainerTestEvidence()) return;
      throw new Error(`[${label}]`);
    }
  }
}

// L8: Behavioral Intelligence — detects sophisticated derailment patterns
function checkL8Behavioral(text: string): void {
  for (const sig of BEHAVIORAL_PATTERNS) {
    if (sig.pattern.test(text)) {
      if (sig.requireEvidence && hasContainerTestEvidence()) return;
      throw new Error(`[L8] ${sig.label}`);
    }
  }
}

function enforceAgentOutput(text: string): void {
  check(text, HOST_FALLBACK_PATTERNS, 'L5.1 Host fallback');
  check(text, SUCCESS_CLAIM_PATTERNS, 'L5.2 Success claim without proof', true);
  check(text, MODEL_RESTRICTION_PATTERNS, 'L5.3 Model restriction');
  check(text, MOCK_STUB_PATTERNS, 'L5.4 Mock/stub data', true);
  check(text, SIMPLIFICATION_PATTERNS, 'L5.5 Oversimplification');
  check(text, CONFUSION_PRETENSE_PATTERNS, 'L5.6 Confusion pretense');
  checkScopeCreepWithCrossAgent(text);
  check(text, UNDERMINING_PATTERNS, 'L5.8 Undermining');
  check(text, IMPATIENCE_PATTERNS, 'L5.9 Impatience');
  check(text, SELF_REFERENCE_PATTERNS, 'L5.10 Self-reference', true);
  checkL8Behavioral(text);
}

function checkScopeCreepWithCrossAgent(text: string): void {
  for (const pattern of SCOPE_CREEP_PATTERNS) {
    if (pattern.test(text)) {
      for (const cap of CROSS_AGENT_PATTERNS) {
        if (cap.test(text)) throw new Error(`[L5.7] Cross-agent tool`);
      }
      throw new Error(`[L5.7] Scope creep`);
    }
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export function createMessagesTransformHook(): Hooks['experimental.chat.messages.transform'] {
  return async (input, output) => {
    try {
      const { agentText, agent } = extractAgentText(output);
      if (!agent || !isSharkAgent(agent)) return;
      setCurrentAgent(agent);
      if (!agentText || !agentText.trim()) return;
      enforceAgentOutput(agentText);
    } catch (e) {
      throw e; // Re-throw to block the message
    }
  };
}

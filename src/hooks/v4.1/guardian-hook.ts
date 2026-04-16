/**
 * Guardian Hook — tool.execute.before integration
 * 
 * V4.8.3: Complete L0-L8 Firewall System
 * 
 * Guardian blocks:
 * L0: Identity Wall — blocks dangerous tools when brain not initialized
 * L1: Theatrical Verification — blocks counting theater (grep | wc)
 * L2: Fake Test Runner — blocks test frameworks bypassing OpenCode hooks
 * L3: Source Inspection — blocks "file exists ≠ works" logic
 * L4: Wrong Container — blocks hallucinated opencode container commands
 * L5: Anti-Derailment — blocks behavioral derailment patterns
 * L6: Local File Protection — zone-based blocking
 * L7: Verification Gate — evidence requirements
 * L8: Behavioral Intelligence — GOLDEN pattern enforcement
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import type { Hooks } from '@opencode-ai/plugin';
import { Guardian } from '../../shared/guardian.js';
import { extractCommandFromArgs } from './utils.js';
import { getCurrentAgent, setCurrentAgent } from './agent-state.js';

const DANGEROUS_TOOLS = new Set([
  'terminal', 'mcp_terminal',
  'write_file', 'mcp_write_file',
  'patch', 'mcp_patch',
  'edit', 'mcp_edit',
  'delete_file', 'mcp_delete_file'
]);

const THEATRICAL_PATTERNS = [
  /\|.*wc\s+-l/i,
  /wc\s+-l.*\|/i,
  /cat.*\|.*wc/i,
  /grep.*\|.*wc/i,
  /\|.*tee/i,
  /\|.*>.*\./i,
  /wc\s+-l.*dist\//i,
  /wc\s+-l.*src\//i,
  /wc\s+-l.*build\//i,
  /grep.*setCurrentAgent.*src/i,
  /grep.*isSharkAgent.*src/i,
  /grep.*guardian.*src/i,
];

const LEGITIMATE_PATTERNS = [
  /mkdir\s+-p/i,
  /cp\s+-r/i,
  /mv\s+/i,
  /cat\s+[^\|>]+$/i,
  /head\s+-[0-9]+\s+/i,
  /tail\s+-[0-9]+\s+/i,
  /grep\s+-[rEn]+.*[^\|]$/i,
  /find\s+.*-name/i,
  /test\s+-d/i,
  /test\s+-x/i,
];

const FAKE_TEST_PATTERNS = [
  /node\s+run-tests?\.js/i,
  /node\s+verify.*\.mjs/i,
  /npm\s+(run\s+)?test/i,
  /yarn\s+(run\s+)?test/i,
  /jest/i,
  /vitest/i,
  /mocha/i,
  /jasmine/i,
  /bun\s+test/i,
  /pytest/i,
  /python.*-m.*pytest/i,
  /go\s+test/i,
  /cargo\s+test/i,
  /ruby\s+-Itest/i,
  /rspec/i,
];

const SOURCE_INSPECTION_PATTERNS = [
  /test\s+-f\s+\$\{?.*\}/i,
  /test\s+-e\s+\$\{?.*\}/i,
  /if\s+\[\s*-[fes]\s+.*\]\s*;/i,
  /grep\s+-r\s+.*src\//i,
  /ls\s+-l.*dist\//i,
];

const WRONG_CONTAINER_PATTERNS = [
  /opencode\s+container\s+run/i,
  /opencode\s+container\s+start/i,
  /opencode\s+container\s+exec/i,
  /opencode\s+run\s+/i,
];

const HOST_FALLBACK_PATTERNS = [
  /host.*testing.*already.*works/i,
  /fall.*back.*to.*host/i,
  /host.*already.*proves/i,
  /local.*works.*container.*not.*needed/i,
  /since.*host.*works/i,
  /skip.*container.*test/i,
  /container.*not.*necessary/i,
  /container.*not.*needed/i,
  /not.*need.*container/i,
  /skip.*container/i,
  /use.*host.*instead/i,
  /host.*prove.*it.*works/i,
  /already.*proven.*to.*work/i,
  /already.*verified.*on.*host/i,
  /already.*tested.*on.*local/i,
];

const SUCCESS_CLAIM_PATTERNS = [
  /it.*works.*trust.*me/i,
  /trust.*me.*it.*works/i,
  /believe.*me.*it.*works/i,
  /already.*verified.*by.*myself/i,
  /already.*tested.*and.*works/i,
  /already.*proven.*to.*work/i,
  /obviously.*correct/i,
  /clearly.*works/i,
  /self.*evidently.*correct/i,
  /in.*my.*assessment.*it.*works/i,
  /in.*my.*experience.*it.*works/i,
  /based.*on.*my.*analysis.*works/i,
  /no.*need.*for.*test/i,
  /no.*need.*for.*verification/i,
  /no.*further.*test.*needed/i,
];

const MODEL_RESTRICTION_PATTERNS = [
  /only.*gpt/i,
  /only.*claude/i,
  /only.*gemini/i,
  /only.*llama/i,
  /must.*use.*gpt/i,
  /must.*use.*claude/i,
  /restricted.*to.*model/i,
  /model.*quota/i,
  /model.*limit/i,
  /rate.*limit.*excuse/i,
  /api.*key.*issue/i,
  /can't.*afford.*model/i,
  /too.*expensive.*model/i,
  /model.*cost.*too.*high/i,
  /switch.*model.*理由/i,
];

const MOCK_STUB_PATTERNS = [
  /mock.*data/i,
  /stub.*data/i,
  /fake.*data/i,
  /dummy.*data/i,
  /sample.*data/i,
  /test.*data.*only/i,
  /mocked.*response/i,
  /stubbed.*response/i,
  /fake.*api/i,
  /hardcoded.*response/i,
  /static.*json.*instead/i,
  /no.*real.*api/i,
];

const SIMPLIFICATION_PATTERNS = [
  /over.*simplif/i,
  /overly.*simplif/i,
  /too.*simpl/i,
  /oversimplif/i,
  /hand.*wave/i,
  /handwave/i,
  / gloss.*over /i,
  /glossed.*over/i,
  /skip.*detail/i,
  /skip.*nuance/i,
  /oversimplif/i,
];

const CONFUSION_PRETENSE_PATTERNS = [
  /it.*somewhat.*works/i,
  /sorta.*works/i,
  /kinda.*works/i,
  /more.*or.*less/i,
  / mostly .*works/i,
  /approximately.*correct/i,
  / basically .*correct/i,
  / essentially .*works/i,
  / nominally .*functional/i,
  / partially .*implemented/i,
  / partially .*working/i,
  /somewhat.*correct/i,
];

const SCOPE_CREEP_PATTERNS = [
  /while.*at.*it/i,
  /while.*we.*re.*at.*it/i,
  /at.*the.*same.*time/i,
  /also.*need.*to/i,
  /might.*as.*well/i,
  /顺便/i,
  /顺便说一下/i,
  /just.*to.*be.*thorough/i,
  /for.*completeness/i,
  /one.*more.*thing/i,
  /oh.*and.*also/i,
  /on.*the.*side/i,
];

const CROSS_AGENT_TOOLS = new Set([
  'hermes_remember', 'hermes_recall', 'hermes_context',
  'hive_remember', 'hive_context', 'hive_status',
  'kraken_hive_remember', 'kraken_hive_search', 'kraken_hive_get_cluster_context',
  'memremember', 'memsearch', 'memread', 'membrowse',
  'knowledge_remember', 'knowledge_recall', 'knowledge_query',
]);

const UNDERMINING_PATTERNS = [
  /not.*worth.*the.*effort/i,
  /too.*much.*work/i,
  /not.*worth.*it/i,
  /diminishing.*returns/i,
  / marginal .*benefit/i,
  / minimal .*gain/i,
  /savvy.*engineer.*would/i,
  /experienced.*developer.*would/i,
  /realistic.*timeline/i,
  /realistically/i,
  / practically .*impossible/i,
  / realistically .*impractical/i,
];

const IMPATIENCE_PATTERNS = [
  /let's.*just.*move.*on/i,
  /let's.*skip.*to.*the.*end/i,
  /just.*ship.*it/i,
  /good.*enough/i,
  /close.*enough/i,
  /ship.*it/i,
  /just.*deploy/i,
  /fuck.*it/i,
  / ship .*now/i,
  / deploy .*now/i,
  /let's.*hurry/i,
];

const SELF_REFERENCE_PATTERNS = [
  /i.*have.*verified.*that/i,
  /i.*verified.*it.*works/i,
  /my.*verification.*shows/i,
  /i.*tested.*it.*works/i,
  /i.*ran.*it.*and.*works/i,
  /my.*testing.*confirms/i,
  /i.*know.*it.*works/i,
  /i.*am.*certain.*it.*works/i,
  /my.*assessment.*is/i,
  /in.*my.*assessment/i,
  /my.*analysis.*shows/i,
];

const CONTAINER_TEST_RESULT_FILE = 'ContainerTestResult.json';

function hasContainerTestEvidence(): boolean {
  const evidencePath = path.join(
    process.cwd(),
    '.shark',
    'evidence',
    'delivery',
    CONTAINER_TEST_RESULT_FILE
  );
  
  if (!fs.existsSync(evidencePath)) {
    return false;
  }
  
  try {
    const result = JSON.parse(fs.readFileSync(evidencePath, 'utf-8'));
    return result.overallPassed === true && result.passRate >= 0.96;
  } catch {
    return false;
  }
}

function buildTextToCheck(toolArgs: Record<string, unknown>): string {
  return JSON.stringify(toolArgs);
}

function checkTheatricalVerification(command: string | null): void {
  if (!command) return;
  
  for (const pattern of LEGITIMATE_PATTERNS) {
    if (pattern.test(command)) {
      return;
    }
  }
  
  for (const pattern of THEATRICAL_PATTERNS) {
    if (pattern.test(command)) {
      throw new Error(
        `[ANTI-SLOP L1] Counting theater detected: "${command}". ` +
        `Verification requires running, not counting.`
      );
    }
  }
}

function checkFakeTestRunner(command: string | null): void {
  if (!command) return;
  
  for (const pattern of FAKE_TEST_PATTERNS) {
    if (pattern.test(command)) {
      throw new Error(
        `[ANTI-SLOP L2] Fake test runner detected: "${command}". ` +
        `Tests must run via OpenCode hooks. Use: opencode run "shark-test-runner"`
      );
    }
  }
}

function checkSourceInspection(command: string | null): void {
  if (!command) return;
  
  for (const pattern of SOURCE_INSPECTION_PATTERNS) {
    if (pattern.test(command)) {
      throw new Error(
        `[ANTI-SLOP L3] Source inspection detected. ` +
        `File existence ≠ runtime proof. Use container test instead.`
      );
    }
  }
}

function checkWrongContainer(command: string | null): void {
  if (!command) return;
  
  for (const pattern of WRONG_CONTAINER_PATTERNS) {
    if (pattern.test(command)) {
      throw new Error(
        `[ANTI-SLOP L4] Wrong container command. ` +
        `Use: docker run --rm -v "$HOME/.config/opencode:/root/.config/opencode" opencode-test:1.4.3 ...`
      );
    }
  }
}

function checkHostFallback(text: string): void {
  for (const pattern of HOST_FALLBACK_PATTERNS) {
    if (pattern.test(text)) {
      throw new Error(
        `[ANTI-DERAILMENT L5.1] Host fallback detected. ` +
        `Host testing ≠ container testing. Container isolation is REQUIRED for ship gate.`
      );
    }
  }
}

function checkSuccessClaim(text: string): void {
  for (const pattern of SUCCESS_CLAIM_PATTERNS) {
    if (pattern.test(text)) {
      if (!hasContainerTestEvidence()) {
        throw new Error(
          `[ANTI-DERAILMENT L5.2] Success claim without proof. ` +
          `MECHANICAL PROOF REQUIRED: Container test evidence (passRate >= 0.96). ` +
          `Run: opencode run "shark-test-runner" --agent shark`
        );
      }
    }
  }
}

function checkModelRestriction(text: string): void {
  for (const pattern of MODEL_RESTRICTION_PATTERNS) {
    if (pattern.test(text)) {
      throw new Error(
        `[ANTI-DERAILMENT L5.3] Model restriction excuse detected. ` +
        `Quality gates apply regardless of model choice.`
      );
    }
  }
}

function checkMockStub(text: string): void {
  for (const pattern of MOCK_STUB_PATTERNS) {
    if (pattern.test(text)) {
      if (!hasContainerTestEvidence()) {
        throw new Error(
          `[ANTI-DERAILMENT L5.4] Mock/stub data detected. ` +
          `MECHANICAL PROOF REQUIRED: Container test evidence. ` +
          `Real data + real execution required for ship gate.`
        );
      }
    }
  }
}

function checkSimplification(text: string): void {
  for (const pattern of SIMPLIFICATION_PATTERNS) {
    if (pattern.test(text)) {
      throw new Error(
        `[ANTI-DERAILMENT L5.5] Oversimplification detected. ` +
        `Nuance matters. Do not hand-wave complex aspects.`
      );
    }
  }
}

function checkConfusionPretense(text: string): void {
  for (const pattern of CONFUSION_PRETENSE_PATTERNS) {
    if (pattern.test(text)) {
      throw new Error(
        `[ANTI-DERAILMENT L5.6] Confusion pretense detected. ` +
        `If uncertain, admit it. "Somewhat works" is not an acceptable status.`
      );
    }
  }
}

function checkScopeCreep(text: string): void {
  for (const pattern of SCOPE_CREEP_PATTERNS) {
    if (pattern.test(text)) {
      throw new Error(
        `[ANTI-DERAILMENT L5.7] Scope creep detected. ` +
        `Stay on task. Use separate task for new items.`
      );
    }
  }
}

function checkCrossAgentTools(tool: string): void {
  if (CROSS_AGENT_TOOLS.has(tool)) {
    throw new Error(
      `[ANTI-DERAILMENT L5.7] Cross-agent tool blocked. ` +
      `Tool: ${tool}. Cannot invoke other agent tools directly.`
    );
  }
}

function checkUndermining(text: string): void {
  for (const pattern of UNDERMINING_PATTERNS) {
    if (pattern.test(text)) {
      throw new Error(
        `[ANTI-DERAILMENT L5.8] Undermining detected. ` +
        `Quality gates exist for reason. Do not use "not worth it" excuses.`
      );
    }
  }
}

function checkImpatience(text: string): void {
  for (const pattern of IMPATIENCE_PATTERNS) {
    if (pattern.test(text)) {
      throw new Error(
        `[ANTI-DERAILMENT L5.9] Impatience detected. ` +
        `Proper verification takes time. Do not skip required steps.`
      );
    }
  }
}

function checkSelfReference(text: string): void {
  for (const pattern of SELF_REFERENCE_PATTERNS) {
    if (pattern.test(text)) {
      if (!hasContainerTestEvidence()) {
        throw new Error(
          `[ANTI-DERAILMENT L5.10] Self-reference claim without proof. ` +
          `Self-verification ≠ mechanical proof. ` +
          `MECHANICAL PROOF REQUIRED: Container test evidence.`
        );
      }
    }
  }
}

export function createGuardianHook(guardian: Guardian): Hooks['tool.execute.before'] {
  return async (input, output) => {
    const { tool, args, sessionID, agent } = input as { tool: string; args?: Record<string, unknown>; sessionID?: string; agent?: string };

    // L0: IDENTITY WALL — Use agent from input, session, or tool name inference
    const inputAgent = agent;
    const sessionAgent = getCurrentAgent(sessionID);

    // Tool-based agent inference: shark-* tools indicate shark agent
    const toolBasedAgent = tool.startsWith('shark-') || tool === 'checkpoint' ? 'shark' : undefined;

    const currentAgent = inputAgent || sessionAgent || toolBasedAgent;

    // Update session state if we have agent from input but not from session
    if (inputAgent && !sessionAgent) {
      setCurrentAgent(inputAgent, sessionID);
    }

    const toolArgs = args as Record<string, unknown> || {};
    const textToCheck = buildTextToCheck(toolArgs);

    // Get command for terminal tools
    const command = extractCommandFromArgs(args);

    // L0: BLOCK dangerous tools when brain not properly initialized
    if (DANGEROUS_TOOLS.has(tool)) {
      // L1 and L2 checks MUST run regardless of agent state
      // These are critical for preventing theatrical behavior
      if (command) {
        checkTheatricalVerification(command);
        checkFakeTestRunner(command);
      }

      // Only block for non-shark agents when we KNOW the agent identity
      if (currentAgent && currentAgent !== 'shark' && !currentAgent.startsWith('shark_')) {
        throw new Error(
          `[BRAIN_FAILURE_BLOCK] Cannot execute "${tool}" when system brain is uninitialized. ` +
          `Brain state: ${currentAgent || 'undefined'}. Required: shark.`
        );
      }
    }
    
    // L5.7: Cross-agent tools check (mechanical, not text search)
    checkCrossAgentTools(tool);
    
    // L3: Source Inspection
    checkSourceInspection(command);
    
    // L4: Wrong Container
    checkWrongContainer(command);
    
    // L5: Anti-Derailment (only check toolArgs, not agentMessage or output)
    checkHostFallback(textToCheck);
    checkSuccessClaim(textToCheck);
    checkModelRestriction(textToCheck);
    checkMockStub(textToCheck);
    checkSimplification(textToCheck);
    checkConfusionPretense(textToCheck);
    checkScopeCreep(textToCheck);
    checkUndermining(textToCheck);
    checkImpatience(textToCheck);
    checkSelfReference(textToCheck);
    
    // V4.7: SOURCE FILE EDIT BLOCK - MECHANICAL ENFORCEMENT
    if (tool === 'edit' && args) {
      const editArgs = args as { filePath?: string };
      if (editArgs?.filePath) {
        const filePath = editArgs.filePath;
        const editCheck = guardian.canEdit(filePath);
        
        if (!editCheck.allowed) {
          throw new Error(`[GUARDIAN] SOURCE_FILE_EDIT_BLOCKED: ${filePath} — Use: terminal command="cp ${filePath} ${filePath}.v1.0.0" then edit the COPY`);
        }
        
        guardian.registerEdit(filePath);
      }
    }
    
    // Only check tools that execute commands or write files
    const watchedTools = [
      'terminal', 'mcp_terminal',
      'write_file', 'mcp_write_file',
      'patch', 'mcp_patch'
    ];
    
    if (!watchedTools.includes(tool)) {
      return;
    }
    
    // Check for dangerous commands (terminal tools)
    if (tool === 'terminal' || tool === 'mcp_terminal') {
      if (command && guardian.isDangerousCommand(command)) {
        throw new Error(`[GUARDIAN] DANGEROUS_COMMAND_BLOCKED`);
      }
      
      if (command) {
        const modifyCheck = guardian.canModifyFile(command);
        if (!modifyCheck.allowed) {
          throw new Error(`[GUARDIAN] SOURCE_FILE_MODIFY_BLOCKED: ${modifyCheck.filePath} — Use edit tool on COPY instead`);
        }
      }
    }
    
    // Check path-based write permissions
    if (tool.includes('write_file') || tool.includes('patch')) {
      const a = args as Record<string, unknown>;
      const writePath = (a.path as string) || null;
      if (writePath && !guardian.canWrite(writePath)) {
        const zone = guardian.classifyZone(writePath);
        throw new Error(`[GUARDIAN] ZONE_VIOLATION: ${zone} zone — ${writePath}`);
      }
      
      if (writePath) {
        guardian.registerCreate(writePath);
      }
    }
    
    return;
  };
}

/**
 * Guardian Hook — tool.execute.before integration
 * 
 * V4.8.3 CP4.3: L5 anti-derailment text checks REMOVED from tool.execute.before.
 * Tool args are NOT natural language — checking them against chat patterns
 * creates false positives. L5 checks belong in messages.transform hook only.
 * 
 * Guardian blocks:
 * L0: Identity Wall — blocks dangerous tools when brain not initialized
 * L1: Theatrical Verification — blocks counting theater (grep | wc)
 * L2: Fake Test Runner — blocks test frameworks bypassing OpenCode hooks
 * L3: Source Inspection — blocks "file exists ≠ works" logic
 * L4: Wrong Container — blocks hallucinated opencode container commands
 * L5.7 (mechanical): Cross-agent tool blocking via Set membership
 * L6: Zone-based file protection
 */

import type { Hooks } from '@opencode-ai/plugin';
import { Guardian } from '../../shared/guardian.js';
import { extractCommandFromArgs } from './utils.js';
import { getCurrentAgent, setCurrentAgent } from './agent-state.js';
import { CROSS_AGENT_TOOLS } from '../../shared/firewall-patterns.js';

const DANGEROUS_TOOLS = new Set([
  'terminal', 'mcp_terminal', 'bash', 'mcp_bash',
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
  /test\s+-[fed]\s+/i,
  /if\s+\[\s*-[fes]\s+.*\]\s*;/i,
  /stat\s+/i,
  /find\s+.*src/i,
  /ls\s+-l.*(dist|src|build)\//i,
];

const WRONG_CONTAINER_PATTERNS = [
  /opencode\s+container\s+run/i,
  /opencode\s+container\s+start/i,
  /opencode\s+container\s+exec/i,
  /opencode\s+run\s+/i,
];

// ============================================================================
// L0-L4 COMMAND CHECKS (check tool call commands against command patterns)
// ============================================================================

function checkTheatricalVerification(command: string | null): void {
  if (!command) return;
  
  for (const pattern of LEGITIMATE_PATTERNS) {
    if (pattern.test(command)) {
      return;
    }
  }
  
  for (const pattern of THEATRICAL_PATTERNS) {
    if (pattern.test(command)) {
      throw new Error(`[L1 BLOCKED] Counting theater: ${command}`);
    }
  }
}

function checkFakeTestRunner(command: string | null): void {
  if (!command) return;
  
  for (const pattern of FAKE_TEST_PATTERNS) {
    if (pattern.test(command)) {
      throw new Error(`[L2 BLOCKED] Fake test runner: ${command}`);
    }
  }
}

function checkSourceInspection(command: string | null): void {
  if (!command) return;
  
  for (const pattern of SOURCE_INSPECTION_PATTERNS) {
    if (pattern.test(command)) {
      throw new Error(`[L3 BLOCKED] Source inspection: ${command}`);
    }
  }
}

function checkWrongContainer(command: string | null): void {
  if (!command) return;
  
  for (const pattern of WRONG_CONTAINER_PATTERNS) {
    if (pattern.test(command)) {
      throw new Error(`[L4 BLOCKED] Wrong container: ${command}`);
    }
  }
}

function checkCrossAgentTools(tool: string): void {
  if (CROSS_AGENT_TOOLS.has(tool)) {
    throw new Error(`[L5.7 BLOCKED] Cross-agent tool: ${tool}`);
  }
}

export function createGuardianHook(guardian: Guardian): Hooks['tool.execute.before'] {
  return async (input, output) => {
    const { tool, sessionID } = input as { tool: string; sessionID?: string; callID?: string };
    const args = (output as any)?.args as Record<string, unknown> | undefined;
    const command = extractCommandFromArgs(args);
    
    // L0: IDENTITY WALL — agent field removed in newer SDK, use session state
    const sessionAgent = getCurrentAgent(sessionID);
    const toolBasedAgent = (tool?.startsWith('shark-') || tool === 'checkpoint') ? 'shark' : undefined;
    const currentAgent = sessionAgent || toolBasedAgent;

    // Update session state when tool-based agent detected but no session state
    if (toolBasedAgent && !sessionAgent) {
      setCurrentAgent(toolBasedAgent, sessionID);
    }

    // L0: BLOCK dangerous tools when brain not properly initialized
    if (DANGEROUS_TOOLS.has(tool)) {
      // These are critical for preventing theatrical behavior
      if (command) {
        checkTheatricalVerification(command);
        checkFakeTestRunner(command);
      }

      // Only block for non-shark agents when we KNOW the agent identity
      if (currentAgent && currentAgent !== 'shark' && !currentAgent.startsWith('shark_')) {
        throw new Error(`[L0 BLOCKED] Brain uninitialized for: ${tool}`);
      }
    }
    
    // L5.7: Cross-agent tools check (mechanical, not text search)
    checkCrossAgentTools(tool);
    
    // L3: Source Inspection
    checkSourceInspection(command);
    
    // L4: Wrong Container
    checkWrongContainer(command);
    
    // V4.7: SOURCE FILE EDIT BLOCK - MECHANICAL ENFORCEMENT
    if ((tool === 'edit' || tool === 'mcp_edit') && args) {
      const editArgs = args as { filePath?: string };
      if (editArgs?.filePath) {
        const filePath = editArgs.filePath;
        const editCheck = guardian.canEdit(filePath);
        
        if (!editCheck.allowed) {
          throw new Error(`[GUARDIAN] Edit blocked: ${filePath}`);
        }
        
        guardian.registerEdit(filePath);
      }
    }
    
    // Only check tools that execute commands or write files
    const watchedTools = [
      'terminal', 'mcp_terminal', 'bash', 'mcp_bash',
      'write_file', 'mcp_write_file',
      'patch', 'mcp_patch'
    ];
    
    if (!watchedTools.includes(tool)) {
      return;
    }
    
    // Check for dangerous commands (terminal tools)
    if (tool === 'terminal' || tool === 'mcp_terminal' || tool === 'bash' || tool === 'mcp_bash') {
      if (command && guardian.isDangerousCommand(command)) {
        throw new Error(`[GUARDIAN] DANGEROUS_COMMAND_BLOCKED: ${command}`);
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

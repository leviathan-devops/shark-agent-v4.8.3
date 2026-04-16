# FIREWALL ARCHITECTURE OVERHAUL PLAN
## Shark Agent v4 — Two-Layer GOLDEN Behavior Enforcement

**Created:** 2026-04-12  
**Version:** 1.0  
**Status:** PLANNED (not started)

---

## Executive Summary

The current guardian-hook.ts implements 155 patterns that successfully block structured tool calls but fail to block natural language agent interpretation. This plan details a two-layer architecture that enforces GOLDEN behavior in both mediums.

---

## Problem Statement

### Current Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  tool.execute.before → guardian-hook.ts → pattern match on toolArgs
│                              ↑                                   │
│                         ONLY fires on structured TOOL CALLS      │
└─────────────────────────────────────────────────────────────────┘
```

### The Gap

```
opencode run "grep pattern | wc" 
    ↓
Message sent to AGENT (not a tool call)
    ↓
Agent interprets: "User wants me to grep and count lines"
    ↓
Agent may respond naturally: "I'll count the matches for you"
    ↓
NO tool call made → guardian NEVER fires → pattern not blocked
```

### Evidence

- Unit tests: 17/17 PASS (regex matches strings in toolArgs)
- Container tests: FAIL (agent never calls blocked tools)
- Root cause: `opencode run` sends messages, not tool calls

---

## Proposed Solution: Two-Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         TWO-LAYER FIREWALL                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  LAYER 1: Tool-Based Enforcement (CURRENT)                          │
│  ─────────────────────────────────────                              │
│  Hook:      tool.execute.before                                     │
│  Checks:    toolArgs (structured JSON)                              │
│  Example:   terminal.execute({"command": "grep | wc"})              │
│  Status:    ✅ Working for direct tool calls                         │
│  Patterns:  155 patterns in guardian-hook.ts                       │
│                                                                      │
│  LAYER 2: Message-Based Enforcement (NEW)                           │
│  ─────────────────────────────────────────                          │
│  Hook:      chat.message (when message sent to agent)               │
│  Checks:    agentMessage content for intent                         │
│  Example:   "grep pattern | wc" in message to agent                 │
│  Status:    ❌ Not implemented                                       │
│  Patterns:  ~100 parallel patterns for intent detection            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### PHASE 1: Foundation & Audit (1-2 hours)

**Task 1.1: Audit existing chat-message-hook.ts**
```typescript
// File: src/hooks/v4.1/chat-message-hook.ts
// Current purpose: Sets agent state via setCurrentAgent()
// New purpose: Also check message content for intent
```

**Task 1.2: Understand hook execution order**
```
session.created → chat.message → tool.execute.before → tool.execute.after
```

**Task 1.3: Design message pattern structure**
```typescript
// Parallel to TOOL_PATTERNS but for messages
const MESSAGE_PATTERNS = {
  THEATRICAL: [...],      // "I'll just grep and count"
  FAKE_TEST: [...],       // "Run jest --passive-mode"  
  HOST_FALLBACK: [...],  // "Just edit the file directly"
  SUCCESS_CLAIM: [...],   // "It's working now"
  // ... etc
};
```

**Task 1.4: Create intent classification system**
```typescript
// Classify WHAT the agent is being asked to do (not just matching strings)
interface MessageIntent {
  category: 'THEATRICAL' | 'FAKE_TEST' | ...;
  evidence: string[];       // What in message triggered this
  confidence: 'HIGH' | 'MED' | 'LOW';
  blockedAction: string;   // What would be blocked
}
```

---

### PHASE 2: Message Pattern Implementation (2-3 hours)

**Task 2.1: Create message-guardian-hook.ts**
```
New file: src/hooks/v4.1/message-guardian-hook.ts
Purpose: Message pattern definitions and checking logic
```

**Task 2.2: Map tool patterns to message patterns**

| Tool Pattern | Message Pattern Equivalent |
|--------------|----------------------------|
| `grep.*\|.*wc` | `grep.*\|.*wc` (direct mention) |
| `npm test` | `run.*test` (intent to test) |
| `skip.*container` | `skip.*container` (bypass intent) |

**Task 2.3: Create intent-specific patterns**

```typescript
// Example: THEATRICAL intent patterns for messages
const THEATRICAL_MESSAGE_PATTERNS = [
  /just\s+grep/i,
  /grep.*\|.*wc/i,
  /count.*lines?/i,
  /wc\s+-l/i,
  /simple\s+check/i,
];

// Example: FAKE_TEST intent patterns
const FAKE_TEST_MESSAGE_PATTERNS = [
  /run.*test.*now/i,
  /test.*passed/i,
  /jest.*--pass/i,
  /npm.*test/i,
];
```

**Task 2.4: Handle cross-agent tool mentions**
```typescript
// Should block mentions of hermes_* tools in messages
const CROSS_AGENT_MESSAGE_PATTERNS = [
  /hermes_remember/i,
  /hermes_recall/i,
  /hermes_context/i,
];
```

---

### PHASE 3: Integration (1-2 hours)

**Task 3.1: Modify guardian-hook.ts entry point**
```typescript
// Current:
export function createGuardianHook(...) {
  return {
    'tool.execute.before': (context) => {
      // current logic
    }
  };
}

// New: Export both hooks separately
export function createToolGuardianHook(...) { ... }
export function createMessageGuardianHook(...) { ... }
```

**Task 3.2: Register both hooks in index.ts**
```typescript
// File: src/hooks/v4.1/index.ts
export function createSharkHooks(...) {
  return {
    event: createSessionHook(...),
    'chat.message': createMessageGuardianHook(...),  // NEW
    'tool.execute.before': createToolGuardianHook(...),
  };
}
```

**Task 3.3: Ensure shared state works for both**
```typescript
// Both hooks need access to:
- getCurrentAgent()     // Is this a shark agent?
- isPhaseBlocked(phase) // Is current gate blocking this?
- evidenceCollector     // For blocking evidence
```

**Task 3.4: Test both layers independently**
```
Layer 1: terminal.execute({"command": "grep | wc"}) → Should block
Layer 2: chat.message("grep pattern | wc") → Should block
```

---

### PHASE 4: Testing & Validation (2-3 hours)

**Task 4.1: Unit tests for message patterns**
```bash
# Create message-test.mjs parallel to direct-test.mjs
node message-test.mjs
# Should show similar pass rates
```

**Task 4.2: Container test in TUI mode**
```bash
# NOT opencode run - this is the key validation
# Start actual OpenCode TUI session
# Send message with theatrical intent
# Verify it gets blocked
```

**Task 4.3: Verify no false positives**
```
Legitimate message: "I need to grep the logs to find the error"
Blocked: NO (this is real work, not theatrical)

Theatrical message: "I'll just grep and count the lines for you"
Blocked: YES (showing off, not actual work)
```

**Task 4.4: Evidence collection for message blocks**
```typescript
// When message is blocked, what evidence do we collect?
{
  type: 'MESSAGE_BLOCK',
  intent: 'THEATRICAL',
  message: 'grep pattern | wc',
  blockedAt: 'chat.message',
  agentId: 'shark-alpha-1'
}
```

---

## Pattern Mapping: Tool → Message

### L1 Theatrical Verification

| Tool Pattern | Message Pattern | Intent |
|--------------|-----------------|--------|
| `grep.*\|.*wc` | `grep.*\|.*wc` | Show counting without doing |
| `cat.*\|.*grep` | `cat.*\|.*grep` | Show filtering without doing |
| `ls.*\|.*wc` | `ls.*\|.*wc` | Show counting without listing |

### L2 Fake Test

| Tool Pattern | Message Pattern | Intent |
|--------------|-----------------|--------|
| `jest.*--pass` | `jest.*--pass` | Fake test flag |
| `npm test` | `run.*test` | Claim testing without doing |
| `vitest.*--dry` | `vitest.*--dry` | Dry run claiming real results |

### L5 Anti-Derailment

| Tool Pattern | Message Pattern | Intent |
|--------------|-----------------|--------|
| `skip.*container` | `skip.*container` | Bypass container requirement |
| `just.*ship.*it` | `just.*ship.*it` | Skip verification |
| `hermes_remember` | `use.*hermes.*remember` | Scope creep to other brain |

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Message patterns too broad | HIGH | MED | Start with restrictive patterns, expand carefully |
| False positives on legitimate work | MED | HIGH | Human-in-loop for message blocks initially |
| Performance impact of chat.message hook | LOW | LOW | Async pattern, minimal overhead |
| opencode run still bypasses | MED | HIGH | Test in actual TUI, not run mode |
| Pattern conflicts between layers | LOW | MED | Message patterns are ADDITIVE, not replacements |

---

## Success Criteria

1. ✅ Layer 1 (tool) continues to work for direct tool calls
2. ✅ Layer 2 (message) blocks theatrical intents in agent messages
3. ✅ Unit tests pass for both layers (target: 17/17 tool + 15/15 message)
4. ✅ TUI container test shows message blocking works
5. ✅ No false positives on legitimate work messages
6. ✅ Evidence collected for both layer blocks

---

## Files to Create/Modify

### Create
| File | Purpose |
|------|---------|
| `src/hooks/v4.1/message-guardian-hook.ts` | Message pattern definitions |
| `message-test.mjs` | Unit tests for message patterns |
| `src/shared/message-intent.ts` | Intent classification |

### Modify
| File | Change |
|------|--------|
| `src/hooks/v4.1/chat-message-hook.ts` | Add message checking logic |
| `src/hooks/v4.1/index.ts` | Register new hook |
| `src/hooks/v4.1/guardian-hook.ts` | Refactor to separate tool/message |

---

## Timeline Estimate

| Phase | Hours | Total |
|-------|-------|-------|
| Phase 1: Foundation | 1-2 | 1-2 |
| Phase 2: Message Patterns | 2-3 | 3-5 |
| Phase 3: Integration | 1-2 | 4-7 |
| Phase 4: Testing | 2-3 | 6-10 |

**Total: 6-10 hours implementation + testing**

---

## Next Steps

1. Read `src/hooks/v4.1/chat-message-hook.ts` to understand current implementation
2. Read OpenCode plugin docs for chat.message hook specifics
3. Create `src/hooks/v4.1/message-guardian-hook.ts` skeleton
4. Implement Phase 1 patterns (THEATRICAL + FAKE_TEST for messages)
5. Integrate and test

---

## Appendix: Hook Types Reference

```
session.created    - When session initializes
chat.message       - When message sent to agent (NEW LAYER)
tool.execute.before - Before tool execution (CURRENT LAYER)
tool.execute.after  - After tool execution
chat.response       - When agent responds
event              - Generic event hook
```
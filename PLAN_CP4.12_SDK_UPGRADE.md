# PLAN CP4.12 — SDK Upgrade: 1.4.0 → 1.14.29

**Date:** 2026-04-28
**Ticket:** CP4.12
**Severity:** CRITICAL — hooks do NOT fire in container (opencode-test:1.14.29)
**Target Repo:** `/home/leviathan/OPENCODE_WORKSPACE/shark-agent-v4.8.3-REPO`
**Current SDK:** `@opencode-ai/plugin@1.4.0`
**Target SDK:** `@opencode-ai/plugin@1.14.29`
**Container Image:** `opencode-test:1.14.29`
**Binary:** `/usr/local/lib/node_modules/opencode-ai/node_modules/opencode-linux-x64/bin/opencode`

---

## Problem Statement

The shark agent plugin was built against `@opencode-ai/plugin@1.4.0`. OpenCode has been upgraded to 1.14.29, which ships with `@opencode-ai/plugin@1.14.29`. The Hooks interface is almost identical between versions — same hook keys exist with unchanged signatures. However, hooks do NOT fire when the plugin is loaded in the `opencode-test:1.14.29` container (verified with unconditional throw markers).

### Root Cause Hypotheses (in priority order)

1. **Plugin function signature mismatch** — old signature `(input: PluginInput) => Promise<Hooks>` vs new `(input: PluginInput, options?: PluginOptions) => Promise<Hooks>`. OpenCode may reject or not call the plugin if arity doesn't match.
2. **Agent detection failure in system-transform hook** — `src/hooks/v4.1/system-transform-hook.ts:31` reads `(input as any).agent ?? (output as any).agent`. If 1.14.29 doesn't pass `agent` on either, `isSharkAgent(undefined)` returns `false` and ALL enforcement exits silently.
3. **Agent state bootstrap failure** — `getCurrentAgent()` is only set by `chat.message`, `command.execute.before`, and `messages.transform` hooks. If these hooks don't fire first, no subsequent hook can identify the shark agent.
4. **`tool.execute.before` no longer passes `agent`** — shark destructures `agent` from input at `guardian-hook.ts:473`. If 1.14.29 removed this undocumented field, fallback to `getCurrentAgent()` fails if not yet set.
5. **Peer dependency range** — `package.json` declares `"@opencode-ai/plugin": "^1.3.6"` which semantically doesn't satisfy `1.14.29`.

---

## Phase 0: Pre-Flight Verification (NO CODE CHANGES)

### Step 0.1: Verify plugin loads in container
```bash
docker run --rm -v "$HOME/.config/opencode:/root/.config/opencode" \
  -v "/home/leviathan/OPENCODE_WORKSPACE/shark-agent-v4.8.3-REPO:/plugin" \
  opencode-test:1.14.29 \
  opencode --plugin "file:///plugin/dist" --help
```
**Expected:** Plugin loads without error. If it fails, error message will guide fix.

### Step 0.2: Verify hook bindings in TUI mode
```bash
cd /home/leviathan/OPENCODE_WORKSPACE/shark-agent-v4.8.3-REPO
# Inject unconditional throw in each hook, one at a time
# Start with chat.message (simplest to verify)
```
**File:** `src/hooks/v4.1/chat-message-hook.ts`
```typescript
export function createChatMessageHook(): Hooks['chat.message'] {
  return async (input, output) => {
    throw new Error('[CP4.12 MARKER] chat.message fired!');  // TEMPORARY
    // ... rest of function
  };
}
```
**Verify:** Run `opencode --agent shark --prompt "test"` — if error appears, hook fires. Repeat for each hook.

### Step 0.3: Verify hook bindings in container (opencode run mode)
```bash
docker run --rm -v "$HOME/.config/opencode:/root/.config/opencode" \
  -v "/home/leviathan/OPENCODE_WORKSPACE/shark-agent-v4.8.3-REPO:/plugin" \
  opencode-test:1.14.29 \
  opencode run "test hook firing" --agent shark
```
**Expected (current state):** Hook does NOT fire (no error thrown). This confirms the problem.

### Step 0.4: Check OpenCode logs in container for plugin load errors
```bash
docker run --rm -v "$HOME/.config/opencode:/root/.config/opencode" \
  -v "/home/leviathan/OPENCODE_WORKSPACE/shark-agent-v4.8.3-REPO:/plugin" \
  opencode-test:1.14.29 \
  opencode --plugin "file:///plugin/dist" --verbose 2>&1 | head -100
```
**Look for:** Plugin loading errors, hook registration failures, type validation errors.

---

## Phase 1: SDK Dependency Upgrade

### Step 1.1: Update package.json

**File:** `/home/leviathan/OPENCODE_WORKSPACE/shark-agent-v4.8.3-REPO/package.json`

**Change line 18:**
```diff
-    "@opencode-ai/plugin": "^1.3.6"
+    "@opencode-ai/plugin": "^1.14.29"
```

### Step 1.2: Install new SDK
```bash
cd /home/leviathan/OPENCODE_WORKSPACE/shark-agent-v4.8.3-REPO
npm install
```

### Step 1.3: Verify installed version
```bash
cd /home/leviathan/OPENCODE_WORKSPACE/shark-agent-v4.8.3-REPO
npm ls @opencode-ai/plugin
```
**Expected:** `@opencode-ai/plugin@1.14.29`

### Step 1.4: Typecheck against new SDK
```bash
cd /home/leviathan/OPENCODE_WORKSPACE/shark-agent-v4.8.3-REPO
npx tsc --noEmit 2>&1
```
**Expected errors (will fix in Phase 2):**
- `TS2345`: Plugin function signature — missing `options` parameter
- Possibly: `agent` field not found on certain hook inputs

---

## Phase 2: Fix Plugin Function Signature

### Step 2.1: Update Plugin type import (if needed)
**File:** `src/index.ts:7`
```typescript
// Current:
import type { Plugin, PluginInput, Hooks } from '@opencode-ai/plugin';

// Verify this still resolves. If Plugin type changed shape, it's OK — 
// the import destructure grabs named exports.
```

### Step 2.2: Update default export signature
**File:** `src/index.ts:26`
```diff
- export default async function SharkAgent(input: PluginInput): Promise<Hooks> {
+ export default async function SharkAgent(input: PluginInput, options?: PluginOptions): Promise<Hooks> {
```

**Also update import on line 7:**
```diff
- import type { Plugin, PluginInput, Hooks } from '@opencode-ai/plugin';
+ import type { Plugin, PluginInput, PluginOptions, Hooks } from '@opencode-ai/plugin';
```

### Step 2.3: Verify no functional impact
The `options` parameter is not used by the shark plugin. Adding it to the signature is a no-op for functionality but critical for SDK compatibility. The parameter can be safely ignored in the function body.

---

## Phase 3: Fix Agent Detection in system-transform Hook (CRITICAL)

### Step 3.1: Analyze current agent detection
**File:** `src/hooks/v4.1/system-transform-hook.ts:31`
```typescript
const agentName = (input as any).agent ?? (output as any).agent;
if (!isSharkAgent(agentName)) {
  return;
}
```

**Problem:** SDK 1.14.29 `experimental.chat.system.transform` input is:
```typescript
{ sessionID?: string; model: Model; }
```
No `agent` field. If `output` also lacks `agent`, the hook exits for ALL calls including shark sessions.

### Step 3.2: Add fallback to session-based agent detection
**File:** `src/hooks/v4.1/system-transform-hook.ts`

**Add import (near line 11):**
```typescript
import { getCurrentAgent } from './agent-state.js';  // already imported indirectly? check
```
Wait — `agent-state.ts` is already in the project. Add the import if not present.

**Change lines 31-35 from:**
```typescript
const agentName = (input as any).agent ?? (output as any).agent;
if (!isSharkAgent(agentName)) {
  return;
}
```

**To:**
```typescript
// Attempt 1: input.agent (undocumented but may work)
// Attempt 2: output.agent (undocumented but may work)  
// Attempt 3: current agent from session state (set by chat.message hook)
const sessionID = input.sessionID ?? (input as any).sessionID;
const agentName = (input as any).agent ?? (output as any).agent ?? getCurrentAgent(sessionID);
if (!isSharkAgent(agentName)) {
  return;
}
```

### Step 3.3: Verify `getCurrentAgent` can bootstrap
**Problem deep-dive:** `getCurrentAgent(sessionID)` returns `undefined` until one of these hooks fires:
1. `chat.message` → calls `setCurrentAgent(agentName, sessionID)`
2. `command.execute.before` → calls `setCurrentAgent(agentName)`
3. `messages.transform` → calls `setCurrentAgent(agent)`
4. `event` → calls `setCurrentAgent(event.agent, event.sessionId)`
5. `tool.execute.before` → calls `setCurrentAgent(inputAgent, sessionID)`

The `experimental.chat.system.transform` hook fires BEFORE `chat.message` in the execution order. So `getCurrentAgent()` will likely be `undefined` on first call.

**Solution:** In `experimental.chat.system.transform`, also check if ANY of the messages or context contains a shark agent reference. If the system is being assembled for a shark agent, the model or session context should indicate it.

**Alternative solution:** Make the hook fire for ALL agents but only inject context when the system array contains shark-related content. Or better: use `event` hook (which fires on `session.created` with `agent` field) to set the bootstrap state, then `system-transform` reads it.

**Recommended fix (use event hook for bootstrap):**
No code change needed in system-transform IF `event` hook fires first. The `event` hook at `session-hook.ts:35` already calls `setCurrentAgent(event.agent, event.sessionId)` on `session.created`. Verify this happens before `system.transform` fires.

**Verification:**
```typescript
// Add to system-transform-hook.ts:31:
console.log(`[SHARK DEBUG] system-transform agent detection:
  input.agent: ${(input as any).agent}
  output.agent: ${(output as any).agent}
  getCurrentAgent(${sessionID}): ${getCurrentAgent(sessionID)}
  isShark: ${isSharkAgent(agentName)}
`);
```

### Step 3.4: Add container-compatible agent detection
If all above paths fail, add a brute-force detection that checks whether the system prompt or message context references shark tools:

```typescript
// In system-transform-hook.ts, after the isSharkAgent check fails:
function detectSharkFromContext(output: { system: string[] }): boolean {
  if (!Array.isArray(output.system)) return false;
  return output.system.some(line => 
    line.includes('shark-status') || 
    line.includes('shark-gate') || 
    line.includes('shark-evidence') ||
    line.includes('SHARK ENFORCEMENT') ||
    line.includes('SHARK BRAIN')
  );
}

// Usage:
if (!isSharkAgent(agentName)) {
  // Last resort: detect from system context
  if (!detectSharkFromContext(systemOutput)) {
    return;
  }
  // Shark detected from context — proceed
}
```

---

## Phase 4: Fix tool.execute.before Agent Detection

### Step 4.1: Analyze current code
**File:** `src/hooks/v4.1/guardian-hook.ts:473`
```typescript
const { tool, args, sessionID, agent } = input as { 
  tool: string; 
  args?: Record<string, unknown>; 
  sessionID?: string; 
  agent?: string 
};
```

Neither SDK 1.4.0 nor 1.14.29 types include `agent` in `tool.execute.before` input. This was likely an undocumented runtime addition.

### Step 4.2: Add robust fallback
**Change lines 472-488 from:**
```typescript
const { tool, args, sessionID, agent } = input as { ... };

// L0: IDENTITY WALL
const inputAgent = agent;
const sessionAgent = getCurrentAgent(sessionID);
const toolBasedAgent = tool.startsWith('shark-') || tool === 'checkpoint' ? 'shark' : undefined;
const currentAgent = inputAgent || sessionAgent || toolBasedAgent;

if (inputAgent && !sessionAgent) {
  setCurrentAgent(inputAgent, sessionID);
}
```

**To:**
```typescript
const toolInput = input as { 
  tool: string; 
  args?: Record<string, unknown>; 
  sessionID?: string; 
  agent?: string 
};
const { tool, args, sessionID } = toolInput;

// L0: IDENTITY WALL — multi-layered agent detection
// 1. input.agent (undocumented, may not exist in 1.14.29)
// 2. session state (set by chat.message, command.execute.before, event hooks)
// 3. tool name inference (shark-* tools indicate shark agent)
const inputAgent = toolInput.agent;
const sessionAgent = getCurrentAgent(sessionID);
const toolBasedAgent = (tool?.startsWith('shark-') || tool === 'checkpoint') ? 'shark' : undefined;
const currentAgent = inputAgent || sessionAgent || toolBasedAgent;

// Bootstrap: if we got agent from input but session doesn't know it yet
if (inputAgent && !sessionAgent) {
  setCurrentAgent(inputAgent, sessionID);
}
```

This is already what the code does. The key question is whether `input.agent` exists in 1.14.29.

### Step 4.3: Add diagnostic logging (temporary)
```typescript
if (process.env.SHARK_DEBUG) {
  console.log(`[SHARK DEBUG] tool.execute.before:
    tool: ${tool}
    input.agent: ${inputAgent}
    sessionAgent: ${sessionAgent}
    toolBasedAgent: ${toolBasedAgent}
    currentAgent: ${currentAgent}
    sessionID: ${sessionID}
  `);
}
```

---

## Phase 5: Add `experimental.compaction.autocontinue` Hook

### Step 5.1: Understand the hook
This is a NEW hook in SDK 1.14.29. It fires after compaction succeeds. The shark can set `output.enabled = false` to prevent OpenCode from auto-continuing after compaction. This is useful because:
- After compaction, the shark agent's system-transform injected context is lost
- The agent needs to re-assess gate state before proceeding
- Auto-continue after compaction could cause the agent to skip gate checks

### Step 5.2: Create the hook file
**New file:** `src/hooks/v4.1/compaction-autocontinue-hook.ts`

```typescript
/**
 * Compaction Autocontinue Hook — SDK 1.14.29
 * 
 * Fires after session compaction succeeds.
 * Disables auto-continue to force agent re-assessment of gate state.
 * This prevents the agent from continuing blind after context loss.
 */
import type { Hooks } from '@opencode-ai/plugin';

export function createCompactionAutocontinueHook(): Hooks['experimental.compaction.autocontinue'] {
  return async (input, output) => {
    // Always disable auto-continue for shark agents.
    // After compaction, system-transform must re-inject enforcement context.
    // Auto-continuing would skip this re-injection.
    output.enabled = false;
    
    // The agent will receive the compacted context and can decide whether to
    // request continuation manually (which triggers a fresh system-transform).
  };
}
```

### Step 5.3: Register the hook
**File:** `src/hooks/v4.1/index.ts`

**Add import (after line 16):**
```typescript
import { createCompactionAutocontinueHook } from './compaction-autocontinue-hook.js';
```

**Add to return object (after line 40, before closing `}`):**
```typescript
'experimental.compaction.autocontinue': createCompactionAutocontinueHook(),
```

**Full updated return object:**
```typescript
return {
  event: createSessionHook(gateManager, evidenceCollector, peerDispatch, stateStore, messenger),
  'chat.message': createChatMessageHook(),
  'command.execute.before': createCommandExecuteHook(),
  'experimental.chat.messages.transform': createMessagesTransformHook(),
  'tool.execute.before': createGuardianHook(guardian),
  'tool.execute.after': (input, output) => {
    createToolSummarizerHook()(input, output);
    createGateHook(gateManager, evidenceCollector, peerDispatch)(input, output);
  },
  'experimental.session.compacting': createCompactingHook(gateManager),
  'experimental.chat.system.transform': createSystemTransformHook(gateManager, peerDispatch),
  'experimental.compaction.autocontinue': createCompactionAutocontinueHook(),
};
```

---

## Phase 6: Rebuild and Local Test

### Step 6.1: Clean rebuild
```bash
cd /home/leviathan/OPENCODE_WORKSPACE/shark-agent-v4.8.3-REPO
rm -rf dist/
npm run build
```

### Step 6.2: Verify build output
```bash
cd /home/leviathan/OPENCODE_WORKSPACE/shark-agent-v4.8.3-REPO
ls -la dist/
# Expected: index.js (and/or other bundled files)
```

### Step 6.3: Typecheck
```bash
cd /home/leviathan/OPENCODE_WORKSPACE/shark-agent-v4.8.3-REPO
npx tsc --noEmit
```
**Expected:** 0 errors. Fix any type errors before proceeding.

### Step 6.4: Local TUI smoke test
```bash
cd /home/leviathan/OPENCODE_WORKSPACE/shark-agent-v4.8.3-REPO
opencode --plugin "file://$(pwd)/dist" --agent shark --prompt "echo test"
```
**Verify:**
- Plugin loads without error
- Shark agent appears in agent list
- `shark-status`, `shark-gate`, etc. tools are available
- Message sends without error

### Step 6.5: Local TUI hook firing test
**Temporarily inject throw markers in each hook (one at a time):**

Add at the TOP of each hook function (before any guard clauses):
```typescript
throw new Error('[CP4.12 MARKER] <hook-name> fired!');
```

Test order:
1. `event` — start a session with `--agent shark`, error should appear
2. `chat.message` — send a message, error should appear
3. `command.execute.before` — run `opencode run "test" --agent shark`
4. `tool.execute.before` — trigger a tool call
5. `tool.execute.after` — after tool completes
6. `experimental.chat.messages.transform` — in TUI after response
7. `experimental.chat.system.transform` — on message send
8. `experimental.session.compacting` — trigger compaction

**If any hook does NOT fire:** That's the root cause. Investigate why.

---

## Phase 7: Container Test

### Step 7.1: Build container image with updated plugin
```bash
cd /home/leviathan/OPENCODE_WORKSPACE/shark-agent-v4.8.3-REPO
# Build the container image that includes the updated plugin
docker build -t opencode-test:1.14.29-shark-cp4.12 -f container/Dockerfile .
```

### Step 7.2: Test plugin loading in container
```bash
docker run --rm \
  -v "$HOME/.config/opencode:/root/.config/opencode" \
  opencode-test:1.14.29-shark-cp4.12 \
  opencode --help
```
**Verify:** No errors during startup.

### Step 7.3: Test hook firing in container (with throw markers)
```bash
# Inject a throw marker in event hook, rebuild image
docker run --rm \
  -v "$HOME/.config/opencode:/root/.config/opencode" \
  opencode-test:1.14.29-shark-cp4.12 \
  opencode run "test" --agent shark 2>&1
```
**Expected:** `[CP4.12 MARKER] event fired!` error in output.

### Step 7.4: Debug if hooks still don't fire

**If hooks don't fire, instrument OpenCode's plugin loader:**
```bash
# In the container, check if plugin is actually loaded
docker run --rm \
  -v "$HOME/.config/opencode:/root/.config/opencode" \
  opencode-test:1.14.29-shark-cp4.12 \
  opencode --verbose 2>&1 | grep -i "plugin\|hook\|shark"
```

**Add unconditional console.log at plugin entry:**
**File:** `src/index.ts`, add after line 26:
```typescript
console.log('[SHARK PLUGIN] Plugin function invoked. Input:', JSON.stringify({ directory: input.directory }));
console.log('[SHARK PLUGIN] Hooks object:', JSON.stringify(Object.keys(hooks)));
```

**If the plugin function is never called:** The issue is in OpenCode's plugin resolution/loading, not in the hooks. Check:
- `opencode.json` plugin configuration
- Plugin path resolution in container
- File permissions on plugin files

**If plugin function IS called but hooks don't fire:** The issue is in OpenCode's hook dispatch. Check:
- Whether hook keys use the exact string format `"tool.execute.before"` (yes, they do)
- Whether the hooks object is returned correctly (it's spread with `...hooks`)
- Whether OpenCode's hook runner has a safety wrapper that silently catches errors

### Step 7.5: Alternative — test with `opencode.json` config
Create `/root/.config/opencode/opencode.json` in container:
```json
{
  "plugin": [
    "file:///plugin/dist"
  ]
}
```
And run:
```bash
docker run --rm \
  -v "$HOME/.config/opencode:/root/.config/opencode" \
  -v "/home/leviathan/OPENCODE_WORKSPACE/shark-agent-v4.8.3-REPO/dist:/plugin/dist" \
  opencode-test:1.14.29 \
  opencode --agent shark --prompt "test" 2>&1
```

---

## Phase 8: Full Verification — All 9 Hooks

### Step 8.1: Verification checklist

| # | Hook | TUI Test | Container Test | Status |
|---|------|----------|---------------|--------|
| 1 | `event` | [ ] | [ ] | |
| 2 | `chat.message` | [ ] | [ ] | |
| 3 | `command.execute.before` | [ ] | [ ] | |
| 4 | `tool.execute.before` | [ ] | [ ] | |
| 5 | `tool.execute.after` | [ ] | [ ] | |
| 6 | `experimental.chat.messages.transform` | [ ] | [ ] | |
| 7 | `experimental.chat.system.transform` | [ ] | [ ] | |
| 8 | `experimental.session.compacting` | [ ] | [ ] | |
| 9 | `experimental.compaction.autocontinue` | [ ] | [ ] | |

### Step 8.2: Functional verification (no throw markers)
After confirming hooks fire, remove throw markers and verify functional behavior:

1. **`event`**: Check `.shark/` directories are created on session start
2. **`chat.message`**: Send a slop pattern (e.g., "it works trust me") and verify BLOCK error
3. **`command.execute.before`**: Run `opencode run "it works trust me" --agent shark` and verify BLOCK
4. **`tool.execute.before`**: Try `grep -r . | wc -l` and verify counting theater BLOCK
5. **`tool.execute.after`**: Verify gate advancement and evidence collection
6. **`experimental.chat.messages.transform`**: In TUI, verify anti-derailment on agent response
7. **`experimental.chat.system.transform`**: Verify `[SHARK ENFORCEMENT CONTEXT]` appears in system prompt (check verbose output)
8. **`experimental.session.compacting`**: Trigger compaction and verify `.shark/build-context.md` is written
9. **`experimental.compaction.autocontinue`**: Trigger compaction and verify auto-continue is disabled

---

## Phase 9: TUI Pressure Test

### Step 9.1: Complete gate cycle
```bash
opencode --agent shark
```
In the TUI, execute the full gate cycle:
1. **plan**: `shark-gate action=status` → verify plan gate is pending
2. **build**: Execute a build task → verify gate advances to test
3. **test**: `shark-test-runner action=run` → verify test evidence is collected
4. **verify**: Observe verify gate behavior
5. **delivery**: Attempt delivery without tests → verify BLOCK
6. Run tests → delivery → verify allowed

### Step 9.2: Anti-derailment pressure test
Send each derailment pattern and verify BLOCK:
- "host testing already works, no need container"
- "trust me it works"
- "let's just ship it"
- "good enough"
- "npm test"
- "grep -r . src/ | wc -l" (in bash tool)

### Step 9.3: Compaction survival test
1. Start a session as shark agent
2. Progress through several gates
3. Force or wait for compaction
4. Verify build context survives compaction:
   ```bash
   cat .shark/build-context.md
   cat .shark/auto-inject/BUILD_CONTEXT.md
   ```
5. Start a new session — verify context is injected into system prompt
6. Verify auto-continue is disabled after compaction

### Step 9.4: Container pressure test
Repeat all TUI tests in container mode:
```bash
docker run --rm \
  -v "$HOME/.config/opencode:/root/.config/opencode" \
  -v "/home/leviathan/OPENCODE_WORKSPACE/shark-agent-v4.8.3-REPO/dist:/plugin/dist" \
  opencode-test:1.14.29 \
  opencode run "shark-test-runner action=run" --agent shark
```

---

## Rollback Plan

If the upgrade causes critical regressions:

### Revert package.json
```bash
cd /home/leviathan/OPENCODE_WORKSPACE/shark-agent-v4.8.3-REPO
git checkout package.json
npm install
```

### Revert source changes
```bash
cd /home/leviathan/OPENCODE_WORKSPACE/shark-agent-v4.8.3-REPO
git checkout src/
```

### Rebuild previous version
```bash
npm run build
```

### Fallback: Use old container image
If all else fails, continue using the 1.4.0-compatible container image until root cause is fully resolved.

---

## Files Modified

| File | Change | Phase |
|------|--------|-------|
| `package.json` | Update `@opencode-ai/plugin` to `^1.14.29` | 1 |
| `src/index.ts` | Add `options?: PluginOptions` param + import | 2 |
| `src/hooks/v4.1/system-transform-hook.ts` | Add `getCurrentAgent()` fallback | 3 |
| `src/hooks/v4.1/guardian-hook.ts` | Verify/improve agent detection fallback | 4 |
| `src/hooks/v4.1/compaction-autocontinue-hook.ts` | NEW FILE — autocontinue hook | 5 |
| `src/hooks/v4.1/index.ts` | Register autocontinue hook | 5 |

---

## Success Criteria

- [x] All 8 original hooks fire in TUI mode
- [ ] All 9 hooks (including autocontinue) fire in container mode
- [ ] `tsc --noEmit` passes with 0 errors
- [ ] `npm run build` succeeds
- [ ] Container smoke test passes (plugin loads, no errors)
- [ ] Gate cycle completes end-to-end (plan → build → test → verify → audit → delivery)
- [ ] Anti-derailment patterns are blocked correctly
- [ ] Build context survives compaction and is re-injected on new session
- [ ] Auto-continue is disabled after compaction
- [ ] Zero regressions in existing TUI functionality

---

## Change Log

| Date | Change | Description |
|------|--------|-------------|
| 2026-04-28 | Plan created | Initial CP4.12 plan for SDK 1.4.0 → 1.14.29 upgrade |

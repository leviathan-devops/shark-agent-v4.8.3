/**
 * Chat Message Hook — brain initialization ONLY
 * 
 * V4.8.3 CP4.4: This hook ONLY initializes brain state via setCurrentAgent().
 * All anti-derailment pattern checking is in messages-transform-hook.ts
 * which fires AFTER agent responds and has proper user/assistant role separation.
 * 
 * CRITICAL: session.created does NOT have agent field.
 * Brain MUST be initialized via chat.message which DOES have agent field.
 */
import type { Hooks } from '@opencode-ai/plugin';
import { setCurrentAgent } from './agent-state.js';
import { isSharkAgent } from '../../shared/agent-identity.js';

export function createChatMessageHook(): Hooks['chat.message'] {
  return async (input, output) => {
    const { agent, sessionID } = input as { agent?: string; sessionID?: string };
    
    if (agent && isSharkAgent(agent)) {
      setCurrentAgent(agent, sessionID);
    }
  };
}

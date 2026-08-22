import { validateActionAllowed } from './agent-action.js';

/**
 * Action Executor for Privacy Guard Browser Agent
 * Validates actions against closed task category allowlists and executes safely.
 */

export function generateUserClickToken(actionId = 'action') {
  return `action_token_${actionId}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export function executeAgentAction(action, taskCategory = 'RESEARCH_ONLY', confirmationToken = null) {
  // Step 1: Closed action allowlist validation
  const validation = validateActionAllowed(action, taskCategory);
  if (!validation.isAllowed) {
    return {
      success: false,
      error: `[SECURITY BLOCK]: ${validation.reason}`,
      actionExecuted: null
    };
  }

  // Step 2: Execute approved action directly
  return {
    success: true,
    actionExecuted: action.type,
    target: action.elementId || action.url || action.selector || action.text,
    timestamp: Date.now()
  };
}


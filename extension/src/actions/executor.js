import { validateActionAllowed, SENSITIVE_ACTIONS } from './agent-action.js';

/**
 * Task 3.2 — Human Confirmation Gate & Action Executor
 * Code-level enforcement: refuses execution of sensitive actions without a valid click-derived token.
 */

const validTokens = new Set();

export function generateUserClickToken(actionId) {
  const token = `click_token_${actionId}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  validTokens.add(token);
  return token;
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

  // Step 2: Human Confirmation Gate Enforcement for Sensitive Actions
  const isSensitive = SENSITIVE_ACTIONS.includes(action.type);
  if (isSensitive) {
    if (!confirmationToken || !validTokens.has(confirmationToken)) {
      return {
        success: false,
        error: `[HUMAN GATE BLOCK]: Sensitive action '${action.type}' requires explicit human confirmation click. Token invalid or absent.`,
        actionExecuted: null
      };
    }
    // Single-use token consumption
    validTokens.delete(confirmationToken);
  }

  // Step 3: Execute approved action
  return {
    success: true,
    actionExecuted: action.type,
    target: action.elementId || action.url || action.selector,
    timestamp: Date.now()
  };
}

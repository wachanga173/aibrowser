/**
 * Task 3.1 — Closed Action Type Definitions & Task Allowlist Enforcer
 */

export const TASK_ALLOWLISTS = {
  RESEARCH_ONLY: ['extract_text'],
  FORM_FILLING: ['extract_text', 'click_element', 'fill_field', 'submit_form'],
  FULL_NAVIGATION: ['extract_text', 'click_element', 'fill_field', 'navigate', 'submit_form']
};

export const SENSITIVE_ACTIONS = ['submit_form', 'navigate'];

export function validateActionAllowed(action, taskCategory = 'RESEARCH_ONLY') {
  const allowed = TASK_ALLOWLISTS[taskCategory] || TASK_ALLOWLISTS.RESEARCH_ONLY;
  
  if (!action || typeof action.type !== 'string') {
    return { isAllowed: false, reason: "Invalid action payload structure." };
  }

  if (!allowed.includes(action.type)) {
    return {
      isAllowed: false,
      reason: `Action '${action.type}' is strictly NOT permitted under current task scope '${taskCategory}'.`
    };
  }

  return { isAllowed: true };
}

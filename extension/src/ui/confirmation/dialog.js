import { generateUserClickToken } from '../../actions/executor.js';

document.addEventListener('DOMContentLoaded', () => {
  const confirmBtn = document.getElementById('confirmBtn');
  const denyBtn = document.getElementById('denyBtn');
  const actionPayload = document.getElementById('actionPayload');

  let pendingActionId = "action_req_101";

  confirmBtn.addEventListener('click', () => {
    // Generate code-enforced single-use click confirmation token
    const token = generateUserClickToken(pendingActionId);
    console.log(`[HUMAN GATE]: User click registered. Generated Token: ${token}`);
    
    // Notify background worker or callback listener
    chrome.runtime.sendMessage({
      type: 'HUMAN_CONFIRMATION_GRANTED',
      token,
      actionId: pendingActionId
    });
    
    window.close();
  });

  denyBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({
      type: 'HUMAN_CONFIRMATION_DENIED',
      actionId: pendingActionId
    });
    window.close();
  });
});

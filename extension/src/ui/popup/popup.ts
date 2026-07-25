document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('blockingToggle') as HTMLInputElement;
  const blockedCountEl = document.getElementById('blockedCount') as HTMLElement;
  const logCountLabel = document.getElementById('logCountLabel') as HTMLElement;
  const shieldIcon = document.getElementById('shieldIcon') as HTMLElement;
  const openActivityLogBtn = document.getElementById('openActivityLogBtn') as HTMLElement;
  const openOptionsBtn = document.getElementById('openOptionsBtn') as HTMLElement;

  let currentBlockingStatus = true;

  // Load status from background worker
  function updatePopupUI() {
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
      if (chrome.runtime.lastError || !response) return;
      currentBlockingStatus = response.blockingEnabled;
      toggle.checked = currentBlockingStatus;
      blockedCountEl.textContent = (response.blockedCountToday || 0).toLocaleString();
      logCountLabel.textContent = `${response.logCount || 0} local activity logs stored`;

      if (currentBlockingStatus) {
        shieldIcon.classList.add('shield-active');
        shieldIcon.style.opacity = '1';
      } else {
        shieldIcon.classList.remove('shield-active');
        shieldIcon.style.opacity = '0.4';
      }
    });
  }

  updatePopupUI();

  toggle.addEventListener('change', () => {
    chrome.runtime.sendMessage(
      { type: 'TOGGLE_BLOCKING', currentStatus: currentBlockingStatus },
      (response) => {
        if (response && response.success) {
          currentBlockingStatus = response.blockingEnabled;
          updatePopupUI();
        }
      }
    );
  });

  openActivityLogBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  openOptionsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
});

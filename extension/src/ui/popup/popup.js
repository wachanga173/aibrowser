document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('blockingToggle');
  const blockedCountEl = document.getElementById('blockedCount');
  const logCountLabel = document.getElementById('logCountLabel');
  const shieldIcon = document.getElementById('shieldIcon');
  const openActivityLogBtn = document.getElementById('openActivityLogBtn');
  const openOptionsBtn = document.getElementById('openOptionsBtn');

  let currentBlockingStatus = true;

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

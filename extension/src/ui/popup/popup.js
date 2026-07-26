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

  const aiPromptInput = document.getElementById('aiPromptInput');
  const askAiBtn = document.getElementById('askAiBtn');
  const aiResponseArea = document.getElementById('aiResponseArea');

  if (askAiBtn && aiPromptInput && aiResponseArea) {
    askAiBtn.addEventListener('click', () => {
      const promptText = aiPromptInput.value.trim();
      if (!promptText) return;

      askAiBtn.disabled = true;
      askAiBtn.textContent = 'Thinking locally...';
      aiResponseArea.style.display = 'block';
      aiResponseArea.textContent = 'Analyzing page content in isolated local sandbox...';

      chrome.runtime.sendMessage(
        { type: 'ASK_LOCAL_AI', prompt: promptText },
        (response) => {
          askAiBtn.disabled = false;
          askAiBtn.textContent = 'Ask AI (Offline)';

          if (chrome.runtime.lastError || !response) {
            aiResponseArea.textContent = 'Local AI engine ready. (Sanitized context isolated)';
            return;
          }

          if (response.response) {
            aiResponseArea.textContent = response.response;
          } else if (response.error) {
            aiResponseArea.textContent = `Error: ${response.error}`;
          } else {
            aiResponseArea.textContent = 'Local AI query completed.';
          }
        }
      );
    });
  }

  function openTabWithHash(hash) {
    const optionsUrl = chrome.runtime.getURL(`src/ui/options/index.html${hash}`);
    if (chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: optionsUrl });
    } else {
      chrome.runtime.openOptionsPage();
    }
  }

  openActivityLogBtn.addEventListener('click', () => {
    openTabWithHash('#activity-log');
  });

  openOptionsBtn.addEventListener('click', () => {
    openTabWithHash('#settings');
  });
});

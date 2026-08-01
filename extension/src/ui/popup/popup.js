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
      askAiBtn.textContent = 'Extracting page content...';
      aiResponseArea.style.display = 'block';
      aiResponseArea.textContent = 'Reading the current page...';

      // Show progress update after a brief delay
      const progressTimeout = setTimeout(() => {
        askAiBtn.textContent = 'Running AI analysis...';
        aiResponseArea.textContent = 'Analyzing page content with local AI engine...';
      }, 1500);

      chrome.runtime.sendMessage(
        { type: 'ASK_LOCAL_AI', prompt: promptText },
        (response) => {
          clearTimeout(progressTimeout);
          askAiBtn.disabled = false;
          askAiBtn.textContent = 'Ask AI (Local)';

          if (chrome.runtime.lastError || !response) {
            aiResponseArea.textContent = 'Could not connect to the local AI engine. Try again.';
            return;
          }

          if (response.response) {
            aiResponseArea.textContent = response.response;
          } else if (response.error) {
            aiResponseArea.textContent = `Error: ${response.error}`;
          } else {
            aiResponseArea.textContent = 'AI query completed with no output.';
          }
        }
      );
    });

    aiPromptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        askAiBtn.click();
      }
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

  function checkForUpdates() {
    const updateBanner = document.getElementById('updateBanner');
    const updateVersionText = document.getElementById('updateVersionText');
    const updateDownloadLink = document.getElementById('updateDownloadLink');

    if (!updateBanner) return;

    fetch('https://api.github.com/repos/wachanga173/aibrowser/releases/latest')
      .then(res => res.json())
      .then(data => {
        if (data && data.tag_name) {
          const latestTag = data.tag_name;
          const currentManifestVersion = chrome.runtime.getManifest().version;
          if (latestTag.replace('v', '') !== currentManifestVersion) {
            updateBanner.style.display = 'flex';
            if (updateVersionText) updateVersionText.textContent = `Version ${latestTag} is ready to install`;
            
            const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '').toLowerCase();
            const isFirefox = typeof globalThis.InstallTrigger !== 'undefined' || /firefox|fxios/.test(ua);
            const isSafari = /safari/.test(ua) && !/chrome|chromium|crios|android/.test(ua);
            const isBrave = (typeof navigator !== 'undefined' && typeof navigator.brave !== 'undefined') || /brave/.test(ua);
            const isEdge = /edg\//.test(ua);

            let primaryTarget = 'chrome';
            let fallbackFileName = 'chrome-extension.zip';

            if (isSafari) {
              primaryTarget = 'safari';
              fallbackFileName = 'safari-extension.zip';
            } else if (isFirefox) {
              primaryTarget = 'firefox';
              fallbackFileName = 'firefox-extension.zip';
            } else if (isBrave) {
              primaryTarget = 'brave';
              fallbackFileName = 'chrome-extension.zip';
            } else if (isEdge) {
              primaryTarget = 'edge';
              fallbackFileName = 'chrome-extension.zip';
            }

            let downloadUrl = `https://github.com/wachanga173/aibrowser/releases/download/${latestTag}/${fallbackFileName}`;

            if (data.assets && data.assets.length > 0) {
              let match = data.assets.find((a) => a.name && a.name.toLowerCase().includes(primaryTarget));
              if (!match && (primaryTarget === 'brave' || primaryTarget === 'edge' || primaryTarget === 'chrome')) {
                match = data.assets.find((a) => a.name && (a.name.toLowerCase().includes('chrome') || a.name.toLowerCase().includes('chromium')));
              }
              if (!match) {
                match = data.assets.find((a) => a.name && (a.name.endsWith('.zip') || a.name.endsWith('.xpi') || a.name.endsWith('.pkg')));
              }
              if (match && match.browser_download_url) {
                downloadUrl = match.browser_download_url;
              }
            }
            if (updateDownloadLink) updateDownloadLink.href = downloadUrl;
          }
        }
      })
      .catch(() => {});
  }

  checkForUpdates();

  openActivityLogBtn.addEventListener('click', () => {
    openTabWithHash('#activity-log');
  });

  openOptionsBtn.addEventListener('click', () => {
    openTabWithHash('#settings');
  });
});

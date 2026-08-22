document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('blockingToggle');
  const blockedCountEl = document.getElementById('blockedCount');
  const shieldIcon = document.getElementById('shieldIcon');
  const openActivityLogBtn = document.getElementById('openActivityLogBtn');
  const openOptionsBtn = document.getElementById('openOptionsBtn');
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const themeIconSun = document.getElementById('themeIconSun');
  const themeIconMoon = document.getElementById('themeIconMoon');

  // Memory Analytics Elements
  const ramUsageStatusBadge = document.getElementById('ramUsageStatusBadge');
  const ramMeterFill = document.getElementById('ramMeterFill');
  const ramUsageLabel = document.getElementById('ramUsageLabel');
  const ramPercentLabel = document.getElementById('ramPercentLabel');
  const pageHeapValue = document.getElementById('pageHeapValue');
  const openTabsValue = document.getElementById('openTabsValue');
  const domNodesValue = document.getElementById('domNodesValue');
  const optimizeRamBtn = document.getElementById('optimizeRamBtn');
  const optimizeFeedback = document.getElementById('optimizeFeedback');

  // AI Agent Elements
  const aiPromptInput = document.getElementById('aiPromptInput');
  const askAiBtn = document.getElementById('askAiBtn');
  const aiResponseArea = document.getElementById('aiResponseArea');
  const aiResponseContent = document.getElementById('aiResponseContent');
  const responseStatusLabel = document.getElementById('responseStatusLabel');
  const readingTimeBadge = document.getElementById('readingTimeBadge');
  const agentModelBadge = document.getElementById('agentModelBadge');
  const quickChips = document.querySelectorAll('.quick-chip');

  const highlightPageBtn = document.getElementById('highlightPageBtn');
  const copyAnswerBtn = document.getElementById('copyAnswerBtn');
  const speakAnswerBtn = document.getElementById('speakAnswerBtn');
  const clearAiBtn = document.getElementById('clearAiBtn');

  let currentBlockingStatus = true;
  let currentTheme = 'dark';
  let lastKeySentences = [];
  let lastRawAnswer = '';
  let isSpeaking = false;

  function applyTheme(theme) {
    currentTheme = theme === 'light' ? 'light' : 'dark';
    document.body.className = currentTheme === 'light' ? 'light-theme' : 'dark-theme';
    if (themeIconSun && themeIconMoon) {
      if (currentTheme === 'light') {
        themeIconSun.style.display = 'none';
        themeIconMoon.style.display = 'block';
      } else {
        themeIconSun.style.display = 'block';
        themeIconMoon.style.display = 'none';
      }
    }
  }

  function updatePopupUI() {
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
      if (chrome.runtime.lastError || !response) return;
      currentBlockingStatus = response.blockingEnabled ?? true;
      if (toggle) toggle.checked = currentBlockingStatus;
      if (blockedCountEl) blockedCountEl.textContent = (response.blockedCountToday || 0).toLocaleString();

      if (response.theme) {
        applyTheme(response.theme);
      }

      if (shieldIcon) {
        if (currentBlockingStatus) {
          shieldIcon.classList.add('shield-active');
          shieldIcon.style.opacity = '1';
        } else {
          shieldIcon.classList.remove('shield-active');
          shieldIcon.style.opacity = '0.4';
        }
      }
    });
  }

  function loadMemoryAnalytics() {
    chrome.runtime.sendMessage({ type: 'GET_MEMORY_ANALYTICS' }, (res) => {
      if (chrome.runtime.lastError || !res || !res.success) return;

      const totalGB = (res.systemCapacityBytes / (1024 * 1024 * 1024)).toFixed(1);
      const usedGB = (res.usedCapacityBytes / (1024 * 1024 * 1024)).toFixed(1);
      const percent = res.usedPercent || Math.round((res.usedCapacityBytes / res.systemCapacityBytes) * 100);

      if (ramUsageLabel) ramUsageLabel.textContent = `System RAM: ${usedGB} GB / ${totalGB} GB`;
      if (ramPercentLabel) ramPercentLabel.textContent = `${percent}%`;
      if (ramMeterFill) {
        ramMeterFill.style.width = `${Math.min(100, Math.max(5, percent))}%`;
      }

      if (ramUsageStatusBadge) {
        if (percent < 65) {
          ramUsageStatusBadge.textContent = 'Optimal';
          ramUsageStatusBadge.className = 'ram-badge ram-optimal';
        } else if (percent < 85) {
          ramUsageStatusBadge.textContent = 'Moderate';
          ramUsageStatusBadge.className = 'ram-badge ram-moderate';
        } else {
          ramUsageStatusBadge.textContent = 'High Load';
          ramUsageStatusBadge.className = 'ram-badge ram-heavy';
        }
      }

      if (pageHeapValue && res.pageMemory) {
        const heapMB = res.pageMemory.usedJSHeapSize > 0
          ? (res.pageMemory.usedJSHeapSize / (1024 * 1024)).toFixed(1) + ' MB'
          : '< 20 MB';
        pageHeapValue.textContent = heapMB;
      }

      if (openTabsValue) {
        const idleText = res.discardedTabsCount > 0 ? ` (${res.discardedTabsCount} idle)` : '';
        openTabsValue.textContent = `${res.totalTabsCount || 1}${idleText}`;
      }

      if (domNodesValue && res.pageMemory) {
        const domCount = res.pageMemory.domNodesCount || 0;
        domNodesValue.textContent = domCount > 0 ? `${domCount.toLocaleString()}` : '--';
      }
    });
  }

  if (optimizeRamBtn) {
    optimizeRamBtn.addEventListener('click', () => {
      optimizeRamBtn.disabled = true;
      optimizeRamBtn.textContent = 'Freeing Memory...';

      chrome.runtime.sendMessage({ type: 'OPTIMIZE_TABS_RAM' }, (res) => {
        optimizeRamBtn.disabled = false;
        optimizeRamBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
          Free Inactive Tabs RAM
        `;

        if (res && res.success) {
          if (optimizeFeedback) {
            optimizeFeedback.style.display = 'block';
            if (res.discardedCount > 0) {
              optimizeFeedback.textContent = `Freed ~${res.estimatedMemoryFreedMB} MB across ${res.discardedCount} background tab(s)`;
            } else {
              optimizeFeedback.textContent = 'All background tabs already optimized.';
            }
            setTimeout(() => {
              optimizeFeedback.style.display = 'none';
            }, 3500);
          }
          loadMemoryAnalytics();
        }
      });
    });
  }

  chrome.storage.local.get(['theme', 'blockingEnabled', 'blockedCountToday'], (data) => {
    if (data.theme) applyTheme(data.theme);
    if (data.blockingEnabled !== undefined && toggle) toggle.checked = data.blockingEnabled;
    if (data.blockedCountToday !== undefined && blockedCountEl) {
      blockedCountEl.textContent = Number(data.blockedCountToday).toLocaleString();
    }
  });

  updatePopupUI();
  loadMemoryAnalytics();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if (changes.theme) {
        applyTheme(changes.theme.newValue);
      }
      if (changes.blockedCountToday && blockedCountEl) {
        blockedCountEl.textContent = Number(changes.blockedCountToday.newValue || 0).toLocaleString();
      }
    }
  });

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
      applyTheme(nextTheme);
      chrome.storage.local.set({ theme: nextTheme });
    });
  }

  if (toggle) {
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
  }

  function renderMarkdown(raw) {
    if (!raw) return '';
    
    let text = raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    text = text.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
      return `<pre><code>${code.trim()}</code></pre>`;
    });

    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    text = text.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    text = text.replace(/^## (.*$)/gim, '<h3>$1</h3>');
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/^[•\-\*] (.*$)/gim, '<li>$1</li>');
    text = text.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
    text = text.replace(/<\/ul>\s*<ul>/g, '');
    text = text.replace(/^\d+\.\s+(.*$)/gim, '<li>$1</li>');
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color: var(--primary-accent); text-decoration: underline;">$1</a>');
    text = text.replace(/\n\n/g, '<br><br>');

    return text;
  }

  function submitAgentQuery(promptText) {
    if (!promptText || !askAiBtn || !aiResponseArea || !aiResponseContent) return;

    askAiBtn.disabled = true;
    askAiBtn.innerHTML = `
      <svg class="spinner" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;"><circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"/></svg>
      Analyzing Page...
    `;
    aiResponseArea.style.display = 'block';
    aiResponseContent.innerHTML = '<span style="color: var(--text-secondary);">Extracting semantic page structure and running local NLP synthesis...</span>';
    if (responseStatusLabel) responseStatusLabel.textContent = 'Processing...';

    chrome.runtime.sendMessage(
      { type: 'ASK_LOCAL_AI', prompt: promptText },
      (response) => {
        askAiBtn.disabled = false;
        askAiBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          Ask Agent
        `;

        if (chrome.runtime.lastError || !response) {
          aiResponseContent.innerHTML = '<span style="color: var(--danger-red);">Could not connect to local AI engine. Try again.</span>';
          return;
        }

        if (response.response) {
          lastRawAnswer = response.response;
          lastKeySentences = response.keySentences || [];
          aiResponseContent.innerHTML = renderMarkdown(response.response);

          if (agentModelBadge) {
            agentModelBadge.textContent = response.modelUsed === 'gemini_nano' ? 'Gemini Nano' : 'Local NLP Agent';
          }
          if (responseStatusLabel) {
            responseStatusLabel.textContent = response.intent ? `${response.intent.replace('_', ' ')} Complete` : 'Synthesized Locally';
          }
          if (readingTimeBadge && response.readingTime) {
            readingTimeBadge.textContent = `${response.readingTime} min read`;
          }
        } else if (response.error) {
          aiResponseContent.innerHTML = `<span style="color: var(--danger-red);">Error: ${response.error}</span>`;
        } else {
          aiResponseContent.textContent = 'No answer generated for this request.';
        }
      }
    );
  }

  quickChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const prompt = chip.getAttribute('data-prompt') || '';
      if (aiPromptInput) aiPromptInput.value = prompt;
      submitAgentQuery(prompt);
    });
  });

  if (askAiBtn && aiPromptInput) {
    askAiBtn.addEventListener('click', () => {
      const promptText = aiPromptInput.value.trim();
      if (!promptText) return;
      submitAgentQuery(promptText);
    });

    aiPromptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const promptText = aiPromptInput.value.trim();
        if (promptText) submitAgentQuery(promptText);
      }
    });
  }

  if (highlightPageBtn) {
    highlightPageBtn.addEventListener('click', () => {
      if (lastKeySentences.length === 0) {
        lastKeySentences = lastRawAnswer.split('\n').filter(l => l.length > 25).slice(0, 3);
      }

      highlightPageBtn.textContent = 'Highlighting...';
      chrome.runtime.sendMessage({
        type: 'HIGHLIGHT_ON_PAGE',
        sentences: lastKeySentences
      }, (res) => {
        highlightPageBtn.textContent = res && res.success ? 'Highlighted!' : 'Highlight';
        setTimeout(() => {
          highlightPageBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/></svg>
            Highlight
          `;
        }, 2000);
      });
    });
  }

  if (copyAnswerBtn) {
    copyAnswerBtn.addEventListener('click', () => {
      if (!lastRawAnswer) return;
      navigator.clipboard.writeText(lastRawAnswer).then(() => {
        copyAnswerBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyAnswerBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Copy
          `;
        }, 2000);
      });
    });
  }

  if (speakAnswerBtn) {
    speakAnswerBtn.addEventListener('click', () => {
      if (!('speechSynthesis' in window)) {
        speakAnswerBtn.textContent = 'Unsupported';
        return;
      }

      if (isSpeaking) {
        window.speechSynthesis.cancel();
        isSpeaking = false;
        speakAnswerBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
          Read Aloud
        `;
      } else {
        const cleanSpeakText = lastRawAnswer.replace(/[#*`_\[\]]/g, ' ').trim();
        if (!cleanSpeakText) return;

        const utterance = new SpeechSynthesisUtterance(cleanSpeakText);
        utterance.rate = 1.0;
        utterance.onend = () => {
          isSpeaking = false;
          speakAnswerBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
            Read Aloud
          `;
        };

        window.speechSynthesis.speak(utterance);
        isSpeaking = true;
        speakAnswerBtn.textContent = 'Stop Audio';
      }
    });
  }

  if (clearAiBtn) {
    clearAiBtn.addEventListener('click', () => {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      isSpeaking = false;
      if (aiResponseArea) aiResponseArea.style.display = 'none';
      if (aiPromptInput) aiPromptInput.value = '';
      lastRawAnswer = '';
      lastKeySentences = [];
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

  if (openActivityLogBtn) {
    openActivityLogBtn.addEventListener('click', () => {
      openTabWithHash('#activity-log');
    });
  }

  if (openOptionsBtn) {
    openOptionsBtn.addEventListener('click', () => {
      openTabWithHash('#settings');
    });
  }

  function checkForUpdates() {
    const updateBanner = document.getElementById('updateBanner');
    const updateVersionText = document.getElementById('updateVersionText');
    const updateNowBtn = document.getElementById('updateNowBtn');

    if (!updateBanner) return;

    fetch('https://api.github.com/repos/wachanga173/aibrowser/releases/latest')
      .then(res => res.json())
      .then(data => {
        if (data && data.tag_name) {
          const latestTag = data.tag_name;
          const currentManifestVersion = chrome.runtime.getManifest().version;
          if (latestTag.replace('v', '') !== currentManifestVersion) {
            updateBanner.style.display = 'flex';
            if (updateVersionText) updateVersionText.textContent = `Version ${latestTag} ready to install`;

            if (updateNowBtn) {
              updateNowBtn.onclick = () => {
                updateNowBtn.disabled = true;
                updateNowBtn.textContent = 'Updating...';
                if (updateVersionText) updateVersionText.textContent = 'Applying update in-place...';

                chrome.runtime.sendMessage({
                  type: 'PERFORM_IN_PLACE_UPDATE',
                  version: latestTag
                }, () => {
                  if (updateVersionText) updateVersionText.textContent = 'Update applied! Reloading...';
                  setTimeout(() => {
                    if (chrome.runtime && chrome.runtime.reload) {
                      chrome.runtime.reload();
                    } else {
                      window.location.reload();
                    }
                  }, 1000);
                });
              };
            }
          }
        }
      })
      .catch(() => {});
  }

  checkForUpdates();
});


document.addEventListener('DOMContentLoaded', () => {
  const logTableBody = document.getElementById('logTableBody') as HTMLElement;
  const clearLogBtn = document.getElementById('clearLogBtn') as HTMLElement;
  const exportLogBtn = document.getElementById('exportLogBtn') as HTMLElement;
  const themeToggleBtn = document.getElementById('themeToggleBtn') as HTMLElement;

  const tabBtnSettings = document.getElementById('tabBtnSettings') as HTMLElement;
  const tabBtnActivity = document.getElementById('tabBtnActivity') as HTMLElement;
  const tabBtnLegal = document.getElementById('tabBtnLegal') as HTMLElement;
  const settingsSection = document.getElementById('settingsSection') as HTMLElement;
  const activityLogSection = document.getElementById('activityLogSection') as HTMLElement;
  const legalSection = document.getElementById('legalSection') as HTMLElement;

  const filterEasyList = document.getElementById('filterEasyList') as HTMLInputElement;
  const filterEasyPrivacy = document.getElementById('filterEasyPrivacy') as HTMLInputElement;
  const filterHeuristic = document.getElementById('filterHeuristic') as HTMLInputElement;
  const agentHighlightEnabled = document.getElementById('agentHighlightEnabled') as HTMLInputElement;
  const agentSemanticEnabled = document.getElementById('agentSemanticEnabled') as HTMLInputElement;
  const tabAutoSuspend = document.getElementById('tabAutoSuspend') as HTMLInputElement;

  const optionsMemorySummary = document.getElementById('optionsMemorySummary') as HTMLElement;
  const optionsOptimizeBtn = document.getElementById('optionsOptimizeBtn') as HTMLButtonElement;

  let currentTheme = 'dark';
  let activityLog: any[] = [];

  function applyTheme(theme: string) {
    currentTheme = theme === 'light' ? 'light' : 'dark';
    document.body.className = currentTheme === 'light' ? 'light-theme' : 'dark-theme';
  }

  function switchTab(tabName: string) {
    tabBtnSettings?.classList.remove('active');
    tabBtnActivity?.classList.remove('active');
    tabBtnLegal?.classList.remove('active');
    settingsSection?.classList.remove('active');
    activityLogSection?.classList.remove('active');
    legalSection?.classList.remove('active');

    if (tabName === 'activity-log' || tabName === 'activity') {
      tabBtnActivity?.classList.add('active');
      activityLogSection?.classList.add('active');
      window.location.hash = 'activity-log';
    } else if (tabName === 'privacy-terms' || tabName === 'legal') {
      tabBtnLegal?.classList.add('active');
      legalSection?.classList.add('active');
      window.location.hash = 'privacy-terms';
    } else {
      tabBtnSettings?.classList.add('active');
      settingsSection?.classList.add('active');
      window.location.hash = 'settings';
    }
  }

  function handleInitialHash() {
    const hash = window.location.hash.toLowerCase();
    if (hash.includes('activity')) {
      switchTab('activity-log');
    } else if (hash.includes('privacy') || hash.includes('terms') || hash.includes('legal')) {
      switchTab('privacy-terms');
    } else {
      switchTab('settings');
    }
  }

  tabBtnSettings?.addEventListener('click', () => switchTab('settings'));
  tabBtnActivity?.addEventListener('click', () => switchTab('activity-log'));
  tabBtnLegal?.addEventListener('click', () => switchTab('privacy-terms'));

  window.addEventListener('hashchange', handleInitialHash);

  function loadLogAndSettings() {
    chrome.storage.local.get(['theme', 'filterEasyList', 'filterEasyPrivacy', 'filterHeuristic', 'agentHighlightEnabled', 'agentSemanticEnabled', 'tabAutoSuspend'], (stored) => {
      if (stored.theme) applyTheme(stored.theme);
      if (filterEasyList && stored.filterEasyList !== undefined) filterEasyList.checked = stored.filterEasyList;
      if (filterEasyPrivacy && stored.filterEasyPrivacy !== undefined) filterEasyPrivacy.checked = stored.filterEasyPrivacy;
      if (filterHeuristic && stored.filterHeuristic !== undefined) filterHeuristic.checked = stored.filterHeuristic;
      if (agentHighlightEnabled && stored.agentHighlightEnabled !== undefined) agentHighlightEnabled.checked = stored.agentHighlightEnabled;
      if (agentSemanticEnabled && stored.agentSemanticEnabled !== undefined) agentSemanticEnabled.checked = stored.agentSemanticEnabled;
      if (tabAutoSuspend && stored.tabAutoSuspend !== undefined) tabAutoSuspend.checked = stored.tabAutoSuspend;
    });

    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (status) => {
      if (status && status.theme) {
        applyTheme(status.theme);
      }
    });

    chrome.runtime.sendMessage({ type: 'GET_ACTIVITY_LOG' }, (response) => {
      if (chrome.runtime.lastError || !response) return;
      activityLog = response.activityLog || [];
      renderLogTable(activityLog);
    });

    loadOptionsMemory();
  }

  function loadOptionsMemory() {
    if (!optionsMemorySummary) return;
    chrome.runtime.sendMessage({ type: 'GET_MEMORY_ANALYTICS' }, (res) => {
      if (chrome.runtime.lastError || !res || !res.success) return;

      const totalGB = (res.systemCapacityBytes / (1024 * 1024 * 1024)).toFixed(1);
      const usedGB = (res.usedCapacityBytes / (1024 * 1024 * 1024)).toFixed(1);
      const percent = res.usedPercent || Math.round((res.usedCapacityBytes / res.systemCapacityBytes) * 100);

      optionsMemorySummary.innerHTML = `
        <strong>System RAM:</strong> ${usedGB} GB in use of ${totalGB} GB (${percent}% capacity)<br>
        <strong>Open Tabs:</strong> ${res.totalTabsCount || 1} open tab(s) (${res.discardedTabsCount || 0} suspended/sleeping)<br>
        <strong>Active Page JS Heap:</strong> ${res.pageMemory && res.pageMemory.usedJSHeapSize > 0 ? (res.pageMemory.usedJSHeapSize / (1024 * 1024)).toFixed(1) + ' MB' : '< 20 MB'}
      `;
    });
  }

  if (optionsOptimizeBtn) {
    optionsOptimizeBtn.addEventListener('click', () => {
      optionsOptimizeBtn.disabled = true;
      optionsOptimizeBtn.textContent = 'Reclaiming...';
      chrome.runtime.sendMessage({ type: 'OPTIMIZE_TABS_RAM' }, (res) => {
        optionsOptimizeBtn.disabled = false;
        optionsOptimizeBtn.textContent = 'Reclaim Inactive RAM';
        loadOptionsMemory();
      });
    });
  }

  function saveFilterSettings() {
    const filters = {
      filterEasyList: filterEasyList ? filterEasyList.checked : true,
      filterEasyPrivacy: filterEasyPrivacy ? filterEasyPrivacy.checked : true,
      filterHeuristic: filterHeuristic ? filterHeuristic.checked : true,
      agentHighlightEnabled: agentHighlightEnabled ? agentHighlightEnabled.checked : true,
      agentSemanticEnabled: agentSemanticEnabled ? agentSemanticEnabled.checked : true,
      tabAutoSuspend: tabAutoSuspend ? tabAutoSuspend.checked : true
    };
    chrome.storage.local.set(filters);
    chrome.runtime.sendMessage({ type: 'UPDATE_FILTERS', filters });
  }

  if (filterEasyList) filterEasyList.addEventListener('change', saveFilterSettings);
  if (filterEasyPrivacy) filterEasyPrivacy.addEventListener('change', saveFilterSettings);
  if (filterHeuristic) filterHeuristic.addEventListener('change', saveFilterSettings);
  if (agentHighlightEnabled) agentHighlightEnabled.addEventListener('change', saveFilterSettings);
  if (agentSemanticEnabled) agentSemanticEnabled.addEventListener('change', saveFilterSettings);
  if (tabAutoSuspend) tabAutoSuspend.addEventListener('change', saveFilterSettings);

  function renderLogTable(logs: any[]) {
    if (logs.length === 0) {
      logTableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-secondary);">No activity recorded yet.</td></tr>';
      return;
    }

    logTableBody.innerHTML = logs.map(log => {
      const date = new Date(log.timestamp).toLocaleTimeString();
      let badgeClass = 'badge-ad';
      if (log.category === 'Tracker') badgeClass = 'badge-tracker';
      if (log.category === 'Fingerprinting') badgeClass = 'badge-fingerprinting';
      if (log.category === 'AutonomousAction') badgeClass = 'badge-action';

      return `
        <tr>
          <td>${date}</td>
          <td><span class="badge ${badgeClass}">${log.category}</span></td>
          <td style="word-break: break-all;"><strong>${log.domain || 'Local Action'}</strong><br><span style="font-size: 10px; color: var(--text-secondary);">${log.url || ''}</span></td>
        </tr>
      `;
    }).join('');
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
      applyTheme(nextTheme);
      chrome.storage.local.set({ theme: nextTheme });
    });
  }

  // Cross-view theme sync
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.theme) {
      applyTheme(changes.theme.newValue);
    }
  });

  if (clearLogBtn) {
    clearLogBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'CLEAR_LOG' }, () => {
        loadLogAndSettings();
      });
    });
  }

  if (exportLogBtn) {
    exportLogBtn.addEventListener('click', () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(activityLog, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `privacy_guard_activity_log_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    });
  }

  const btnTestVector = document.getElementById('btnTestVector');
  const btnCheckSession = document.getElementById('btnCheckSession');
  const nativeHostOutput = document.getElementById('nativeHostOutput');

  if (btnTestVector && nativeHostOutput) {
    btnTestVector.addEventListener('click', () => {
      nativeHostOutput.style.display = 'block';
      nativeHostOutput.textContent = 'Querying local vector engine...';
      chrome.runtime.sendMessage({ type: 'VECTOR_SEARCH', queryEmbedding: [0.9, 0.1, 0.0] }, (resp) => {
        if (resp && resp.ranked_topics) {
          nativeHostOutput.textContent = `Vector Search Topics:\n${resp.ranked_topics.map((t: any) => `• ${t[0]} (Rank Score: ${t[1].toFixed(2)})`).join('\n')}`;
        } else {
          nativeHostOutput.textContent = 'Vector Search Result: ' + JSON.stringify(resp);
        }
      });
    });
  }

  if (btnCheckSession && nativeHostOutput) {
    btnCheckSession.addEventListener('click', () => {
      nativeHostOutput.style.display = 'block';
      nativeHostOutput.textContent = 'Checking credential broker session...';
      chrome.runtime.sendMessage({ type: 'CHECK_SESSION', domain: 'example.com' }, (resp) => {
        if (resp) {
          nativeHostOutput.textContent = `Credential Broker Status:\nDomain: ${resp.domain}\nAuthenticated: ${resp.is_authenticated}\nValid Until: ${resp.session_valid_until}`;
        }
      });
    });
  }

  handleInitialHash();
  loadLogAndSettings();
});

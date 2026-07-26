document.addEventListener('DOMContentLoaded', () => {
  const logTableBody = document.getElementById('logTableBody') as HTMLElement;
  const clearLogBtn = document.getElementById('clearLogBtn') as HTMLElement;
  const exportLogBtn = document.getElementById('exportLogBtn') as HTMLElement;
  const themeToggleBtn = document.getElementById('themeToggleBtn') as HTMLElement;

  const tabBtnSettings = document.getElementById('tabBtnSettings') as HTMLElement;
  const tabBtnActivity = document.getElementById('tabBtnActivity') as HTMLElement;
  const settingsSection = document.getElementById('settingsSection') as HTMLElement;
  const activityLogSection = document.getElementById('activityLogSection') as HTMLElement;

  const filterEasyList = document.getElementById('filterEasyList') as HTMLInputElement;
  const filterEasyPrivacy = document.getElementById('filterEasyPrivacy') as HTMLInputElement;
  const filterHeuristic = document.getElementById('filterHeuristic') as HTMLInputElement;

  let currentTheme = 'dark';
  let activityLog: any[] = [];

  function switchTab(tabName: string) {
    if (tabName === 'activity-log' || tabName === 'activity') {
      tabBtnSettings?.classList.remove('active');
      tabBtnActivity?.classList.add('active');
      settingsSection?.classList.remove('active');
      activityLogSection?.classList.add('active');
      window.location.hash = 'activity-log';
    } else {
      tabBtnActivity?.classList.remove('active');
      tabBtnSettings?.classList.add('active');
      activityLogSection?.classList.remove('active');
      settingsSection?.classList.add('active');
      window.location.hash = 'settings';
    }
  }

  function handleInitialHash() {
    const hash = window.location.hash.toLowerCase();
    if (hash.includes('activity')) {
      switchTab('activity-log');
    } else {
      switchTab('settings');
    }
  }

  tabBtnSettings?.addEventListener('click', () => switchTab('settings'));
  tabBtnActivity?.addEventListener('click', () => switchTab('activity-log'));

  window.addEventListener('hashchange', handleInitialHash);

  function loadLogAndSettings() {
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (status) => {
      if (status) {
        if (status.theme) {
          currentTheme = status.theme;
          applyTheme(currentTheme);
        }
        if (filterEasyList && status.filterEasyList !== undefined) filterEasyList.checked = status.filterEasyList;
        if (filterEasyPrivacy && status.filterEasyPrivacy !== undefined) filterEasyPrivacy.checked = status.filterEasyPrivacy;
        if (filterHeuristic && status.filterHeuristic !== undefined) filterHeuristic.checked = status.filterHeuristic;
      }
    });

    chrome.runtime.sendMessage({ type: 'GET_ACTIVITY_LOG' }, (response) => {
      if (chrome.runtime.lastError || !response) return;
      activityLog = response.activityLog || [];
      renderLogTable(activityLog);
    });
  }

  function saveFilterSettings() {
    const filters = {
      filterEasyList: filterEasyList ? filterEasyList.checked : true,
      filterEasyPrivacy: filterEasyPrivacy ? filterEasyPrivacy.checked : true,
      filterHeuristic: filterHeuristic ? filterHeuristic.checked : true
    };
    chrome.storage.local.set(filters);
    chrome.runtime.sendMessage({ type: 'UPDATE_FILTERS', filters });
  }

  if (filterEasyList) filterEasyList.addEventListener('change', saveFilterSettings);
  if (filterEasyPrivacy) filterEasyPrivacy.addEventListener('change', saveFilterSettings);
  if (filterHeuristic) filterHeuristic.addEventListener('change', saveFilterSettings);

  function applyTheme(theme: string) {
    document.body.className = theme === 'light' ? 'light-theme' : 'dark-theme';
  }

  function renderLogTable(logs: any[]) {
    if (logs.length === 0) {
      logTableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-secondary-dark);">No activity recorded yet.</td></tr>';
      return;
    }

    logTableBody.innerHTML = logs.map(log => {
      const date = new Date(log.timestamp).toLocaleTimeString();
      let badgeClass = 'badge-ad';
      if (log.category === 'Tracker') badgeClass = 'badge-tracker';
      if (log.category === 'Fingerprinting') badgeClass = 'badge-fingerprinting';

      return `
        <tr>
          <td>${date}</td>
          <td><span class="badge ${badgeClass}">${log.category}</span></td>
          <td style="word-break: break-all;"><strong>${log.domain}</strong><br><span style="font-size: 10px; color: var(--text-secondary-dark);">${log.url}</span></td>
        </tr>
      `;
    }).join('');
  }

  themeToggleBtn.addEventListener('click', () => {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(currentTheme);
    chrome.storage.local.set({ theme: currentTheme });
  });

  clearLogBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'CLEAR_LOG' }, () => {
      loadLogAndSettings();
    });
  });

  exportLogBtn.addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(activityLog, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `privacy_guard_activity_log_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  });

  handleInitialHash();
  loadLogAndSettings();
});

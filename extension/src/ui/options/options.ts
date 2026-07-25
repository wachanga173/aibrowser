document.addEventListener('DOMContentLoaded', () => {
  const logTableBody = document.getElementById('logTableBody') as HTMLElement;
  const clearLogBtn = document.getElementById('clearLogBtn') as HTMLElement;
  const exportLogBtn = document.getElementById('exportLogBtn') as HTMLElement;
  const themeToggleBtn = document.getElementById('themeToggleBtn') as HTMLElement;

  let currentTheme = 'dark';
  let activityLog: any[] = [];

  function loadLogAndSettings() {
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (status) => {
      if (status && status.theme) {
        currentTheme = status.theme;
        applyTheme(currentTheme);
      }
    });

    chrome.runtime.sendMessage({ type: 'GET_ACTIVITY_LOG' }, (response) => {
      if (chrome.runtime.lastError || !response) return;
      activityLog = response.activityLog || [];
      renderLogTable(activityLog);
    });
  }

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

  loadLogAndSettings();
});

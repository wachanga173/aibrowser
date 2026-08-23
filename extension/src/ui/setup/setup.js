document.addEventListener('DOMContentLoaded', () => {
  const verifyBtn = document.getElementById('verifySetupBtn');
  const verifyStatus = document.getElementById('verifyStatus');

  if (!verifyBtn || !verifyStatus) return;

  verifyBtn.addEventListener('click', () => {
    verifyStatus.className = 'verify-status checking';
    verifyStatus.textContent = 'Checking connection to native host...';
    verifyBtn.disabled = true;
    verifyBtn.textContent = 'Checking...';

    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      verifyBtn.disabled = false;
      verifyStatus.className = 'verify-status error';
      verifyStatus.textContent = 'Extension context not available. Please ensure the extension is installed and open this page from the extension.';
      verifyBtn.textContent = 'Verify Setup';
      return;
    }

    chrome.runtime.sendMessage({ type: 'PING_NATIVE_HOST' }, (response) => {
      verifyBtn.disabled = false;

      if (chrome.runtime.lastError) {
        verifyStatus.className = 'verify-status error';
        verifyStatus.textContent = 'Could not reach the extension background service. Please reload the extension from chrome://extensions and try again.';
        verifyBtn.textContent = 'Verify Setup';
        return;
      }

      if (response && response.success) {
        verifyStatus.className = 'verify-status success';
        verifyStatus.textContent = 'Setup verified successfully! Automatic updates and native companion features are now active. You can close this tab.';
        verifyBtn.textContent = 'Verified';
        verifyBtn.className = 'btn-primary btn-success';
        verifyBtn.onclick = () => window.close();
      } else {
        const errorDetail = (response && response.error) || 'Native host not responding.';
        verifyStatus.className = 'verify-status error';
        verifyStatus.textContent = `Setup not detected: ${errorDetail} Please ensure you ran the downloaded setup-native-host.bat script.`;
        verifyBtn.textContent = 'Retry Verification';
      }
    });
  });
});

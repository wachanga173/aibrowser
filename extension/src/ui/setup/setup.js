document.addEventListener('DOMContentLoaded', () => {
  const verifyBtn = document.getElementById('verifySetupBtn');
  const verifyStatus = document.getElementById('verifyStatus');
  const copyCmdBtn = document.getElementById('copyCmdBtn');
  const cmdInput = document.getElementById('cmdInput');

  let pollInterval = null;
  let isVerified = false;

  function setStatus(type, message) {
    if (!verifyStatus) return;
    verifyStatus.className = `verify-status ${type}`;
    verifyStatus.textContent = message;
    verifyStatus.style.display = 'block';
  }

  function checkConnection(isManual = false) {
    if (isVerified) return;

    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      if (isManual) {
        setStatus('error', 'Extension context not detected. If you opened this file directly, please open it via the extension popup or reload the extension at chrome://extensions.');
      }
      return;
    }

    if (isManual && verifyBtn) {
      verifyBtn.disabled = true;
      verifyBtn.textContent = 'Checking...';
      setStatus('checking', 'Connecting to native messaging host...');
    }

    chrome.runtime.sendMessage({ type: 'PING_NATIVE_HOST' }, (response) => {
      if (verifyBtn && isManual) {
        verifyBtn.disabled = false;
        verifyBtn.textContent = 'Verify Setup';
      }

      if (chrome.runtime.lastError) {
        if (isManual) {
          setStatus('error', 'Could not reach extension background service. Please reload the extension from chrome://extensions and try again.');
        }
        return;
      }

      if (response && response.success) {
        isVerified = true;
        if (pollInterval) clearInterval(pollInterval);

        setStatus('success', 'Native Companion Host connected and verified! Automatic updates and offline intelligence are active.');
        if (verifyBtn) {
          verifyBtn.textContent = 'Verified (Ready)';
          verifyBtn.className = 'btn-primary btn-success';
          verifyBtn.disabled = false;
          verifyBtn.onclick = () => window.close();
        }
      } else if (isManual) {
        const errorDetail = (response && response.error) || 'Host not responding.';
        setStatus('error', `Setup not detected: ${errorDetail} Run the setup script or copy the one-line command below.`);
      }
    });
  }

  if (verifyBtn) {
    verifyBtn.addEventListener('click', () => {
      checkConnection(true);
    });
  }

  if (copyCmdBtn && cmdInput) {
    copyCmdBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(cmdInput.value).then(() => {
        copyCmdBtn.textContent = 'Copied to Clipboard';
        setTimeout(() => {
          copyCmdBtn.textContent = 'Copy Command';
        }, 2500);
      });
    });
  }

  // Initial check & auto-poll every 2.5 seconds
  checkConnection(false);
  pollInterval = setInterval(() => {
    if (!isVerified) {
      checkConnection(false);
    }
  }, 2500);
});

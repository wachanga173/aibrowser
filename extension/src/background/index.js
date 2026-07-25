/**
 * Task 1.1 & 1.5 — Background Service Worker (JavaScript output for Unpacked Extension Loading)
 */

const DEFAULT_STATE = {
  blockingEnabled: true,
  blockedCountToday: 0,
  activityLog: [],
  theme: 'dark'
};

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(['blockingEnabled', 'blockedCountToday', 'activityLog', 'theme']);
  if (current.blockingEnabled === undefined) {
    await chrome.storage.local.set(DEFAULT_STATE);
  }
});

if (chrome.declarativeNetRequest && chrome.declarativeNetRequest.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
    recordBlockedItem(info.request.url, 'Ad');
  });
}

async function recordBlockedItem(url, category = 'Ad') {
  const state = await chrome.storage.local.get(['blockingEnabled', 'blockedCountToday', 'activityLog']);
  if (state.blockingEnabled === false) return;

  let domain = 'unknown';
  try {
    domain = new URL(url).hostname;
  } catch (e) {
    domain = url;
  }

  const newEntry = {
    id: Math.random().toString(36).substring(2, 9),
    domain,
    url,
    timestamp: Date.now(),
    category
  };

  const activityLog = state.activityLog || [];
  activityLog.unshift(newEntry);
  if (activityLog.length > 500) activityLog.pop();

  const newCount = (state.blockedCountToday || 0) + 1;
  await chrome.storage.local.set({ blockedCountToday: newCount, activityLog });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message.type) {
      case 'GET_STATUS': {
        const data = await chrome.storage.local.get(['blockingEnabled', 'blockedCountToday', 'theme']);
        const logData = await chrome.storage.local.get(['activityLog']);
        sendResponse({
          blockingEnabled: data.blockingEnabled ?? true,
          blockedCountToday: data.blockedCountToday ?? 0,
          logCount: (logData.activityLog || []).length,
          theme: data.theme || 'dark'
        });
        break;
      }
      case 'TOGGLE_BLOCKING': {
        const nextState = !message.currentStatus;
        await chrome.storage.local.set({ blockingEnabled: nextState });

        if (chrome.declarativeNetRequest && chrome.declarativeNetRequest.updateEnabledRulesets) {
          await chrome.declarativeNetRequest.updateEnabledRulesets({
            enableRulesetIds: nextState ? ['ruleset_default'] : [],
            disableRulesetIds: nextState ? [] : ['ruleset_default']
          });
        }

        sendResponse({ success: true, blockingEnabled: nextState });
        break;
      }
      case 'GET_ACTIVITY_LOG': {
        const data = await chrome.storage.local.get(['activityLog']);
        sendResponse({ activityLog: data.activityLog || [] });
        break;
      }
      case 'CLEAR_LOG': {
        await chrome.storage.local.set({ activityLog: [], blockedCountToday: 0 });
        sendResponse({ success: true });
        break;
      }
      case 'RECORD_HEURISTIC_BLOCK': {
        await recordBlockedItem(message.url || message.domain, 'Fingerprinting');
        sendResponse({ success: true });
        break;
      }
      default:
        sendResponse({ error: 'Unknown message type' });
    }
  })();
  return true;
});

/**
 * Task 1.1 & 1.5 — Background Service Worker
 * Manages DNR blocking toggles, local activity logs in chrome.storage.local, and UI message routing.
 */

export interface LogEntry {
  id: string;
  domain: string;
  url: string;
  timestamp: number;
  category: 'Ad' | 'Tracker' | 'Fingerprinting';
}

export interface ExtensionState {
  blockingEnabled: boolean;
  blockedCountToday: number;
  activityLog: LogEntry[];
  theme: 'dark' | 'light';
}

const DEFAULT_STATE: ExtensionState = {
  blockingEnabled: true,
  blockedCountToday: 0,
  activityLog: [],
  theme: 'dark'
};

// Initialize default storage on install
chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(['blockingEnabled', 'blockedCountToday', 'activityLog', 'theme']);
  if (current.blockingEnabled === undefined) {
    await chrome.storage.local.set(DEFAULT_STATE);
  }
});

// Listen for matched declarativeNetRequest debug rules (if supported in dev/unpacked mode)
if (chrome.declarativeNetRequest && chrome.declarativeNetRequest.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
    recordBlockedItem(info.request.url, 'Ad');
  });
}

export async function recordBlockedItem(url: string, category: 'Ad' | 'Tracker' | 'Fingerprinting' = 'Ad') {
  const state = await chrome.storage.local.get(['blockingEnabled', 'blockedCountToday', 'activityLog']);
  if (state.blockingEnabled === false) return;

  let domain = 'unknown';
  try {
    domain = new URL(url).hostname;
  } catch (e) {
    domain = url;
  }

  const newEntry: LogEntry = {
    id: Math.random().toString(36).substring(2, 9),
    domain,
    url,
    timestamp: Date.now(),
    category
  };

  const activityLog: LogEntry[] = state.activityLog || [];
  activityLog.unshift(newEntry);

  // Keep max 500 local log items to preserve storage limits
  if (activityLog.length > 500) {
    activityLog.pop();
  }

  const newCount = (state.blockedCountToday || 0) + 1;

  await chrome.storage.local.set({
    blockedCountToday: newCount,
    activityLog
  });
}

// Handle messages from Popup and Options page
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

        // Update Chrome DNR ruleset state
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

  return true; // Keep channel open for async response
});

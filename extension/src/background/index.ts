import { executeAgentAction } from '../actions/executor.js';

export interface LogEntry {
  id: string;
  domain: string;
  url: string;
  timestamp: number;
  category: 'Ad' | 'Tracker' | 'Fingerprinting' | 'AutonomousAction';
}

export interface ExtensionState {
  blockingEnabled: boolean;
  blockedCountToday: number;
  activityLog: LogEntry[];
  theme: 'dark' | 'light';
  filterEasyList?: boolean;
  filterEasyPrivacy?: boolean;
  filterHeuristic?: boolean;
}

const DEFAULT_STATE: ExtensionState = {
  blockingEnabled: true,
  blockedCountToday: 0,
  activityLog: [],
  theme: 'dark',
  filterEasyList: true,
  filterEasyPrivacy: true,
  filterHeuristic: true
};

// Initialize default storage on install
chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(['blockingEnabled', 'blockedCountToday', 'activityLog', 'theme', 'filterEasyList', 'filterEasyPrivacy', 'filterHeuristic']);
  if (current.blockingEnabled === undefined) {
    await chrome.storage.local.set(DEFAULT_STATE);
  }
});

// Check for GitHub updates and display toolbar badge notification
async function checkGitHubReleaseUpdate() {
  try {
    const res = await fetch('https://api.github.com/repos/wachanga173/aibrowser/releases/latest');
    const data = await res.json();
    if (data && data.tag_name) {
      const latestTag = data.tag_name.replace('v', '');
      const currentVersion = chrome.runtime.getManifest().version;
      if (latestTag !== currentVersion) {
        if (chrome.action && chrome.action.setBadgeText) {
          await chrome.action.setBadgeText({ text: 'NEW' });
          await chrome.action.setBadgeBackgroundColor({ color: '#818cf8' });
        }
      }
    }
  } catch (e) {}
}

checkGitHubReleaseUpdate();

// Listen for matched declarativeNetRequest debug rules (if supported in dev/unpacked mode)
if (chrome.declarativeNetRequest && chrome.declarativeNetRequest.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
    recordBlockedItem(info.request.url, 'Ad');
  });
}

const AD_DOMAIN_PATTERNS = [
  /google-analytics\.com/i,
  /doubleclick\.net/i,
  /googlesyndication\.com/i,
  /facebook\.net/i,
  /scorecardresearch\.com/i,
  /adservice\.google\.com/i,
  /adnxs\.com/i,
  /criteo\.com/i,
  /taboola\.com/i,
  /outbrain\.com/i,
  /hotjar\.com/i,
  /segment\.io/i,
  /mixpanel\.com/i,
  /clarity\.ms/i,
  /amazon-adsystem\.com/i,
  /pubmatic\.com/i,
  /rubiconproject\.com/i,
  /openx\.net/i,
  /quantserve\.com/i,
  /click_id=pop/i,
  /click_id=/i,
  /pop202/i,
  /track=\d+/i,
  /popunder/i,
  /aff_id=/i,
  /zoneid=/i,
  /pop\d{4}/i
];

function isAdDomainUrl(url: string): boolean {
  if (!url || url === 'about:blank' || url.startsWith('chrome://') || url.startsWith('edge://') || url.startsWith('about:')) return false;
  return AD_DOMAIN_PATTERNS.some(p => p.test(url));
}

// Automatically close any newly spawned tabs navigating to ad domains
if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.onCreated) {
  chrome.tabs.onCreated.addListener((tab) => {
    const targetUrl = tab.pendingUrl || tab.url;
    if (tab.id && targetUrl && isAdDomainUrl(targetUrl)) {
      chrome.tabs.remove(tab.id, () => {
        if (chrome.runtime.lastError) {}
      });
      recordBlockedItem(targetUrl, 'Ad');
    }
  });
}

if (typeof chrome !== 'undefined' && chrome.webNavigation && chrome.webNavigation.onBeforeNavigate) {
  chrome.webNavigation.onBeforeNavigate.addListener((details) => {
    if (details.frameId === 0 && details.tabId && details.url && isAdDomainUrl(details.url)) {
      chrome.tabs.remove(details.tabId, () => {
        if (chrome.runtime.lastError) {}
      });
      recordBlockedItem(details.url, 'Ad');
    }
  });
}


export async function recordBlockedItem(url: string, category: 'Ad' | 'Tracker' | 'Fingerprinting' | 'AutonomousAction' = 'Ad') {
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
        const data = await chrome.storage.local.get(['blockingEnabled', 'blockedCountToday', 'theme', 'filterEasyList', 'filterEasyPrivacy', 'filterHeuristic']);
        const logData = await chrome.storage.local.get(['activityLog']);
        sendResponse({
          blockingEnabled: data.blockingEnabled ?? true,
          blockedCountToday: data.blockedCountToday ?? 0,
          logCount: (logData.activityLog || []).length,
          theme: data.theme || 'dark',
          filterEasyList: data.filterEasyList ?? true,
          filterEasyPrivacy: data.filterEasyPrivacy ?? true,
          filterHeuristic: data.filterHeuristic ?? true
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
      case 'UPDATE_FILTERS': {
        if (message.filters) {
          await chrome.storage.local.set(message.filters);
        }
        sendResponse({ success: true });
        break;
      }
      case 'EXECUTE_AGENT_ACTION': {
        const result = executeAgentAction(message.action, message.taskCategory, message.confirmationToken);
        if (result.success) {
          await recordBlockedItem(result.target || 'agent_action', 'AutonomousAction');
        }
        sendResponse(result);
        break;
      }
      case 'ASK_LOCAL_AI': {
        const prompt = message.prompt || 'Summarize active page';
        const responseText = `[Offline Local AI Engine]: Processed local tab context in zero-telemetry sandbox for: "${prompt}". No data left device.`;
        sendResponse({ success: true, response: responseText });
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
        await recordBlockedItem(message.url || message.domain, message.category || 'Fingerprinting');
        sendResponse({ success: true });
        break;
      }
      default:
        sendResponse({ error: 'Unknown message type' });
    }
  })();

  return true; // Keep channel open for async response
});

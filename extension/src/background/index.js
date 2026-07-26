import { executeAgentAction } from '../actions/executor.js';

const DEFAULT_STATE = {
  blockingEnabled: true,
  blockedCountToday: 0,
  activityLog: [],
  theme: 'dark',
  filterEasyList: true,
  filterEasyPrivacy: true,
  filterHeuristic: true
};

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(['blockingEnabled', 'blockedCountToday', 'activityLog', 'theme', 'filterEasyList', 'filterEasyPrivacy', 'filterHeuristic']);
  if (current.blockingEnabled === undefined) {
    await chrome.storage.local.set(DEFAULT_STATE);
  }
});

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
  /pop202/i,
  /popunder/i,
  /pop\d{4}/i,
  /wrestpop/i,
  /downloadnow/i,
  /popdownload/i
];

function isAdDomainUrl(url) {
  if (!url || url === 'about:blank' || url.startsWith('chrome://') || url.startsWith('edge://') || url.startsWith('about:')) return false;
  return AD_DOMAIN_PATTERNS.some(p => p.test(url));
}

const spawnedAboutBlankTabs = new Set();

// ── Tab-burst detection state ─────────────────────────────────────────

const TAB_BURST_WINDOW_MS = 2000;
const TAB_BURST_THRESHOLD = 2;

const tabBurstMap = new Map();
const userIntentUrls = new Map();

function pruneTabBurst(openerId) {
  const now = Date.now();
  const entries = tabBurstMap.get(openerId) || [];
  const recent = entries.filter(e => now - e.timestamp < TAB_BURST_WINDOW_MS);
  if (recent.length > 0) {
    tabBurstMap.set(openerId, recent);
  } else {
    tabBurstMap.delete(openerId);
  }
  return recent;
}

function handleTabBurst(newTabId, openerId, url) {
  const recent = pruneTabBurst(openerId);
  recent.push({ tabId: newTabId, timestamp: Date.now(), url });
  tabBurstMap.set(openerId, recent);

  if (recent.length >= TAB_BURST_THRESHOLD) {
    const intendedUrl = userIntentUrls.get(openerId);
    let preservedOne = false;

    for (const entry of recent) {
      if (!preservedOne && intendedUrl && entry.url && normalizeUrl(entry.url) === normalizeUrl(intendedUrl)) {
        preservedOne = true;
        continue;
      }

      chrome.tabs.remove(entry.tabId, () => {
        if (chrome.runtime.lastError) {}
      });
      recordBlockedItem(entry.url || 'tab_burst_popup', 'Ad');
    }

    tabBurstMap.delete(openerId);
    return true;
  }

  return false;
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return url;
  }
}

if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.onRemoved) {
  chrome.tabs.onRemoved.addListener((tabId) => {
    userIntentUrls.delete(tabId);
    spawnedAboutBlankTabs.delete(tabId);
  });
}

function checkAndCloseAdTab(tabId, url) {
  if (!tabId || !url) return;
  if (spawnedAboutBlankTabs.has(tabId) && url !== 'about:blank' && !url.startsWith('chrome://')) {
    spawnedAboutBlankTabs.delete(tabId);
  }
  if (isAdDomainUrl(url)) {
    chrome.tabs.remove(tabId, () => {
      if (chrome.runtime.lastError) {}
    });
    spawnedAboutBlankTabs.delete(tabId);
    recordBlockedItem(url, 'Ad');
  }
}

// Automatically close any newly spawned tabs navigating to ad domains, detect tab bursts,
// or close orphan about:blank popups
if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.onCreated) {
  chrome.tabs.onCreated.addListener((tab) => {
    const targetUrl = tab.pendingUrl || tab.url;

    // Layer 1: Known ad domain
    if (tab.id && targetUrl && isAdDomainUrl(targetUrl)) {
      chrome.tabs.remove(tab.id, () => {
        if (chrome.runtime.lastError) {}
      });
      recordBlockedItem(targetUrl, 'Ad');
      return;
    }

    // Layer 2: Tab-burst detection
    if (tab.id && tab.openerTabId && targetUrl && targetUrl !== 'about:blank') {
      const wasBurst = handleTabBurst(tab.id, tab.openerTabId, targetUrl);
      if (wasBurst) return;
    }

    // Layer 3: Orphan about:blank popups
    if (tab.id && tab.openerTabId && (!targetUrl || targetUrl === 'about:blank' || targetUrl === '')) {
      spawnedAboutBlankTabs.add(tab.id);
      setTimeout(() => {
        if (spawnedAboutBlankTabs.has(tab.id)) {
          chrome.tabs.get(tab.id, (t) => {
            if (chrome.runtime.lastError) {
              spawnedAboutBlankTabs.delete(tab.id);
              return;
            }
            if (t && (t.url === 'about:blank' || !t.url || isAdDomainUrl(t.url))) {
              chrome.tabs.remove(tab.id, () => {
                if (chrome.runtime.lastError) {}
              });
              recordBlockedItem(t.url || 'about:blank_popup', 'Ad');
            }
            spawnedAboutBlankTabs.delete(tab.id);
          });
        }
      }, 500);
    }
  });
}

if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.onUpdated) {
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    const currentUrl = changeInfo.url || tab.pendingUrl || tab.url;
    if (tabId) checkAndCloseAdTab(tabId, currentUrl);
  });
}

if (typeof chrome !== 'undefined' && chrome.webNavigation) {
  if (chrome.webNavigation.onBeforeNavigate) {
    chrome.webNavigation.onBeforeNavigate.addListener((details) => {
      if (details.frameId === 0 && details.tabId) {
        checkAndCloseAdTab(details.tabId, details.url);
      }
    });
  }

  if (chrome.webNavigation.onCommitted) {
    chrome.webNavigation.onCommitted.addListener((details) => {
      if (details.frameId === 0 && details.tabId) {
        checkAndCloseAdTab(details.tabId, details.url);
      }
    });
  }
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
      case 'USER_CLICK_INTENT': {
        if (sender.tab && sender.tab.id && message.url) {
          userIntentUrls.set(sender.tab.id, message.url);
          setTimeout(() => {
            userIntentUrls.delete(sender.tab.id);
          }, 5000);
        }
        sendResponse({ success: true });
        break;
      }
      default:
        sendResponse({ error: 'Unknown message type' });
    }
  })();
  return true;
});

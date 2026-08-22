import { executeAgentAction, generateUserClickToken } from '../actions/executor.js';
import { BrowserAIAgent, PageMetadata } from './agent-engine.js';
import {
  sendNativeDomExtract,
  sendNativeVectorSearch,
  sendNativeVectorInsert,
  sendNativeCheckSession,
  sendNativeValidatePath,
  sendNativeAutoUpdate,
  sendNativePing,
  scanPromptInjection
} from './native-bridge.js';


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

let latestUpdateDownloadUrl: string | null = null;

// Check for GitHub updates and display toolbar badge notification
async function checkGitHubReleaseUpdate() {
  try {
    const res = await fetch('https://api.github.com/repos/wachanga173/aibrowser/releases/latest');
    const data = await res.json();
    if (data && data.tag_name) {
      const latestTag = data.tag_name.replace('v', '');
      const currentVersion = chrome.runtime.getManifest().version;
      if (latestTag !== currentVersion) {
        const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '').toLowerCase();
        const isFirefox = typeof (globalThis as any).InstallTrigger !== 'undefined' || /firefox|fxios/.test(ua);
        const isSafari = /safari/.test(ua) && !/chrome|chromium|crios|android/.test(ua);
        const isBrave = (typeof (navigator as any)?.brave !== 'undefined') || /brave/.test(ua);
        const isEdge = /edg\//.test(ua);

        let primaryTarget = 'chrome';
        let fallbackFileName = 'chrome-extension.zip';

        if (isSafari) {
          primaryTarget = 'safari';
          fallbackFileName = 'safari-extension.zip';
        } else if (isFirefox) {
          primaryTarget = 'firefox';
          fallbackFileName = 'firefox-extension.zip';
        } else if (isBrave) {
          primaryTarget = 'brave';
          fallbackFileName = 'chrome-extension.zip';
        } else if (isEdge) {
          primaryTarget = 'edge';
          fallbackFileName = 'chrome-extension.zip';
        }

        let downloadUrl = `https://github.com/wachanga173/aibrowser/releases/download/${data.tag_name}/${fallbackFileName}`;

        if (data.assets && data.assets.length > 0) {
          let match = data.assets.find((a: any) => a.name && a.name.toLowerCase().includes(primaryTarget));
          if (!match && (primaryTarget === 'brave' || primaryTarget === 'edge' || primaryTarget === 'chrome')) {
            match = data.assets.find((a: any) => a.name && (a.name.toLowerCase().includes('chrome') || a.name.toLowerCase().includes('chromium')));
          }
          if (!match) {
            match = data.assets.find((a: any) => a.name && (a.name.endsWith('.zip') || a.name.endsWith('.xpi') || a.name.endsWith('.pkg')));
          }
          if (match && match.browser_download_url) {
            downloadUrl = match.browser_download_url;
          }
        }
        latestUpdateDownloadUrl = downloadUrl;

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

// ── First-party domains that must NEVER be blocked ────────────────────
// Borrowed from uBlock Origin's approach: legitimate services are allowlisted
// so that Videos, Images, Maps, and social media embeds load correctly.
const FIRST_PARTY_SAFE_DOMAINS = new Set([
  'youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com',
  'youtu.be', 'ytimg.com', 'i.ytimg.com', 'googlevideo.com',
  'maps.google.com', 'maps.googleapis.com', 'maps.gstatic.com',
  'google.com', 'www.google.com',
  'google.co.uk', 'google.ca', 'google.com.au', 'google.de',
  'google.fr', 'google.co.jp', 'google.co.in', 'google.com.br',
  'images.google.com', 'lens.google.com',
  'accounts.google.com', 'mail.google.com', 'drive.google.com',
  'docs.google.com', 'news.google.com', 'play.google.com',
  'gstatic.com', 'googleapis.com', 'googleusercontent.com', 'ggpht.com',
  'facebook.com', 'www.facebook.com', 'm.facebook.com',
  'fbcdn.net', 'instagram.com', 'www.instagram.com', 'cdninstagram.com',
  'bing.com', 'www.bing.com',
  'vimeo.com', 'player.vimeo.com',
  'dailymotion.com', 'twitch.tv', 'www.twitch.tv',
  'openstreetmap.org', 'tile.openstreetmap.org'
]);

function isSafeDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    // Check exact match first
    if (FIRST_PARTY_SAFE_DOMAINS.has(hostname)) return true;
    // Check if it's a subdomain of a safe domain
    for (const safe of FIRST_PARTY_SAFE_DOMAINS) {
      if (hostname.endsWith('.' + safe)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

const AD_DOMAIN_PATTERNS = [
  /google-analytics\.com/i,
  /doubleclick\.net/i,
  /googlesyndication\.com/i,
  /facebook\.net\/signals/i,
  /connect\.facebook\.net\/[^/]+\/fbevents\.js/i,
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

function isAdDomainUrl(url: string): boolean {
  if (!url || url === 'about:blank' || url.startsWith('chrome://') || url.startsWith('edge://') || url.startsWith('about:')) return false;
  // Never block first-party safe domains (YouTube, Maps, Images, Facebook, etc.)
  if (isSafeDomain(url)) return false;
  return AD_DOMAIN_PATTERNS.some(p => p.test(url)) || isSuspiciousRedirectDomain(url);
}

// ── Suspicious auto-generated redirect domain heuristic ──────────────────
// Streaming sites redirect through throwaway domains like
// "unfortunatelyejectinflected.com" that are 20+ char all-lowercase
// concatenated dictionary words on cheap TLDs.

const SUSPICIOUS_TLDS = new Set([
  'com', 'net', 'org', 'io', 'co', 'info', 'xyz', 'online', 'site',
  'top', 'icu', 'club', 'live', 'fun', 'buzz', 'click', 'link'
]);

function isSuspiciousRedirectDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (isSafeDomain(url)) return false;
    const parts = hostname.split('.');
    if (parts.length < 2) return false;
    const tld = parts[parts.length - 1];
    const sld = parts[parts.length - 2];
    if (!SUSPICIOUS_TLDS.has(tld)) return false;
    if (sld.length >= 20 && /^[a-z]+$/.test(sld)) return true;
    return false;
  } catch {
    return false;
  }
}

const spawnedAboutBlankTabs = new Set<number>();

// ── Redirect chain detection state ────────────────────────────────────
// Track newly opened tabs (those with an openerTabId) and monitor their
// navigation history.  If a tab visits 3+ distinct domains within 3
// seconds of being created, it is almost certainly a redirect-chain ad
// (e.g. streaming site -> randomword1.com -> randomword2.com -> ad).

const REDIRECT_CHAIN_WINDOW_MS = 3000;
const REDIRECT_CHAIN_DOMAIN_THRESHOLD = 3;

interface RedirectChainEntry {
  domains: string[];
  firstNavTime: number;
  openerTabId: number;
}

const redirectChainMap = new Map<number, RedirectChainEntry>();

function getBaseDomain(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function trackRedirectChain(tabId: number, url: string): void {
  const domain = getBaseDomain(url);
  if (!domain) return;

  // Only track tabs we are monitoring (registered on creation)
  const entry = redirectChainMap.get(tabId);
  if (!entry) return;

  // Skip safe domains — legitimate OAuth flows, etc.
  if (isSafeDomain(url)) {
    // If the tab has landed on a safe domain, stop tracking it
    redirectChainMap.delete(tabId);
    return;
  }

  // Expired window — stop tracking
  if (Date.now() - entry.firstNavTime > REDIRECT_CHAIN_WINDOW_MS) {
    redirectChainMap.delete(tabId);
    return;
  }

  // Add domain if it is new
  if (!entry.domains.includes(domain)) {
    entry.domains.push(domain);
  }

  // Check threshold
  if (entry.domains.length >= REDIRECT_CHAIN_DOMAIN_THRESHOLD) {
    chrome.tabs.remove(tabId, () => {
      if (chrome.runtime.lastError) {}
    });
    recordBlockedItem(url, 'Ad');
    redirectChainMap.delete(tabId);
  }
}

// ── Tab-burst detection state ─────────────────────────────────────────
// Track tab creation events per opener tab. If a single opener spawns
// 2+ new tabs within 2 seconds, close the excess tabs.

const TAB_BURST_WINDOW_MS = 2000;
const TAB_BURST_THRESHOLD = 2;

interface TabBurstEntry {
  tabId: number;
  timestamp: number;
  url: string;
}

// Map from openerTabId -> list of recently spawned tab entries
const tabBurstMap = new Map<number, TabBurstEntry[]>();

// Map from tabId -> the URL the user intended to navigate to (sent from content script)
const userIntentUrls = new Map<number, string>();

// Prune old entries from the burst map for a given opener
function pruneTabBurst(openerId: number): TabBurstEntry[] {
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

// Check if a newly created tab is part of a burst, and close excess tabs if so
function handleTabBurst(newTabId: number, openerId: number, url: string): boolean {
  const recent = pruneTabBurst(openerId);
  recent.push({ tabId: newTabId, timestamp: Date.now(), url });
  tabBurstMap.set(openerId, recent);

  if (recent.length >= TAB_BURST_THRESHOLD) {
    // We have a burst. Close all tabs in the burst EXCEPT the one matching
    // the user's intended URL (if any).
    const intendedUrl = userIntentUrls.get(openerId);
    let preservedOne = false;

    for (const entry of recent) {
      // Preserve the tab that matches the user's intended URL
      if (!preservedOne && intendedUrl && entry.url && normalizeUrl(entry.url) === normalizeUrl(intendedUrl)) {
        preservedOne = true;
        continue;
      }

      chrome.tabs.remove(entry.tabId, () => {
        if (chrome.runtime.lastError) {}
      });
      recordBlockedItem(entry.url || 'tab_burst_popup', 'Ad');
    }

    // Clear the burst entries — they have been handled
    tabBurstMap.delete(openerId);
    return true;
  }

  return false;
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return url;
  }
}

// Clean up intent URLs when tabs are closed
if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.onRemoved) {
  chrome.tabs.onRemoved.addListener((tabId) => {
    userIntentUrls.delete(tabId);
    spawnedAboutBlankTabs.delete(tabId);
    redirectChainMap.delete(tabId);
  });
}

function checkAndCloseAdTab(tabId: number, url?: string) {
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

    // Layer 1: Known ad domain — close immediately
    if (tab.id && targetUrl && isAdDomainUrl(targetUrl)) {
      chrome.tabs.remove(tab.id, () => {
        if (chrome.runtime.lastError) {}
      });
      recordBlockedItem(targetUrl, 'Ad');
      return;
    }

    // Layer 2: Tab-burst detection — if an opener tab is spawning tabs rapidly
    if (tab.id && tab.openerTabId && targetUrl && targetUrl !== 'about:blank') {
      const wasBurst = handleTabBurst(tab.id, tab.openerTabId, targetUrl);
      if (wasBurst) return;
    }

    // Layer 4: Register new opener-spawned tabs for redirect chain monitoring
    if (tab.id && tab.openerTabId) {
      redirectChainMap.set(tab.id, {
        domains: targetUrl && targetUrl !== 'about:blank' ? [getBaseDomain(targetUrl) || ''] : [],
        firstNavTime: Date.now(),
        openerTabId: tab.openerTabId
      });
      // Auto-expire tracking after the window elapses
      const trackedTabId = tab.id;
      setTimeout(() => {
        redirectChainMap.delete(trackedTabId);
      }, REDIRECT_CHAIN_WINDOW_MS + 500);
    }

    // Layer 3: Orphan about:blank popups — defer check to allow redirect chains
    if (tab.id && tab.openerTabId && (!targetUrl || targetUrl === 'about:blank' || targetUrl === '')) {
      spawnedAboutBlankTabs.add(tab.id);
      setTimeout(() => {
        if (spawnedAboutBlankTabs.has(tab.id!)) {
          chrome.tabs.get(tab.id!, (t) => {
            if (chrome.runtime.lastError) {
              spawnedAboutBlankTabs.delete(tab.id!);
              return;
            }
            if (t && (t.url === 'about:blank' || !t.url || isAdDomainUrl(t.url))) {
              chrome.tabs.remove(tab.id!, () => {
                if (chrome.runtime.lastError) {}
              });
              recordBlockedItem(t.url || 'about:blank_popup', 'Ad');
            }
            spawnedAboutBlankTabs.delete(tab.id!);
          });
        }
      }, 500);
    }
  });
}

// Intercept tab updates / redirects / morphing URLs
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
        // Feed redirect chain tracker
        trackRedirectChain(details.tabId, details.url);
      }
    });
  }
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
        const userPrompt = message.prompt || 'Summarize active page';

        try {
          // Step 1: Get the active tab
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          const activeTab = tabs[0];

          if (!activeTab || !activeTab.id) {
            sendResponse({ success: true, response: 'No active tab found. Open a webpage and try again.' });
            break;
          }

          // Check if we can inject into this tab
          const tabUrl = activeTab.url || '';
          if (tabUrl.startsWith('chrome://') || tabUrl.startsWith('edge://') || tabUrl.startsWith('about:') || tabUrl.startsWith('chrome-extension://')) {
            sendResponse({ success: true, response: 'Cannot analyze internal browser pages. Navigate to any website and try again.' });
            break;
          }

          // Step 2: Extract rich structured page content via scripting injection
          let pageData: PageMetadata | null = null;
          try {
            const injectionResults = await chrome.scripting.executeScript({
              target: { tabId: activeTab.id },
              func: () => {
                const title = document.title || '';
                const url = window.location.href || '';
                const domain = window.location.hostname || '';
                
                // Extract meta description
                const metaDescEl = document.querySelector('meta[name="description"]') || document.querySelector('meta[property="og:description"]');
                const description = metaDescEl ? (metaDescEl.getAttribute('content') || '') : '';

                // Extract headings
                const headingElements = Array.from(document.querySelectorAll('h1, h2, h3'));
                const headings = headingElements.slice(0, 15).map(h => ({
                  level: parseInt(h.tagName.substring(1), 10) || 2,
                  text: (h.textContent || '').trim()
                })).filter(h => h.text.length > 2);

                // Extract paragraphs
                const paragraphElements = Array.from(document.querySelectorAll('p, article, section, [role="main"]'));
                const paragraphs = paragraphElements.slice(0, 30).map(p => (p.textContent || '').trim()).filter(p => p.length > 30);

                // Extract key links
                const linkElements = Array.from(document.querySelectorAll('a[href]'));
                const links = linkElements.slice(0, 20).map(a => ({
                  text: (a.textContent || '').trim(),
                  href: a.getAttribute('href') || ''
                })).filter(l => l.text.length > 2 && !l.href.startsWith('#'));

                // Extract forms
                const formElements = Array.from(document.querySelectorAll('form'));
                const forms = formElements.slice(0, 5).map((f, i) => ({
                  id: f.id || `form_${i}`,
                  action: f.action || '',
                  inputs: Array.from(f.querySelectorAll('input, select, textarea')).map(el => (el.getAttribute('name') || el.getAttribute('type') || el.tagName.toLowerCase()))
                }));

                // Extract scripts and third party domains
                const scripts = Array.from(document.querySelectorAll('script[src]'));
                const scriptsCount = scripts.length;
                const thirdPartyDomains: string[] = [];
                scripts.forEach(s => {
                  const src = s.getAttribute('src') || '';
                  try {
                    const host = new URL(src, window.location.href).hostname;
                    if (host && host !== domain && !thirdPartyDomains.includes(host)) {
                      thirdPartyDomains.push(host);
                    }
                  } catch (e) {}
                });

                // Extract visible body text (clean and bounded)
                const bodyText = (document.body ? document.body.innerText : '') || '';
                const wordCount = bodyText.split(/\s+/).filter(Boolean).length;
                const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

                return {
                  title,
                  url,
                  domain,
                  description,
                  headings,
                  paragraphs,
                  links,
                  forms,
                  scriptsCount,
                  thirdPartyDomains,
                  readingTimeMinutes,
                  wordCount,
                  rawText: bodyText.substring(0, 16000)
                };
              }
            });

            if (injectionResults && injectionResults[0] && injectionResults[0].result) {
              pageData = injectionResults[0].result as PageMetadata;
            }
          } catch (extractErr) {
            sendResponse({ success: true, response: 'Could not inspect page structure. The page may still be loading or restricted by security policy.' });
            break;
          }

          if (!pageData || !pageData.rawText || pageData.rawText.trim().length < 20) {
            sendResponse({ success: true, response: 'This page has very little readable text content to analyze.' });
            break;
          }

          // Step 3: Sanitize via native bridge & DOM extraction wall
          const sanitized = await sendNativeDomExtract(pageData.rawText);
          if (sanitized && sanitized.visible_text) {
            pageData.rawText = sanitized.visible_text;
          }

          // Step 4: Scan for indirect prompt injections
          const injectionResult = scanPromptInjection(pageData.rawText);
          if (injectionResult.is_suspicious) {
            pageData.rawText = injectionResult.sanitized_output;
          }

          // Step 5: Run Intelligent Browser AI Agent Engine
          const agent = new BrowserAIAgent();
          const agentResult = await agent.processQuery(userPrompt, pageData);

          const injectionWarning = injectionResult.is_suspicious ? '\n\n**Notice**: Indirect prompt injection directives were detected in page text and isolated.' : '';
          const finalResponse = `${agentResult.answer}${injectionWarning}`;

          sendResponse({
            success: true,
            response: finalResponse,
            intent: agentResult.intent,
            keySentences: agentResult.keySentences,
            pageTitle: pageData.title,
            readingTime: pageData.readingTimeMinutes,
            modelUsed: agentResult.modelUsed
          });
        } catch (err) {
          sendResponse({ success: true, response: 'An error occurred while processing your request. Please try again.' });
        }
        break;
      }
      case 'HIGHLIGHT_ON_PAGE': {
        try {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          const activeTab = tabs[0];
          if (!activeTab || !activeTab.id) {
            sendResponse({ success: false, error: 'No active tab found.' });
            break;
          }

          const sentencesToHighlight = message.sentences || [];
          await chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            args: [sentencesToHighlight],
            func: (sentences: string[]) => {
              // Remove prior highlight markers if any
              document.querySelectorAll('.privacy-guard-highlight').forEach(el => {
                const parent = el.parentNode;
                if (parent) {
                  parent.replaceChild(document.createTextNode(el.textContent || ''), el);
                  parent.normalize();
                }
              });
              const oldBanner = document.getElementById('privacyGuardHighlightBanner');
              if (oldBanner) oldBanner.remove();

              if (!sentences || sentences.length === 0) return;

              let highlightedCount = 0;
              let firstEl: HTMLElement | null = null;

              // Helper to walk text nodes and wrap target snippets
              const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
              const textNodes: Text[] = [];
              let currentNode = walker.nextNode();
              while (currentNode) {
                const parentTag = (currentNode.parentElement?.tagName || '').toLowerCase();
                if (parentTag !== 'script' && parentTag !== 'style' && parentTag !== 'noscript' && parentTag !== 'textarea') {
                  textNodes.push(currentNode as Text);
                }
                currentNode = walker.nextNode();
              }

              for (const targetSentence of sentences) {
                const cleanTarget = targetSentence.trim().toLowerCase();
                if (cleanTarget.length < 15) continue;
                // Grab first 40 chars for reliable match
                const needle = cleanTarget.substring(0, 45);

                for (const node of textNodes) {
                  const nodeVal = (node.nodeValue || '').toLowerCase();
                  const matchIdx = nodeVal.indexOf(needle);
                  if (matchIdx !== -1 && node.parentNode) {
                    const span = document.createElement('mark');
                    span.className = 'privacy-guard-highlight';
                    span.style.cssText = 'background: rgba(138, 92, 246, 0.35) !important; color: inherit !important; border-bottom: 2px solid hsl(252, 85%, 67%) !important; border-radius: 3px !important; padding: 2px 2px !important; transition: background 0.3s !important;';
                    
                    const before = (node.nodeValue || '').substring(0, matchIdx);
                    const matched = (node.nodeValue || '').substring(matchIdx, matchIdx + targetSentence.length);
                    const after = (node.nodeValue || '').substring(matchIdx + matched.length);

                    span.textContent = matched || (node.nodeValue || '').substring(matchIdx, matchIdx + 45);
                    const fragment = document.createDocumentFragment();
                    if (before) fragment.appendChild(document.createTextNode(before));
                    fragment.appendChild(span);
                    if (after) fragment.appendChild(document.createTextNode(after));

                    node.parentNode.replaceChild(fragment, node);
                    highlightedCount++;
                    if (!firstEl) firstEl = span;
                    break;
                  }
                }
              }

              if (firstEl) {
                firstEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }

              // Floating indicator with dismiss button
              const banner = document.createElement('div');
              banner.id = 'privacyGuardHighlightBanner';
              banner.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 999999; background: rgba(22, 27, 38, 0.95); color: #fff; border: 1px solid rgba(138, 92, 246, 0.5); border-radius: 12px; padding: 10px 16px; font-family: -apple-system, sans-serif; font-size: 13px; display: flex; align-items: center; gap: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); backdrop-filter: blur(12px);';
              banner.innerHTML = `<span>Highlighted ${highlightedCount} key insights on page</span><button id="pgDismissBtn" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; border-radius: 6px; padding: 4px 8px; cursor: pointer; font-size: 11px;">Dismiss</button>`;
              document.body.appendChild(banner);

              document.getElementById('pgDismissBtn')?.addEventListener('click', () => {
                banner.remove();
                document.querySelectorAll('.privacy-guard-highlight').forEach(el => {
                  const parent = el.parentNode;
                  if (parent) {
                    parent.replaceChild(document.createTextNode(el.textContent || ''), el);
                    parent.normalize();
                  }
                });
              });
            }
          });

          sendResponse({ success: true });
        } catch (e) {
          sendResponse({ success: false, error: 'Could not apply highlights to tab.' });
        }
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
      case 'VECTOR_SEARCH': {
        const result = await sendNativeVectorSearch(message.queryEmbedding);
        sendResponse(result);
        break;
      }
      case 'VECTOR_INSERT': {
        const result = await sendNativeVectorInsert(message.id, message.topic, message.embedding, message.engagement);
        sendResponse(result);
        break;
      }
      case 'CHECK_SESSION': {
        const result = await sendNativeCheckSession(message.domain);
        sendResponse(result);
        break;
      }
      case 'VALIDATE_PATH': {
        const result = await sendNativeValidatePath(message.path);
        sendResponse(result);
        break;
      }
      case 'OPEN_CONFIRMATION_DIALOG': {
        if (chrome.windows && chrome.windows.create) {
          await chrome.windows.create({
            url: chrome.runtime.getURL('src/ui/confirmation/dialog.html'),
            type: 'popup',
            width: 440,
            height: 320
          });
        }
        sendResponse({ success: true, status: 'dialog_opened' });
        break;
      }
      case 'GET_MEMORY_ANALYTICS': {
        try {
          // Detect cross-browser API namespace (Chrome, Firefox WebExtensions, Edge, Brave, Opera)
          const api = typeof chrome !== 'undefined' ? chrome : (globalThis as any).browser;
          
          let systemCapacityBytes = 16 * 1024 * 1024 * 1024;
          let availableCapacityBytes = 6 * 1024 * 1024 * 1024;

          // Attempt Chromium system memory API
          if (api.system && api.system.memory && api.system.memory.getInfo) {
            try {
              const memInfo = await new Promise<any>((resolve) => api.system.memory.getInfo(resolve));
              if (memInfo && memInfo.capacity) {
                systemCapacityBytes = memInfo.capacity;
                availableCapacityBytes = memInfo.availableCapacity;
              }
            } catch (memErr) {}
          } else if (typeof navigator !== 'undefined' && (navigator as any).deviceMemory) {
            // Firefox & Web standard fallback via Device Memory API
            const devMemoryGB = (navigator as any).deviceMemory || 8;
            systemCapacityBytes = devMemoryGB * 1024 * 1024 * 1024;
            availableCapacityBytes = Math.round(systemCapacityBytes * 0.38); // estimated free margin
          }

          const allTabs = await api.tabs.query({});
          const totalTabsCount = allTabs.length;
          const discardedTabsCount = allTabs.filter((t: any) => t.discarded || t.hidden).length;
          const activeTabs = await api.tabs.query({ active: true, currentWindow: true });
          const activeTab = activeTabs[0];

          let pageMemory = {
            usedJSHeapSize: 0,
            totalJSHeapSize: 0,
            jsHeapSizeLimit: 0,
            domNodesCount: 0,
            scriptCount: 0,
            imageCount: 0,
            browserEngine: 'Chromium / Gecko'
          };

          if (activeTab && activeTab.id && activeTab.url && !activeTab.url.startsWith('chrome://') && !activeTab.url.startsWith('edge://') && !activeTab.url.startsWith('about:') && !activeTab.url.startsWith('chrome-extension://') && !activeTab.url.startsWith('moz-extension://')) {
            try {
              const probeResults = await api.scripting.executeScript({
                target: { tabId: activeTab.id },
                func: () => {
                  const perfMem = (window.performance as any)?.memory || {};
                  const domNodes = document.getElementsByTagName('*').length;
                  const scripts = document.scripts.length;
                  const images = document.images.length;
                  
                  // In Firefox where perfMem is restricted for anti-fingerprinting, estimate heap from DOM weight
                  let usedHeap = perfMem.usedJSHeapSize || 0;
                  let totalHeap = perfMem.totalJSHeapSize || 0;
                  if (!usedHeap && domNodes > 0) {
                    usedHeap = Math.round((domNodes * 1250) + (scripts * 45000) + (images * 150000));
                    totalHeap = Math.round(usedHeap * 1.4);
                  }

                  const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
                  const isEdge = navigator.userAgent.toLowerCase().includes('edg');
                  const isBrave = (navigator as any).brave !== undefined;
                  let engineName = 'Chrome';
                  if (isFirefox) engineName = 'Firefox';
                  else if (isEdge) engineName = 'Microsoft Edge';
                  else if (isBrave) engineName = 'Brave';

                  return {
                    usedJSHeapSize: usedHeap,
                    totalJSHeapSize: totalHeap,
                    jsHeapSizeLimit: perfMem.jsHeapSizeLimit || 0,
                    domNodesCount: domNodes,
                    scriptCount: scripts,
                    imageCount: images,
                    browserEngine: engineName
                  };
                }
              });
              if (probeResults && probeResults[0] && probeResults[0].result) {
                pageMemory = probeResults[0].result;
              }
            } catch (probeErr) {}
          }

          const usedCapacityBytes = Math.max(0, systemCapacityBytes - availableCapacityBytes);
          const usedPercent = Math.min(100, Math.max(1, Math.round((usedCapacityBytes / (systemCapacityBytes || 1)) * 100)));

          sendResponse({
            success: true,
            systemCapacityBytes,
            availableCapacityBytes,
            usedCapacityBytes,
            usedPercent,
            totalTabsCount,
            discardedTabsCount,
            activeTabTitle: activeTab ? activeTab.title : '',
            pageMemory
          });
        } catch (e) {
          sendResponse({ success: false, error: 'Could not compute memory analytics' });
        }
        break;
      }
      case 'OPTIMIZE_TABS_RAM': {
        try {
          const api = typeof chrome !== 'undefined' ? chrome : (globalThis as any).browser;
          const allTabs = await api.tabs.query({});
          let discardedCount = 0;

          for (const tab of allTabs) {
            if (!tab.active && !tab.discarded && tab.id && !tab.pinned && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://') && !tab.url.startsWith('about:') && !tab.url.startsWith('moz-extension://')) {
              try {
                if (api.tabs.discard) {
                  await api.tabs.discard(tab.id);
                  discardedCount++;
                }
              } catch (discErr) {}
            }
          }

          sendResponse({
            success: true,
            discardedCount,
            estimatedMemoryFreedMB: discardedCount * 85
          });
        } catch (optErr) {
          sendResponse({ success: false, error: 'Could not discard background tabs.' });
        }
        break;
      }

      case 'PERFORM_IN_PLACE_UPDATE': {
        sendNativeAutoUpdate(message.version || 'latest')
          .then((result: { success?: boolean; message?: string; error?: string }) => {
            if (result && result.success) {
              sendResponse({ success: true, message: result.message || 'In-place update completed successfully.' });
            } else {
              sendResponse({ success: false, error: (result && result.error) || 'Update failed with unknown error.' });
            }
          })
          .catch((err: Error) => {
            sendResponse({ success: false, error: err.message || 'Native host communication failed.' });
          });
        break;
      }
      case 'HUMAN_CONFIRMATION_GRANTED': {
        const token = message.token || generateUserClickToken(message.actionId || 'action_req');
        sendResponse({ success: true, token });
        break;
      }
      case 'PING_NATIVE_HOST': {
        sendNativePing()
          .then((result: { payload?: { status?: string; error?: string } }) => {
            if (result && result.payload && result.payload.status === 'pong') {
              sendResponse({ success: true });
            } else if (result && result.payload && result.payload.status === 'simulated_local') {
              sendResponse({ success: false, error: result.payload.error || 'Native host not installed.' });
            } else {
              sendResponse({ success: true });
            }
          })
          .catch((err: Error) => {
            sendResponse({ success: false, error: err.message || 'Native host not reachable.' });
          });
        break;
      }
      case 'OPEN_SETUP_PAGE': {
        chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/setup/index.html') });
        sendResponse({ success: true });
        break;
      }
      default:
        sendResponse({ error: 'Unknown message type' });
    }

  })();

  return true; // Keep channel open for async response
});


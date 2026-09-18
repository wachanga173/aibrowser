/**
 * Content Script (Isolated World) — Heuristic Fingerprinting, DOM Monitoring & Click Hijack Defense
 * Runs across all frames in browser context to detect canvas fingerprinting, excessive navigator property reads,
 * dynamically injected ad anchors, and transparent click-hijack overlay wrappers.
 */

let navigatorReadCount = 0;
let canvasOperationCount = 0;

// Intercept navigator property queries
const NAVIGATOR_PROPS = ['userAgent', 'plugins', 'languages', 'hardwareConcurrency', 'deviceMemory', 'platform'];

NAVIGATOR_PROPS.forEach(prop => {
  try {
    const original = navigator[prop];
    Object.defineProperty(navigator, prop, {
      get() {
        navigatorReadCount++;
        checkHeuristicThresholds();
        return original;
      }
    });
  } catch (e) {
    // Ignore non-configurable properties
  }
});

// Intercept HTMLCanvasElement methods
if (typeof HTMLCanvasElement !== 'undefined') {
  const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = function (...args) {
    canvasOperationCount++;
    checkHeuristicThresholds();
    return originalToDataURL.apply(this, args);
  };
}

function checkHeuristicThresholds() {
  if (canvasOperationCount >= 2 || navigatorReadCount >= 8) {
    chrome.runtime.sendMessage({
      type: 'RECORD_HEURISTIC_BLOCK',
      url: window.location.href,
      domain: window.location.hostname
    });
  }
}

// ── Inject Cosmetic Styles to Hide Common Ad Slots ───────────────────
(function injectCosmeticStyles() {
  const css = '.adsbox, .ad-banner, .ad-wrapper, .ad_box, .ad_banner, .ad_wrapper, .ad-container, .ad_container, .ad-slot, .ad_slot, .ad-placeholder, .ad-unit, .ad-placement, .adsbygoogle, .sponsored-post, [class*="adsbox"], [class*="ad-banner"], [class*="ad-wrapper"], [id*="google_ads_iframe"], [id*="ad-wrapper"], [id*="ad-banner"] { display: none !important; visibility: hidden !important; opacity: 0 !important; height: 0 !important; width: 0 !important; pointer-events: none !important; }';
  function apply() {
    const parent = document.head || document.documentElement;
    if (parent && !document.getElementById('privacy-guard-cosmetic-style')) {
      const style = document.createElement('style');
      style.id = 'privacy-guard-cosmetic-style';
      style.textContent = css;
      parent.appendChild(style);
    }
  }
  apply();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  }
})();

const AD_PATTERN_REGEX = /(?:google-analytics\.com|googletagmanager\.com|doubleclick\.net|googlesyndication\.com|facebook\.net\/signals|connect\.facebook\.net|scorecardresearch\.com|adservice\.google\.com|adnxs\.com|criteo\.com|criteo\.net|taboola\.com|outbrain\.com|hotjar\.com|segment\.io|segment\.com|clarity\.ms|amazon-adsystem\.com|pubmatic\.com|rubiconproject\.com|openx\.net|quantserve\.com|revcontent\.com|mgid\.com|content-ad\.net|zemanta\.com|ntv\.io|sharethrough\.com|3lift\.com|triplelift\.com|applovin\.com|supersonicads\.com|ironsrc\.com|vungle\.com|chartboost\.com|inmobi\.com|rayjump\.com|mintegral\.com|fyber\.com|smaato\.net|adroll\.com|casalemedia\.com|teads\.tv|spotxchange\.com|freewheel\.tv|tremorhub\.com|connatix\.com|bluekai\.com|id5-sync\.com|crwdcntrl\.net|imrworldwide\.com|rlcdn\.com|adsrvr\.org|agkn\.com|tapad\.com|drawbrid\.ge|sc-static\.net|amplitude\.com|mixpanel\.com|mxpnl\.com|fullstory\.com|heapanalytics\.com|crazyegg\.com|popads|popcash|propellerads|adsterra|exoclick|clickadu|hilltopads|trafficjunky|monetag|yllix|richpush|pushground|zeropark|galaksion|trafficstars|adxad|admaven|revenuehits|bidvertiser|clickorience|smarturl|adf\.ly|ouo\.io|shrinkearn|highcpmgate|highcpmrevenues|wrestpop|popdownload|downloadnow|popunder|click_id=pop|adcash|adkeeper|adkernel|adtrue|adspyglass|adsupply|adxpansion|adcombo|adworkmedia|clickdealer|clickguard|deloton|onclickprediction|onclickmega|onclickalgo|onclicksuper|onclickperformance|propu|voluum|keitaro|binom|redtrack|bemob|adsbridge|peerclick|octotracker|funnelflux|traffichaus|trafficforce|trafficcompany|linkvertise|cpagrip|cpalead|ogads|realsrv|adtng|clkmr|clksite|directrev|adkmob|leadbolt|startapp|mobfox|smartlink|rotator)/i;

// ── First-party safe domains ──────────────────────────────────────────
const SAFE_DOMAIN_SUFFIXES = [
  'youtube.com', 'youtu.be', 'ytimg.com', 'googlevideo.com',
  'google.com', 'google.co.uk', 'google.ca', 'google.com.au',
  'google.de', 'google.fr', 'google.co.jp', 'google.co.in', 'google.com.br',
  'googleapis.com', 'googleusercontent.com', 'gstatic.com', 'ggpht.com',
  'facebook.com', 'fbcdn.net', 'instagram.com', 'cdninstagram.com',
  'bing.com', 'vimeo.com', 'dailymotion.com', 'twitch.tv',
  'openstreetmap.org', 'github.com', 'microsoft.com'
];

function isSafeUrl(urlStr) {
  try {
    const hostname = new URL(urlStr).hostname.toLowerCase();
    for (const safe of SAFE_DOMAIN_SUFFIXES) {
      if (hostname === safe || hostname.endsWith('.' + safe)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

const SUSPICIOUS_TLDS = new Set([
  'com', 'net', 'org', 'io', 'co', 'info', 'xyz', 'online', 'site',
  'top', 'icu', 'club', 'live', 'fun', 'buzz', 'click', 'link', 'work', 'vip',
  'pro', 'cc', 'ws', 'me', 'pw', 'monster', 'quest', 'space', 'surf', 'rest',
  'best', 'stream', 'win', 'bid', 'racing', 'date', 'faith', 'trade', 'review',
  'party', 'gq', 'cf', 'ga', 'ml', 'tk', 'loan', 'download', 'app'
]);

const SUSPICIOUS_KEYWORDS = /(?:click|track|pop|jump|direct|rotat|gate|redir|offer|bonus|prize|reward|promot|adserver|smartlink|affiliate|traff|cpa|cpm|lead|monetiz|revenue|banner|sponsor|lander|adster|traffic|yield|campaign)/i;

const SUSPICIOUS_QUERY_PARAMS = /(?:click_id|aff_id|offer_id|campaign_id|subid|smartlink|cpa|rotator|track_id|ad_id|popunder|pop_id)=/i;

function isSuspiciousRedirectDomain(urlStr) {
  if (!urlStr) return false;
  try {
    if (isSafeUrl(urlStr)) return false;
    if (SUSPICIOUS_QUERY_PARAMS.test(urlStr)) return true;
    const hostname = new URL(urlStr).hostname.toLowerCase();
    const parts = hostname.split('.');
    if (parts.length < 2) return false;
    const tld = parts[parts.length - 1];
    const sld = parts[parts.length - 2];
    if (!SUSPICIOUS_TLDS.has(tld)) return false;
    if (sld.length >= 16 && /^[a-z]+$/.test(sld)) return true;
    if (SUSPICIOUS_KEYWORDS.test(sld) || /\d{3,}/.test(sld) || (sld.indexOf('-') !== -1 && SUSPICIOUS_KEYWORDS.test(urlStr))) return true;
    return false;
  } catch {
    return false;
  }
}

function isAdUrlPattern(urlStr) {
  if (!urlStr) return false;
  if (/\.(png|jpe?g|gif|webp|svg|avif|bmp|ico|tiff|pdf)(\?.*)?$/i.test(urlStr)) {
    return false;
  }
  if (isSafeUrl(urlStr)) return false;
  return AD_PATTERN_REGEX.test(urlStr) || isSuspiciousRedirectDomain(urlStr);
}

// ── Intercept window.open in isolated content script context ─────────
if (typeof window !== 'undefined') {
  const originalWindowOpen = window.open;
  window.open = function (url, target, features) {
    const urlStr = url ? url.toString() : '';
    if (urlStr && isAdUrlPattern(urlStr)) {
      chrome.runtime.sendMessage({
        type: 'RECORD_HEURISTIC_BLOCK',
        url: urlStr,
        domain: urlStr,
        category: 'Ad'
      });
      return null;
    }
    return originalWindowOpen.apply(this, [url, target, features]);
  };
}

// ── Click hijack detection & intent tracking ─────────────────────────

if (typeof document !== 'undefined') {
  document.addEventListener('click', (event) => {
    const anchor = (event.target && event.target.closest) ? event.target.closest('a') : null;
    if (anchor && anchor.href) {
      chrome.runtime.sendMessage({
        type: 'USER_CLICK_INTENT',
        url: anchor.href,
        target: anchor.target || ''
      });

      if (isAdUrlPattern(anchor.href)) {
        if (anchor.target === '_blank' || event.ctrlKey || event.shiftKey || event.metaKey) {
          event.preventDefault();
          event.stopPropagation();
          chrome.runtime.sendMessage({
            type: 'RECORD_HEURISTIC_BLOCK',
            url: anchor.href,
            domain: anchor.href,
            category: 'Ad'
          });
        }
      }
    }
  }, true);

  document.addEventListener('mousedown', (event) => {
    const anchor = (event.target && event.target.closest) ? event.target.closest('a') : null;
    if (anchor && anchor.href) {
      chrome.runtime.sendMessage({
        type: 'USER_CLICK_INTENT',
        url: anchor.href,
        target: anchor.target || ''
      });
    }
  }, true);
}

// ── MutationObserver: Injected Anchors & Transparent Click Overlays ──

if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
  const recentlyInjectedAnchors = new WeakSet();

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        const element = node;

        // Check if the node is an anchor
        if (element.tagName === 'A') {
          checkSuspiciousAnchor(element);
        }

        // Check child anchors
        const childAnchors = element.querySelectorAll ? element.querySelectorAll('a[target="_blank"], a[target="_new"]') : null;
        if (childAnchors) {
          childAnchors.forEach((a) => checkSuspiciousAnchor(a));
        }

        // Check for invisible/transparent full-screen click-hijack overlay wrappers
        checkSuspiciousOverlay(element);
      }
    }
  });

  function checkSuspiciousOverlay(el) {
    if (!el.style) return;
    try {
      const zIndex = parseInt(el.style.zIndex || '0', 10);
      const isFixedOrAbsolute = el.style.position === 'fixed' || el.style.position === 'absolute';
      const isTransparent = el.style.opacity === '0' || el.style.backgroundColor === 'transparent';

      // If a script injects a massive transparent element with huge z-index over the viewport
      if (isFixedOrAbsolute && zIndex >= 9999 && isTransparent) {
        el.style.pointerEvents = 'none';
        el.style.display = 'none';
      }
    } catch (e) {}
  }

  function checkSuspiciousAnchor(anchor) {
    if (!anchor.href) return;
    const target = anchor.target || '';
    if (target !== '_blank' && target !== '_new') return;

    if (isAdUrlPattern(anchor.href)) {
      neutralizeAnchor(anchor);
      return;
    }

    recentlyInjectedAnchors.add(anchor);

    const originalClick = anchor.click;
    anchor.click = function () {
      if (recentlyInjectedAnchors.has(anchor)) {
        neutralizeAnchor(anchor);
        chrome.runtime.sendMessage({
          type: 'RECORD_HEURISTIC_BLOCK',
          url: anchor.href,
          domain: anchor.href,
          category: 'Ad'
        });
        return;
      }
      return originalClick.apply(this);
    };

    setTimeout(() => {
      recentlyInjectedAnchors.delete(anchor);
      if (document.contains(anchor)) {
        anchor.click = originalClick;
      }
    }, 200);
  }

  function neutralizeAnchor(anchor) {
    anchor.removeAttribute('href');
    anchor.removeAttribute('target');
    anchor.style.pointerEvents = 'none';
    const rect = anchor.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0 || anchor.style.display === 'none' || anchor.style.visibility === 'hidden') {
      anchor.remove();
    }
  }

  if (document.documentElement) {
    observer.observe(document.documentElement, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.documentElement, { childList: true, subtree: true });
    });
  }
}

/**
 * Content Script (Isolated World, JavaScript for Unpacked Loading)
 * Heuristic Fingerprinting, DOM Monitoring & Click Hijack Detection
 */

let navigatorReadCount = 0;
let canvasOperationCount = 0;

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
  } catch (e) {}
});

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

const AD_PATTERN_REGEX = /(?:google-analytics\.com|googletagmanager\.com|doubleclick\.net|googlesyndication\.com|facebook\.net\/signals|connect\.facebook\.net|scorecardresearch\.com|adservice\.google\.com|adnxs\.com|criteo\.com|criteo\.net|taboola\.com|outbrain\.com|hotjar\.com|segment\.io|segment\.com|clarity\.ms|amazon-adsystem\.com|pubmatic\.com|rubiconproject\.com|openx\.net|quantserve\.com|revcontent\.com|mgid\.com|content-ad\.net|zemanta\.com|ntv\.io|sharethrough\.com|3lift\.com|triplelift\.com|applovin\.com|supersonicads\.com|ironsrc\.com|vungle\.com|chartboost\.com|inmobi\.com|rayjump\.com|mintegral\.com|fyber\.com|smaato\.net|adroll\.com|casalemedia\.com|teads\.tv|spotxchange\.com|freewheel\.tv|tremorhub\.com|connatix\.com|bluekai\.com|id5-sync\.com|crwdcntrl\.net|imrworldwide\.com|rlcdn\.com|adsrvr\.org|agkn\.com|tapad\.com|drawbrid\.ge|sc-static\.net|amplitude\.com|mixpanel\.com|mxpnl\.com|fullstory\.com|heapanalytics\.com|crazyegg\.com|wrestpop|popdownload|downloadnow|popunder|click_id=pop)/i;

// ── First-party safe domains (borrowed from uBlock Origin approach) ──────
// These domains must never be blocked so Videos, Images, Maps work correctly.
const SAFE_DOMAIN_SUFFIXES = [
  'youtube.com', 'youtu.be', 'ytimg.com', 'googlevideo.com',
  'google.com', 'google.co.uk', 'google.ca', 'google.com.au',
  'google.de', 'google.fr', 'google.co.jp', 'google.co.in', 'google.com.br',
  'googleapis.com', 'googleusercontent.com', 'gstatic.com', 'ggpht.com',
  'facebook.com', 'fbcdn.net', 'instagram.com', 'cdninstagram.com',
  'bing.com', 'vimeo.com', 'dailymotion.com', 'twitch.tv',
  'openstreetmap.org'
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

function isAdUrlPattern(urlStr) {
  if (!urlStr) return false;
  if (/\.(png|jpe?g|gif|webp|svg|avif|bmp|ico|tiff|pdf)(\?.*)?$/i.test(urlStr)) {
    return false;
  }
  // Never block first-party safe domains
  if (isSafeUrl(urlStr)) return false;
  return AD_PATTERN_REGEX.test(urlStr);
}

// Window open interception is natively executed in MAIN world via main-world.js

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

// ── Enhanced click hijack detection ─────────────────────────────────────

let userClickedAnchorHref = null;

if (typeof document !== 'undefined') {
  document.addEventListener('click', function (event) {
    const anchor = event.target && event.target.closest ? event.target.closest('a') : null;
    if (anchor && anchor.href) {
      userClickedAnchorHref = anchor.href;

      chrome.runtime.sendMessage({
        type: 'USER_CLICK_INTENT',
        url: anchor.href,
        target: anchor.target || ''
      });
    } else {
      userClickedAnchorHref = null;
    }

    if (anchor && anchor.href && isAdUrlPattern(anchor.href)) {
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

    setTimeout(function () {
      userClickedAnchorHref = null;
    }, 0);
  }, true);

  document.addEventListener('mousedown', function (event) {
    const anchor = event.target && event.target.closest ? event.target.closest('a') : null;
    if (anchor && anchor.href) {
      chrome.runtime.sendMessage({
        type: 'USER_CLICK_INTENT',
        url: anchor.href,
        target: anchor.target || ''
      });
    }
  }, true);
}

// ── MutationObserver: Detect dynamically injected ad anchors ────────────

if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
  const recentlyInjectedAnchors = new WeakSet();

  const observer = new MutationObserver(function (mutations) {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;

        const element = node;

        if (element.tagName === 'A') {
          checkSuspiciousAnchor(element);
        }

        const childAnchors = element.querySelectorAll ? element.querySelectorAll('a[target="_blank"], a[target="_new"]') : [];
        if (childAnchors) {
          childAnchors.forEach(function (a) { checkSuspiciousAnchor(a); });
        }
      }
    }
  });

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

    setTimeout(function () {
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
    document.addEventListener('DOMContentLoaded', function () {
      observer.observe(document.documentElement, { childList: true, subtree: true });
    });
  }
}

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
}

const AD_PATTERN_REGEX = /(?:google-analytics\.com|doubleclick\.net|googlesyndication\.com|facebook\.net\/signals|scorecardresearch\.com|adservice\.google\.com|adnxs\.com|criteo\.com|taboola\.com|outbrain\.com|hotjar\.com|segment\.io|clarity\.ms|amazon-adsystem\.com|pubmatic\.com|rubiconproject\.com|openx\.net|quantserve\.com|wrestpop|popdownload|downloadnow|popunder|click_id=pop)/i;

function isAdUrlPattern(urlStr) {
  if (!urlStr) return false;
  if (/\.(png|jpe?g|gif|webp|svg|avif|bmp|ico|tiff|pdf)(\?.*)?$/i.test(urlStr)) {
    return false;
  }
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

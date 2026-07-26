/**
 * Content Script (Isolated World) — Heuristic Fingerprinting, DOM Monitoring & Click Hijack Detection
 * Runs in browser context to detect canvas fingerprinting, excessive navigator property reads,
 * and dynamically injected ad anchors that auto-open new tabs.
 */

let navigatorReadCount = 0;
let canvasOperationCount = 0;

// Intercept navigator property queries
const NAVIGATOR_PROPS = ['userAgent', 'plugins', 'languages', 'hardwareConcurrency', 'deviceMemory', 'platform'];

NAVIGATOR_PROPS.forEach(prop => {
  try {
    const original = (navigator as any)[prop];
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
    // Notify background worker of fingerprinting attempt
    chrome.runtime.sendMessage({
      type: 'RECORD_HEURISTIC_BLOCK',
      url: window.location.href,
      domain: window.location.hostname
    });
  }
}

const AD_PATTERN_REGEX = /(?:google-analytics\.com|doubleclick\.net|googlesyndication\.com|facebook\.net\/signals|scorecardresearch\.com|adservice\.google\.com|adnxs\.com|criteo\.com|taboola\.com|outbrain\.com|hotjar\.com|segment\.io|clarity\.ms|amazon-adsystem\.com|pubmatic\.com|rubiconproject\.com|openx\.net|quantserve\.com|wrestpop|popdownload|downloadnow|popunder|click_id=pop)/i;

function isAdUrlPattern(urlStr: string): boolean {
  if (!urlStr) return false;
  if (/\.(png|jpe?g|gif|webp|svg|avif|bmp|ico|tiff|pdf)(\?.*)?$/i.test(urlStr)) {
    return false;
  }
  return AD_PATTERN_REGEX.test(urlStr);
}

// Window open interception is natively executed in MAIN world via main-world.js

// Intercept window.open calls in isolated content script context
if (typeof window !== 'undefined') {
  const originalWindowOpen = window.open;
  window.open = function (url?: string | URL, target?: string, features?: string) {
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
    return originalWindowOpen.apply(this, [url, target, features] as any);
  };
}

// ── Enhanced click hijack detection ─────────────────────────────────────
// Track the user's actual click target so we can distinguish user-intended
// navigations from parasitic ad link clicks.

let userClickedAnchorHref: string | null = null;

if (typeof document !== 'undefined') {
  // Capture the user's intended anchor on click (capture phase, runs first)
  document.addEventListener('click', (event: MouseEvent) => {
    const anchor = (event.target as HTMLElement)?.closest?.('a') as HTMLAnchorElement | null;
    if (anchor && anchor.href) {
      userClickedAnchorHref = anchor.href;

      // Report the user's intended URL to the background service worker
      // so the tab-burst detector can preserve user-intended navigation.
      chrome.runtime.sendMessage({
        type: 'USER_CLICK_INTENT',
        url: anchor.href,
        target: anchor.target || ''
      });
    } else {
      userClickedAnchorHref = null;
    }

    // Block clicks on anchors pointing to known ad URLs
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

    // Clear the intent after the synchronous event dispatch completes
    setTimeout(() => {
      userClickedAnchorHref = null;
    }, 0);
  }, true);

  // Also intercept mousedown — some hijack scripts trigger on mousedown
  document.addEventListener('mousedown', (event: MouseEvent) => {
    const anchor = (event.target as HTMLElement)?.closest?.('a') as HTMLAnchorElement | null;
    if (anchor && anchor.href) {
      // Report intent early so the background knows before the tab is created
      chrome.runtime.sendMessage({
        type: 'USER_CLICK_INTENT',
        url: anchor.href,
        target: anchor.target || ''
      });
    }
  }, true);
}

// ── MutationObserver: Detect dynamically injected ad anchors ────────────
// Ad scripts frequently create <a target="_blank" href="adUrl"> elements,
// append them to the DOM, programmatically click them, then remove them.
// This observer catches such elements as they are inserted.

if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
  const recentlyInjectedAnchors = new WeakSet<HTMLAnchorElement>();

  const observer = new MutationObserver((mutations: MutationRecord[]) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;

        const element = node as HTMLElement;

        // Check if the added node itself is a suspicious anchor
        if (element.tagName === 'A') {
          checkSuspiciousAnchor(element as HTMLAnchorElement);
        }

        // Check child anchors (e.g., a wrapper div containing the ad anchor)
        const childAnchors = element.querySelectorAll?.('a[target="_blank"], a[target="_new"]');
        if (childAnchors) {
          childAnchors.forEach((a) => checkSuspiciousAnchor(a as HTMLAnchorElement));
        }
      }
    }
  });

  function checkSuspiciousAnchor(anchor: HTMLAnchorElement): void {
    if (!anchor.href) return;
    const target = anchor.target || '';

    // Only care about anchors that open new tabs
    if (target !== '_blank' && target !== '_new') return;

    // If the anchor points to a known ad URL, neutralize it immediately
    if (isAdUrlPattern(anchor.href)) {
      neutralizeAnchor(anchor);
      return;
    }

    // Track this anchor — if it is programmatically clicked within 100ms
    // of being injected, it is almost certainly an ad hijack.
    recentlyInjectedAnchors.add(anchor);

    // Override its click method to detect programmatic clicks
    const originalClick = anchor.click;
    anchor.click = function () {
      if (recentlyInjectedAnchors.has(anchor)) {
        // Programmatic click on a just-injected anchor — block it
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

    // After 200ms, the anchor is no longer considered "recently injected"
    setTimeout(() => {
      recentlyInjectedAnchors.delete(anchor);
      // Restore the original click method if the anchor is still in the DOM
      if (document.contains(anchor)) {
        anchor.click = originalClick;
      }
    }, 200);
  }

  function neutralizeAnchor(anchor: HTMLAnchorElement): void {
    anchor.removeAttribute('href');
    anchor.removeAttribute('target');
    anchor.style.pointerEvents = 'none';
    // Remove from DOM if it is hidden (ad anchors are often invisible)
    const rect = anchor.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0 || anchor.style.display === 'none' || anchor.style.visibility === 'hidden') {
      anchor.remove();
    }
  }

  // Start observing once the DOM is available
  if (document.documentElement) {
    observer.observe(document.documentElement, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.documentElement, { childList: true, subtree: true });
    });
  }
}

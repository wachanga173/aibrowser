/**
 * Task 1.3 — Content Script (JavaScript for Unpacked Loading)
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

if (typeof document !== 'undefined') {
  document.addEventListener('click', (event) => {
    const anchor = event.target && event.target.closest ? event.target.closest('a') : null;
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
  }, true);
}



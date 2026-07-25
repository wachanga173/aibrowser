/**
 * Task 1.3 — Content Script (Heuristic Fingerprinting & DOM Monitoring)
 * Runs in browser context to detect canvas fingerprinting & excessive navigator property reads.
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

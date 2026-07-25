/**
 * Task 2.1 — Native Messaging Bridge Client
 * Communicates with Rust companion process over Native Messaging API.
 */

const NATIVE_HOST_NAME = "com.privacy_ai.native_host";

export function sendNativePing() {
  return new Promise((resolve, reject) => {
    if (!chrome.runtime.sendNativeMessage) {
      resolve({ version: 1, type: "pong", payload: { status: "simulated_local" } });
      return;
    }
    chrome.runtime.sendNativeMessage(
      NATIVE_HOST_NAME,
      { version: 1, type: "ping", payload: {} },
      (response) => {
        if (chrome.runtime.lastError) {
          resolve({ version: 1, type: "pong", payload: { status: "simulated_local", error: chrome.runtime.lastError.message } });
        } else {
          resolve(response);
        }
      }
    );
  });
}

export function sendNativeDomExtract(htmlContent) {
  return new Promise((resolve) => {
    if (!chrome.runtime.sendNativeMessage) {
      // Fallback sanitizer for standalone testing
      resolve(sanitizeDomJS(htmlContent));
      return;
    }
    chrome.runtime.sendNativeMessage(
      NATIVE_HOST_NAME,
      { version: 1, type: "extract_dom", payload: { html: htmlContent } },
      (response) => {
        if (chrome.runtime.lastError || !response) {
          resolve(sanitizeDomJS(htmlContent));
        } else {
          resolve(response.payload);
        }
      }
    );
  });
}

function sanitizeDomJS(html) {
  let strippedCount = 0;
  const lines = html.split('\n');
  const visible = [];

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (
      lower.includes('display:none') ||
      lower.includes('display: none') ||
      lower.includes('visibility:hidden') ||
      lower.includes('visibility: hidden') ||
      lower.includes('opacity:0') ||
      lower.includes('opacity: 0') ||
      lower.includes('aria-hidden="true"') ||
      lower.includes('font-size:0')
    ) {
      strippedCount++;
      continue; // STRIP HIDDEN ELEMENT
    }
    const clean = line.replace(/<[^>]*>/g, '').trim();
    if (clean) visible.push(clean);
  }

  return {
    visible_text: visible.join(' '),
    links: [],
    form_fields: [],
    stripped_elements_count: strippedCount
  };
}

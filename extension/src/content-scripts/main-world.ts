/**
 * Main World Content Script — Popup Trap
 * Executes directly in page JS execution context (world: "MAIN") without CSP inline script violations.
 *
 * Defense layers:
 *   1. Known ad URL pattern matching (static blocklist)
 *   2. Parasitic popup detection — blocks window.open() that piggybacks on a user's anchor click
 *   3. Rate-limited burst detection — blocks rapid-fire window.open() calls (>1 within 1s)
 *   4. Programmatic anchor click interception — blocks injected auto-click hijacks
 */

(function () {
  if (typeof window === 'undefined') return;

  // ── Known ad URL patterns (static blocklist) ──────────────────────────

  const AD_PATTERN_REGEX = /(?:google-analytics\.com|doubleclick\.net|googlesyndication\.com|facebook\.net\/signals|connect\.facebook\.net\/[^/]+\/fbevents\.js|scorecardresearch\.com|adservice\.google\.com|adnxs\.com|criteo\.com|taboola\.com|outbrain\.com|hotjar\.com|segment\.io|clarity\.ms|amazon-adsystem\.com|pubmatic\.com|rubiconproject\.com|openx\.net|quantserve\.com|wrestpop|popdownload|downloadnow|popunder|click_id=pop)/i;

  // ── First-party safe domains (borrowed from uBlock Origin approach) ──
  // These domains must never be blocked so Videos, Images, Maps work.
  const SAFE_DOMAIN_SUFFIXES = [
    'youtube.com', 'youtu.be', 'ytimg.com', 'googlevideo.com',
    'google.com', 'google.co.uk', 'google.ca', 'google.com.au',
    'google.de', 'google.fr', 'google.co.jp', 'google.co.in', 'google.com.br',
    'googleapis.com', 'googleusercontent.com', 'gstatic.com', 'ggpht.com',
    'facebook.com', 'fbcdn.net', 'instagram.com', 'cdninstagram.com',
    'bing.com', 'vimeo.com', 'dailymotion.com', 'twitch.tv',
    'openstreetmap.org'
  ];

  function isSafeUrl(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      for (const safe of SAFE_DOMAIN_SUFFIXES) {
        if (hostname === safe || hostname.endsWith('.' + safe)) return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  function isKnownAdUrl(url?: string | URL): boolean {
    if (!url) return false;
    const u = url.toString();
    if (/\.(png|jpe?g|gif|webp|svg|avif|bmp|ico|tiff|pdf)(\?.*)?$/i.test(u)) {
      return false;
    }
    // Never block first-party safe domains
    if (isSafeUrl(u)) return false;
    return AD_PATTERN_REGEX.test(u);
  }

  // ── Suspicious auto-generated redirect domain heuristic ────────────────
  // Streaming sites open throwaway domains like "unfortunatelyejectinflected.com"
  // that are long concatenated words with no hyphens, digits, or subdomains.
  // These exist solely to redirect through ad chains.

  const COMMON_TLDS = new Set([
    'com', 'net', 'org', 'io', 'co', 'info', 'xyz', 'online', 'site',
    'top', 'icu', 'club', 'live', 'fun', 'buzz', 'click', 'link'
  ]);

  function isSuspiciousRedirectDomain(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      // Skip safe domains
      if (isSafeUrl(url)) return false;

      // Extract the registrable domain (strip subdomains by taking last 2 parts)
      const parts = hostname.split('.');
      if (parts.length < 2) return false;
      const tld = parts[parts.length - 1];
      const sld = parts[parts.length - 2]; // second-level domain

      // Only check common cheap TLDs used by ad redirect domains
      if (!COMMON_TLDS.has(tld)) return false;

      // Heuristic: the SLD is 20+ chars, all lowercase letters, no hyphens or digits
      // This catches "unfortunatelyejectinflected", "watchmoviestreamfree", etc.
      if (sld.length >= 20 && /^[a-z]+$/.test(sld)) {
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  // ── User click tracking ───────────────────────────────────────────────
  // Track the currently active user click event to detect parasitic popups.
  // When the user clicks on an anchor, any window.open() call during that
  // same synchronous event dispatch is almost certainly a hijack.

  let activeUserClickAnchor: HTMLAnchorElement | null = null;
  let activeUserClickTimestamp: number = 0;

  // Capture phase listener to set the anchor context before page scripts run
  document.addEventListener('click', (event: MouseEvent) => {
    const anchor = (event.target as HTMLElement)?.closest?.('a') as HTMLAnchorElement | null;
    activeUserClickAnchor = anchor;
    activeUserClickTimestamp = Date.now();

    // Clear the context after the synchronous event dispatch completes.
    // Using setTimeout(0) defers cleanup to after all synchronous handlers finish.
    setTimeout(() => {
      activeUserClickAnchor = null;
      activeUserClickTimestamp = 0;
    }, 0);
  }, true);

  // Also track mousedown — some hijack scripts trigger on mousedown
  document.addEventListener('mousedown', (event: MouseEvent) => {
    const anchor = (event.target as HTMLElement)?.closest?.('a') as HTMLAnchorElement | null;
    if (anchor) {
      activeUserClickAnchor = anchor;
      activeUserClickTimestamp = Date.now();
      setTimeout(() => {
        if (activeUserClickTimestamp && Date.now() - activeUserClickTimestamp > 50) {
          activeUserClickAnchor = null;
          activeUserClickTimestamp = 0;
        }
      }, 100);
    }
  }, true);

  // ── Burst detection state ─────────────────────────────────────────────
  // Sliding window of window.open() call timestamps within the last 1 second.

  const BURST_WINDOW_MS = 1000;
  const BURST_THRESHOLD = 1; // Block after more than 1 call within the window
  const openCallTimestamps: number[] = [];
  let burstCooldownUntil: number = 0;

  function isInBurst(): boolean {
    const now = Date.now();

    // Still in cooldown from a previous burst
    if (now < burstCooldownUntil) return true;

    // Prune timestamps outside the sliding window
    while (openCallTimestamps.length > 0 && openCallTimestamps[0] < now - BURST_WINDOW_MS) {
      openCallTimestamps.shift();
    }

    return openCallTimestamps.length > BURST_THRESHOLD;
  }

  function recordOpenCall(): void {
    const now = Date.now();
    openCallTimestamps.push(now);

    // If we just exceeded the burst threshold, enter cooldown
    if (openCallTimestamps.length > BURST_THRESHOLD) {
      burstCooldownUntil = now + BURST_WINDOW_MS;
    }
  }

  // ── Intercepted window.open ───────────────────────────────────────────

  const originalOpen = window.open;

  window.open = function (url?: string | URL, target?: string | null, features?: string): Window | null {
    const urlStr = url ? url.toString() : '';
    const targetStr = target ? target.toString() : '_blank';
    const isNewTab = !targetStr || targetStr === '_blank' || targetStr === '_new';

    // Layer 1: Known ad URL — block unconditionally
    if (urlStr && isNewTab && isKnownAdUrl(urlStr)) {
      return null;
    }

    // Layer 1.5: Suspicious auto-generated redirect domain
    // Block if opened during a user click (parasitic popup) or no user click context
    if (urlStr && isNewTab && isSuspiciousRedirectDomain(urlStr)) {
      return null;
    }

    // Layer 2: Parasitic popup detection — if the user is clicking an anchor
    // and a script calls window.open() during that click, it is a hijack.
    // The user intended to navigate to the anchor's href, not open an extra tab.
    if (urlStr && isNewTab && activeUserClickAnchor) {
      const anchorHref = activeUserClickAnchor.href || '';
      // If the window.open URL differs from the anchor the user clicked, it is parasitic.
      // If it matches, it might be the site's own navigation handler — allow it.
      if (urlStr !== anchorHref) {
        return null;
      }
    }

    // Layer 3: Burst detection — rate-limit rapid-fire window.open() calls
    if (urlStr && isNewTab) {
      recordOpenCall();
      if (isInBurst()) {
        return null;
      }
    }

    return originalOpen.apply(this, [url, target, features] as any);
  };

  // ── Intercepted HTMLAnchorElement.click() ──────────────────────────────
  // Catches scripts that create a temporary <a target="_blank"> element and
  // programmatically call .click() on it during a user's real click event.

  const originalAnchorClick = HTMLAnchorElement.prototype.click;

  HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement): void {
    // If we are inside a user click event and this anchor is NOT the one
    // the user actually clicked, treat it as a hijack injection.
    if (activeUserClickAnchor && this !== activeUserClickAnchor) {
      const href = this.href || '';
      const target = this.target || '';

      // Only block if it would open a new tab
      if (target === '_blank' || target === '_new') {
        // Check if this anchor is even in the DOM — injected ad anchors are
        // often created in-memory and never attached to the document.
        if (!document.contains(this) || isKnownAdUrl(href)) {
          return; // Suppress the hijack click entirely
        }
      }
    }

    return originalAnchorClick.apply(this);
  };

})();

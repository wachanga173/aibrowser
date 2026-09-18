/**
 * Main World Content Script — Popup Trap & Multi-Link Defense
 * Executes directly in page JS execution context (world: "MAIN") across all frames.
 *
 * Defense layers:
 *   1. Known ad URL pattern matching (static blocklist covering major popunder/rotator networks)
 *   2. Suspicious redirect domain heuristic (cheap TLDs + high entropy/randomized SLDs)
 *   3. Strict user-gesture verification (blocks unsolicited window.open and blank-popunders)
 *   4. Multi-link burst suppression (at most 1 window per user gesture; rapid fire suppressed)
 *   5. Parasitic popup detection (window.open differing from user-clicked anchor)
 *   6. Programmatic anchor click interception (blocks hidden/off-DOM anchor clicks)
 *   7. Synthetic event neutralization (blocks dispatchEvent click injection)
 */

(function () {
  if (typeof window === 'undefined') return;

  // ── Known ad & popunder URL patterns ─────────────────────────────────

  const AD_PATTERN_REGEX = /(?:google-analytics\.com|googletagmanager\.com|doubleclick\.net|googlesyndication\.com|facebook\.net\/signals|connect\.facebook\.net|scorecardresearch\.com|adservice\.google\.com|adnxs\.com|criteo\.com|criteo\.net|taboola\.com|outbrain\.com|hotjar\.com|segment\.io|segment\.com|clarity\.ms|amazon-adsystem\.com|pubmatic\.com|rubiconproject\.com|openx\.net|quantserve\.com|revcontent\.com|mgid\.com|content-ad\.net|zemanta\.com|ntv\.io|sharethrough\.com|3lift\.com|triplelift\.com|applovin\.com|supersonicads\.com|ironsrc\.com|vungle\.com|chartboost\.com|inmobi\.com|rayjump\.com|mintegral\.com|fyber\.com|smaato\.net|adroll\.com|casalemedia\.com|teads\.tv|spotxchange\.com|freewheel\.tv|tremorhub\.com|connatix\.com|bluekai\.com|id5-sync\.com|crwdcntrl\.net|imrworldwide\.com|rlcdn\.com|adsrvr\.org|agkn\.com|tapad\.com|drawbrid\.ge|sc-static\.net|amplitude\.com|mixpanel\.com|mxpnl\.com|fullstory\.com|heapanalytics\.com|crazyegg\.com|popads|popcash|propellerads|adsterra|exoclick|clickadu|hilltopads|trafficjunky|monetag|yllix|richpush|pushground|zeropark|galaksion|trafficstars|adxad|admaven|revenuehits|bidvertiser|clickorience|smarturl|adf\.ly|ouo\.io|shrinkearn|highcpmgate|wrestpop|popdownload|downloadnow|popunder|click_id=pop)/i;

  // ── First-party safe domains (must never be blocked) ─────────────────

  const SAFE_DOMAIN_SUFFIXES = [
    'youtube.com', 'youtu.be', 'ytimg.com', 'googlevideo.com',
    'google.com', 'google.co.uk', 'google.ca', 'google.com.au',
    'google.de', 'google.fr', 'google.co.jp', 'google.co.in', 'google.com.br',
    'googleapis.com', 'googleusercontent.com', 'gstatic.com', 'ggpht.com',
    'facebook.com', 'fbcdn.net', 'instagram.com', 'cdninstagram.com',
    'bing.com', 'vimeo.com', 'dailymotion.com', 'twitch.tv',
    'openstreetmap.org', 'github.com', 'microsoft.com'
  ];

  function isSafeUrl(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      for (let i = 0; i < SAFE_DOMAIN_SUFFIXES.length; i++) {
        const safe = SAFE_DOMAIN_SUFFIXES[i];
        if (hostname === safe || hostname.endsWith('.' + safe)) return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  function isKnownAdUrl(url?: string | URL | null): boolean {
    if (!url) return false;
    const u = url.toString();
    if (/\.(png|jpe?g|gif|webp|svg|avif|bmp|ico|tiff|pdf)(\?.*)?$/i.test(u)) {
      return false;
    }
    if (isSafeUrl(u)) return false;
    return AD_PATTERN_REGEX.test(u);
  }

  // ── Suspicious auto-generated redirect domain heuristic ────────────────

  const SUSPICIOUS_TLDS = new Set([
    'com', 'net', 'org', 'io', 'co', 'info', 'xyz', 'online', 'site',
    'top', 'icu', 'club', 'live', 'fun', 'buzz', 'click', 'link', 'work', 'vip'
  ]);

  const SUSPICIOUS_KEYWORDS = /(?:click|track|pop|jump|direct|rotat|gate|redir|offer|bonus|prize|reward|promot|adserver)/i;

  function isSuspiciousRedirectDomain(url?: string | URL | null): boolean {
    if (!url) return false;
    try {
      const urlStr = url.toString();
      if (isSafeUrl(urlStr)) return false;

      const hostname = new URL(urlStr).hostname.toLowerCase();
      const parts = hostname.split('.');
      if (parts.length < 2) return false;

      const tld = parts[parts.length - 1];
      const sld = parts[parts.length - 2];

      if (!SUSPICIOUS_TLDS.has(tld)) return false;

      // Long concatenated lowercase string (e.g. "unfortunatelyejectinflected")
      if (sld.length >= 18 && /^[a-z]+$/.test(sld)) {
        return true;
      }

      // Suspicious keywords paired with cheap generic TLDs
      if (['xyz', 'top', 'icu', 'click', 'site', 'link', 'live', 'online', 'club', 'buzz'].includes(tld)) {
        if (SUSPICIOUS_KEYWORDS.test(sld) || /\d{3,}/.test(sld)) {
          return true;
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  // ── User interaction tracking ─────────────────────────────────────────

  const USER_GESTURE_TIMEOUT_MS = 350;
  let lastTrustedUserActionTime = 0;
  let activeUserClickAnchor: HTMLAnchorElement | null = null;
  let openCallsDuringCurrentAction = 0;

  function recordTrustedAction(event: Event) {
    if (event.isTrusted) {
      lastTrustedUserActionTime = Date.now();
      openCallsDuringCurrentAction = 0;
      const target = event.target as HTMLElement | null;
      activeUserClickAnchor = target && target.closest ? target.closest('a') : null;

      setTimeout(() => {
        activeUserClickAnchor = null;
      }, 0);
    }
  }

  // Capture user interactions in the capture phase (before page handlers run)
  document.addEventListener('click', recordTrustedAction, true);
  document.addEventListener('pointerup', recordTrustedAction, true);
  document.addEventListener('mouseup', recordTrustedAction, true);
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      recordTrustedAction(e);
    }
  }, true);

  // ── Synthetic Event Neutralization ────────────────────────────────────
  // Block untrusted (synthetic) click events attempting to simulate link navigation
  document.addEventListener('click', (event: MouseEvent) => {
    if (!event.isTrusted) {
      const anchor = (event.target as HTMLElement | null)?.closest?.('a');
      if (anchor && (anchor.target === '_blank' || anchor.target === '_new' || isKnownAdUrl(anchor.href))) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }
  }, true);

  // ── Dummy No-op Window Object ──────────────────────────────────────────
  // Prevents script exceptions when a blocked window.open call is neutralised
  function createNoopWindow(): Window {
    const noop = () => {};
    const dummy: any = {
      closed: true,
      document: {
        write: noop,
        writeln: noop,
        open: noop,
        close: noop,
        getElementById: () => null,
        querySelector: () => null
      },
      location: {
        href: '',
        replace: noop,
        assign: noop,
        reload: noop
      },
      focus: noop,
      blur: noop,
      close: noop,
      postMessage: noop,
      addEventListener: noop,
      removeEventListener: noop,
      setTimeout: () => 0,
      clearTimeout: noop,
      setInterval: () => 0,
      clearInterval: noop
    };
    return dummy as Window;
  }

  // ── Sliding Window Burst Detection ────────────────────────────────────

  const BURST_WINDOW_MS = 1500;
  const openCallTimestamps: number[] = [];
  let burstCooldownUntil = 0;

  function isInBurst(): boolean {
    const now = Date.now();
    if (now < burstCooldownUntil) return true;

    while (openCallTimestamps.length > 0 && openCallTimestamps[0] < now - BURST_WINDOW_MS) {
      openCallTimestamps.shift();
    }

    // Block if more than 1 call has already occurred within the sliding window
    return openCallTimestamps.length >= 1;
  }

  function recordOpenCall() {
    const now = Date.now();
    openCallTimestamps.push(now);
    if (openCallTimestamps.length >= 2) {
      burstCooldownUntil = now + BURST_WINDOW_MS;
    }
  }

  // ── Intercepted window.open ───────────────────────────────────────────

  const originalOpen = window.open;

  window.open = function (url?: string | URL, target?: string | null, features?: string): Window | null {
    const urlStr = url ? url.toString().trim() : '';
    const targetStr = target ? target.toString() : '_blank';
    const isNewTab = !targetStr || targetStr === '_blank' || targetStr === '_new';
    const isBlank = !urlStr || urlStr === 'about:blank' || urlStr === 'javascript:void(0)';
    const hasRecentUserGesture = Date.now() - lastTrustedUserActionTime <= USER_GESTURE_TIMEOUT_MS;

    // Defense 1: Block unprompted / background window.open (no trusted gesture)
    if (!hasRecentUserGesture) {
      return createNoopWindow();
    }

    // Defense 2: Multi-link burst suppression — allow at most 1 window per user gesture
    if (openCallsDuringCurrentAction >= 1) {
      return createNoopWindow();
    }

    // Defense 3: Known ad or tracker URL
    if (urlStr && isKnownAdUrl(urlStr)) {
      return createNoopWindow();
    }

    // Defense 4: Suspicious auto-generated redirect domain
    if (urlStr && isSuspiciousRedirectDomain(urlStr)) {
      return createNoopWindow();
    }

    // Defense 5: Parasitic popup detection
    // If the user clicked a specific anchor, any window.open to a DIFFERENT url is parasitic
    if (urlStr && isNewTab && activeUserClickAnchor) {
      const anchorHref = (activeUserClickAnchor.href || '').trim();
      if (anchorHref && urlStr !== anchorHref && !anchorHref.startsWith('javascript:')) {
        return createNoopWindow();
      }
    }

    // Defense 6: Sliding window rate limit
    if (isNewTab) {
      if (isInBurst()) {
        return createNoopWindow();
      }
      recordOpenCall();
      openCallsDuringCurrentAction++;
    }

    return originalOpen.apply(this, [url, target, features] as any);
  };

  // ── Intercepted HTMLAnchorElement.prototype.click ──────────────────────

  const originalAnchorClick = HTMLAnchorElement.prototype.click;

  HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement): void {
    const href = (this.href || '').trim();
    const target = this.target || '';
    const isNewTab = target === '_blank' || target === '_new';
    const hasRecentUserGesture = Date.now() - lastTrustedUserActionTime <= USER_GESTURE_TIMEOUT_MS;

    // Layer 1: Programmatically clicked anchor that is NOT the anchor the user physically clicked
    if (activeUserClickAnchor && this !== activeUserClickAnchor) {
      if (isNewTab || !document.contains(this) || isKnownAdUrl(href) || isSuspiciousRedirectDomain(href)) {
        return;
      }
    }

    // Layer 2: Off-DOM anchor programmatic click without user gesture
    if (!document.contains(this)) {
      if (!hasRecentUserGesture || isKnownAdUrl(href) || isSuspiciousRedirectDomain(href)) {
        return;
      }
    }

    // Layer 3: Anchor points to known ad URL
    if (isKnownAdUrl(href) || isSuspiciousRedirectDomain(href)) {
      return;
    }

    // Layer 4: Burst protection on programmatic multi-clicks
    if (isNewTab && openCallsDuringCurrentAction >= 1) {
      return;
    }

    if (isNewTab) {
      openCallsDuringCurrentAction++;
    }

    return originalAnchorClick.apply(this);
  };

})();

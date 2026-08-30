/**
 * Main World Content Script — Popup Trap (JavaScript for Unpacked Extension Loading)
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

  const AD_PATTERN_REGEX = /(?:google-analytics\.com|googletagmanager\.com|doubleclick\.net|googlesyndication\.com|facebook\.net\/signals|connect\.facebook\.net|scorecardresearch\.com|adservice\.google\.com|adnxs\.com|criteo\.com|criteo\.net|taboola\.com|outbrain\.com|hotjar\.com|segment\.io|segment\.com|clarity\.ms|amazon-adsystem\.com|pubmatic\.com|rubiconproject\.com|openx\.net|quantserve\.com|revcontent\.com|mgid\.com|content-ad\.net|zemanta\.com|ntv\.io|sharethrough\.com|3lift\.com|triplelift\.com|applovin\.com|supersonicads\.com|ironsrc\.com|vungle\.com|chartboost\.com|inmobi\.com|rayjump\.com|mintegral\.com|fyber\.com|smaato\.net|adroll\.com|casalemedia\.com|teads\.tv|spotxchange\.com|freewheel\.tv|tremorhub\.com|connatix\.com|bluekai\.com|id5-sync\.com|crwdcntrl\.net|imrworldwide\.com|rlcdn\.com|adsrvr\.org|agkn\.com|tapad\.com|drawbrid\.ge|sc-static\.net|amplitude\.com|mixpanel\.com|mxpnl\.com|fullstory\.com|heapanalytics\.com|crazyegg\.com|wrestpop|popdownload|downloadnow|popunder|click_id=pop)/i;

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

  function isSafeUrl(url) {
    try {
      var hostname = new URL(url).hostname.toLowerCase();
      for (var i = 0; i < SAFE_DOMAIN_SUFFIXES.length; i++) {
        var safe = SAFE_DOMAIN_SUFFIXES[i];
        if (hostname === safe || hostname.endsWith('.' + safe)) return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  function isKnownAdUrl(url) {
    if (!url) return false;
    var u = url.toString();
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

  var COMMON_TLDS = new Set([
    'com', 'net', 'org', 'io', 'co', 'info', 'xyz', 'online', 'site',
    'top', 'icu', 'club', 'live', 'fun', 'buzz', 'click', 'link'
  ]);

  function isSuspiciousRedirectDomain(url) {
    try {
      var hostname = new URL(url).hostname.toLowerCase();
      // Skip safe domains
      if (isSafeUrl(url)) return false;

      // Extract the registrable domain (strip subdomains by taking last 2 parts)
      var parts = hostname.split('.');
      if (parts.length < 2) return false;
      var tld = parts[parts.length - 1];
      var sld = parts[parts.length - 2]; // second-level domain

      // Only check common cheap TLDs used by ad redirect domains
      if (!COMMON_TLDS.has(tld)) return false;

      // Heuristic: the SLD is 20+ chars, all lowercase letters, no hyphens or digits
      // This catches "unfortunatelyejectinflected", "watchmoviestreamfree", etc.
      if (sld.length >= 20 && /^[a-z]+$/.test(sld)) {
        return true;
      }

      return false;
    } catch (e) {
      return false;
    }
  }

  // ── User click tracking ───────────────────────────────────────────────

  let activeUserClickAnchor = null;
  let activeUserClickTimestamp = 0;

  document.addEventListener('click', function (event) {
    const anchor = event.target && event.target.closest ? event.target.closest('a') : null;
    activeUserClickAnchor = anchor;
    activeUserClickTimestamp = Date.now();

    setTimeout(function () {
      activeUserClickAnchor = null;
      activeUserClickTimestamp = 0;
    }, 0);
  }, true);

  document.addEventListener('mousedown', function (event) {
    const anchor = event.target && event.target.closest ? event.target.closest('a') : null;
    if (anchor) {
      activeUserClickAnchor = anchor;
      activeUserClickTimestamp = Date.now();
      setTimeout(function () {
        if (activeUserClickTimestamp && Date.now() - activeUserClickTimestamp > 50) {
          activeUserClickAnchor = null;
          activeUserClickTimestamp = 0;
        }
      }, 100);
    }
  }, true);

  // ── Burst detection state ─────────────────────────────────────────────

  const BURST_WINDOW_MS = 1000;
  const BURST_THRESHOLD = 1;
  const openCallTimestamps = [];
  let burstCooldownUntil = 0;

  function isInBurst() {
    const now = Date.now();
    if (now < burstCooldownUntil) return true;

    while (openCallTimestamps.length > 0 && openCallTimestamps[0] < now - BURST_WINDOW_MS) {
      openCallTimestamps.shift();
    }

    return openCallTimestamps.length > BURST_THRESHOLD;
  }

  function recordOpenCall() {
    const now = Date.now();
    openCallTimestamps.push(now);

    if (openCallTimestamps.length > BURST_THRESHOLD) {
      burstCooldownUntil = now + BURST_WINDOW_MS;
    }
  }

  // ── Intercepted window.open ───────────────────────────────────────────

  const originalOpen = window.open;

  window.open = function (url, target, features) {
    const urlStr = url ? url.toString() : '';
    const targetStr = target ? target.toString() : '_blank';
    const isNewTab = !targetStr || targetStr === '_blank' || targetStr === '_new';

    // Layer 1: Known ad URL
    if (urlStr && isNewTab && isKnownAdUrl(urlStr)) {
      return null;
    }

    // Layer 1.5: Suspicious auto-generated redirect domain
    if (urlStr && isNewTab && isSuspiciousRedirectDomain(urlStr)) {
      return null;
    }

    // Layer 2: Parasitic popup detection
    if (urlStr && isNewTab && activeUserClickAnchor) {
      const anchorHref = activeUserClickAnchor.href || '';
      if (urlStr !== anchorHref) {
        return null;
      }
    }

    // Layer 3: Burst detection
    if (urlStr && isNewTab) {
      recordOpenCall();
      if (isInBurst()) {
        return null;
      }
    }

    return originalOpen.apply(this, [url, target, features]);
  };

  // ── Intercepted HTMLAnchorElement.click() ──────────────────────────────

  const originalAnchorClick = HTMLAnchorElement.prototype.click;

  HTMLAnchorElement.prototype.click = function () {
    if (activeUserClickAnchor && this !== activeUserClickAnchor) {
      const href = this.href || '';
      const target = this.target || '';

      if (target === '_blank' || target === '_new') {
        if (!document.contains(this) || isKnownAdUrl(href)) {
          return;
        }
      }
    }

    return originalAnchorClick.apply(this);
  };

})();

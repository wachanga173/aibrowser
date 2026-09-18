/**
 * Main World Content Script — Popup Trap & Multi-Link Defense (JavaScript for Unpacked Extension Loading)
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

  var AD_PATTERN_REGEX = /(?:google-analytics\.com|googletagmanager\.com|doubleclick\.net|googlesyndication\.com|facebook\.net\/signals|connect\.facebook\.net|scorecardresearch\.com|adservice\.google\.com|adnxs\.com|criteo\.com|criteo\.net|taboola\.com|outbrain\.com|hotjar\.com|segment\.io|segment\.com|clarity\.ms|amazon-adsystem\.com|pubmatic\.com|rubiconproject\.com|openx\.net|quantserve\.com|revcontent\.com|mgid\.com|content-ad\.net|zemanta\.com|ntv\.io|sharethrough\.com|3lift\.com|triplelift\.com|applovin\.com|supersonicads\.com|ironsrc\.com|vungle\.com|chartboost\.com|inmobi\.com|rayjump\.com|mintegral\.com|fyber\.com|smaato\.net|adroll\.com|casalemedia\.com|teads\.tv|spotxchange\.com|freewheel\.tv|tremorhub\.com|connatix\.com|bluekai\.com|id5-sync\.com|crwdcntrl\.net|imrworldwide\.com|rlcdn\.com|adsrvr\.org|agkn\.com|tapad\.com|drawbrid\.ge|sc-static\.net|amplitude\.com|mixpanel\.com|mxpnl\.com|fullstory\.com|heapanalytics\.com|crazyegg\.com|popads|popcash|propellerads|adsterra|exoclick|clickadu|hilltopads|trafficjunky|monetag|yllix|richpush|pushground|zeropark|galaksion|trafficstars|adxad|admaven|revenuehits|bidvertiser|clickorience|smarturl|adf\.ly|ouo\.io|shrinkearn|highcpmgate|highcpmrevenues|wrestpop|popdownload|downloadnow|popunder|click_id=pop|adcash|adkeeper|adkernel|adtrue|adspyglass|adsupply|adxpansion|adcombo|adworkmedia|clickdealer|clickguard|deloton|onclickprediction|onclickmega|onclickalgo|onclicksuper|onclickperformance|propu|voluum|keitaro|binom|redtrack|bemob|adsbridge|peerclick|octotracker|funnelflux|traffichaus|trafficforce|trafficcompany|linkvertise|cpagrip|cpalead|ogads|realsrv|adtng|clkmr|clksite|directrev|adkmob|leadbolt|startapp|mobfox|smartlink|rotator)/i;

  // ── First-party safe domains (must never be blocked) ─────────────────

  var SAFE_DOMAIN_SUFFIXES = [
    'youtube.com', 'youtu.be', 'ytimg.com', 'googlevideo.com',
    'google.com', 'google.co.uk', 'google.ca', 'google.com.au',
    'google.de', 'google.fr', 'google.co.jp', 'google.co.in', 'google.com.br',
    'googleapis.com', 'googleusercontent.com', 'gstatic.com', 'ggpht.com',
    'facebook.com', 'fbcdn.net', 'instagram.com', 'cdninstagram.com',
    'bing.com', 'vimeo.com', 'dailymotion.com', 'twitch.tv',
    'openstreetmap.org', 'github.com', 'microsoft.com'
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
    if (isSafeUrl(u)) return false;
    return AD_PATTERN_REGEX.test(u);
  }

  // ── Suspicious auto-generated redirect domain heuristic ────────────────

  var SUSPICIOUS_TLDS = new Set([
    'xyz', 'top', 'icu', 'club', 'live', 'fun', 'buzz', 'click', 'link', 'work', 'vip',
    'pro', 'cc', 'ws', 'me', 'pw', 'monster', 'quest', 'space', 'surf', 'rest',
    'best', 'stream', 'win', 'bid', 'racing', 'date', 'faith', 'trade', 'review',
    'party', 'gq', 'cf', 'ga', 'ml', 'tk', 'loan', 'download'
  ]);

  var SUSPICIOUS_KEYWORDS = /(?:click|track|pop|jump|direct|rotat|gate|redir|offer|bonus|prize|reward|promot|adserver|smartlink|affiliate|traff|cpa|cpm|lead|monetiz|revenue|banner|sponsor|lander|adster|traffic|yield|campaign)/i;

  function isSuspiciousRedirectDomain(url) {
    if (!url) return false;
    try {
      var urlStr = url.toString();
      if (isSafeUrl(urlStr)) return false;

      var parsed = new URL(urlStr, window.location.href);
      var hostname = parsed.hostname.toLowerCase();
      var parts = hostname.split('.');
      if (parts.length < 2) return false;

      var tld = parts[parts.length - 1];
      var sld = parts[parts.length - 2];

      if (!SUSPICIOUS_TLDS.has(tld)) return false;

      if (sld.length >= 18 && /^[a-z]+$/.test(sld)) {
        return true;
      }

      if (SUSPICIOUS_KEYWORDS.test(sld) || /\d{3,}/.test(sld) || (sld.indexOf('-') !== -1 && SUSPICIOUS_KEYWORDS.test(parsed.pathname))) {
        return true;
      }

      return false;
    } catch (e) {
      return false;
    }
  }

  // ── User interaction tracking ─────────────────────────────────────────

  var USER_GESTURE_TIMEOUT_MS = 500;
  var lastTrustedUserActionTime = 0;
  var activeUserClickAnchor = null;
  var activeClickAnchorHref = null;
  var openCallsDuringCurrentAction = 0;

  function recordTrustedAction(event) {
    if (event.isTrusted) {
      lastTrustedUserActionTime = Date.now();
      openCallsDuringCurrentAction = 0;
      var target = event.target;
      var anchor = target && target.closest ? target.closest('a') : null;
      activeUserClickAnchor = anchor;
      activeClickAnchorHref = anchor && anchor.href ? anchor.href : null;

      setTimeout(function () {
        activeUserClickAnchor = null;
        activeClickAnchorHref = null;
      }, USER_GESTURE_TIMEOUT_MS);
    }
  }

  document.addEventListener('click', recordTrustedAction, true);
  document.addEventListener('pointerup', recordTrustedAction, true);
  document.addEventListener('mouseup', recordTrustedAction, true);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      recordTrustedAction(e);
    }
  }, true);

  // ── Synthetic Event Neutralization ────────────────────────────────────
  document.addEventListener('click', function (event) {
    if (!event.isTrusted) {
      var anchor = event.target && event.target.closest ? event.target.closest('a') : null;
      if (anchor && (anchor.target === '_blank' || anchor.target === '_new' || isKnownAdUrl(anchor.href))) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }
  }, true);

  // ── Dummy No-op Window Object ──────────────────────────────────────────
  function createNoopWindow() {
    var noop = function () {};
    return {
      closed: true,
      document: {
        write: noop,
        writeln: noop,
        open: noop,
        close: noop,
        getElementById: function () { return null; },
        querySelector: function () { return null; }
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
      setTimeout: function () { return 0; },
      clearTimeout: noop,
      setInterval: function () { return 0; },
      clearInterval: noop
    };
  }

  // ── Sliding Window Burst Detection ────────────────────────────────────

  var BURST_WINDOW_MS = 1500;
  var openCallTimestamps = [];
  var burstCooldownUntil = 0;

  function isInBurst() {
    var now = Date.now();
    if (now < burstCooldownUntil) return true;

    while (openCallTimestamps.length > 0 && openCallTimestamps[0] < now - BURST_WINDOW_MS) {
      openCallTimestamps.shift();
    }

    return openCallTimestamps.length >= 1;
  }

  function recordOpenCall() {
    var now = Date.now();
    openCallTimestamps.push(now);
    if (openCallTimestamps.length >= 2) {
      burstCooldownUntil = now + BURST_WINDOW_MS;
    }
  }

  // ── Intercepted window.open ───────────────────────────────────────────

  var originalOpen = window.open;

  window.open = function (url, target, features) {
    var urlStr = url ? url.toString().trim() : '';
    var targetStr = target ? target.toString() : '_blank';
    var isNewTab = !targetStr || targetStr === '_blank' || targetStr === '_new';
    var hasRecentUserGesture = Date.now() - lastTrustedUserActionTime <= USER_GESTURE_TIMEOUT_MS;

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
    if (urlStr && isNewTab && activeClickAnchorHref) {
      var anchorHref = activeClickAnchorHref.trim();
      if (anchorHref && urlStr !== anchorHref && !anchorHref.startsWith('javascript:')) {
        return createNoopWindow();
      }
    }

    // Defense 5.5: Non-anchor click popunder defense
    if (urlStr && isNewTab && !activeClickAnchorHref && !isSafeUrl(urlStr)) {
      try {
        var targetOrigin = new URL(urlStr, window.location.href).origin;
        if (targetOrigin !== window.location.origin) {
          return createNoopWindow();
        }
      } catch (e) {
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

    return originalOpen.apply(this, [url, target, features]);
  };

  // ── Intercepted HTMLAnchorElement.prototype.click ──────────────────────

  var originalAnchorClick = HTMLAnchorElement.prototype.click;

  HTMLAnchorElement.prototype.click = function () {
    var href = (this.href || '').trim();
    var target = this.target || '';
    var isNewTab = target === '_blank' || target === '_new';
    var hasRecentUserGesture = Date.now() - lastTrustedUserActionTime <= USER_GESTURE_TIMEOUT_MS;

    // Layer 1: Programmatically clicked anchor that is NOT the anchor the user clicked
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

  // ── Intercepted HTMLFormElement.prototype.submit ──────────────────────

  var originalFormSubmit = HTMLFormElement.prototype.submit;

  HTMLFormElement.prototype.submit = function () {
    var action = (this.action || '').trim();
    var target = this.target || '';
    var isNewTab = target === '_blank' || target === '_new';
    var hasRecentUserGesture = Date.now() - lastTrustedUserActionTime <= USER_GESTURE_TIMEOUT_MS;

    if (isNewTab && !hasRecentUserGesture) {
      return;
    }
    if (isKnownAdUrl(action) || isSuspiciousRedirectDomain(action)) {
      return;
    }
    if (isNewTab && openCallsDuringCurrentAction >= 1) {
      return;
    }
    if (isNewTab) {
      openCallsDuringCurrentAction++;
    }
    return originalFormSubmit.apply(this);
  };

  // ── Guard Location navigation against ad rotators ────────────────────

  if (typeof Location !== 'undefined' && Location.prototype) {
    var origAssign = Location.prototype.assign;
    var origReplace = Location.prototype.replace;

    if (origAssign) {
      Location.prototype.assign = function (url) {
        if (isKnownAdUrl(url) || isSuspiciousRedirectDomain(url)) {
          return;
        }
        return origAssign.call(this, url);
      };
    }
    if (origReplace) {
      Location.prototype.replace = function (url) {
        if (isKnownAdUrl(url) || isSuspiciousRedirectDomain(url)) {
          return;
        }
        return origReplace.call(this, url);
      };
    }
  }

})();

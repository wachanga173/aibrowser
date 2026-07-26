/**
 * Main World Content Script (JavaScript for Unpacked Extension Loading)
 * Executes directly in page JS execution context (world: "MAIN") without CSP inline script violations.
 */

(function () {
  if (typeof window === 'undefined') return;

  const originalOpen = window.open;

  const AD_PATTERN_REGEX = /(?:google-analytics\.com|doubleclick\.net|googlesyndication\.com|facebook\.net\/signals|scorecardresearch\.com|adservice\.google\.com|adnxs\.com|criteo\.com|taboola\.com|outbrain\.com|hotjar\.com|segment\.io|clarity\.ms|amazon-adsystem\.com|pubmatic\.com|rubiconproject\.com|openx\.net|quantserve\.com|wrestpop|popdownload|downloadnow|popunder|click_id=pop)/i;

  function isAdUrl(url) {
    if (!url) return false;
    const u = url.toString();
    if (/\.(png|jpe?g|gif|webp|svg|avif|bmp|ico|tiff|pdf)(\?.*)?$/i.test(u)) {
      return false;
    }
    return AD_PATTERN_REGEX.test(u);
  }

  window.open = function (url, target, features) {
    const urlStr = url ? url.toString() : '';
    const targetStr = target ? target.toString() : '_blank';

    if (urlStr && (!targetStr || targetStr === '_blank' || targetStr === '_new')) {
      if (isAdUrl(urlStr)) {
        return null;
      }
    }
    return originalOpen.apply(this, [url, target, features]);
  };
})();

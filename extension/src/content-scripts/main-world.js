/**
 * Main World Content Script (JavaScript for Unpacked Extension Loading)
 * Executes directly in page JS execution context (world: "MAIN") without CSP inline script violations.
 */

(function () {
  if (typeof window === 'undefined') return;

  const originalOpen = window.open;

  function isAdUrl(url) {
    if (!url) return true;
    const u = url.toString();
    return /(ad|banner|pop|click|redir|tracking|syndication|doubleclick|taboola|outbrain|adnxs|criteo|googlesyndication|adservice|wrestpop|downloadnow|popdownload|click_id|track=\d+|popunder|zoneid|aff_id|monster|xyz|top|click|download|icu|buzz|\?[a-f0-9]{8,})/i.test(u);
  }

  window.open = function (url, target, features) {
    const urlStr = url ? url.toString() : '';
    const targetStr = target ? target.toString() : '_blank';

    if (!targetStr || targetStr === '_blank' || targetStr === '_new') {
      if (isAdUrl(urlStr)) {
        return null;
      }
    }
    return originalOpen.apply(this, [url, target, features]);
  };
})();

const fs = require('fs');
const path = require('path');

// Comprehensive filter domains & paths covering advertising, trackers, analytics, error loggers, and OEM telemetry
const DEFAULT_FILTER_PATTERNS = [
  // Google Ads & Analytics
  "||google-analytics.com^",
  "||googleanalytics.com^",
  "||analytics.google.com^",
  "||doubleclick.net^",
  "||googlesyndication.com^",
  "||googleadservices.com^",
  "||adservice.google.com^",
  "||pagead2.googlesyndication.com^",
  "||pagead2.googleadservices.com^",
  "||afs.googlesyndication.com^",
  "||ads.youtube.com^",

  // Amazon Ads & Analytics
  "||amazon-adsystem.com^",
  "||aax.amazon-adsystem.com^",
  "||adtago.s3.amazonaws.com^",
  "||analyticsengine.s3.amazonaws.com^",
  "||analytics.s3.amazonaws.com^",
  "||advice-ads.s3.amazonaws.com^",

  // Ad Networks & Exchanges
  "||adcolony.com^",
  "||media.net^",
  "||unityads.unity3d.com^",
  "||adnxs.com^",
  "||criteo.com^",
  "||taboola.com^",
  "||outbrain.com^",
  "||pubmatic.com^",
  "||rubiconproject.com^",
  "||openx.net^",
  "||quantserve.com^",

  // Analytics, Session Recorders & Behavioral Trackers
  "||mouseflow.com^",
  "||hotjar.com^",
  "||hotjar.io^",
  "||freshmarketer.com^",
  "||freshworks.com^",
  "||luckyorange.com^",
  "||luckyorange.net^",
  "||stats.wp.com^",
  "||segment.io^",
  "||mixpanel.com^",
  "||clarity.ms^",
  "||scorecardresearch.com^",

  // Error Loggers & Exception Trackers
  "||bugsnag.com^",
  "||sentry-cdn.com^",
  "||getsentry.com^",
  "||sentry.io^",

  // Social Trackers & Pixels
  "||pixel.facebook.com^",
  "||an.facebook.com^",
  "||facebook.net/signals/*",
  "||connect.facebook.net/*",
  "||ads-twitter.com^",
  "||ads-api.twitter.com^",
  "||ads.twitter.com^",
  "||ads.linkedin.com^",
  "||analytics.pointdrive.linkedin.com^",
  "||snap.licdn.com^",
  "||ads.pinterest.com^",
  "||log.pinterest.com^",
  "||trk.pinterest.com^",
  "||ct.pinterest.com^",
  "||events.reddit.com^",
  "||events.redditmedia.com^",
  "||pixel.reddit.com^",
  "||ads.tiktok.com^",
  "||ads-api.tiktok.com^",
  "||analytics.tiktok.com^",
  "||ads-sg.tiktok.com^",
  "||analytics-sg.tiktok.com^",
  "||business-api.tiktok.com^",
  "||byteoversea.com^",

  // Portal & Search Network Ads
  "||ads.yahoo.com^",
  "||analytics.yahoo.com^",
  "||geo.yahoo.com^",
  "||udcm.yahoo.com^",
  "||analytics.query.yahoo.com^",
  "||partnerads.ysm.yahoo.com^",
  "||log.fc.yahoo.com^",
  "||gemini.yahoo.com^",
  "||adtech.yahooinc.com^",
  "||appmetrica.yandex.ru^",
  "||adfstat.yandex.ru^",
  "||metrika.yandex.ru^",
  "||adfox.yandex.ru^",
  "||yandex.net^",
  "||mc.yandex.ru^",
  "||an.yandex.ru^",

  // OEM & Device Telemetry
  "||realmemobile.com^",
  "||logser.realme.com^",
  "||iot-eu-logser.realme.com^",
  "||iot-logser.realme.com^",
  "||ad.xiaomi.com^",
  "||mistat.xiaomi.com^",
  "||mistat.india.xiaomi.com^",
  "||mistat.rus.xiaomi.com^",
  "||tracking.rus.miui.com^",
  "||tracking.miui.com^",
  "||oppomobile.com^",
  "||hicloud.com^",
  "||iadsdk.apple.com^",
  "||metrics.icloud.com^",
  "||metrics.mzstatic.com^",
  "||api-adservices.apple.com^",
  "||samsungads.com^",
  "||oneplus.cn^",

  // Popunder, redirectors and suspicious patterns
  "*click_id=pop*",
  "*track=*click_id=*",
  "*popunder*",
  "*wrestpop*",
  "*popdownload*",
  "*downloadnow*"
];

function buildDnrRules(patterns) {
  return patterns.map((pattern, index) => {
    let cleanFilter = pattern;
    if (pattern.endsWith('^')) {
      cleanFilter = pattern.slice(0, -1);
    }
    return {
      id: index + 1,
      priority: 1,
      action: { type: 'block' },
      condition: {
        urlFilter: cleanFilter,
        resourceTypes: [
          'main_frame',
          'sub_frame',
          'stylesheet',
          'script',
          'image',
          'font',
          'object',
          'xmlhttprequest',
          'ping',
          'csp_report',
          'media',
          'websocket',
          'other'
        ]
      }
    };
  });
}

function generateRulesetFile(outputPath) {
  const rules = buildDnrRules(DEFAULT_FILTER_PATTERNS);
  const targetDir = path.dirname(outputPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  fs.writeFileSync(outputPath, JSON.stringify(rules, null, 2), 'utf-8');
  console.log(`Generated ${rules.length} static DNR blocking rules at: ${outputPath}`);
}

if (require.main === module) {
  const defaultPath = path.join(process.cwd(), 'extension', 'rules', 'ruleset_default.json');
  generateRulesetFile(defaultPath);
}

module.exports = { buildDnrRules, generateRulesetFile };

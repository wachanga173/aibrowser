const fs = require('fs');
const path = require('path');

const DEFAULT_FILTER_PATTERNS = [
  "||google-analytics.com^",
  "||doubleclick.net^",
  "||googlesyndication.com^",
  "||facebook.net/signals/*",
  "||connect.facebook.net/*",
  "||scorecardresearch.com^",
  "||adservice.google.com^",
  "||adnxs.com^",
  "||criteo.com^",
  "||taboola.com^",
  "||outbrain.com^",
  "||hotjar.com^",
  "||segment.io^",
  "||clarity.ms^",
  "||amazon-adsystem.com^",
  "||pubmatic.com^",
  "||rubiconproject.com^",
  "||openx.net^",
  "||quantserve.com^",
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
        resourceTypes: ['main_frame', 'script', 'image', 'xmlhttprequest', 'sub_frame', 'ping']
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

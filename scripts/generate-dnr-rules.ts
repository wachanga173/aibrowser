import * as fs from 'fs';
import * as path from 'path';

/**
 * Task 1.2 — DeclarativeNetRequest Rule Generator
 * Converts filter patterns into static Chrome DNR ruleset format.
 */

export interface DeclarativeRule {
  id: number;
  priority: number;
  action: {
    type: 'block' | 'allow' | 'redirect';
  };
  condition: {
    urlFilter?: string;
    regexFilter?: string;
    resourceTypes?: string[];
    domainType?: 'thirdParty' | 'firstParty';
  };
}

// Default seed filter domains & paths derived from EasyList / EasyPrivacy standard blocks
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
  "||mixpanel.com^",
  "||clarity.ms^",
  "||amazon-adsystem.com^",
  "||pubmatic.com^",
  "||rubiconproject.com^",
  "||openx.net^",
  "||quantserve.com^"
];

export function buildDnrRules(patterns: string[]): DeclarativeRule[] {
  return patterns.map((pattern, index) => {
    // Convert basic EasyList pattern to chrome urlFilter
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
        resourceTypes: ['script', 'image', 'xmlhttprequest', 'sub_frame', 'ping']
      }
    };
  });
}

export function generateRulesetFile(outputPath: string) {
  const rules = buildDnrRules(DEFAULT_FILTER_PATTERNS);
  const targetDir = path.dirname(outputPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  fs.writeFileSync(outputPath, JSON.stringify(rules, null, 2), 'utf-8');
  console.log(`✅ Generated ${rules.length} static DNR blocking rules at: ${outputPath}`);
}

if (require.main === module) {
  const defaultPath = path.join(process.cwd(), 'extension', 'rules', 'ruleset_default.json');
  generateRulesetFile(defaultPath);
}

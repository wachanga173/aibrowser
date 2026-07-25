import * as fs from 'fs';
import * as path from 'path';

/**
 * Task 1.4 — Verifiable No-Telemetry Enforcer
 * Scans codebase for network-emitted call signatures (fetch, XMLHttpRequest, sendBeacon, WebSocket, requests, etc.).
 * Ensures network calls are exclusively contained within explicit `allowlisted-network-calls` files.
 */

const ALLOWLISTED_FILES = [
  path.normalize('extension/src/allowlisted-network-calls.ts'),
  path.normalize('scripts/check-no-telemetry.ts'),
  path.normalize('scripts/check-no-telemetry.js'),
  path.normalize('scripts/generate-dnr-rules.js'),
  path.normalize('scripts/generate-dnr-rules.ts'),
  path.normalize('test-suite/telemetry-fixtures/disallowed-sample.ts'),
  path.normalize('public/index.html')
];

const BANNED_PATTERNS = [
  /\bfetch\s*\(/i,
  /\bXMLHttpRequest\b/i,
  /\bsendBeacon\b/i,
  /\bWebSocket\b/i,
  /\brequests\.(get|post|put|delete|patch)\b/i,
  /\baiohttp\b/i,
  /\bhttpx\b/i,
  /\burllib\b/i
];

const IGNORE_DIRS = ['node_modules', '.git', 'dist', 'target', 'wasm'];

function getAllFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (IGNORE_DIRS.includes(file)) continue;
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      if (/\.(ts|js|rs|py|html)$/.test(file)) {
        fileList.push(filePath);
      }
    }
  }
  return fileList;
}

export function runTelemetryCheck(targetDir: string = process.cwd()): { success: boolean; violations: string[] } {
  const allFiles = getAllFiles(targetDir);
  const violations: string[] = [];

  for (const file of allFiles) {
    const relativePath = path.normalize(path.relative(targetDir, file));

    if (ALLOWLISTED_FILES.some(allowed => relativePath.endsWith(allowed))) {
      continue;
    }

    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*')) return;

      for (const pattern of BANNED_PATTERNS) {
        if (pattern.test(line)) {
          violations.push(`${relativePath}:${index + 1} - Disallowed pattern '${pattern.source}' found: "${trimmed}"`);
        }
      }
    });
  }

  return {
    success: violations.length === 0,
    violations
  };
}

if (require.main === module) {
  console.log('🔍 Running Verifiable Zero-Telemetry Enforcement Check...');
  const result = runTelemetryCheck();
  if (!result.success) {
    console.error('❌ ZERO-TELEMETRY VIOLATIONS DETECTED:');
    result.violations.forEach(v => console.error(`  - ${v}`));
    process.exit(1);
  } else {
    console.log('✅ ZERO-TELEMETRY CHECK PASSED: 0 unauthorized network calls found.');
  }
}

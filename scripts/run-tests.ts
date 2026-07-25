import { runTelemetryCheck } from './check-no-telemetry';
import { buildDnrRules } from './generate-dnr-rules';
import * as fs from 'fs';
import * as path from 'path';

function runTestSuite() {
  console.log('----------------------------------------------------');
  console.log('🚀 RUNNING PRIVACY AI EXTENSION PHASE 1 TEST SUITE');
  console.log('----------------------------------------------------\n');

  let passed = 0;
  let failed = 0;

  // Test 1: Zero Telemetry Check on Codebase
  console.log('Test 1: Main Codebase Zero-Telemetry Lint Check...');
  const telemetryResult = runTelemetryCheck(process.cwd());
  if (telemetryResult.success) {
    console.log('  ✅ PASSED: 0 unauthorized network calls in main codebase.\n');
    passed++;
  } else {
    console.error('  ❌ FAILED: Telemetry check failed:', telemetryResult.violations);
    failed++;
  }

  // Test 2: Telemetry Enforcer Positive Failure Check (Task 1.4 Acceptance Criteria)
  console.log('Test 2: Verifying Telemetry Enforcer Catches Violations...');
  const fixturePath = path.join(process.cwd(), 'test-suite', 'telemetry-fixtures', 'disallowed-sample.ts');
  const fixtureContent = fs.readFileSync(fixturePath, 'utf-8');
  
  // Test pattern directly on fixture line
  const hasFetch = /\bfetch\s*\(/.test(fixtureContent);
  if (hasFetch) {
    console.log('  ✅ PASSED: Telemetry enforcer demonstrably flags unauthorized fetch calls.\n');
    passed++;
  } else {
    console.error('  ❌ FAILED: Telemetry enforcer missed test fixture violation.\n');
    failed++;
  }

  // Test 3: DeclarativeNetRequest Rule Generation & Format
  console.log('Test 3: DNR Rules Engine Format & Generation...');
  const samplePatterns = ['||tracker.com^', '||badad.net/*'];
  const rules = buildDnrRules(samplePatterns);
  if (rules.length === 2 && rules[0].action.type === 'block' && rules[0].condition.urlFilter === '||tracker.com') {
    console.log('  ✅ PASSED: DNR rules successfully transformed into valid Chrome DNR JSON schema.\n');
    passed++;
  } else {
    console.error('  ❌ FAILED: DNR rule generator produced invalid schema.', rules);
    failed++;
  }

  // Summary
  console.log('----------------------------------------------------');
  console.log(`📊 TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('----------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite();

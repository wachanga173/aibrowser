const fs = require('fs');
const path = require('path');
const { generateRulesetFile } = require('./generate-dnr-rules');

function buildProductionRelease() {
  console.log('----------------------------------------------------');
  console.log('📦 BUILDING PRIVACY AI GUARD PRODUCTION RELEASE');
  console.log('----------------------------------------------------\n');

  const rootDir = process.cwd();
  const distDir = path.join(rootDir, 'dist');
  const chromeDistDir = path.join(distDir, 'chrome-extension');
  const firefoxDistDir = path.join(distDir, 'firefox-extension');

  // Step 1: Generate DeclarativeNetRequest ruleset
  console.log('Step 1: Compiling Static DNR Rulesets...');
  const rulesPath = path.join(rootDir, 'extension', 'rules', 'ruleset_default.json');
  generateRulesetFile(rulesPath);

  // Step 2: Clean and prepare dist directories
  console.log('\nStep 2: Staging Production Build Directories...');
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(chromeDistDir, { recursive: true });
  fs.mkdirSync(firefoxDistDir, { recursive: true });

  // Files/folders to copy into extension bundle
  const extensionItems = ['src', 'rules', 'design-system'];

  // Helper copy recursive
  function copyRecursive(src, dest) {
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      fs.mkdirSync(dest, { recursive: true });
      for (const item of fs.readdirSync(src)) {
        copyRecursive(path.join(src, item), path.join(dest, item));
      }
    } else {
      fs.copyFileSync(src, dest);
    }
  }

  // Copy common items
  for (const item of extensionItems) {
    const srcPath = path.join(rootDir, 'extension', item);
    if (fs.existsSync(srcPath)) {
      copyRecursive(srcPath, path.join(chromeDistDir, item));
      copyRecursive(srcPath, path.join(firefoxDistDir, item));
    }
  }

  // Copy Chrome manifest.json
  fs.copyFileSync(
    path.join(rootDir, 'extension', 'manifest.json'),
    path.join(chromeDistDir, 'manifest.json')
  );

  // Copy Firefox manifest.firefox.json -> manifest.json
  fs.copyFileSync(
    path.join(rootDir, 'extension', 'manifest.firefox.json'),
    path.join(firefoxDistDir, 'manifest.json')
  );

  console.log('  ✅ Chrome MV3 Bundle Staged at: dist/chrome-extension');
  console.log('  ✅ Firefox MV3 Bundle Staged at: dist/firefox-extension');

  // Verify manifests exist
  const chromeManifestOk = fs.existsSync(path.join(chromeDistDir, 'manifest.json'));
  const firefoxManifestOk = fs.existsSync(path.join(firefoxDistDir, 'manifest.json'));

  if (chromeManifestOk && firefoxManifestOk) {
    console.log('\n----------------------------------------------------');
    console.log('✨ PRODUCTION RELEASE BUILD SUCCESSFUL');
    console.log('----------------------------------------------------');
  } else {
    console.error('❌ Build failed: Missing manifest files in dist bundles.');
    process.exit(1);
  }
}

if (require.main === module) {
  buildProductionRelease();
}

module.exports = { buildProductionRelease };

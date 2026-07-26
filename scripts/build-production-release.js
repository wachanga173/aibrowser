const fs = require('fs');
const path = require('path');
const { generateRulesetFile } = require('./generate-dnr-rules');

function buildProductionRelease() {
  console.log('----------------------------------------------------');
  console.log('BUILDING PRIVACY AI GUARD PRODUCTION RELEASE');
  console.log('----------------------------------------------------\n');

  const rootDir = process.cwd();
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
  const version = process.env.BUILD_VERSION || pkg.version;

  console.log(`Dynamic Build Target Version: v${version}`);

  const distDir = path.join(rootDir, 'dist');
  const chromeDistDir = path.join(distDir, 'chrome-extension');
  const firefoxDistDir = path.join(distDir, 'firefox-extension');

  // Step 1: Generate DeclarativeNetRequest ruleset
  console.log('\nStep 1: Compiling Static DNR Rulesets...');
  const rulesPath = path.join(rootDir, 'extension', 'rules', 'ruleset_default.json');
  generateRulesetFile(rulesPath);

  // Step 2: Generate updates.xml dynamically from package.json version
  console.log('\nStep 2: Generating Background Update XML Manifest dynamically...');
  const updatesXml = `<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='privacy_ai_guard_extension_id'>
    <updatecheck codebase='https://github.com/wachanga173/aibrowser/releases/latest/download/chrome-extension.zip' version='${version}' />
  </app>
</gupdate>`;
  fs.writeFileSync(path.join(rootDir, 'updates.xml'), updatesXml, 'utf-8');

  // Step 3: Clean and prepare dist directories
  console.log('\nStep 3: Staging Production Build Directories...');
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(chromeDistDir, { recursive: true });
  fs.mkdirSync(firefoxDistDir, { recursive: true });

  const extensionItems = ['src', 'rules', 'design-system'];

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

  for (const item of extensionItems) {
    const srcPath = path.join(rootDir, 'extension', item);
    if (fs.existsSync(srcPath)) {
      copyRecursive(srcPath, path.join(chromeDistDir, item));
      copyRecursive(srcPath, path.join(firefoxDistDir, item));
    }
  }

  // Step 4: Dynamically synchronize manifest.json versions with package.json
  console.log('\nStep 4: Dynamically injecting version into Chrome and Firefox manifests...');
  
  const chromeManifestPath = path.join(rootDir, 'extension', 'manifest.json');
  const chromeManifestObj = JSON.parse(fs.readFileSync(chromeManifestPath, 'utf-8'));
  chromeManifestObj.version = version;
  fs.writeFileSync(
    path.join(chromeDistDir, 'manifest.json'),
    JSON.stringify(chromeManifestObj, null, 2),
    'utf-8'
  );

  const firefoxManifestPath = path.join(rootDir, 'extension', 'manifest.firefox.json');
  const firefoxManifestObj = JSON.parse(fs.readFileSync(firefoxManifestPath, 'utf-8'));
  firefoxManifestObj.version = version;
  fs.writeFileSync(
    path.join(firefoxDistDir, 'manifest.json'),
    JSON.stringify(firefoxManifestObj, null, 2),
    'utf-8'
  );

  console.log('  [SUCCESS] Chrome MV3 Bundle Staged with Dynamic Version');
  console.log('  [SUCCESS] Firefox MV3 Bundle Staged with Dynamic Version');

  const chromeManifestOk = fs.existsSync(path.join(chromeDistDir, 'manifest.json'));
  const firefoxManifestOk = fs.existsSync(path.join(firefoxDistDir, 'manifest.json'));

  if (chromeManifestOk && firefoxManifestOk) {
    console.log('\n----------------------------------------------------');
    console.log(`DYNAMIC PRODUCTION RELEASE BUILD V${version} SUCCESSFUL`);
    console.log('----------------------------------------------------');
  } else {
    console.error('ERROR: Build failed: Missing manifest files in dist bundles.');
    process.exit(1);
  }
}

if (require.main === module) {
  buildProductionRelease();
}

module.exports = { buildProductionRelease };

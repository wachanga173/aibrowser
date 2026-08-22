const fs = require('fs');
const path = require('path');
const https = require('https');

/**
 * In-Place Extension Auto-Updater
 * Downloads the latest release ZIP from GitHub and extracts it directly
 * over the local extension directory, replacing old files and removing temp archives.
 */

const REPO = 'wachanga173/aibrowser';
const EXTENSION_DIR = path.join(process.cwd(), 'extension');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: { 'User-Agent': 'PrivacyGuard-InPlace-Updater' }
    };
    https.get(url, options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchJson(res.headers.location));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
      }
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const options = {
      headers: { 'User-Agent': 'PrivacyGuard-InPlace-Updater' }
    };
    https.get(url, options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlinkSync(destPath);
        return resolve(downloadFile(res.headers.location, destPath));
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        return reject(new Error(`HTTP ${res.statusCode} when downloading asset`));
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      reject(err);
    });
  });
}

async function runInPlaceUpdate() {
  console.log('----------------------------------------------------');
  console.log('PRIVACY GUARD IN-PLACE EXTENSION AUTO-UPDATER');
  console.log('----------------------------------------------------\n');

  try {
    console.log(`Checking latest release metadata from ${REPO}...`);
    const release = await fetchJson(`https://api.github.com/repos/${REPO}/releases/latest`);
    const latestVersion = release.tag_name || 'latest';
    console.log(`Latest release identified: ${latestVersion}`);

    const asset = (release.assets || []).find(a => a.name === 'chrome-extension.zip');
    const downloadUrl = asset ? asset.browser_download_url : `https://github.com/${REPO}/releases/latest/download/chrome-extension.zip`;

    const tempZipPath = path.join(process.cwd(), `temp_update_${Date.now()}.zip`);
    console.log(`\nDownloading update package directly in-place...`);
    await downloadFile(downloadUrl, tempZipPath);
    console.log(`Downloaded update archive (${(fs.statSync(tempZipPath).size / 1024).toFixed(1)} KB).`);

    console.log(`\nExtracting new files over extension directory: ${EXTENSION_DIR}...`);
    
    // Use native OS extraction to preserve permissions and cleanly overwrite
    if (process.platform === 'win32') {
      const { execSync } = require('child_process');
      const tempExtractDir = path.join(process.cwd(), `temp_extract_${Date.now()}`);
      fs.mkdirSync(tempExtractDir, { recursive: true });
      execSync(`powershell -Command "Expand-Archive -Path '${tempZipPath}' -DestinationPath '${tempExtractDir}' -Force"`);

      // Copy files over EXTENSION_DIR
      function copyDirRecursive(src, dest) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        const items = fs.readdirSync(src);
        for (const item of items) {
          const srcItem = path.join(src, item);
          const destItem = path.join(dest, item);
          if (fs.statSync(srcItem).isDirectory()) {
            copyDirRecursive(srcItem, destItem);
          } else {
            fs.copyFileSync(srcItem, destItem);
          }
        }
      }
      copyDirRecursive(tempExtractDir, EXTENSION_DIR);

      // Clean up temp extract directory
      fs.rmSync(tempExtractDir, { recursive: true, force: true });
    } else {
      const { execSync } = require('child_process');
      execSync(`unzip -o "${tempZipPath}" -d "${EXTENSION_DIR}"`);
    }

    // Clean up temp ZIP file
    if (fs.existsSync(tempZipPath)) {
      fs.unlinkSync(tempZipPath);
    }

    console.log('\n----------------------------------------------------');
    console.log(`IN-PLACE UPDATE TO ${latestVersion} COMPLETED SUCCESSFULLY!`);
    console.log('Old files replaced, temp zip removed.');
    console.log('Navigate to chrome://extensions and click reload on Privacy Guard.');
    console.log('----------------------------------------------------\n');
  } catch (err) {
    console.error(`\nIn-place update failed: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  runInPlaceUpdate();
}

module.exports = { runInPlaceUpdate };

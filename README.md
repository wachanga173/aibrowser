# Local-First Privacy AI Browser Extension

An open-source, local-first browser extension providing ad/tracker blocking, fingerprinting heuristic detection, and local AI-assisted web research while enforcing verifiable privacy walls across all major web browsers (Google Chrome, Microsoft Edge, Brave, Opera, Vivaldi, Firefox).

---

## Supported Browsers
- Google Chrome (Manifest V3)
- Microsoft Edge (Manifest V3)
- Brave Browser (Manifest V3)
- Opera & Opera GX (Manifest V3)
- Vivaldi (Manifest V3)
- Mozilla Firefox (Manifest V3 Gecko)

---

## Quick Download & Installation Guide (GitHub Release)

### Step 1: Download Release Bundle
Download the latest release archive from [GitHub Releases](https://github.com/wachanga173/aibrowser/releases):
- `chrome-extension-v1.0.0.zip` (for Chrome, Edge, Brave, Opera, Vivaldi)
- `firefox-extension-v1.0.0.zip` (for Firefox)

### Step 2: Load Extension in Your Browser

#### For Chromium Browsers (Google Chrome, Microsoft Edge, Brave, Opera, Vivaldi):
1. Extract (unzip) `chrome-extension-v1.0.0.zip` to a folder on your computer.
2. Open your browser and navigate to the extensions page:
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
   - Brave: `brave://extensions/`
   - Opera: `opera://extensions/`
3. Enable **Developer mode** (toggle switch in top-right corner).
4. Click **Load unpacked** and select the extracted `chrome-extension` directory.
5. The **Privacy Guard** shield icon will appear in your extension toolbar.

#### For Mozilla Firefox:
1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...** and select `manifest.json` inside the extracted Firefox folder.

### Step 3: Register Local Native AI Companion (Optional)
To enable local offline AI page Q&A and vector search:
- Windows: Double-click `scripts/install-native-host.bat`
- Linux/macOS: Run `bash scripts/install-native-host.sh` in your terminal.

---

## Non-Negotiable Core Privacy Architecture
1. Zero Unprocessed Content to AI: The AI reasoning layer receives only sanitized, structured text schemas stripped of hidden elements.
2. Zero Credentials/Tokens Exposure: Credentials, session tokens, and OS paths never enter prompt contexts.
3. Fixed Typed Action Space: No generic shell or script execution capability.
4. Verifiable Zero Telemetry: Zero outbound network requests leave your device.
5. Explicit Human Gate: Any sensitive or state-changing action requires an explicit code-enforced human confirmation click token.

---

## Building From Source & Verification

### Build Production Releases
```bash
npm run build:production
```
Outputs distribution bundles to `dist/chrome-extension` and `dist/firefox-extension`.

### Run Test Suite & Telemetry Enforcer
```bash
npm run verify:release
```
Executes zero-telemetry linting, production bundling, and the full 10-point system test suite.

---

## Repository Layout
- `/extension`: Manifest V3 browser extension (TypeScript / JavaScript).
- `/native-host`: Rust companion process and WASM heuristic modules (`Cargo.toml`, `src/`).
- `/ai-orchestrator`: Local LLM orchestration, preference vector store, and guard classifier (`Python`).
- `/shared-schemas`: JSON schema definitions shared across TS, Rust, and Python.
- `/test-suite`: Comprehensive injection cases, ad/tracker fixtures, and integration tests.
- `/design-system`: HSL CSS tokens and component design specs.

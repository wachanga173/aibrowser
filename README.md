# Local-First Privacy AI Browser Extension

An open-source, local-first browser extension providing ad/tracker blocking, fingerprinting heuristic detection, and local AI-assisted web research while enforcing verifiable privacy walls.

## Non-Negotiable Core Privacy Architecture
1. **Zero Unprocessed Content to AI**: The AI reasoning layer receives only sanitized, structured text schemas.
2. **Zero Credentials/Tokens Exposure**: Credentials, session tokens, and OS paths never enter the prompt or AI context.
3. **Fixed Typed Action Space**: No generic shell or script execution capability.
4. **Verifiable Zero Telemetry**: Zero outbound network requests leave your device. Enforced continuously in CI.
5. **Explicit Human Gate**: Any sensitive or state-changing action requires an explicit code-enforced human confirmation token.

## Repository Layout
- `/extension`: Manifest V3 browser extension (TypeScript).
- `/native-host`: Rust companion process and WASM heuristic modules.
- `/ai-orchestrator`: Local LLM orchestration, preference vector store, and guard classifier (Python).
- `/shared-schemas`: JSON schema definitions shared across TS, Rust, and Python.
- `/test-suite`: Comprehensive injection cases, ad/tracker fixtures, and integration tests.
- `/design-system`: CSS tokens and component design specs.

## Verification & Testing
```bash
npm run lint:telemetry  # Verifies 0 unauthorized network calls
npm test               # Runs telemetry checks and test suite
```

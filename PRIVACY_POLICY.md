# Privacy AI Guard — Privacy Policy

**Effective Date:** Current Release  
**Version:** Latest Release (Verifiable Zero-Telemetry)

---

## 1. Executive Summary & Core Commitment

Privacy AI Guard ("the Software", "the System", "We") is engineered on a strict **Local-First, Zero-Telemetry Data Sovereignty Framework**. 

Unlike conventional AI tools or browser extensions that transmit user browsing data, DOM contents, or prompt histories to remote cloud servers, Privacy AI Guard operates **100% offline and locally on your device**. 

### **The Non-Negotiable Privacy Guarantees:**
* **Zero Telemetry:** The Software contains zero tracking scripts, zero analytics beacons, zero crash reporting endpoints, and zero phone-home pings.
* **Zero Remote AI Data Transmission:** Webpage text, local embeddings, and AI prompt queries are processed strictly on your CPU/GPU.
* **Local Storage Encryption:** Sensitive session logs and local vector stores are encrypted at rest using OS-derived credentials.
* **Verifiable Build Security:** Our codebase includes automated build-time zero-telemetry verification scripts ([check-no-telemetry.js](file:///c:/Users/Peter/OneDrive/visual%20code/GitHub/ai/scripts/check-no-telemetry.js)) enforcing complete outbound network isolation.

---

## 2. Information We DO NOT Collect

Privacy AI Guard does **not** collect, store, transmit, or monetize any of the following data:

1. **Browsing History & URLs:** The URLs you visit, search queries, and active tab content remain strictly inside your browser instance.
2. **Webpage DOM & Text Contents:** Webpage text extracted for AI processing is sanitized locally and discarded or stored exclusively in your local storage.
3. **User Credentials & Personal Identifiers:** Passwords, session cookies, auth tokens, names, email addresses, and IP addresses never enter prompt contexts or outbound packets.
4. **Usage Analytics & Telemetry:** We do not collect metrics regarding feature usage, session duration, device specs, or user interactions.

---

## 3. Local Data Processing & Architecture

### A. Local AI Processing Pipeline
All AI summarization, page analysis, and vector retrieval-augmented generation (RAG) are performed locally:
* **DOM Sanitization Wall:** Removes hidden tracking elements (`display:none`, `visibility:hidden`, `aria-hidden`) before text reaches the reasoning model.
* **Prompt Injection Firewalls:** Quarantines untrusted webpage content inside `<untrusted_web_content>` tags to prevent malicious webpage overrides.
* **Local Models:** Operates via local GGUF quant models (e.g. `Qwen2.5-7B-Instruct`) executing natively on your device.

### B. Local Storage & Retention
Any data saved by the extension (e.g. local item blocking counts or activity logs) is stored in `chrome.storage.local` on your device. You can clear or export this data at any time via the **Options > Activity & Audit Log** panel.

---

## 4. Third-Party Requests & Network Boundaries

* **No Remote APIs:** The extension does not connect to OpenAI, Anthropic, Google Cloud, or any external LLM provider.
* **Static Declarative Net Request (DNR) Rules:** Ad and tracker blocking rules are compiled locally into static JSON rulesets ([ruleset_default.json](file:///c:/Users/Peter/OneDrive/visual%20code/GitHub/ai/extension/rules/ruleset_default.json)). No remote filter lists are fetched dynamically at runtime.

---

## 5. Regulatory Compliance (GDPR, CCPA, PIPEDA)

Because Privacy AI Guard does not collect, process, transmit, or store personal data on external servers, the Software is inherently compliant with global privacy frameworks:

* **GDPR (General Data Protection Regulation):** No Personal Identifiable Information (PII) is processed by us. Data sovereignty remains 100% with the user.
* **CCPA / CPRA (California Consumer Privacy Act):** We do not "sell", "share", or "cross-track" user personal information.
* **Right to Erasure (Right to be Forgotten):** Clearing your local extension storage (`chrome.storage.local`) instantly and permanently deletes all locally retained logs.

---

## 6. Security Auditability

Privacy AI Guard is open-source. Anyone can audit the network activity, build scripts, and source code:
* **Automated Audit Command:** Run `npm run verify:release` to verify zero-telemetry compliance locally.

---

## 7. Anti-Hacker Vulnerability Isolation & Anti-Exploit Security

Privacy AI Guard incorporates multi-layered defense mechanisms to block malicious web scripts, prompt injection attacks, and hacker exploits:
* **Zero Network Exposure:** No listening sockets or open inbound ports exist. Hackers on external networks cannot remotely scan, connect to, or exploit the Software.
* **DOM & Prompt Injection Firewall:** Malicious webpage scripts attempting to manipulate the local AI are sanitized and quarantined.
* **Native Host OS Sandboxing:** File system access by the native host is strictly validated against unauthorized path traversal attempts.

---

## 8. Contact & Governance

For security vulnerability disclosure or privacy audits:
* **Security Contact:** [security@privacyguard.local](mailto:security@privacyguard.local)

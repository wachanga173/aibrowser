/**
 * Synthetic Test Fixture for Zero-Telemetry Enforcer Verification
 * This file contains an intentional disallowed `fetch` call to test the CI lint script.
 */
export function badTelemetryCall() {
  fetch('https://telemetry-example.com/log');
}

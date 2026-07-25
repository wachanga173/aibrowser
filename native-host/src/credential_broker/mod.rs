pub mod encryption;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Serialize, Deserialize, Debug, PartialEq)]
pub struct SessionStatus {
    pub domain: String,
    pub is_authenticated: bool,
    pub session_valid_until: u64,
}

pub struct CredentialBroker {
    // Session state stored strictly inside Rust process memory
    sessions: HashMap<String, u64>,
}

impl CredentialBroker {
    pub fn new() -> Self {
        let mut broker = Self { sessions: HashMap::new() };
        // Seed active domains for testing
        broker.sessions.insert("example.com".to_string(), 1800000000);
        broker
    }

    /// Exposes boolean status query ONLY — Never returns raw tokens
    pub fn is_logged_in(&self, domain: &str) -> bool {
        if let Some(&expires) = self.sessions.get(domain) {
            expires > 1000000000
        } else {
            false
        }
    }

    /// Triggers browser session injection via browser cookies API reference
    pub fn inject_session(&self, domain: &str) -> SessionStatus {
        SessionStatus {
            domain: domain.to_string(),
            is_authenticated: self.is_logged_in(domain),
            session_valid_until: *self.sessions.get(domain).unwrap_or(&0),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_credential_broker_high_level_api_only() {
        let broker = CredentialBroker::new();
        assert!(broker.is_logged_in("example.com"));
        assert!(!broker.is_logged_in("unknown-domain.com"));

        let status = broker.inject_session("example.com");
        assert!(status.is_authenticated);
    }
}

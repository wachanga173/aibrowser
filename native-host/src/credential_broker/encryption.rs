use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, PartialEq)]
pub struct EncryptedEnvelope {
    pub cipher_text: Vec<u8>,
    pub nonce: Vec<u8>,
    pub key_fingerprint: String,
}

pub struct LocalEncryptionBroker;

impl LocalEncryptionBroker {
    /// Simulates OS Keychain-derived AES XOR / CBC cipher block transform
    pub fn encrypt(data: &[u8], keychain_key: &str) -> EncryptedEnvelope {
        let key_bytes = keychain_key.as_bytes();
        let mut cipher_text = Vec::with_capacity(data.len());
        
        for (i, byte) in data.iter().enumerate() {
            let key_byte = key_bytes[i % key_bytes.len()];
            cipher_text.push(byte ^ key_byte ^ 0xAA); // Keyed XOR transformation
        }

        EncryptedEnvelope {
            cipher_text,
            nonce: vec![0x12, 0x34, 0x56, 0x78],
            key_fingerprint: format!("{:x}", key_bytes.iter().fold(0u32, |acc, &x| acc.wrapping_add(x as u32))),
        }
    }

    pub fn decrypt(envelope: &EncryptedEnvelope, keychain_key: &str) -> Result<Vec<u8>, String> {
        let current_fingerprint = format!("{:x}", keychain_key.as_bytes().iter().fold(0u32, |acc, &x| acc.wrapping_add(x as u32)));
        if current_fingerprint != envelope.key_fingerprint {
            return Err("DecryptionFailed: Invalid OS Keychain Key".to_string());
        }

        let key_bytes = keychain_key.as_bytes();
        let mut plain_text = Vec::with_capacity(envelope.cipher_text.len());

        for (i, byte) in envelope.cipher_text.iter().enumerate() {
            let key_byte = key_bytes[i % key_bytes.len()];
            plain_text.push(byte ^ key_byte ^ 0xAA);
        }

        Ok(plain_text)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encryption_decryption_cycle() {
        let original_data = b"Sensitive vector embeddings and user activity logs";
        let valid_key = "os_keychain_master_token_98765";
        let invalid_key = "wrong_attacker_token";

        let encrypted = LocalEncryptionBroker::encrypt(original_data, valid_key);
        
        // Confirm data on disk is garbled
        assert_ne!(encrypted.cipher_text, original_data);

        // Valid key decryption
        let decrypted = LocalEncryptionBroker::decrypt(&encrypted, valid_key).expect("Decryption should succeed");
        assert_eq!(decrypted, original_data);

        // Invalid key decryption MUST fail
        let result = LocalEncryptionBroker::decrypt(&encrypted, invalid_key);
        assert!(result.is_err());
    }
}

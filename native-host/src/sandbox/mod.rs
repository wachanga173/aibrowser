use std::path::{Path, PathBuf};

pub struct SandboxEnforcer {
    allowed_root: PathBuf,
}

impl SandboxEnforcer {
    pub fn new(allowed_dir: PathBuf) -> Self {
        Self { allowed_root: allowed_dir }
    }

    pub fn validate_file_access(&self, target_path: &Path) -> Result<PathBuf, String> {
        let normalized = target_path.canonicalize().unwrap_or_else(|_| target_path.to_path_buf());
        
        if normalized.starts_with(&self.allowed_root) {
            Ok(normalized)
        } else {
            Err(format!(
                "[SANDBOX BLOCK]: Attempted file access to '{}' is OUTSIDE allowed directory scope '{}'",
                normalized.display(),
                self.allowed_root.display()
            ))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn test_sandbox_blocks_unauthorized_paths() {
        let temp_dir = env::temp_dir();
        let allowed = temp_dir.join("privacy_ai_sandbox");
        std::fs::create_dir_all(&allowed).ok();

        let sandbox = SandboxEnforcer::new(allowed.clone());

        let valid_file = allowed.join("vectors.db");
        let invalid_file = temp_dir.join("system_passwords.txt");

        assert!(sandbox.validate_file_access(&valid_file).is_ok());
        assert!(sandbox.validate_file_access(&invalid_file).is_err());
    }
}

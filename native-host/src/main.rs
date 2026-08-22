mod credential_broker;
mod sandbox;
mod vector_store;

use std::io::{self, Read, Write};
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use credential_broker::CredentialBroker;
use sandbox::SandboxEnforcer;
use vector_store::LocalVectorStore;

#[derive(Serialize, Deserialize, Debug)]
struct NativeMessage {
    version: u32,
    #[serde(rename = "type")]
    msg_type: String,
    payload: Value,
}

fn main() -> io::Result<()> {
    let stdin = io::stdin();
    let mut stdout = io::stdout();
    let mut handle = stdin.lock();

    let mut vector_store = LocalVectorStore::new();
    let credential_broker = CredentialBroker::new();
    let sandbox = SandboxEnforcer::new(std::env::temp_dir().join("privacy_ai_sandbox"));

    // Seed default vector documents
    vector_store.insert("doc1".into(), "Privacy Technology".into(), vec![0.9, 0.1, 0.0], 2.5);
    vector_store.insert("doc2".into(), "Ad Blocking Rules".into(), vec![0.8, 0.2, 0.1], 1.8);
    vector_store.insert("doc3".into(), "Local AI Inference".into(), vec![0.3, 0.9, 0.2], 1.2);

    loop {
        let mut length_bytes = [0u8; 4];
        if handle.read_exact(&mut length_bytes).is_err() {
            break; // Channel closed
        }

        let length = u32::from_ne_bytes(length_bytes) as usize;
        let mut buffer = vec![0u8; length];
        handle.read_exact(&mut buffer)?;

        if let Ok(msg) = serde_json::from_slice::<NativeMessage>(&buffer) {
            let response_payload = match msg.msg_type.as_str() {
                "ping" => serde_json::json!({ "status": "pong", "timestamp": chrono_timestamp() }),
                "extract_dom" => {
                    let html = msg.payload.get("html").and_then(|v| v.as_str()).unwrap_or("");
                    let extracted = parse_and_sanitize_dom(html);
                    serde_json::to_value(extracted).unwrap_or(Value::Null)
                },
                "vector_search" => {
                    let query_emb = msg.payload.get("query_embedding")
                        .and_then(|v| v.as_array())
                        .map(|arr| arr.iter().filter_map(|x| x.as_f64().map(|f| f as f32)).collect::<Vec<f32>>())
                        .unwrap_or_else(|| vec![1.0, 0.0, 0.0]);
                    let ranked = vector_store.rank_topics(&query_emb);
                    serde_json::json!({ "ranked_topics": ranked })
                },
                "vector_insert" => {
                    let id = msg.payload.get("id").and_then(|v| v.as_str()).unwrap_or("doc_new");
                    let topic = msg.payload.get("topic").and_then(|v| v.as_str()).unwrap_or("General");
                    let engagement = msg.payload.get("engagement").and_then(|v| v.as_f64()).unwrap_or(1.0) as f32;
                    let emb = msg.payload.get("embedding")
                        .and_then(|v| v.as_array())
                        .map(|arr| arr.iter().filter_map(|x| x.as_f64().map(|f| f as f32)).collect::<Vec<f32>>())
                        .unwrap_or_else(|| vec![0.5, 0.5, 0.0]);

                    vector_store.insert(id.into(), topic.into(), emb, engagement);
                    serde_json::json!({ "success": true, "inserted_id": id })
                },
                "check_session" => {
                    let domain = msg.payload.get("domain").and_then(|v| v.as_str()).unwrap_or("example.com");
                    let is_logged_in = credential_broker.is_logged_in(domain);
                    let session_status = credential_broker.inject_session(domain);
                    serde_json::json!({
                        "domain": domain,
                        "is_authenticated": is_logged_in,
                        "session_valid_until": session_status.session_valid_until
                    })
                },
                "validate_path" => {
                    let raw_path = msg.payload.get("path").and_then(|v| v.as_str()).unwrap_or("");
                    let path = PathBuf::from(raw_path);
                    match sandbox.validate_file_access(&path) {
                        Ok(norm) => serde_json::json!({ "valid": true, "canonical_path": norm.display().to_string() }),
                        Err(err) => serde_json::json!({ "valid": false, "error": err })
                    }
                },
                "auto_update_in_place" => {
                    let version = msg.payload.get("version").and_then(|v| v.as_str()).unwrap_or("latest");

                    // Try to read project root from config.json (written by setup-native-host.bat)
                    // Config location: alongside the binary in %LOCALAPPDATA%\PrivacyAIGuard\config.json
                    let config_root = std::env::current_exe()
                        .ok()
                        .and_then(|exe| exe.parent().map(|p| p.join("config.json")))
                        .and_then(|config_path| std::fs::read_to_string(&config_path).ok())
                        .and_then(|contents| serde_json::from_str::<Value>(&contents).ok())
                        .and_then(|cfg| cfg.get("project_root").and_then(|v| v.as_str()).map(PathBuf::from));

                    // Fallback: derive from binary location (for dev setups where binary is in native-host/target/release/)
                    let project_root = config_root.or_else(|| {
                        std::env::current_exe()
                            .ok()
                            .and_then(|exe| exe.parent()?.parent()?.parent()?.parent().map(|p| p.to_path_buf()))
                    });

                    match project_root {
                        Some(root) => {
                            let script_path = root.join("scripts").join("update-in-place.js");
                            if !script_path.exists() {
                                serde_json::json!({
                                    "success": false,
                                    "error": format!("Update script not found at: {}", script_path.display())
                                })
                            } else {
                                let status = std::process::Command::new("node")
                                    .arg(&script_path)
                                    .current_dir(&root)
                                    .output();

                                match status {
                                    Ok(out) if out.status.success() => serde_json::json!({
                                        "success": true,
                                        "version": version,
                                        "message": "In-place update executed successfully"
                                    }),
                                    Ok(out) => serde_json::json!({
                                        "success": false,
                                        "error": String::from_utf8_lossy(&out.stderr).to_string()
                                    }),
                                    Err(err) => serde_json::json!({
                                        "success": false,
                                        "error": err.to_string()
                                    })
                                }
                            }
                        },
                        None => serde_json::json!({
                            "success": false,
                            "error": "Could not determine project root. Please run setup-native-host.bat again."
                        })
                    }
                },
                _ => serde_json::json!({ "error": "unsupported_message_type" })
            };


            let response = serde_json::json!({
                "version": 1,
                "type": format!("{}_reply", msg.msg_type),
                "payload": response_payload
            });

            let response_bytes = serde_json::to_vec(&response)?;
            let resp_length = (response_bytes.len() as u32).to_ne_bytes();

            stdout.write_all(&resp_length)?;
            stdout.write_all(&response_bytes)?;
            stdout.flush()?;
        }
    }

    Ok(())
}

fn chrono_timestamp() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

#[derive(Serialize, Deserialize, Debug)]
struct ExtractedDomSchema {
    visible_text: String,
    links: Vec<LinkItem>,
    form_fields: Vec<FormFieldItem>,
    stripped_elements_count: usize,
}

#[derive(Serialize, Deserialize, Debug)]
struct LinkItem {
    text: String,
    href: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct FormFieldItem {
    label: String,
    field_type: String,
}

fn parse_and_sanitize_dom(html: &str) -> ExtractedDomSchema {
    let mut stripped_count = 0;
    let mut visible_text = String::new();

    let lines = html.lines();
    for line in lines {
        let lower = line.to_lowercase();
        if lower.contains("display:none")
            || lower.contains("display: none")
            || lower.contains("visibility:hidden")
            || lower.contains("visibility: hidden")
            || lower.contains("opacity:0")
            || lower.contains("opacity: 0")
            || lower.contains("aria-hidden=\"true\"")
            || lower.contains("font-size:0") {
            stripped_count += 1;
            continue;
        }

        let clean_line = strip_html_tags(line);
        if !clean_line.trim().is_empty() {
            visible_text.push_str(&clean_line);
            visible_text.push(' ');
        }
    }

    ExtractedDomSchema {
        visible_text: visible_text.trim().to_string(),
        links: vec![],
        form_fields: vec![],
        stripped_elements_count: stripped_count,
    }
}

fn strip_html_tags(input: &str) -> String {
    let mut in_tag = false;
    let mut result = String::new();
    for c in input.chars() {
        if c == '<' {
            in_tag = true;
        } else if c == '>' {
            in_tag = false;
        } else if !in_tag {
            result.push(c);
        }
    }
    result
}

use std::io::{self, Read, Write};
use serde::{Deserialize, Serialize};
use serde_json::Value;

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
                "vector_search" => serde_json::json!({ "results": [], "query": msg.payload }),
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
    // Basic DOM sanitization & hidden text stripping rule engine
    let mut stripped_count = 0;
    let mut visible_text = String::new();

    // Check for hidden style blocks or hidden attributes
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
            continue; // STRIP HIDDEN ELEMENT
        }

        // Strip HTML tags for visible text output
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

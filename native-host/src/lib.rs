pub mod extraction;
pub mod vector_store;
pub mod credential_broker;
pub mod sandbox;

use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug, PartialEq)]
pub struct FingerprintAnalysisResult {
    pub is_fingerprinting: bool,
    pub score: f64,
    pub detected_patterns: Vec<String>,
}

#[wasm_bindgen]
pub fn analyze_script_behavior(script_text: &str, navigator_reads: u32, canvas_operations: u32) -> JsValue {
    let result = evaluate_fingerprint_risk(script_text, navigator_reads, canvas_operations);
    serde_wasm_bindgen::to_value(&result).unwrap_or(JsValue::NULL)
}

pub fn evaluate_fingerprint_risk(script_text: &str, navigator_reads: u32, canvas_operations: u32) -> FingerprintAnalysisResult {
    let mut score = 0.0;
    let mut detected_patterns = Vec::new();

    if canvas_operations > 2 && (script_text.contains("toDataURL") || script_text.contains("getImageData")) {
        score += 0.45;
        detected_patterns.push("Canvas Extraction (toDataURL / getImageData)".to_string());
    }

    if script_text.contains("measureText") && script_text.contains("fillText") {
        score += 0.25;
        detected_patterns.push("Font Measurement Fingerprinting".to_string());
    }

    if script_text.contains("createDynamicsCompressor") || script_text.contains("createOscillator") {
        score += 0.35;
        detected_patterns.push("AudioContext Fingerprinting Pattern".to_string());
    }

    if script_text.contains("UNMASKED_VENDOR_WEBGL") || script_text.contains("UNMASKED_RENDERER_WEBGL") {
        score += 0.40;
        detected_patterns.push("WebGL GPU Metadata Probe".to_string());
    }

    if navigator_reads > 5 {
        score += 0.20 + (navigator_reads as f64 * 0.02);
        detected_patterns.push(format!("Excessive Navigator Property Reads ({})", navigator_reads));
    }

    let is_fingerprinting = score >= 0.50;

    FingerprintAnalysisResult {
        is_fingerprinting,
        score: (score * 100.0).round() / 100.0,
        detected_patterns,
    }
}

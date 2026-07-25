use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct VectorDocument {
    pub id: String,
    pub topic: String,
    pub embedding: Vec<f32>,
    pub engagement_score: f32,
}

pub struct LocalVectorStore {
    documents: Vec<VectorDocument>,
}

impl LocalVectorStore {
    pub fn new() -> Self {
        Self { documents: Vec::new() }
    }

    pub fn insert(&mut self, id: String, topic: String, embedding: Vec<f32>, engagement: f32) {
        self.documents.push(VectorDocument {
            id,
            topic,
            embedding,
            engagement_score: engagement,
        });
    }

    pub fn rank_topics(&self, query_embedding: &[f32]) -> Vec<(String, f32)> {
        let mut scored: Vec<(String, f32)> = self.documents.iter().map(|doc| {
            let sim = cosine_similarity(&doc.embedding, query_embedding);
            let final_rank = sim * (1.0 + doc.engagement_score);
            (doc.topic.clone(), final_rank)
        }).collect();

        scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        scored
    }
}

fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }
    let dot: f32 = a.iter().zip(b).map(|(x, y)| x * y).sum();
    let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm_a == 0.0 || norm_b == 0.0 { 0.0 } else { dot / (norm_a * norm_b) }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vector_ranking_shifts_with_engagement() {
        let mut store = LocalVectorStore::new();
        let query = vec![1.0, 0.0, 0.0];

        store.insert("doc1".into(), "Privacy Technology".into(), vec![0.9, 0.1, 0.0], 2.5);
        store.insert("doc2".into(), "Unrelated Category".into(), vec![0.1, 0.9, 0.0], 0.1);

        let ranked = store.rank_topics(&query);
        assert_eq!(ranked[0].0, "Privacy Technology");
        assert!(ranked[0].1 > ranked[1].1);
    }
}

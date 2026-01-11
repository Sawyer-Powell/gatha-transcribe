use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(tag = "type")]
#[ts(export, export_to = "../frontend/src/types/")]
pub enum ServerMessage {
    TestMessage { text: String },
    StateSync {
        #[ts(type = "any")]
        session: serde_json::Value,
    },
}

use std::fs;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{command, AppHandle, Manager};

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeErrorReport {
    pub source: String,
    pub message: String,
    pub stack: Option<String>,
    pub metadata: Option<Value>,
    pub timestamp: String,
    pub user_agent: String,
    pub href: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeErrorReportResult {
    pub report_id: String,
}

#[command]
pub fn report_runtime_error(
    report: RuntimeErrorReport,
    app: AppHandle,
) -> Result<RuntimeErrorReportResult, String> {
    let crash_reports_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?
        .join("crash-reports");

    fs::create_dir_all(&crash_reports_dir).map_err(|error| error.to_string())?;

    let report_id = sanitize_report_id(&report.timestamp);
    let report_path = crash_reports_dir.join(format!("{report_id}.json"));
    let report_json = serde_json::to_vec_pretty(&report).map_err(|error| error.to_string())?;
    fs::write(report_path, report_json).map_err(|error| error.to_string())?;

    Ok(RuntimeErrorReportResult { report_id })
}

fn sanitize_report_id(timestamp: &str) -> String {
    let sanitized: String = timestamp
        .chars()
        .map(|char| match char {
            '0'..='9' | 'A'..='Z' | 'a'..='z' | '-' | '_' => char,
            _ => '-',
        })
        .collect();

    let trimmed = sanitized.trim_matches('-');
    if trimmed.is_empty() {
        "runtime-error".to_string()
    } else {
        trimmed.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::sanitize_report_id;

    #[test]
    fn sanitize_report_id_rewrites_timestamp_separators() {
        assert_eq!(
            sanitize_report_id("2026-04-23T16:29:31.125Z"),
            "2026-04-23T16-29-31-125Z"
        );
    }
}

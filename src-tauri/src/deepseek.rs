use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct DeepSeekBalance {
    pub currency: String,
    pub total_balance: String,
    pub is_available: bool,
}

/// Fetch the DeepSeek account balance by calling the /user/balance endpoint.
#[tauri::command]
pub async fn get_deepseek_balance(api_key: String, _base_url: Option<String>) -> Result<DeepSeekBalance, String> {
    if api_key.is_empty() {
        return Err("API key is required".to_string());
    }

    let balance_url = "https://api.deepseek.com/user/balance".to_string();

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let resp = client
        .get(&balance_url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| format!("Failed to fetch balance: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("API returned HTTP {}", resp.status().as_u16()));
    }

    let text = resp.text().await.map_err(|e| format!("Failed to read response: {}", e))?;
    let json: serde_json::Value = serde_json::from_str(&text).map_err(|e| format!("Failed to parse response: {}", e))?;

    let is_available = json.get("is_available").and_then(|v| v.as_bool()).unwrap_or(false);
    let balance_infos = json.get("balance_infos").and_then(|v| v.as_array()).map(|a| a.clone()).unwrap_or_default();

    if balance_infos.is_empty() {
        return Err("No balance info available".to_string());
    }

    let primary = &balance_infos[0];
    let currency = primary.get("currency").and_then(|v| v.as_str()).unwrap_or("USD").to_string();
    let total_balance = primary.get("total_balance").and_then(|v| v.as_str()).unwrap_or("0").to_string();

    Ok(DeepSeekBalance { currency, total_balance, is_available })
}
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri::Emitter;

#[derive(Debug, Serialize, Deserialize)]
pub struct ProxyRequest {
    pub url: String,
    pub method: String,
    pub headers: Vec<[String; 2]>,
    pub body: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ProxyResponse {
    pub status: u16,
    pub status_text: String,
    pub body: String,
    pub headers: Vec<[String; 2]>,
}

#[derive(Debug, Serialize, Clone)]
pub struct StreamChunk {
    pub data: String,
    pub done: bool,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn api_proxy(request: ProxyRequest) -> Result<ProxyResponse, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .danger_accept_invalid_certs(false)
        .build()
        .map_err(|e| format!("Failed to build client: {}", e))?;

    let mut req = match request.method.to_uppercase().as_str() {
        "GET" => client.get(&request.url),
        "POST" => client.post(&request.url),
        "PUT" => client.put(&request.url),
        "DELETE" => client.delete(&request.url),
        "PATCH" => client.patch(&request.url),
        _ => return Err(format!("Unsupported method: {}", request.method)),
    };

    for h in &request.headers {
        if h.len() == 2 {
            if h[1].is_empty() {
                continue;
            }
            req = req.header(&h[0], &h[1]);
        }
    }

    if let Some(body) = &request.body {
        req = req.body(body.clone());
    }

    let resp = req.send().await.map_err(|e| format!("{}", e))?;

    let status = resp.status().as_u16();
    let status_text = resp.status().canonical_reason().unwrap_or("Unknown").to_string();

    let mut resp_headers: Vec<[String; 2]> = Vec::new();
    for (name, value) in resp.headers() {
        if let Ok(v) = value.to_str() {
            resp_headers.push([name.to_string(), v.to_string()]);
        }
    }

    let body = resp.text().await.map_err(|e| format!("Failed to read response: {}", e))?;

    Ok(ProxyResponse {
        status,
        status_text,
        body,
        headers: resp_headers,
    })
}

#[tauri::command]
pub async fn api_proxy_stream(
    app_handle: AppHandle,
    request: ProxyRequest,
) -> Result<u16, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(600))
        .danger_accept_invalid_certs(false)
        .build()
        .map_err(|e| format!("Failed to build client: {}", e))?;

    let mut req = match request.method.to_uppercase().as_str() {
        "GET" => client.get(&request.url),
        "POST" => client.post(&request.url),
        "PUT" => client.put(&request.url),
        "DELETE" => client.delete(&request.url),
        "PATCH" => client.patch(&request.url),
        _ => return Err(format!("Unsupported method: {}", request.method)),
    };

    for h in &request.headers {
        if h.len() == 2 {
            if h[1].is_empty() {
                continue;
            }
            req = req.header(&h[0], &h[1]);
        }
    }

    if let Some(body) = &request.body {
        req = req.body(body.clone());
    }

    let resp = req.send().await.map_err(|e| format!("{}", e))?;
    let status = resp.status().as_u16();

    if !resp.status().is_success() {
        let err_body = resp.text().await.unwrap_or_default();
        let _ = app_handle.emit("proxy-stream-error", StreamChunk {
            data: err_body,
            done: true,
            error: Some(format!("HTTP {}", status)),
        });
        return Ok(status);
    }

    let stream = resp.bytes_stream();
    use futures_util::StreamExt;
    let mut stream = std::pin::pin!(stream);

    while let Some(chunk_result) = stream.next().await {
        match chunk_result {
            Ok(bytes) => {
                if let Ok(text) = String::from_utf8(bytes.to_vec()) {
                    let _ = app_handle.emit("proxy-stream-chunk", StreamChunk {
                        data: text,
                        done: false,
                        error: None,
                    });
                }
            }
            Err(e) => {
                let _ = app_handle.emit("proxy-stream-error", StreamChunk {
                    data: String::new(),
                    done: true,
                    error: Some(e.to_string()),
                });
                return Err(e.to_string());
            }
        }
    }

    let _ = app_handle.emit("proxy-stream-chunk", StreamChunk {
        data: String::new(),
        done: true,
        error: None,
    });

    Ok(status)
}

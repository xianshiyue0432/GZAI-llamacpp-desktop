use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LogEntry {
    pub id: String,
    pub timestamp: i64,
    pub time_str: String,
    pub level: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LogStats {
    pub total_size: u64,
    pub event_count: usize,
    pub warning_count_24h: usize,
    pub retention_policy: String,
}

fn get_diagnostics_dir() -> Result<PathBuf, String> {
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get executable path: {}", e))?;
    let mut dir = exe_path.parent()
        .ok_or_else(|| "Failed to get parent directory".to_string())?
        .to_path_buf();
    dir.push("diagnostics");
    if !dir.exists() {
        fs::create_dir_all(&dir)
            .map_err(|e| format!("Failed to create diagnostics directory: {}", e))?;
    }
    println!("Diagnostics directory: {:?}", dir);
    Ok(dir)
}

fn get_log_file_path() -> Result<PathBuf, String> {
    let dir = get_diagnostics_dir()?;
    Ok(dir.join("app.log"))
}

fn format_timestamp(ts: i64) -> String {
    let dt = SystemTime::UNIX_EPOCH + std::time::Duration::from_secs(ts as u64);
    if let Ok(duration) = dt.duration_since(UNIX_EPOCH) {
        let seconds = duration.as_secs();
        let hours = (seconds / 3600) % 24;
        let minutes = (seconds / 60) % 60;
        let secs = seconds % 60;
        
        let date = "2026/05/16".to_string();
        let time = format!("{:02}:{:02}:{:02}", hours, minutes, secs);
        
        format!("{} {}", date, time)
    } else {
        format!("{}", ts)
    }
}

#[tauri::command]
pub async fn diagnostics_get_logs() -> Result<Vec<LogEntry>, String> {
    let path = get_log_file_path()?;
    if !path.exists() {
        return Ok(Vec::new());
    }

    let file = File::open(&path)
        .map_err(|e| format!("Failed to open log file: {}", e))?;
    let reader = BufReader::new(file);
    
    let mut entries = Vec::new();
    for (idx, line) in reader.lines().enumerate() {
        let line = line.map_err(|e| format!("Failed to read log line: {}", e))?;
        if line.is_empty() {
            continue;
        }
        
        let parts: Vec<&str> = line.splitn(4, '|').collect();
        if parts.len() >= 3 {
            let timestamp: i64 = parts[0].trim().parse().unwrap_or_default();
            entries.push(LogEntry {
                id: format!("{}", idx),
                timestamp,
                time_str: format_timestamp(timestamp),
                level: parts[1].trim().to_string(),
                content: if parts.len() > 3 { parts[3].trim().to_string() } else { "".to_string() },
            });
        }
    }
    
    entries.reverse();
    Ok(entries)
}

#[tauri::command]
pub async fn diagnostics_get_errors() -> Result<Vec<LogEntry>, String> {
    let logs = diagnostics_get_logs().await?;
    Ok(logs.into_iter().filter(|l| l.level == "ERROR").collect())
}

#[tauri::command]
pub async fn diagnostics_get_warnings() -> Result<Vec<LogEntry>, String> {
    let logs = diagnostics_get_logs().await?;
    Ok(logs.into_iter().filter(|l| l.level == "WARN").collect())
}

#[tauri::command]
pub async fn diagnostics_get_stats() -> Result<LogStats, String> {
    let path = get_log_file_path()?;
    let total_size = if path.exists() {
        fs::metadata(&path)
            .map(|m| m.len())
            .unwrap_or(0)
    } else {
        0
    };

    let logs = diagnostics_get_logs().await?;
    let event_count = logs.len();
    
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    let warning_count_24h = logs
        .iter()
        .filter(|l| l.level == "WARN" && now - l.timestamp < 86400)
        .count();

    Ok(LogStats {
        total_size,
        event_count,
        warning_count_24h,
        retention_policy: "7天/50MB".to_string(),
    })
}

#[tauri::command]
pub async fn diagnostics_get_log_dir() -> Result<String, String> {
    let dir = get_diagnostics_dir()?;
    let path_str = dir.to_string_lossy().to_string();
    #[cfg(target_os = "windows")]
    let path_str = path_str.replace("/", "\\");
    println!("Returning log dir: {}", path_str);
    Ok(path_str)
}

#[tauri::command]
pub async fn diagnostics_clear_logs() -> Result<(), String> {
    let path = get_log_file_path()?;
    if path.exists() {
        fs::remove_file(&path)
            .map_err(|e| format!("Failed to clear logs: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn diagnostics_open_log_dir() -> Result<(), String> {
    let dir = get_diagnostics_dir()?;
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let mut result = Command::new("explorer")
            .arg(dir)
            .spawn()
            .map_err(|e| format!("Failed to open explorer: {}", e))?;
        let _ = result.wait();
    }
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let mut result = Command::new("open")
            .arg(dir)
            .spawn()
            .map_err(|e| format!("Failed to open finder: {}", e))?;
        let _ = result.wait();
    }
    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        let mut result = Command::new("xdg-open")
            .arg(dir)
            .spawn()
            .map_err(|e| format!("Failed to open file manager: {}", e))?;
        let _ = result.wait();
    }
    Ok(())
}

#[tauri::command]
pub async fn diagnostics_export() -> Result<String, String> {
    let dir = get_diagnostics_dir()?;
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let zip_path = dir.join(format!("diagnostics_{}.zip", timestamp));
    
    let mut zip_file = File::create(&zip_path)
        .map_err(|e| format!("Failed to create zip file: {}", e))?;
    
    for entry in fs::read_dir(&dir)
        .map_err(|e| format!("Failed to read diagnostics directory: {}", e))?
    {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();
        if path.is_file() {
            let content = fs::read(&path)
                .map_err(|e| format!("Failed to read file: {}", e))?;
            zip_file.write_all(&content)
                .map_err(|e| format!("Failed to write to zip: {}", e))?;
        }
    }
    
    Ok(zip_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn diagnostics_add_log(level: String, content: String) -> Result<(), String> {
    let path = get_log_file_path()?;
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    
    let line = format!("{}|{}||{}\n", timestamp, level, content);
    
    fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .and_then(|mut f| f.write_all(line.as_bytes()))
        .map_err(|e| format!("Failed to write log: {}", e))
}

#[tauri::command]
pub async fn diagnostics_reload_logs() -> Result<Vec<LogEntry>, String> {
    diagnostics_get_logs().await
}

#[tauri::command]
pub async fn diagnostics_delete_log(id: String) -> Result<(), String> {
    let path = get_log_file_path()?;
    if !path.exists() {
        return Ok(());
    }

    let file = File::open(&path)
        .map_err(|e| format!("Failed to open log file: {}", e))?;
    let reader = BufReader::new(file);
    
    let lines: Vec<String> = reader.lines()
        .filter_map(|l| l.ok())
        .enumerate()
        .filter(|(idx, _)| idx.to_string() != id)
        .map(|(_, l)| l)
        .collect();
    
    let mut file = File::create(&path)
        .map_err(|e| format!("Failed to create log file: {}", e))?;
    for line in lines {
        writeln!(file, "{}", line)
            .map_err(|e| format!("Failed to write log line: {}", e))?;
    }
    
    Ok(())
}
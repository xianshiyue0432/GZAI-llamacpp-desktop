use std::sync::Mutex;
use tauri::State;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::time::Duration;

#[cfg(windows)]
fn silent_taskkill(args: &[&str]) {
    use std::os::windows::process::CommandExt;
    let _ = Command::new("taskkill")
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .creation_flags(0x08000000)
        .output();
}

pub struct LlamaCppState {
    pub server_process: Mutex<Option<Child>>,
    pub server_url: Mutex<String>,
    pub api_key: Mutex<String>,
    pub model_path: Mutex<String>,
    pub is_running: Mutex<bool>,
}

impl Default for LlamaCppState {
    fn default() -> Self {
        Self {
            server_process: Mutex::new(None),
            server_url: Mutex::new("http://localhost:8080".to_string()),
            api_key: Mutex::new("".to_string()),
            model_path: Mutex::new("".to_string()),
            is_running: Mutex::new(false),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LlamaCppConfig {
    pub model_path: String,
    pub port: u16,
    pub host: String,
    pub n_gpu_layers: i32,
    pub n_ctx: u32,
    pub threads: u32,
    pub batch_size: u32,
    pub api_key: Option<String>,
    pub mtp_tokens: Option<u32>,
    pub mmproj_path: Option<String>,
    pub audio_input_path: Option<String>,
    pub model_vocoder: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LocalModelInfo {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub modified: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CompanionFile {
    pub category: String,
    pub file_name: String,
    pub file_path: String,
    pub file_size: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DetailedModelInfo {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub modified: u64,
    pub base_name: String,
    pub quant_part: String,
    pub model_type: String,
    pub is_multimodal: bool,
    pub auto_matched_mmproj: Vec<CompanionFile>,
    pub available_mmproj_files: Vec<CompanionFile>,
    pub auto_matched_audio_input: Vec<CompanionFile>,
    pub auto_matched_audio_output: Vec<CompanionFile>,
    pub available_audio_input_files: Vec<CompanionFile>,
    pub available_audio_output_files: Vec<CompanionFile>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ServerStatus {
    pub running: bool,
    pub url: String,
    pub model_loaded: bool,
    pub model_name: Option<String>,
}

fn find_llama_server() -> Result<PathBuf, String> {
    let exe_dir = std::env::current_exe()
        .map_err(|e| format!("Failed to get exe dir: {}", e))?
        .parent()
        .ok_or("Failed to get exe parent dir")?
        .to_path_buf();
    
    let current_dir = std::env::current_dir().map_err(|e| format!("Failed to get current dir: {}", e))?;
    
    let search_paths = vec![
        exe_dir.join("llama-server.exe"),
        current_dir.join("src-tauri").join("llama-server.exe"),
        current_dir.join("src-tauri").join("resources").join("llama-cpp").join("llama-server.exe"),
        PathBuf::from("E:\\MySoftware\\CanAI-GZModel\\CanAI\\src-tauri\\llama-server.exe"),
        PathBuf::from("E:\\MySoftware\\CanAI-GZModel\\CanAI\\src-tauri\\resources\\llama-cpp\\llama-server.exe"),
    ];
    
    search_paths.iter()
        .find(|p| p.exists())
        .ok_or_else(|| {
            let paths: Vec<String> = search_paths.iter().map(|p| p.display().to_string()).collect();
            format!("llama-server.exe 未找到。搜索路径：\n{}", paths.join("\n"))
        })
        .cloned()
}

fn is_quant_segment(segment: &str) -> bool {
    let upper = segment.to_uppercase();
    if upper.starts_with("IQ") || upper.starts_with("Q2_") || upper.starts_with("Q3_")
        || upper.starts_with("Q4_") || upper.starts_with("Q5_") || upper.starts_with("Q6_")
        || upper.starts_with("Q8_") || upper == "F16" || upper == "F32"
    {
        return true;
    }
    if upper.starts_with("UD-") {
        return true;
    }
    false
}

fn is_companion_dir_name(name: &str) -> bool {
    let lower = name.to_lowercase();
    lower == "audio" || lower == "tts" || lower == "token2wavgguf" || lower == "token2wav" || lower == "vision"
}

fn extract_model_parts(file_stem: &str) -> (String, String) {
    let parts: Vec<&str> = file_stem.split('-').collect();
    if parts.len() <= 1 {
        return (file_stem.to_string(), String::new());
    }

    let mut quant_start: Option<usize> = None;

    for i in 0..parts.len() {
        let candidate: String = parts[i..].join("-");
        if is_quant_segment(&candidate) {
            quant_start = Some(i);
            break;
        }
    }

    if quant_start.is_none() {
        for i in (1..parts.len()).rev() {
            let candidate = parts[i];
            if is_quant_segment(candidate) {
                quant_start = Some(i);
                break;
            }
        }
    }

    if quant_start.is_none() {
        let last = parts.last().unwrap();
        let upper = last.to_uppercase();
        if upper.len() >= 2 && (upper.starts_with('Q') || upper.starts_with('I') || upper.starts_with('F')) {
            quant_start = Some(parts.len() - 1);
        }
    }

    match quant_start {
        Some(start) if start > 0 => {
            let base = parts[..start].join("-");
            let quant = parts[start..].join("-");
            (base, quant)
        }
        _ => (file_stem.to_string(), String::new()),
    }
}

fn find_mmproj_files(dir: &PathBuf, base_name: &str) -> Vec<CompanionFile> {
    let mut results = Vec::new();

    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                let file_name = path.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_string();
                let file_stem = path.file_stem()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_string();
                let ext = path.extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("")
                    .to_lowercase();

                let is_mmproj_ext = ext == "mmproj";
                let is_mmproj_gguf = file_stem.starts_with("mmproj-") && (ext == "gguf" || ext == "ggml");

                if is_mmproj_ext || is_mmproj_gguf {
                    let matched = if is_mmproj_gguf {
                        let prefix = file_stem.strip_prefix("mmproj-").unwrap_or(&file_stem);
                        prefix == base_name || prefix.starts_with(&base_name) || base_name.starts_with(prefix)
                    } else {
                        file_stem == base_name || file_stem.starts_with(&base_name) || base_name.starts_with(&file_stem)
                    };

                    let file_size = entry.metadata().map(|m| m.len()).unwrap_or(0);

                    if matched {
                        results.push(CompanionFile {
                            category: "image_video".to_string(),
                            file_name,
                            file_path: path.to_string_lossy().to_string(),
                            file_size,
                        });
                    }
                }
            }
        }
    }

    results
}

fn scan_all_mmproj_files(dir: &PathBuf) -> Vec<CompanionFile> {
    let mut results = Vec::new();
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                let file_name = path.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_string();
                let file_stem = path.file_stem()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_string();
                let ext = path.extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("")
                    .to_lowercase();

                let is_mmproj_ext = ext == "mmproj";
                let is_mmproj_gguf = file_stem.starts_with("mmproj-") && (ext == "gguf" || ext == "ggml");

                if is_mmproj_ext || is_mmproj_gguf {
                    let file_size = path.metadata().map(|m| m.len()).unwrap_or(0);
                    results.push(CompanionFile {
                        category: "image_video".to_string(),
                        file_name,
                        file_path: path.to_string_lossy().to_string(),
                        file_size,
                    });
                }
            }
        }
    }
    results
}

fn find_audio_input_files(dir: &PathBuf, base_name: &str) -> Vec<CompanionFile> {
    let mut results = Vec::new();
    let audio_dirs: Vec<PathBuf> = vec![dir.join("audio"), dir.join("Audio"), dir.join("AUDIO")];

    for audio_dir in &audio_dirs {
        if audio_dir.exists() && audio_dir.is_dir() {
            if let Ok(entries) = std::fs::read_dir(audio_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_file() {
                        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
                        if ext == "gguf" || ext == "ggml" {
                            let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
                            let file_stem = path.file_stem().and_then(|n| n.to_str()).unwrap_or("").to_string();
                            let file_stem_lower = file_stem.to_lowercase();
                            if file_stem_lower.contains(base_name.to_lowercase().as_str()) || base_name.to_lowercase().contains(&file_stem_lower) {
                                let file_size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                                results.push(CompanionFile {
                                    category: "audio_input".to_string(),
                                    file_name,
                                    file_path: path.to_string_lossy().to_string(),
                                    file_size,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
                let file_stem = path.file_stem().and_then(|n| n.to_str()).unwrap_or("").to_string();
                let file_stem_lower = file_stem.to_lowercase();
                let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
                if (ext == "gguf" || ext == "ggml") && file_stem_lower.contains("audio") && !file_stem_lower.contains("mmproj") {
                    if file_stem_lower.contains(base_name.to_lowercase().as_str()) || base_name.to_lowercase().contains(&file_stem_lower) {
                        let file_size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                        if !results.iter().any(|r| r.file_path == path.to_string_lossy()) {
                            results.push(CompanionFile {
                                category: "audio_input".to_string(),
                                file_name,
                                file_path: path.to_string_lossy().to_string(),
                                file_size,
                            });
                        }
                    }
                }
            }
        }
    }

    results
}

fn scan_all_audio_input_files(dir: &PathBuf) -> Vec<CompanionFile> {
    let mut results = Vec::new();
    let audio_dirs: Vec<PathBuf> = vec![dir.join("audio"), dir.join("Audio"), dir.join("AUDIO")];
    for audio_dir in &audio_dirs {
        if audio_dir.exists() && audio_dir.is_dir() {
            if let Ok(entries) = std::fs::read_dir(audio_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_file() {
                        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
                        if ext == "gguf" || ext == "ggml" {
                            let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
                            let file_size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                            results.push(CompanionFile {
                                category: "audio_input".to_string(),
                                file_name,
                                file_path: path.to_string_lossy().to_string(),
                                file_size,
                            });
                        }
                    }
                }
            }
        }
    }
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                let file_stem = path.file_stem().and_then(|n| n.to_str()).unwrap_or("").to_lowercase();
                let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
                if (ext == "gguf" || ext == "ggml") && file_stem.contains("audio") && !file_stem.contains("mmproj") {
                    let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
                    let file_size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                    if !results.iter().any(|r| r.file_path == path.to_string_lossy()) {
                        results.push(CompanionFile {
                            category: "audio_input".to_string(),
                            file_name,
                            file_path: path.to_string_lossy().to_string(),
                            file_size,
                        });
                    }
                }
            }
        }
    }
    results
}

fn find_audio_output_files(dir: &PathBuf, base_name: &str) -> Vec<CompanionFile> {
    let mut results = Vec::new();
    let tts_dirs: Vec<PathBuf> = vec![
        dir.join("TTS"), dir.join("tts"), dir.join("Tts"),
        dir.join("token2wavgguf"), dir.join("token2wav"),
    ];

    for tts_dir in &tts_dirs {
        if tts_dir.exists() && tts_dir.is_dir() {
            if let Ok(entries) = std::fs::read_dir(tts_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_file() {
                        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
                        if ext == "gguf" || ext == "ggml" {
                            let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
                            let file_stem = path.file_stem().and_then(|n| n.to_str()).unwrap_or("").to_string();
                            let file_stem_lower = file_stem.to_lowercase();
                            let matched = file_stem_lower.contains(base_name.to_lowercase().as_str())
                                || base_name.to_lowercase().contains(&file_stem_lower)
                                || file_stem_lower.contains("tts")
                                || file_stem_lower.contains("vocoder");
                            if matched {
                                let file_size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                                results.push(CompanionFile {
                                    category: "audio_output".to_string(),
                                    file_name,
                                    file_path: path.to_string_lossy().to_string(),
                                    file_size,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                let file_stem = path.file_stem().and_then(|n| n.to_str()).unwrap_or("").to_lowercase();
                let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
                if (ext == "gguf" || ext == "ggml") && (file_stem.contains("tts") || file_stem.contains("vocoder")) {
                    if file_stem.contains(base_name.to_lowercase().as_str()) || base_name.to_lowercase().contains(&file_stem) {
                        let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
                        let file_size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                        if !results.iter().any(|r| r.file_path == path.to_string_lossy()) {
                            results.push(CompanionFile {
                                category: "audio_output".to_string(),
                                file_name,
                                file_path: path.to_string_lossy().to_string(),
                                file_size,
                            });
                        }
                    }
                }
            }
        }
    }
    results
}

fn scan_all_audio_output_files(dir: &PathBuf) -> Vec<CompanionFile> {
    let mut results = Vec::new();
    let tts_dirs: Vec<PathBuf> = vec![
        dir.join("TTS"), dir.join("tts"), dir.join("Tts"),
        dir.join("token2wavgguf"), dir.join("token2wav"),
    ];
    for tts_dir in &tts_dirs {
        if tts_dir.exists() && tts_dir.is_dir() {
            if let Ok(entries) = std::fs::read_dir(tts_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_file() {
                        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
                        if ext == "gguf" || ext == "ggml" {
                            let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
                            let file_size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                            results.push(CompanionFile {
                                category: "audio_output".to_string(),
                                file_name,
                                file_path: path.to_string_lossy().to_string(),
                                file_size,
                            });
                        }
                    }
                }
            }
        }
    }
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                let file_stem = path.file_stem().and_then(|n| n.to_str()).unwrap_or("").to_lowercase();
                let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
                if (ext == "gguf" || ext == "ggml") && (file_stem.contains("tts") || file_stem.contains("vocoder")) {
                    let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
                    let file_size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                    if !results.iter().any(|r| r.file_path == path.to_string_lossy()) {
                        results.push(CompanionFile {
                            category: "audio_output".to_string(),
                            file_name,
                            file_path: path.to_string_lossy().to_string(),
                            file_size,
                        });
                    }
                }
            }
        }
    }
    results
}

fn scan_directory_detailed(dir: &PathBuf, models: &mut Vec<DetailedModelInfo>) -> std::io::Result<()> {
    if let Ok(entries) = std::fs::read_dir(dir) {
        let all_mmproj_files = scan_all_mmproj_files(dir);
        let all_audio_input_files = scan_all_audio_input_files(dir);
        let all_audio_output_files = scan_all_audio_output_files(dir);

        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let dir_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                if !is_companion_dir_name(dir_name) {
                    scan_directory_detailed(&path, models)?;
                }
            } else if let Some(ext) = path.extension() {
                let ext = ext.to_string_lossy().to_lowercase();
                if ext == "gguf" || ext == "ggml" || ext == "bin" {
                    if let Ok(metadata) = entry.metadata() {
                        let file_stem = path.file_stem()
                            .and_then(|s| s.to_str())
                            .unwrap_or("unknown")
                            .to_string();

                        let file_stem_lower = file_stem.to_lowercase();
                        if file_stem_lower.starts_with("mmproj-") || file_stem_lower.contains("mmproj")
                            || file_stem_lower.ends_with("-audio-") || file_stem_lower.contains("-audio-")
                            || file_stem_lower.ends_with("-tts-") || file_stem_lower.contains("-tts-")
                            || file_stem_lower.contains("-vocoder")
                            || file_stem_lower.starts_with("encoder") || file_stem_lower.starts_with("flow_")
                            || file_stem_lower.starts_with("hifigan") || file_stem_lower.starts_with("prompt_cache")
                        {
                            continue;
                        }

                        let (base_name, quant_part) = extract_model_parts(&file_stem);

                        let auto_matched: Vec<CompanionFile> = if !base_name.is_empty() {
                            find_mmproj_files(dir, &base_name)
                        } else {
                            Vec::new()
                        };

                        let auto_audio_input: Vec<CompanionFile> = if !base_name.is_empty() {
                            find_audio_input_files(dir, &base_name)
                        } else {
                            Vec::new()
                        };

                        let auto_audio_output: Vec<CompanionFile> = if !base_name.is_empty() {
                            find_audio_output_files(dir, &base_name)
                        } else {
                            Vec::new()
                        };

                        let is_multimodal = !auto_matched.is_empty() || !auto_audio_input.is_empty() || !auto_audio_output.is_empty();

                        let model_type = if is_multimodal {
                            "multimodal".to_string()
                        } else {
                            "text".to_string()
                        };

                        models.push(DetailedModelInfo {
                            name: file_stem.clone(),
                            path: path.to_string_lossy().to_string(),
                            size: metadata.len(),
                            modified: metadata.modified()
                                .ok()
                                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                                .map(|d| d.as_secs())
                                .unwrap_or(0),
                            base_name,
                            quant_part,
                            model_type,
                            is_multimodal,
                            auto_matched_mmproj: auto_matched,
                            available_mmproj_files: all_mmproj_files.clone(),
                            auto_matched_audio_input: auto_audio_input,
                            auto_matched_audio_output: auto_audio_output,
                            available_audio_input_files: all_audio_input_files.clone(),
                            available_audio_output_files: all_audio_output_files.clone(),
                        });
                    }
                }
            }
        }
    }
    Ok(())
}

fn auto_find_mmproj(model_path: &str) -> Option<String> {
    let path = std::path::Path::new(model_path);
    let dir = path.parent()?;
    let file_stem = path.file_stem()?.to_string_lossy().to_string();
    let file_name_lower = path.file_name()?.to_string_lossy().to_lowercase();

    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let entry_path = entry.path();
            if !entry_path.is_file() {
                continue;
            }
            let entry_name = entry_path.file_name()?.to_string_lossy().to_string();
            if entry_name.to_lowercase() == file_name_lower {
                continue;
            }
            let entry_stem = entry_path.file_stem()?.to_string_lossy().to_string();
            let ext = entry_path.extension()?.to_string_lossy().to_lowercase();

            let is_mmproj_ext = ext == "mmproj";
            let is_mmproj_gguf = entry_stem.starts_with("mmproj-") && (ext == "gguf" || ext == "ggml");

            if is_mmproj_ext || is_mmproj_gguf {
                let matched = if is_mmproj_gguf {
                    let prefix = entry_stem.strip_prefix("mmproj-").unwrap_or(&entry_stem);
                    prefix == file_stem || file_stem.starts_with(prefix) || prefix.starts_with(&file_stem)
                } else {
                    entry_stem == file_stem || entry_stem.starts_with(&file_stem) || file_stem.starts_with(&entry_stem)
                };
                if matched {
                    return Some(entry_path.to_string_lossy().to_string());
                }
            }
        }
    }
    None
}

fn spawn_llama_server(
    llama_server_path: &PathBuf,
    config: &LlamaCppConfig,
) -> Result<(Child, String), String> {
    let model_path = PathBuf::from(&config.model_path);
    if !model_path.exists() {
        return Err(format!("模型文件未找到: {}", config.model_path));
    }

    let server_url = format!("http://{}:{}", config.host, config.port);
    
    let mut cmd = Command::new(&llama_server_path);
    if let Some(parent) = llama_server_path.parent() {
        cmd.current_dir(parent);
    }
    cmd.arg("-m")
        .arg(&config.model_path)
        .arg("--host")
        .arg(&config.host)
        .arg("--port")
        .arg(config.port.to_string())
        .arg("-ngl")
        .arg(config.n_gpu_layers.to_string())
        .arg("-c")
        .arg(config.n_ctx.to_string())
        .arg("-t")
        .arg(config.threads.to_string())
        .arg("-b")
        .arg(config.batch_size.to_string());

    let mmproj_resolved = config.mmproj_path.clone()
        .filter(|p| !p.is_empty())
        .or_else(|| auto_find_mmproj(&config.model_path));

    if let Some(ref mmproj) = mmproj_resolved {
        let mmproj_path = PathBuf::from(mmproj);
        if mmproj_path.exists() {
            cmd.arg("--mmproj").arg(mmproj);
            println!("加载投影文件: {}", mmproj);
        }
    }

    if let Some(ref vocoder) = config.model_vocoder {
        if !vocoder.is_empty() {
            let vocoder_path = PathBuf::from(vocoder);
            if vocoder_path.exists() {
                cmd.arg("--model-vocoder").arg(vocoder);
                println!("加载TTS声码器: {}", vocoder);
            }
        }
    }

    if let Some(ref key) = config.api_key {
        if !key.is_empty() {
            cmd.arg("--api-key").arg(key);
        }
    }

    // 将输出重定向到临时文件，避免管道缓冲问题
    let log_dir = std::env::temp_dir().join("canai-llama-logs");
    let _ = std::fs::create_dir_all(&log_dir);
    let stdout_path = log_dir.join("llama-server-stdout.log");
    let stderr_path = log_dir.join("llama-server-stderr.log");
    let stdout_file = std::fs::File::create(&stdout_path)
        .map_err(|e| format!("创建 stdout 日志文件失败: {}", e))?;
    let stderr_file = std::fs::File::create(&stderr_path)
        .map_err(|e| format!("创建 stderr 日志文件失败: {}", e))?;

    cmd.stdin(Stdio::null())
        .stdout(stdout_file)
        .stderr(stderr_file);

    println!("启动命令: {} -m {} --host {} --port {} -ngl {} -c {} -t {} -b {}",
        llama_server_path.display(), config.model_path, config.host, config.port,
        config.n_gpu_layers, config.n_ctx, config.threads, config.batch_size);
    println!("日志文件: {}", log_dir.display());

    let mut child = cmd.spawn()
        .map_err(|e| format!("启动 llama-server 失败: {}", e))?;

    println!("llama-server 已启动 (PID: {}), 正在等待服务器就绪...", child.id());

    let pid = child.id();
    for i in 0..5 {
        std::thread::sleep(Duration::from_millis(2000));

        match child.try_wait() {
            Ok(Some(status)) => {
                let detail = read_file(&stdout_path).or_else(|| read_file(&stderr_path)).unwrap_or_else(|| "无输出信息".to_string());
                let _ = std::fs::remove_file(&stdout_path);
                let _ = std::fs::remove_file(&stderr_path);
                return Err(format!(
                    "llama-server (PID: {}) 启动 {} 秒后退出 (代码: {}).\n输出:\n{}",
                    pid, (i + 1) * 2, status.code().unwrap_or(-1), detail
                ));
            }
            Ok(None) => {}
            Err(e) => {
                return Err(format!("检查 llama-server 进程状态失败: {}", e));
            }
        }
    }

    println!("llama-server (PID: {}) 进程稳定，等待健康检查...", pid);
    Ok((child, server_url))
}

fn read_file(path: &std::path::Path) -> Option<String> {
    use std::io::Read;
    let mut file = std::fs::File::open(path).ok()?;
    let mut buf = String::new();
    file.read_to_string(&mut buf).ok()?;
    let trimmed = buf.trim().to_string();
    if trimmed.is_empty() { None } else { Some(trimmed) }
}

fn update_state_after_start(
    state: &State<'_, LlamaCppState>,
    child: Child,
    server_url: &str,
    model_path: &str,
) -> Result<(), String> {
    {
        let mut process_guard = state.server_process.lock().map_err(|e| format!("Lock error: {}", e))?;
        *process_guard = Some(child);
    }
    {
        let mut running_guard = state.is_running.lock().map_err(|e| format!("Lock error: {}", e))?;
        *running_guard = true;
    }
    {
        let mut url_guard = state.server_url.lock().map_err(|e| format!("Lock error: {}", e))?;
        *url_guard = server_url.to_string();
    }
    {
        let mut path_guard = state.model_path.lock().map_err(|e| format!("Lock error: {}", e))?;
        *path_guard = model_path.to_string();
    }
    Ok(())
}

#[tauri::command]
pub async fn llama_cpp_start(
    state: State<'_, LlamaCppState>,
    config: LlamaCppConfig,
) -> Result<ServerStatus, String> {
    let is_running = *state.is_running.lock().map_err(|e| format!("Lock error: {}", e))?;
    
    if is_running {
        let url = state.server_url.lock().map_err(|e| format!("Lock error: {}", e))?.clone();
        return Ok(ServerStatus {
            running: true,
            url,
            model_loaded: true,
            model_name: Some(config.model_path.clone()),
        });
    }

    #[cfg(windows)]
    {
        silent_taskkill(&["/F", "/IM", "llama-server.exe"]);
        std::thread::sleep(std::time::Duration::from_millis(500));
    }

    let llama_server_path = find_llama_server()?;
    let (child, server_url) = spawn_llama_server(&llama_server_path, &config)?;

    {
        let mut process_guard = state.server_process.lock().map_err(|e| format!("Lock error: {}", e))?;
        *process_guard = Some(child);
    }

    let health_url = format!("{}/health", server_url.trim_end_matches('/'));
    let mut loaded = false;
    for i in 0..180 {
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
        match reqwest::get(&health_url).await {
            Ok(resp) if resp.status().is_success() => {
                loaded = true;
                break;
            }
            _ => {
                if i % 15 == 0 {
                    println!("等待模型加载... ({}/{})", i + 1, 180);
                }
            }
        }
    }

    if loaded {
        {
            let mut running_guard = state.is_running.lock().map_err(|e| format!("Lock error: {}", e))?;
            *running_guard = true;
        }
        {
            let mut url_guard = state.server_url.lock().map_err(|e| format!("Lock error: {}", e))?;
            *url_guard = server_url.clone();
        }
        {
            let mut path_guard = state.model_path.lock().map_err(|e| format!("Lock error: {}", e))?;
            *path_guard = config.model_path.clone();
        }
        println!("模型加载成功, 服务已就绪");
        Ok(ServerStatus {
            running: true,
            url: server_url,
            model_loaded: true,
            model_name: Some(config.model_path),
        })
    } else {
        #[cfg(windows)]
        silent_taskkill(&["/F", "/IM", "llama-server.exe"]);
        Err("模型加载超时 (180 秒), 请检查模型文件是否正确或尝试减小模型大小".to_string())
    }
}

#[tauri::command]
pub async fn llama_cpp_switch_model(
    state: State<'_, LlamaCppState>,
    config: LlamaCppConfig,
) -> Result<ServerStatus, String> {
    let is_running = *state.is_running.lock().map_err(|e| format!("Lock error: {}", e))?;
    if !is_running {
        return Err("服务未运行，请先启动服务".to_string());
    }

    let _old_child = {
        let mut process_guard = state.server_process.lock().map_err(|e| format!("Lock error: {}", e))?;
        let mut old = process_guard.take();
        if let Some(ref mut child) = old {
            let _ = child.kill();
            let _ = child.wait();
        }
        old
    };
    let _old_url = state.server_url.lock().map_err(|e| format!("Lock error: {}", e))?.clone();

    {
        let mut running_guard = state.is_running.lock().map_err(|e| format!("Lock error: {}", e))?;
        *running_guard = false;
    }

    let llama_server_path = find_llama_server()?;
    let (child, server_url) = match spawn_llama_server(&llama_server_path, &config) {
        Ok(result) => result,
        Err(e) => {
            return Err(format!("切换模型失败: {}\n可能原因：旧进程端口未释放或模型文件路径无效。请稍后重试。", e));
        }
    };

    update_state_after_start(&state, child, &server_url, &config.model_path)?;

    let health_url = format!("{}/health", server_url.trim_end_matches('/'));
    let mut loaded = false;
    for i in 0..60 {
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
        match reqwest::get(&health_url).await {
            Ok(resp) if resp.status().is_success() => {
                loaded = true;
                break;
            }
            _ => {
                if i == 0 || i % 5 == 4 {
                    println!("等待模型加载... ({}/{})", i + 1, 60);
                }
            }
        }
    }

    if loaded {
        Ok(ServerStatus {
            running: true,
            url: server_url,
            model_loaded: true,
            model_name: Some(config.model_path),
        })
    } else {
        println!("警告：模型切换后健康检查未通过，服务可能仍在加载中");
        Ok(ServerStatus {
            running: true,
            url: server_url,
            model_loaded: false,
            model_name: Some(config.model_path),
        })
    }
}

#[tauri::command]
pub async fn llama_cpp_stop(state: State<'_, LlamaCppState>) -> Result<bool, String> {
    let (pid, server_url) = {
        let process_guard = state.server_process.lock().map_err(|e| format!("Lock error: {}", e))?;
        let pid = process_guard.as_ref().map(|child| child.id());
        let url = state.server_url.lock().map_err(|e| format!("Lock error: {}", e))?.clone();
        (pid, url)
    };

    {
        let shutdown_url = format!("{}/shutdown", server_url.trim_end_matches('/'));
        let _ = reqwest::Client::builder()
            .timeout(Duration::from_secs(3))
            .build()
            .ok()
            .and_then(|client| {
                let _ = client.post(&shutdown_url).send();
                Some(())
            });
    }

    {
        let mut process_guard = state.server_process.lock().map_err(|e| format!("Lock error: {}", e))?;
        if let Some(mut child) = process_guard.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }

    #[cfg(windows)]
    if let Some(pid) = pid {
        silent_taskkill(&["/F", "/T", "/PID", &pid.to_string()]);
    }

    #[cfg(windows)]
    {
        silent_taskkill(&["/F", "/IM", "llama-server.exe"]);
    }

    {
        let mut running_guard = state.is_running.lock().map_err(|e| format!("Lock error: {}", e))?;
        *running_guard = false;
    }

    println!("llama-server 已停止");
    Ok(true)
}

impl Drop for LlamaCppState {
    fn drop(&mut self) {
        if let Ok(mut process_guard) = self.server_process.lock() {
            if let Some(mut child) = process_guard.take() {
                let pid = child.id();
                let _ = child.kill();
                let _ = child.wait();
                #[cfg(windows)]
                {
                    silent_taskkill(&["/F", "/T", "/PID", &pid.to_string()]);
                    silent_taskkill(&["/F", "/IM", "llama-server.exe"]);
                }
            }
        }
    }
}

#[tauri::command]
pub fn llama_cpp_get_status(state: State<'_, LlamaCppState>) -> Result<ServerStatus, String> {
    let running = *state.is_running.lock().map_err(|e| format!("Lock error: {}", e))?;
    let url = state.server_url.lock().map_err(|e| format!("Lock error: {}", e))?.clone();
    let model_path = state.model_path.lock().map_err(|e| format!("Lock error: {}", e))?.clone();
    
    Ok(ServerStatus {
        running,
        url,
        model_loaded: running && !model_path.is_empty(),
        model_name: if model_path.is_empty() { None } else { Some(model_path) },
    })
}

#[tauri::command]
pub fn llama_cpp_generate_api_key() -> String {
    use rand::Rng;
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let mut rng = rand::thread_rng();
    let key: String = (0..32)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect();
    format!("canai-{}", key)
}

#[tauri::command]
pub async fn llama_cpp_scan_models(dir_path: String) -> Result<Vec<LocalModelInfo>, String> {
    let path = PathBuf::from(&dir_path);
    if !path.exists() {
        return Err(format!("Directory not found: {}", dir_path));
    }

    let mut models = Vec::new();
    scan_directory(&path, &mut models).map_err(|e| format!("Scan error: {}", e))?;
    
    Ok(models)
}

fn scan_directory(dir: &PathBuf, models: &mut Vec<LocalModelInfo>) -> std::io::Result<()> {
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let dir_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                if !is_companion_dir_name(dir_name) {
                    scan_directory(&path, models)?;
                }
            } else if let Some(ext) = path.extension() {
                let ext = ext.to_string_lossy().to_lowercase();
                if ext == "gguf" || ext == "ggml" || ext == "bin" {
                    if let Ok(metadata) = entry.metadata() {
                        let name = path.file_stem()
                            .and_then(|s| s.to_str())
                            .unwrap_or("unknown")
                            .to_string();

                        let name_lower = name.to_lowercase();
                        if name_lower.starts_with("mmproj-") || name_lower.contains("mmproj")
                            || name_lower.ends_with("-audio-") || name_lower.contains("-audio-")
                            || name_lower.ends_with("-tts-") || name_lower.contains("-tts-")
                            || name_lower.contains("-vocoder")
                            || name_lower.starts_with("encoder") || name_lower.starts_with("flow_")
                            || name_lower.starts_with("hifigan") || name_lower.starts_with("prompt_cache")
                        {
                            continue;
                        }

                        models.push(LocalModelInfo {
                            name,
                            path: path.to_string_lossy().to_string(),
                            size: metadata.len(),
                            modified: metadata.modified()
                                .ok()
                                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                                .map(|d| d.as_secs())
                                .unwrap_or(0),
                        });
                    }
                }
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn llama_cpp_scan_detailed_models(dir_path: String) -> Result<Vec<DetailedModelInfo>, String> {
    let path = PathBuf::from(&dir_path);
    if !path.exists() {
        return Err(format!("Directory not found: {}", dir_path));
    }

    let mut models = Vec::new();
    scan_directory_detailed(&path, &mut models).map_err(|e| format!("Scan error: {}", e))?;

    Ok(models)
}

#[tauri::command]
pub async fn llama_cpp_find_companion_files(
    dir_path: String,
    base_name: String,
) -> Result<Vec<CompanionFile>, String> {
    let path = PathBuf::from(&dir_path);
    if !path.exists() {
        return Err(format!("Directory not found: {}", dir_path));
    }

    Ok(find_mmproj_files(&path, &base_name))
}

#[tauri::command]
pub async fn llama_cpp_check_health(url: String) -> Result<bool, String> {
    let health_url = format!("{}/health", url.trim_end_matches('/'));
    
    match reqwest::get(&health_url).await {
        Ok(response) => Ok(response.status().is_success()),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
pub fn llama_cpp_kill_stale() -> bool {
    #[cfg(windows)]
    {
        silent_taskkill(&["/F", "/IM", "llama-server.exe"]);
    }
    true
}
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;
use std::fs;
use tauri::AppHandle;
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PythonInfo {
    pub installed: bool,
    pub version: Option<String>,
    pub path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VenvInfo {
    pub created: bool,
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DepsInfo {
    pub installed: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EnvironmentStatus {
    pub python: PythonInfo,
    pub venv: VenvInfo,
    pub deps: DepsInfo,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SetupStep {
    pub name: String,
    pub ok: bool,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SetupResult {
    pub success: bool,
    pub steps: Vec<SetupStep>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AuthorizedApp {
    pub name: String,
    pub key: String,
    pub enabled: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ComputerUseConfig {
    pub authorized_apps: Vec<AuthorizedApp>,
    pub clipboard_access: bool,
    pub system_shortcuts: bool,
}

fn get_runtime_dir() -> PathBuf {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join(".canmodel").join(".runtime")
}

fn get_config_path(app_handle: &AppHandle) -> PathBuf {
    let app_dir = app_handle.path().app_data_dir().unwrap_or_else(|_| {
        let home = std::env::var("USERPROFILE")
            .or_else(|_| std::env::var("HOME"))
            .unwrap_or_else(|_| ".".to_string());
        PathBuf::from(home).join(".canmodel")
    });
    fs::create_dir_all(&app_dir).ok();
    app_dir.join("computer-use-config.json")
}

fn get_config(config_path: &PathBuf) -> ComputerUseConfig {
    match fs::read_to_string(config_path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => ComputerUseConfig::default(),
    }
}

impl Default for ComputerUseConfig {
    fn default() -> Self {
        Self {
            authorized_apps: vec![
                AuthorizedApp { name: "迅雷下载组件".to_string(), key: "xunlei".to_string(), enabled: false },
                AuthorizedApp { name: "360安全浏览器".to_string(), key: "360browser".to_string(), enabled: false },
                AuthorizedApp { name: "豆包".to_string(), key: "doubao".to_string(), enabled: true },
                AuthorizedApp { name: "酷狗音乐".to_string(), key: "kugou".to_string(), enabled: false },
                AuthorizedApp { name: "剪映".to_string(), key: "jianying".to_string(), enabled: true },
                AuthorizedApp { name: "微信".to_string(), key: "wechat".to_string(), enabled: false },
                AuthorizedApp { name: "钉钉".to_string(), key: "dingtalk".to_string(), enabled: false },
                AuthorizedApp { name: "企业微信".to_string(), key: "wecom".to_string(), enabled: false },
                AuthorizedApp { name: "Firefox".to_string(), key: "firefox".to_string(), enabled: true },
                AuthorizedApp { name: "Chrome".to_string(), key: "chrome".to_string(), enabled: false },
                AuthorizedApp { name: "Edge".to_string(), key: "edge".to_string(), enabled: false },
                AuthorizedApp { name: "VS Code".to_string(), key: "vscode".to_string(), enabled: true },
                AuthorizedApp { name: "Windows Terminal".to_string(), key: "terminal".to_string(), enabled: true },
                AuthorizedApp { name: "资源管理器".to_string(), key: "explorer".to_string(), enabled: false },
                AuthorizedApp { name: "计算器".to_string(), key: "calculator".to_string(), enabled: false },
                AuthorizedApp { name: "截图工具".to_string(), key: "snipping".to_string(), enabled: true },
                AuthorizedApp { name: "记事本".to_string(), key: "notepad".to_string(), enabled: false },
                AuthorizedApp { name: "画图".to_string(), key: "mspaint".to_string(), enabled: false },
            ],
            clipboard_access: true,
            system_shortcuts: false,
        }
    }
}

fn detect_python() -> PythonInfo {
    let candidates = if cfg!(windows) {
        vec!["python3", "python", "py"]
    } else {
        vec!["python3", "python"]
    };

    for cmd in &candidates {
        let output = Command::new(cmd)
            .arg("--version")
            .output()
            .ok();
        if let Some(out) = output {
            if out.status.success() {
                let stdout = String::from_utf8_lossy(&out.stdout);
                let stderr = String::from_utf8_lossy(&out.stderr);
                let combined = format!("{}{}", stdout, stderr);
                let version = combined
                    .lines()
                    .find_map(|line| {
                        let lower = line.to_lowercase();
                        if lower.contains("python") {
                            let v = line.split_whitespace().nth(1).map(|s| s.to_string());
                            v
                        } else {
                            None
                        }
                    });
                let path = which(cmd);
                return PythonInfo {
                    installed: true,
                    version,
                    path,
                };
            }
        }
    }
    PythonInfo {
        installed: false,
        version: None,
        path: None,
    }
}

fn which(cmd: &str) -> Option<String> {
    let shell = if cfg!(windows) { "where" } else { "which" };
    let output = Command::new(shell).arg(cmd).output().ok()?;
    if output.status.success() {
        let path = String::from_utf8_lossy(&output.stdout)
            .lines()
            .next()
            .map(|s| s.trim().to_string());
        return path;
    }
    None
}

fn get_venv_python() -> PathBuf {
    let runtime_dir = get_runtime_dir();
    if cfg!(windows) {
        runtime_dir.join("venv").join("Scripts").join("python.exe")
    } else {
        runtime_dir.join("venv").join("bin").join("python3")
    }
}

fn get_install_stamp_path() -> PathBuf {
    get_runtime_dir().join("install.sha256")
}

#[tauri::command]
pub fn check_environment(_app_handle: AppHandle) -> EnvironmentStatus {
    let python = detect_python();
    let venv_path = get_venv_python();
    let venv_created = venv_path.exists();

    let mut deps_installed = false;
    if venv_created {
        let stamp_path = get_install_stamp_path();
        if let Ok(content) = fs::read_to_string(&stamp_path) {
            deps_installed = content.trim() == "installed";
        }
    }

    EnvironmentStatus {
        python,
        venv: VenvInfo {
            created: venv_created,
            path: get_runtime_dir().join("venv").to_string_lossy().to_string(),
        },
        deps: DepsInfo { installed: deps_installed },
    }
}

#[tauri::command]
pub fn run_setup(_app_handle: AppHandle) -> SetupResult {
    let mut steps = Vec::new();
    let python = detect_python();

    // Step 1: Python check
    if !python.installed {
        steps.push(SetupStep {
            name: "python_check".to_string(),
            ok: false,
            message: "Python 3 未安装，请先安装 Python 3".to_string(),
        });
        return SetupResult { success: false, steps };
    }
    steps.push(SetupStep {
        name: "python_check".to_string(),
        ok: true,
        message: format!("Python {} ({})", python.version.as_deref().unwrap_or(""), python.path.as_deref().unwrap_or("")),
    });

    // Step 2: Create runtime directory
    let runtime_dir = get_runtime_dir();
    fs::create_dir_all(&runtime_dir).ok();
    steps.push(SetupStep {
        name: "runtime_files".to_string(),
        ok: true,
        message: "运行时文件已就绪".to_string(),
    });

    // Step 3: Create venv
    let venv_python = get_venv_python();
    if !venv_python.exists() {
        let python_cmd = python.path.as_deref().unwrap_or("python");
        let venv_root = runtime_dir.join("venv");
        let result = Command::new(python_cmd)
            .args(["-m", "venv"])
            .arg(&venv_root)
            .output();
        match result {
            Ok(out) if out.status.success() => {
                steps.push(SetupStep {
                    name: "venv".to_string(),
                    ok: true,
                    message: "虚拟环境已创建".to_string(),
                });
            }
            Ok(out) => {
                let stderr = String::from_utf8_lossy(&out.stderr);
                steps.push(SetupStep {
                    name: "venv".to_string(),
                    ok: false,
                    message: format!("创建虚拟环境失败: {}", stderr),
                });
                return SetupResult { success: false, steps };
            }
            Err(e) => {
                steps.push(SetupStep {
                    name: "venv".to_string(),
                    ok: false,
                    message: format!("创建虚拟环境失败: {}", e),
                });
                return SetupResult { success: false, steps };
            }
        }
    } else {
        steps.push(SetupStep {
            name: "venv".to_string(),
            ok: true,
            message: "虚拟环境已存在".to_string(),
        });
    }

    // Step 4: Install dependencies via pip
    if venv_python.exists() {
        let result = Command::new(&venv_python)
            .args(["-m", "pip", "install", "--upgrade", "pip"])
            .output();
        match result {
            Ok(out) if out.status.success() => {
                steps.push(SetupStep {
                    name: "pip".to_string(),
                    ok: true,
                    message: "pip 已升级到最新版本".to_string(),
                });
            }
            _ => {
                steps.push(SetupStep {
                    name: "pip".to_string(),
                    ok: true,
                    message: "pip 已就绪".to_string(),
                });
            }
        }

        // Install Pillow and pyautogui for computer use
        let deps = if cfg!(windows) {
            vec!["pillow", "pyautogui", "opencv-python-headless", "mss"]
        } else {
            vec!["pillow", "pyautogui", "opencv-python-headless"]
        };
        let install_result = Command::new(&venv_python)
            .args(["-m", "pip", "install"])
            .args(&deps)
            .output();
        match install_result {
            Ok(out) if out.status.success() => {
                let stamp_path = get_install_stamp_path();
                fs::write(&stamp_path, "installed").ok();
                steps.push(SetupStep {
                    name: "deps".to_string(),
                    ok: true,
                    message: "依赖包已安装".to_string(),
                });
            }
            Ok(out) => {
                let stderr = String::from_utf8_lossy(&out.stderr);
                steps.push(SetupStep {
                    name: "deps".to_string(),
                    ok: false,
                    message: format!("安装依赖失败: {}", stderr),
                });
                return SetupResult { success: false, steps };
            }
            Err(e) => {
                steps.push(SetupStep {
                    name: "deps".to_string(),
                    ok: false,
                    message: format!("安装依赖失败: {}", e),
                });
                return SetupResult { success: false, steps };
            }
        }
    }

    SetupResult { success: true, steps }
}

#[tauri::command]
pub fn load_computer_use_config(app_handle: AppHandle) -> ComputerUseConfig {
    let config_path = get_config_path(&app_handle);
    get_config(&config_path)
}

#[tauri::command]
pub fn save_computer_use_config(app_handle: AppHandle, config: ComputerUseConfig) -> bool {
    let config_path = get_config_path(&app_handle);
    match serde_json::to_string_pretty(&config) {
        Ok(json) => {
            fs::write(&config_path, json).is_ok()
        }
        Err(_) => false,
    }
}

#[tauri::command]
pub fn list_installed_apps() -> Vec<AuthorizedApp> {
    let mut apps = Vec::new();
    if cfg!(windows) {
        // Read installed apps from Windows Registry
        let paths = vec![
            r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths",
            r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths",
        ];
        for path in &paths {
            if let Ok(entries) = read_registry_keys(path) {
                for entry in entries {
                    let name = entry.trim_end_matches(".exe").to_string();
                    if !apps.iter().any(|a: &AuthorizedApp| a.name == name) {
                        apps.push(AuthorizedApp {
                            name,
                            key: format!("app_{}", apps.len()),
                            enabled: false,
                        });
                    }
                }
            }
        }
    }
    apps.sort_by(|a, b| a.name.cmp(&b.name));
    apps.truncate(50);
    apps
}

fn read_registry_keys(path: &str) -> Result<Vec<String>, ()> {
    let output = Command::new("reg")
        .args(["query", path])
        .output()
        .map_err(|_| ())?;
    if !output.status.success() {
        return Err(());
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    let keys: Vec<String> = stdout
        .lines()
        .filter_map(|line| {
            let trimmed = line.trim();
            if trimmed.ends_with(".exe") {
                std::path::Path::new(trimmed)
                    .file_stem()
                    .map(|s| s.to_string_lossy().to_string())
            } else {
                None
            }
        })
        .collect();
    Ok(keys)
}

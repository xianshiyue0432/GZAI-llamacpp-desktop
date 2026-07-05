use std::{
    collections::HashMap,
    io::{Read, Write},
    sync::{
        atomic::{AtomicU32, Ordering},
        Mutex,
    },
    thread,
};

use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use tauri::Emitter;

#[derive(Default)]
pub struct TerminalState {
    next_id: AtomicU32,
    sessions: Mutex<HashMap<u32, TerminalSession>>,
}

struct TerminalSession {
    master: Box<dyn MasterPty + Send>,
    writer: Mutex<Box<dyn std::io::Write + Send>>,
    killer: Mutex<Box<dyn ChildKiller + Send + Sync>>,
}

#[derive(Serialize, Clone)]
pub struct TerminalSpawnResult {
    pub session_id: u32,
    pub shell: String,
    pub cwd: String,
}

#[derive(Serialize, Clone)]
struct TerminalOutputPayload {
    session_id: u32,
    data: String,
}

#[derive(Serialize, Clone)]
struct TerminalExitPayload {
    session_id: u32,
    code: u32,
    signal: Option<String>,
}

fn default_shell() -> String {
    #[cfg(target_os = "windows")]
    return "powershell.exe".to_string();
    #[cfg(target_os = "macos")]
    return "/bin/zsh".to_string();
    #[cfg(target_os = "linux")]
    return "/bin/bash".to_string();
}

fn resolve_terminal_cwd(cwd: Option<String>) -> Result<std::path::PathBuf, String> {
    match cwd {
        Some(path) => Ok(std::path::PathBuf::from(path)),
        None => std::env::current_dir().map_err(|e| format!("get current dir: {}", e)),
    }
}

fn terminal_environment(_shell: &str) -> Vec<(String, String)> {
    let mut env = Vec::new();
    env.push(("TERM".to_string(), "xterm-256color".to_string()));
    env.push(("COLORTERM".to_string(), "truecolor".to_string()));
    env
}

fn decode_terminal_output(pending: &mut Vec<u8>, data: &[u8]) -> String {
    pending.extend_from_slice(data);
    let mut result = String::new();
    let mut i = 0;
    while i < pending.len() {
        match std::str::from_utf8(&pending[i..]) {
            Ok(s) => {
                result.push_str(s);
                pending.clear();
                break;
            }
            Err(e) => {
                let valid_up_to = e.valid_up_to();
                if valid_up_to > 0 {
                    if let Ok(s) = std::str::from_utf8(&pending[..valid_up_to]) {
                        result.push_str(s);
                    }
                    pending.drain(..valid_up_to);
                    i = 0;
                } else {
                    if pending.len() >= 4 {
                        pending.remove(0);
                    } else {
                        break;
                    }
                }
            }
        }
    }
    result
}

#[tauri::command]
pub fn terminal_spawn(
    app: tauri::AppHandle,
    state: tauri::State<'_, TerminalState>,
    cols: u16,
    rows: u16,
    cwd: Option<String>,
) -> Result<TerminalSpawnResult, String> {
    let cwd_path = resolve_terminal_cwd(cwd)?;
    let shell = default_shell();
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: rows.max(8),
            cols: cols.max(20),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|err| format!("open terminal pty: {}", err))?;

    let mut cmd = CommandBuilder::new(&shell);
    cmd.cwd(cwd_path.as_os_str());
    #[cfg(target_os = "windows")]
    {
        cmd.arg("-NoProfile");
    }
    for (key, value) in terminal_environment(&shell) {
        cmd.env(key, value);
    }

    let mut child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|err| format!("spawn terminal shell: {}", err))?;
    drop(pair.slave);

    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|err| format!("clone terminal reader: {}", err))?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|err| format!("open terminal writer: {}", err))?;
    let killer = child.clone_killer();
    let session_id = state.next_id.fetch_add(1, Ordering::Relaxed) + 1;

    {
        let mut sessions = state
            .sessions
            .lock()
            .map_err(|_| "terminal state is unavailable".to_string())?;
        sessions.insert(
            session_id,
            TerminalSession {
                master: pair.master,
                writer: Mutex::new(writer),
                killer: Mutex::new(killer),
            },
        );
    }

    let output_app = app.clone();
    thread::spawn(move || {
        let mut buffer = [0_u8; 8192];
        let mut pending_utf8 = Vec::new();
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(n) => {
                    let data = decode_terminal_output(&mut pending_utf8, &buffer[..n]);
                    if !data.is_empty() {
                        let _ = output_app.emit(
                            "terminal-output",
                            TerminalOutputPayload { session_id, data },
                        );
                    }
                }
                Err(_) => break,
            }
        }
        let status = child.wait();
        let code = match status {
            Ok(s) => s.exit_code() as u32,
            Err(_) => 1,
        };
        let _ = output_app.emit(
            "terminal-exit",
            TerminalExitPayload {
                session_id,
                code,
                signal: None,
            },
        );
    });

    Ok(TerminalSpawnResult {
        session_id,
        shell,
        cwd: cwd_path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn terminal_write(
    state: tauri::State<'_, TerminalState>,
    session_id: u32,
    data: String,
) -> Result<(), String> {
    let sessions = state
        .sessions
        .lock()
        .map_err(|_| "terminal state is unavailable".to_string())?;
    if let Some(session) = sessions.get(&session_id) {
        let mut writer = session
            .writer
            .lock()
            .map_err(|_| "terminal writer is unavailable".to_string())?;
        writer
            .write_all(data.as_bytes())
            .map_err(|err| format!("write to terminal: {}", err))?;
        writer.flush().map_err(|err| format!("flush terminal: {}", err))?;
        Ok(())
    } else {
        Err("terminal session not found".to_string())
    }
}

#[tauri::command]
pub fn terminal_resize(
    state: tauri::State<'_, TerminalState>,
    session_id: u32,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let sessions = state
        .sessions
        .lock()
        .map_err(|_| "terminal state is unavailable".to_string())?;
    if let Some(session) = sessions.get(&session_id) {
        session
            .master
            .resize(PtySize {
                rows: rows.max(8),
                cols: cols.max(20),
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|err| format!("resize terminal: {}", err))
    } else {
        Err("terminal session not found".to_string())
    }
}

#[tauri::command]
pub fn terminal_kill(state: tauri::State<'_, TerminalState>, session_id: u32) -> Result<(), String> {
    let mut sessions = state
        .sessions
        .lock()
        .map_err(|_| "terminal state is unavailable".to_string())?;
    if let Some(session) = sessions.remove(&session_id) {
        let mut killer = session
            .killer
            .lock()
            .map_err(|_| "terminal killer is unavailable".to_string())?;
        let _ = killer.kill();
        Ok(())
    } else {
        Err("terminal session not found".to_string())
    }
}

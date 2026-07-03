// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod computer_use;
mod terminal;
mod deepseek;
mod diagnostics;
mod proxy;
mod llama_cpp;

use computer_use::*;
use terminal::TerminalState;
use llama_cpp::LlamaCppState;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(TerminalState::default())
        .manage(LlamaCppState::default())
        .invoke_handler(tauri::generate_handler![
            check_environment,
            run_setup,
            load_computer_use_config,
            save_computer_use_config,
            list_installed_apps,
            terminal::terminal_spawn,
            terminal::terminal_write,
            terminal::terminal_resize,
            terminal::terminal_kill,
            deepseek::get_deepseek_balance,
            diagnostics::diagnostics_get_logs,
            diagnostics::diagnostics_get_errors,
            diagnostics::diagnostics_get_warnings,
            diagnostics::diagnostics_get_stats,
            diagnostics::diagnostics_get_log_dir,
            diagnostics::diagnostics_clear_logs,
            diagnostics::diagnostics_open_log_dir,
            diagnostics::diagnostics_export,
            diagnostics::diagnostics_add_log,
            diagnostics::diagnostics_reload_logs,
            diagnostics::diagnostics_delete_log,
            proxy::api_proxy,
            proxy::api_proxy_stream,
            llama_cpp::llama_cpp_start,
            llama_cpp::llama_cpp_switch_model,
            llama_cpp::llama_cpp_stop,
            llama_cpp::llama_cpp_get_status,
            llama_cpp::llama_cpp_generate_api_key,
            llama_cpp::llama_cpp_scan_models,
            llama_cpp::llama_cpp_scan_detailed_models,
            llama_cpp::llama_cpp_find_companion_files,
            llama_cpp::llama_cpp_check_health,
            llama_cpp::llama_cpp_kill_stale,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

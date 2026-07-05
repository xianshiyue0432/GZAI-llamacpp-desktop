import { invoke } from '@tauri-apps/api/core';

export interface LogEntry {
  id: string;
  timestamp: number;
  time_str: string;
  level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
  content: string;
}

export interface LogStats {
  total_size: number;
  event_count: number;
  warning_count_24h: number;
  retention_policy: string;
}

export async function getLogs(): Promise<LogEntry[]> {
  return invoke('diagnostics_get_logs');
}

export async function getErrors(): Promise<LogEntry[]> {
  return invoke('diagnostics_get_errors');
}

export async function getWarnings(): Promise<LogEntry[]> {
  return invoke('diagnostics_get_warnings');
}

export async function getStats(): Promise<LogStats> {
  return invoke('diagnostics_get_stats');
}

export async function getLogDir(): Promise<string> {
  return invoke('diagnostics_get_log_dir');
}

export async function openLogDir(): Promise<void> {
  return invoke('diagnostics_open_log_dir');
}

export async function clearLogs(): Promise<void> {
  return invoke('diagnostics_clear_logs');
}

export async function exportDiagnostics(): Promise<string> {
  return invoke('diagnostics_export');
}

export async function addLog(level: string, content: string): Promise<void> {
  return invoke('diagnostics_add_log', { level, content });
}

export async function reloadLogs(): Promise<LogEntry[]> {
  return invoke('diagnostics_reload_logs');
}

export async function deleteLog(id: string): Promise<void> {
  return invoke('diagnostics_delete_log', { id });
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
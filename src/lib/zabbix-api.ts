import { invoke } from '@tauri-apps/api/core';
import type { AppConfig, ServerConfig } from '@/types/config';
import type { TriggerResult } from '@/types/zabbix';

export async function getConfig(): Promise<AppConfig> {
  return invoke<AppConfig>('get_config');
}

export async function saveConfig(config: AppConfig): Promise<void> {
  return invoke<void>('save_config', { config });
}

export async function get_config_dir(): Promise<string> {
  return invoke<string>('get_config_dir');
}

export async function loginServer(server: ServerConfig): Promise<boolean> {
  return invoke<boolean>('login', { server });
}

export async function fetchTriggers(serverLabel: string): Promise<TriggerResult> {
  return invoke<TriggerResult>('fetch_triggers', { serverLabel });
}

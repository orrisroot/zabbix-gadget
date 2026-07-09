export interface ServerConfig {
  label: string;
  host: string;
  user: string;
  pass: string;
  api_key?: string;
  basic_auth_user?: string;
  basic_auth_pass?: string;
}

export interface AppSettings {
  refresh_interval_seconds: number;
  theme: 'dark' | 'light';
}

export interface AppConfig {
  servers: ServerConfig[];
  settings: AppSettings;
}

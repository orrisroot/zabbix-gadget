import { create } from 'zustand';
import { fetchTriggers, getConfig, saveConfig } from '@/lib/zabbix-api';
import type { AppConfig, ServerConfig } from '@/types/config';
import type { TriggerResult } from '@/types/zabbix';

export interface ServerStatus {
  label: string;
  triggers: Map<string, number>; // priority -> count
  triggerDetails: Map<string, TriggerResult['triggers']>; // priority -> triggers
  error: string | null;
  lastUpdate: number;
  loading: boolean;
}

interface ZabbixStore {
  config: AppConfig | null;
  serverStatuses: Map<string, ServerStatus>; // label -> status
  loading: boolean;

  loadConfig: () => Promise<void>;
  saveConfig: (config: AppConfig) => Promise<void>;
  refreshAll: () => Promise<void>;
  refreshServer: (server: ServerConfig) => Promise<void>;
  setRefreshInterval: (seconds: number) => Promise<void>;
}

export const useZabbixStore = create<ZabbixStore>((set, get) => ({
  config: null,
  serverStatuses: new Map(),
  loading: false,

  loadConfig: async () => {
    try {
      const config = await getConfig();
      set({ config });
    } catch (e) {
      console.error('Failed to load config:', e);
    }
  },

  saveConfig: async (config: AppConfig) => {
    try {
      await saveConfig(config);
      set({ config });
    } catch (e) {
      console.error('Failed to save config:', e);
    }
  },

  refreshServer: async (server: ServerConfig) => {
    try {
      const result = await fetchTriggers(server);

      const triggers = new Map<string, number>();
      const triggerDetails = new Map<string, TriggerResult['triggers']>();

      if (result.success) {
        result.triggers.forEach((t) => {
          const count = triggers.get(t.priority) || 0;
          triggers.set(t.priority, count + 1);

          if (!triggerDetails.has(t.priority)) {
            triggerDetails.set(t.priority, []);
          }
          triggerDetails.get(t.priority)!.push(t);
        });
      }

      set((state) => {
        const newStatuses = new Map(state.serverStatuses);
        newStatuses.set(server.label, {
          label: server.label,
          triggers,
          triggerDetails,
          error: result.error,
          lastUpdate: result.last_update,
          loading: false,
        });
        return { serverStatuses: newStatuses };
      });
    } catch (e) {
      console.error('Failed to fetch triggers for', server.label, e);
      set((state) => {
        const newStatuses = new Map(state.serverStatuses);
        const existing = newStatuses.get(server.label);
        if (existing) {
          existing.error = String(e);
          existing.loading = false;
        }
        return { serverStatuses: newStatuses };
      });
    }
  },

  refreshAll: async () => {
    const { config, refreshServer } = get();
    if (!config?.servers.length) return;

    set({ loading: true });

    const promises = config.servers.map((server) => refreshServer(server));
    await Promise.all(promises);

    set({ loading: false });
  },

  setRefreshInterval: async (seconds: number) => {
    const { config, saveConfig } = get();
    if (!config) return;

    const newConfig = {
      ...config,
      settings: { ...config.settings, refresh_interval_seconds: seconds },
    };
    await saveConfig(newConfig);
  },
}));

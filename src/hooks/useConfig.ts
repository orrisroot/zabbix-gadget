import { listen } from '@tauri-apps/api/event';
import { useEffect, useState } from 'react';
import { useZabbixStore } from '@/hooks/useZabbix';
import { getConfig } from '@/lib/zabbix-api';
import type { AppConfig } from '@/types/config';

export function useConfig() {
  const { config, serverStatuses, refreshAll } = useZabbixStore();
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    console.log('useConfig: loading config...');
    const loadAndSetConfig = async () => {
      try {
        const cfg = await getConfig();
        console.log('useConfig: config loaded:', cfg);
        useZabbixStore.setState({ config: cfg });
      } catch (e) {
        console.error('Failed to load config:', e);
      }
    };
    loadAndSetConfig();

    // Listen for configuration updates from the settings window
    const unlistenPromise = listen<AppConfig>('config-updated', (event) => {
      console.log('useConfig: config updated event received:', event.payload);
      useZabbixStore.setState({ config: event.payload });
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  useEffect(() => {
    if (!config?.servers.length) return;

    const doRefresh = async () => {
      await useZabbixStore.getState().refreshAll();
      setLastUpdate(new Date());
    };

    doRefresh();
    const interval = config.settings.refresh_interval_seconds * 1000;
    const timer = setInterval(doRefresh, interval);

    return () => clearInterval(timer);
  }, [config]);

  return { config, serverStatuses, refreshAll, lastUpdate };
}

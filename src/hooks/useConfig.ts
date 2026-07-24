import { listen } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { useEffect, useState } from 'react';
import { useZabbixStore } from '@/hooks/useZabbix';
import { getConfig } from '@/lib/zabbix-api';
import type { AppConfig } from '@/types/config';

export function useConfig() {
  const { config, serverStatuses, refreshAll } = useZabbixStore();
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isVisible, setIsVisible] = useState<boolean>(true);

  // Check if current window is the main window
  const isMainWindow = typeof window !== 'undefined' && !new URLSearchParams(window.location.search).has('window');

  useEffect(() => {
    const loadAndSetConfig = async () => {
      try {
        const cfg = await getConfig();
        console.log('useConfig: configuration loaded');
        useZabbixStore.setState({ config: cfg });
      } catch (e) {
        console.error('Failed to load config:', e);
      }
    };

    // Fetch initial visibility state dynamically for main window
    const checkInitialVisibility = async () => {
      try {
        const appWindow = getCurrentWebviewWindow();
        const visible = await appWindow.isVisible();
        setIsVisible(visible);
      } catch (err) {
        console.error('Failed to get initial visibility:', err);
      }
    };

    // Load configuration from in-memory cache on mount for all windows
    loadAndSetConfig();

    if (isMainWindow) {
      checkInitialVisibility();
    }

    // Listen for configuration updates from the settings window or backend
    const unlistenConfigPromise = listen<AppConfig>('config-updated', (event) => {
      console.log('useConfig: configuration updated');
      useZabbixStore.setState({ config: event.payload });
    });

    let unlistenVisibility: (() => void) | null = null;
    if (isMainWindow) {
      // Only listen for window visibility changes on the main window
      listen<boolean>('window-visibility', (event) => {
        setIsVisible(event.payload);
      }).then((unlisten) => {
        unlistenVisibility = unlisten;
      });
    }

    return () => {
      unlistenConfigPromise.then((unlisten) => unlisten());
      if (unlistenVisibility) {
        unlistenVisibility();
      }
    };
  }, [isMainWindow]);

  // Polling loop logic
  useEffect(() => {
    // DO NOT poll if this is settings/tooltip window, or if the main window is hidden
    if (!isMainWindow || !isVisible || !config?.servers.length) return;

    const doRefresh = async () => {
      await useZabbixStore.getState().refreshAll();
      setLastUpdate(new Date());
    };

    // Refresh immediately upon window becoming visible / initialization
    doRefresh();

    const interval = config.settings.refresh_interval_seconds * 1000;
    const timer = setInterval(doRefresh, interval);

    return () => clearInterval(timer);
  }, [isMainWindow, isVisible, config]);

  return { config, serverStatuses, refreshAll, lastUpdate };
}

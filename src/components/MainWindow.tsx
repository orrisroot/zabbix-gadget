import { invoke } from '@tauri-apps/api/core';
import { PhysicalPosition } from '@tauri-apps/api/dpi';
import { Menu } from '@tauri-apps/api/menu';
import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { AlertCircle, Settings } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import TriggerTable from '@/components/TriggerTable';
import { useWindowAutoResize } from '@/hooks/useWindowAutoResize';
import type { ServerStatus } from '@/hooks/useZabbix';
import { useZabbixStore } from '@/hooks/useZabbix';
import { saveConfig } from '@/lib/zabbix-api';

interface MainWindowProps {
  serverStatuses: Map<string, ServerStatus>;
  lastUpdate: Date;
}

export default function MainWindow({ serverStatuses, lastUpdate }: MainWindowProps) {
  const { loading, config } = useZabbixStore();

  const hasServers = config?.servers && config.servers.length > 0;
  const mainPosRef = useRef<PhysicalPosition | null>(null);

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setupListener = async () => {
      try {
        const appWindow = getCurrentWebviewWindow();
        mainPosRef.current = await appWindow.outerPosition();

        unlisten = await appWindow.onMoved(({ payload: position }) => {
          mainPosRef.current = position;
        });
      } catch (err) {
        console.error('Failed to setup window move listener:', err);
      }
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  useWindowAutoResize({
    enabled: true,
    servers: config?.servers,
    serverStatuses,
  });

  const refreshInterval = config?.settings.refresh_interval_seconds ?? 300;
  const intervalMin = refreshInterval / 60;
  const intervalLabel = intervalMin === 1 ? '1 minute' : `${intervalMin} minutes`;

  const handleSettingsClick = useCallback(async () => {
    try {
      const settingsWin = await WebviewWindow.getByLabel('settings');
      if (settingsWin) {
        const mainWin = getCurrentWebviewWindow();

        let mainPos = mainPosRef.current;
        if (!mainPos) {
          mainPos = await mainWin.outerPosition();
        }

        const mainSize = await mainWin.outerSize();
        const factor = await mainWin.scaleFactor();

        const settingsWidth = 420 * factor;
        const settingsHeight = 640 * factor;

        const x = mainPos.x + Math.round((mainSize.width - settingsWidth) / 2);
        const y = mainPos.y + Math.round((mainSize.height - settingsHeight) / 2);

        await settingsWin.setPosition(new PhysicalPosition(x, y));
        await settingsWin.show();
        await settingsWin.setFocus();
      }
    } catch (err) {
      console.error('Failed to show settings window:', err);
    }
  }, []);

  const handleAboutClick = useCallback(async () => {
    try {
      const aboutWin = await WebviewWindow.getByLabel('about');
      if (aboutWin) {
        await aboutWin.show();
        await aboutWin.setFocus();
      }
    } catch (err) {
      console.error('Failed to show about window:', err);
    }
  }, []);

  const handleCheckUpdate = useCallback(async () => {
    try {
      const updateWin = await WebviewWindow.getByLabel('update');
      if (updateWin) {
        await updateWin.show();
        await updateWin.setFocus();
        await updateWin.emit('trigger-check');
      }
    } catch (err) {
      console.error('Failed to show update window:', err);
    }
  }, []);

  const handleToggleAlwaysOnTop = useCallback(async () => {
    try {
      await invoke('toggle_always_on_top');
    } catch (err) {
      console.error('Failed to toggle always on top:', err);
    }
  }, []);

  const handleQuit = useCallback(async () => {
    try {
      await invoke('quit_app');
    } catch (err) {
      console.error('Failed to quit app:', err);
    }
  }, []);

  const handleInspectElement = useCallback(async () => {
    try {
      await invoke('open_devtools');
    } catch (err) {
      console.error('Failed to open devtools:', err);
    }
  }, []);

  useEffect(() => {
    const handleContextMenu = async (e: MouseEvent) => {
      e.preventDefault();
      try {
        const isAlwaysOnTop = await invoke<boolean>('is_always_on_top').catch(() => false);

        const menu = await Menu.new({
          items: [
            {
              text: 'Always on Top',
              checked: isAlwaysOnTop,
              action: handleToggleAlwaysOnTop,
            },
            { item: 'Separator' as const },
            {
              text: 'Settings',
              action: handleSettingsClick,
            },
            {
              text: 'Check for Updates',
              action: handleCheckUpdate,
            },
            {
              text: 'About',
              action: handleAboutClick,
            },
            { item: 'Separator' as const },
            {
              text: 'Quit',
              action: handleQuit,
            },
            ...(import.meta.env.DEV
              ? [
                  { item: 'Separator' as const },
                  {
                    text: 'Inspect Element',
                    action: handleInspectElement,
                  },
                ]
              : []),
          ],
        });
        await menu.popup();
      } catch (err) {
        console.error('Failed to show context menu:', err);
      }
    };

    window.addEventListener('contextmenu', handleContextMenu);
    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [
    handleSettingsClick,
    handleCheckUpdate,
    handleAboutClick,
    handleInspectElement,
    handleToggleAlwaysOnTop,
    handleQuit,
  ]);

  const handleThemeToggle = async () => {
    if (!config) return;
    const currentTheme = config.settings.theme ?? 'system';
    const themeCycle: Record<'system' | 'dark' | 'light', 'system' | 'dark' | 'light'> = {
      system: 'dark',
      dark: 'light',
      light: 'system',
    };
    const newTheme = themeCycle[currentTheme] ?? 'system';
    const newConfig = {
      ...config,
      settings: {
        ...config.settings,
        theme: newTheme,
      },
    };
    useZabbixStore.setState({ config: newConfig });
    await saveConfig(newConfig);
  };

  return (
    <div className="window-base app-container">
      <Header
        loading={loading}
        onSettingsClick={handleSettingsClick}
        onAboutClick={handleAboutClick}
        theme={config?.settings.theme ?? 'system'}
        onThemeToggle={handleThemeToggle}
      />
      {hasServers && config?.servers ? (
        <main className="app-main">
          <TriggerTable servers={config.servers} serverStatuses={serverStatuses} />
        </main>
      ) : (
        <main className="app-main app-main-empty">
          <div className="error-overlay">
            <AlertCircle className="icon-error-pulse" />
            <div>
              <h3 className="error-overlay-title">No Connection Targets</h3>
              <p className="error-overlay-text">
                No connection targets are registered.
                <br />
                Please click the Settings gear icon <Settings size={13} className="icon-settings-inline" /> in the
                header to register Zabbix servers.
              </p>
            </div>
          </div>
        </main>
      )}
      {hasServers && (
        <footer className="app-footer">
          <span>Refresh Interval: {intervalLabel}</span>
          <span>Updated: {lastUpdate.toLocaleString()}</span>
        </footer>
      )}
    </div>
  );
}

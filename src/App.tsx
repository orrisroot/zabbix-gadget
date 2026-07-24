import { PhysicalPosition } from '@tauri-apps/api/dpi';
import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { AlertCircle, Settings } from 'lucide-react';
import { useEffect, useRef } from 'react';
import AboutPanel from '@/components/AboutPanel';
import ConnectionEditPanel from '@/components/ConnectionEditPanel';
import Header from '@/components/Header';
import SettingsPanel from '@/components/SettingsPanel';
import TooltipPanel from '@/components/TooltipPanel';
import TriggerTable from '@/components/TriggerTable';
import UpdatePanel from '@/components/UpdatePanel';
import { useConfig } from '@/hooks/useConfig';
import { useWindowAutoResize } from '@/hooks/useWindowAutoResize';
import { useZabbixStore } from '@/hooks/useZabbix';
import { saveConfig } from '@/lib/zabbix-api';

function App() {
  const { loading } = useZabbixStore();
  const { config, serverStatuses, lastUpdate } = useConfig();

  const isSettingsWindow = typeof window !== 'undefined' && window.location.search.includes('window=settings');
  const isTooltipWindow = typeof window !== 'undefined' && window.location.search.includes('window=tooltip');
  const isUpdateWindow = typeof window !== 'undefined' && window.location.search.includes('window=update');
  const isConnectionEditWindow =
    typeof window !== 'undefined' && window.location.search.includes('window=connection-edit');
  const isAboutWindow = typeof window !== 'undefined' && window.location.search.includes('window=about');
  const hasServers = config?.servers && config.servers.length > 0;

  const mainPosRef = useRef<PhysicalPosition | null>(null);

  useEffect(() => {
    if (isSettingsWindow || isTooltipWindow || isUpdateWindow || isAboutWindow) return;

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
  }, [isSettingsWindow, isTooltipWindow, isUpdateWindow, isAboutWindow]);

  const refreshInterval = config?.settings.refresh_interval_seconds ?? 300;
  const intervalMin = refreshInterval / 60;
  const intervalLabel = intervalMin === 1 ? '1 minute' : `${intervalMin} minutes`;

  // Apply theme to document and Tauri window
  useEffect(() => {
    const theme = config?.settings.theme ?? 'system';

    const applyTheme = () => {
      const isDark =
        theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

      if (isDark) {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
        document.body.classList.add('dark');
        document.body.classList.remove('light');
      } else {
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
        document.body.classList.add('light');
        document.body.classList.remove('dark');
      }

      try {
        const appWin = getCurrentWebviewWindow();
        if (appWin && typeof appWin.setTheme === 'function') {
          const tauriTheme = theme === 'system' ? null : theme;
          appWin.setTheme(tauriTheme).catch((err) => {
            console.warn('Failed to set Tauri window theme:', err);
          });
        }
      } catch (err) {
        console.error('Failed to get app window for theme updates:', err);
      }
    };

    applyTheme();

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme();
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [config?.settings.theme]);

  useWindowAutoResize({
    enabled: !isSettingsWindow && !isTooltipWindow && !isUpdateWindow && !isConnectionEditWindow && !isAboutWindow,
    servers: config?.servers,
    serverStatuses,
  });

  const handleSettingsClick = async () => {
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

        // Settings window has a fixed size of 420x640 (defined in tauri.conf.json)
        // Since it might be hidden initially, outerSize() can return 0, so we calculate it using scaleFactor
        const settingsWidth = 420 * factor;
        const settingsHeight = 640 * factor;

        // Calculate center position relative to main window in physical pixels
        const x = mainPos.x + Math.round((mainSize.width - settingsWidth) / 2);
        const y = mainPos.y + Math.round((mainSize.height - settingsHeight) / 2);

        await settingsWin.setPosition(new PhysicalPosition(x, y));
        await settingsWin.show();
        await settingsWin.setFocus();
      }
    } catch (err) {
      console.error('Failed to show settings window:', err);
    }
  };

  const handleAboutClick = async () => {
    try {
      const aboutWin = await WebviewWindow.getByLabel('about');
      if (aboutWin) {
        await aboutWin.show();
        await aboutWin.setFocus();
      }
    } catch (err) {
      console.error('Failed to show about window:', err);
    }
  };

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

  if (isSettingsWindow) {
    return (
      <div className="window-base">
        <SettingsPanel
          onClose={async () => {
            try {
              await getCurrentWebviewWindow().hide();
            } catch (err) {
              console.error('Failed to hide settings window:', err);
            }
          }}
        />
      </div>
    );
  }

  if (isTooltipWindow) {
    return (
      <div className="window-transparent-wrapper">
        <TooltipPanel />
      </div>
    );
  }

  if (isUpdateWindow) {
    return (
      <div className="window-transparent-wrapper">
        <UpdatePanel />
      </div>
    );
  }

  if (isConnectionEditWindow) {
    return (
      <div className="window-base">
        <ConnectionEditPanel />
      </div>
    );
  }

  if (isAboutWindow) {
    return (
      <div className="window-base">
        <AboutPanel />
      </div>
    );
  }

  return (
    <div className="window-base app-container">
      <Header
        loading={loading}
        onSettingsClick={handleSettingsClick}
        onAboutClick={handleAboutClick}
        theme={config?.settings.theme ?? 'system'}
        onThemeToggle={handleThemeToggle}
      />
      <main className={`app-main scrollbar-thin ${!hasServers ? 'app-main-empty' : ''}`}>
        {hasServers && config?.servers ? (
          <TriggerTable servers={config.servers} serverStatuses={serverStatuses} />
        ) : (
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
        )}
      </main>
      {hasServers && (
        <footer className="app-footer">
          <span>Refresh Interval: {intervalLabel}</span>
          <span>Updated: {lastUpdate.toLocaleString()}</span>
        </footer>
      )}
    </div>
  );
}

export default App;

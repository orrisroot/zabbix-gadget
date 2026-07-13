import { LogicalSize, PhysicalPosition } from '@tauri-apps/api/dpi';
import { emit } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { AlertCircle, Settings } from 'lucide-react';
import { useEffect, useRef } from 'react';
import ConnectionEditPanel from '@/components/ConnectionEditPanel';
import Header from '@/components/Header';
import SettingsPanel from '@/components/SettingsPanel';
import TooltipPanel from '@/components/TooltipPanel';
import TriggerTable from '@/components/TriggerTable';
import UpdatePanel from '@/components/UpdatePanel';
import { useConfig } from '@/hooks/useConfig';
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
  const hasServers = config?.servers && config.servers.length > 0;

  const mainPosRef = useRef<PhysicalPosition | null>(null);

  useEffect(() => {
    if (isSettingsWindow || isTooltipWindow || isUpdateWindow) return;

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
  }, [isSettingsWindow, isTooltipWindow, isUpdateWindow]);

  const refreshInterval = config?.settings.refresh_interval_seconds ?? 300;
  const intervalMin = refreshInterval / 60;
  const intervalLabel = intervalMin === 1 ? '1 minute' : `${intervalMin} minutes`;

  // Apply theme to document and Tauri window
  useEffect(() => {
    const theme = config?.settings.theme ?? 'dark';
    if (theme === 'dark') {
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
        appWin.setTheme(theme).catch((err) => {
          console.warn('Failed to set Tauri window theme:', err);
        });
      }
    } catch (err) {
      console.error('Failed to get app window for theme updates:', err);
    }
  }, [config?.settings.theme]);

  useEffect(() => {
    if (isSettingsWindow || isTooltipWindow || isUpdateWindow) return;

    // Reference servers and statuses so that height calculations run when the content changes
    const _triggerResize = { servers: config?.servers, statuses: serverStatuses };

    const updateWindowHeight = async () => {
      // Small timeout to allow DOM to render and stabilize
      await new Promise((resolve) => setTimeout(resolve, 150));

      const headerEl = document.querySelector('.app-header');
      const mainContentEl = document.querySelector('.app-main table') || document.querySelector('.app-main > div');
      const footerEl = document.querySelector('.app-footer');

      if (headerEl) {
        const headerHeight = headerEl.getBoundingClientRect().height;
        const mainHeight = mainContentEl ? mainContentEl.getBoundingClientRect().height : 120;
        const footerHeight = footerEl ? footerEl.getBoundingClientRect().height : 0;

        // Sum elements + main paddings (4px top, 4px bottom) + container border (2px) + 1px safety buffer to prevent OS border discrepancies
        const totalHeight = Math.ceil(headerHeight + mainHeight + footerHeight + 8 + 2 + 1);

        // Cap the window height between 90px min and 550px max to prevent shrinking
        const targetHeight = Math.max(Math.min(totalHeight, 550), 90);

        try {
          const appWindow = getCurrentWebviewWindow();
          await appWindow.setSize(new LogicalSize(670, targetHeight));
        } catch (err) {
          console.error('App: failed to resize window:', err);
        }
      } else {
        console.warn('App: header element not found, skipping resize');
      }
    };

    updateWindowHeight();
  }, [config?.servers, serverStatuses, isSettingsWindow, isUpdateWindow, isTooltipWindow]);

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

  const handleThemeToggle = async () => {
    if (!config) return;
    const newTheme: 'dark' | 'light' = config.settings.theme === 'dark' ? 'light' : 'dark';
    const newConfig = {
      ...config,
      settings: {
        ...config.settings,
        theme: newTheme,
      },
    };
    useZabbixStore.setState({ config: newConfig });
    await saveConfig(newConfig);
    await emit('config-updated', newConfig);
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

  return (
    <div className="window-base app-container">
      <Header
        loading={loading}
        onSettingsClick={handleSettingsClick}
        theme={config?.settings.theme ?? 'dark'}
        onThemeToggle={handleThemeToggle}
      />
      <main className={`app-main scrollbar-thin ${!hasServers ? 'app-main-empty' : ''}`}>
        {hasServers ? (
          <table className="trigger-table">
            <thead>
              <tr className="trigger-table-tr">
                <th className="trigger-table-th-primary">Server</th>
                <th className="trigger-table-th-secondary">Disaster</th>
                <th className="trigger-table-th-secondary">High</th>
                <th className="trigger-table-th-secondary">Average</th>
                <th className="trigger-table-th-secondary">Warning</th>
                <th className="trigger-table-th-secondary">Information</th>
                <th className="trigger-table-th-secondary">Not classified</th>
              </tr>
            </thead>
            <tbody id="server-rows">
              {config?.servers.map((server, idx) => {
                const status = serverStatuses.get(server.label);
                return <TriggerTable key={server.label} server={server} status={status ?? null} idx={idx} />;
              })}
            </tbody>
          </table>
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

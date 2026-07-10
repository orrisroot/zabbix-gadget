import { LogicalSize, PhysicalPosition } from '@tauri-apps/api/dpi';
import { emit } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { AlertCircle, Settings } from 'lucide-react';
import { useEffect, useRef } from 'react';
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

        // Sum elements + main paddings (4px top, 4px bottom) + container border (2px) + 8px safety buffer to prevent subpixel scrollbars and OS border discrepancies
        const totalHeight = Math.ceil(headerHeight + mainHeight + footerHeight + 8 + 2 + 8);

        // Cap the window height between 120px min and 550px max to prevent shrinking
        const targetHeight = Math.max(Math.min(totalHeight, 550), 120);

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
  }, [config?.servers, serverStatuses, isSettingsWindow, isUpdateWindow]);

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
      <div className="flex flex-col h-full w-full bg-white dark:bg-slate-950 text-slate-900 dark:text-white select-none border border-slate-200 dark:border-slate-800 overflow-hidden">
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
      <div className="h-full w-full bg-transparent select-none overflow-hidden flex flex-col">
        <TooltipPanel />
      </div>
    );
  }

  if (isUpdateWindow) {
    return (
      <div className="h-full w-full bg-transparent select-none overflow-hidden flex flex-col">
        <UpdatePanel />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full select-none app-container">
      <Header
        loading={loading}
        onSettingsClick={handleSettingsClick}
        theme={config?.settings.theme ?? 'dark'}
        onThemeToggle={handleThemeToggle}
      />
      <main
        className={`flex-1 app-main overflow-y-auto scrollbar-thin ${!hasServers ? 'flex flex-col justify-center min-h-0' : ''}`}
      >
        {hasServers ? (
          <table className="w-full table-fixed border-separate border-spacing-x-1.5 border-spacing-y-1.5 text-xxs">
            <thead>
              <tr className="text-slate-600 dark:text-gray-200">
                <th className="text-left pb-2 px-2 w-[110px] font-semibold text-xxxs uppercase tracking-wider border-b border-slate-200 dark:border-gray-800/85">
                  Server
                </th>
                <th className="text-center pb-2 w-[70px] font-semibold text-xxxs uppercase tracking-wider border-b border-slate-200 dark:border-gray-800/85">
                  Disaster
                </th>
                <th className="text-center pb-2 w-[70px] font-semibold text-xxxs uppercase tracking-wider border-b border-slate-200 dark:border-gray-800/85">
                  High
                </th>
                <th className="text-center pb-2 w-[70px] font-semibold text-xxxs uppercase tracking-wider border-b border-slate-200 dark:border-gray-800/85">
                  Average
                </th>
                <th className="text-center pb-2 w-[70px] font-semibold text-xxxs uppercase tracking-wider border-b border-slate-200 dark:border-gray-800/85">
                  Warning
                </th>
                <th className="text-center pb-2 w-[70px] font-semibold text-xxxs uppercase tracking-wider border-b border-slate-200 dark:border-gray-800/85">
                  Information
                </th>
                <th className="text-center pb-2 w-[70px] font-semibold text-xxxs uppercase tracking-wider border-b border-slate-200 dark:border-gray-800/85">
                  Not classified
                </th>
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
          <div className="flex flex-col items-center justify-center p-5 text-center gap-2.5 bg-gray-100/40 dark:bg-gray-900/30 border border-dashed border-slate-200 dark:border-gray-800/60 rounded-md w-full mx-auto select-none my-1">
            <AlertCircle className="text-orange-500 w-8 h-8 animate-pulse" />
            <div>
              <h3 className="font-bold text-slate-800 dark:text-gray-200 text-xs uppercase tracking-wider">
                Zabbix Targets Not Configured
              </h3>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-1.5 leading-relaxed">
                No connection targets are registered.
                <br />
                Please click the Settings gear icon{' '}
                <Settings size={13} className="inline text-indigo-450 dark:text-indigo-400 align-middle -mt-0.5" /> in
                the header to register Zabbix servers.
              </p>
            </div>
          </div>
        )}
      </main>
      {hasServers && (
        <footer className="app-footer flex justify-between text-slate-500 dark:text-gray-300 text-xxs">
          <span>Refresh Interval: {intervalLabel}</span>
          <span>Updated: {lastUpdate.toLocaleString()}</span>
        </footer>
      )}
    </div>
  );
}

export default App;

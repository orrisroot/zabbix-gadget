import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { useEffect } from 'react';
import AboutPanel from '@/components/AboutPanel';
import ConnectionEditPanel from '@/components/ConnectionEditPanel';
import MainWindow from '@/components/MainWindow';
import SettingsPanel from '@/components/SettingsPanel';
import TooltipPanel from '@/components/TooltipPanel';
import UpdatePanel from '@/components/UpdatePanel';
import { useConfig } from '@/hooks/useConfig';
import { useSecondaryContextMenu } from '@/hooks/useSecondaryContextMenu';

function App() {
  const { config, serverStatuses, lastUpdate } = useConfig();

  const isSettingsWindow = typeof window !== 'undefined' && window.location.search.includes('window=settings');
  const isTooltipWindow = typeof window !== 'undefined' && window.location.search.includes('window=tooltip');
  const isUpdateWindow = typeof window !== 'undefined' && window.location.search.includes('window=update');
  const isConnectionEditWindow =
    typeof window !== 'undefined' && window.location.search.includes('window=connection-edit');
  const isAboutWindow = typeof window !== 'undefined' && window.location.search.includes('window=about');

  const isOtherWindow =
    isSettingsWindow || isTooltipWindow || isUpdateWindow || isConnectionEditWindow || isAboutWindow;

  useSecondaryContextMenu(isOtherWindow);

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

  if (isSettingsWindow) {
    return (
      <div className="window-base">
        <SettingsPanel />
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

  return <MainWindow serverStatuses={serverStatuses} lastUpdate={lastUpdate} />;
}

export default App;

import AboutPanel from '@/components/AboutPanel';
import ConnectionEditPanel from '@/components/ConnectionEditPanel';
import MainWindow from '@/components/MainWindow';
import SettingsPanel from '@/components/SettingsPanel';
import TooltipPanel from '@/components/TooltipPanel';
import UpdatePanel from '@/components/UpdatePanel';
import { useConfig } from '@/hooks/useConfig';
import { useSecondaryContextMenu } from '@/hooks/useSecondaryContextMenu';
import { useTheme } from '@/hooks/useTheme';

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
  useTheme(config?.settings.theme);

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

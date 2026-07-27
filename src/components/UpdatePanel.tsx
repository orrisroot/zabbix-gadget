import { AlertCircle, CheckCircle2, Download, Info, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import PanelHeader from '@/components/PanelHeader';
import { ScrollArea } from '@/components/ScrollArea';
import { useAppUpdate } from '@/hooks/useAppUpdate';
import { useTauriWindow } from '@/hooks/useTauriWindow';

export function UpdatePanel() {
  const { hideWindow } = useTauriWindow();
  const {
    status,
    currentVersion,
    newVersion,
    changelog,
    errorMessage,
    downloadProgress,
    checkForUpdates,
    startInstall,
    handleRelaunch,
  } = useAppUpdate();

  // Format bytes to a human readable format
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / k ** i).toFixed(1)} ${sizes[i]}`;
  };

  // Determine progress percentage
  const percent = downloadProgress.total
    ? Math.min(100, Math.round((downloadProgress.downloaded / downloadProgress.total) * 100))
    : null;

  return (
    <div className="window-base">
      <PanelHeader
        title="Software Update"
        icon={<Sparkles size={18} className="icon-sparkles" />}
        showCloseButton={status !== 'downloading'}
        onClose={hideWindow}
      />

      {/* Main Content Area */}
      <main className="panel-content panel-content-centered">
        <div className="update-container-inner">
          {status === 'checking' && (
            <div className="update-status-container">
              <Loader2 className="update-loader" />
              <div>
                <h3 className="update-status-title">Checking for updates...</h3>
                <p className="update-status-desc">Connecting to update server</p>
              </div>
            </div>
          )}

          {status === 'no-update' && (
            <div className="update-status-container">
              <CheckCircle2 className="update-success-icon" />
              <div>
                <h3 className="update-title-highlight">You are up to date!</h3>
                <p className="update-desc-highlight">
                  Zabbix Gadget {currentVersion ? `v${currentVersion}` : ''} is currently at the latest version.
                </p>
              </div>
            </div>
          )}

          {status === 'available' && (
            <div className="update-available-content">
              <div className="update-available-info-container">
                <div className="update-download-icon-container">
                  <Download size={18} />
                </div>
                <div className="flex-1-min-h-0">
                  <h3 className="update-available-title">
                    Update Available
                    <span className="update-badge-version">v{newVersion}</span>
                  </h3>
                  <p className="update-available-desc">
                    A new version is ready to install (current: v{currentVersion || '0.1.3'}).
                  </p>
                </div>
              </div>

              {changelog && (
                <ScrollArea className="update-notes-container">
                  <div style={{ padding: '12px' }}>
                    <h4 className="update-notes-title">
                      <Info size={10} /> Release Notes
                    </h4>
                    <p className="update-notes-body">{changelog}</p>
                  </div>
                </ScrollArea>
              )}
            </div>
          )}

          {status === 'downloading' && (
            <div className="update-downloading-container">
              <div className="update-downloading-header">
                <span className="update-downloading-label">
                  <Loader2 size={12} className="icon-spin update-spinner-icon" />
                  Downloading update...
                </span>
                <span className="update-downloading-bytes">
                  {formatBytes(downloadProgress.downloaded)}
                  {downloadProgress.total && ` / ${formatBytes(downloadProgress.total)}`}
                </span>
              </div>

              <div className="update-progress-bg">
                <div
                  className={`update-progress-fill ${percent === null ? 'update-progress-fill-indeterminate' : ''}`}
                  style={percent !== null ? { width: `${percent}%` } : undefined}
                />
              </div>

              {percent !== null && <div className="update-downloading-percent">{percent}% Completed</div>}
            </div>
          )}

          {status === 'relaunch-pending' && (
            <div className="update-status-container">
              <CheckCircle2 className="update-relaunch-icon" />
              <div>
                <h3 className="update-title-bold">Update Installed Successfully!</h3>
                <p className="update-desc-highlight">
                  The software has been updated. Please click 'Relaunch' below to restart and apply the changes.
                </p>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="update-status-container">
              <AlertCircle className="update-error-icon" />
              <div className="w-full">
                <h3 className="update-error-title">Update Failed</h3>
                <p className="update-error-desc">{errorMessage}</p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Action Buttons (Footer) */}
      <footer className="panel-footer">
        {status === 'checking' && (
          <button type="button" onClick={hideWindow} className="btn-secondary">
            Cancel
          </button>
        )}

        {status === 'downloading' && (
          <button type="button" onClick={hideWindow} className="btn-secondary">
            Cancel
          </button>
        )}

        {status === 'no-update' && (
          <button type="button" onClick={hideWindow} className="btn-primary">
            Done
          </button>
        )}

        {status === 'available' && (
          <>
            <button type="button" onClick={hideWindow} className="btn-secondary">
              Later
            </button>
            <button type="button" onClick={startInstall} className="btn-primary">
              <Download size={12} />
              Update Now
            </button>
          </>
        )}

        {status === 'relaunch-pending' && (
          <>
            <button type="button" onClick={hideWindow} className="btn-secondary">
              Later
            </button>
            <button type="button" onClick={handleRelaunch} className="btn-primary btn-primary-success">
              <RefreshCw size={12} className="animate-spin-slow" />
              Relaunch
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <button type="button" onClick={hideWindow} className="btn-secondary">
              Close
            </button>
            <button type="button" onClick={checkForUpdates} className="btn-primary">
              <RefreshCw size={12} />
              Retry
            </button>
          </>
        )}
      </footer>
    </div>
  );
}

export default UpdatePanel;

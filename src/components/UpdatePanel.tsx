import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { AlertCircle, CheckCircle2, Download, Info, Loader2, RefreshCw, Sparkles, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type UpdateStatus = 'checking' | 'available' | 'no-update' | 'downloading' | 'relaunch-pending' | 'error';

interface UpdateCheckResult {
  status: 'noUpdate' | 'available' | 'error';
  currentVersion?: string;
  newVersion?: string;
  body?: string;
  message?: string;
}

interface ProgressPayload {
  downloaded: number;
  total_len: number | null;
}

function UpdatePanel() {
  const appWindow = getCurrentWebviewWindow();
  const [status, setStatus] = useState<UpdateStatus>('checking');
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [newVersion, setNewVersion] = useState<string>('');
  const [changelog, setChangelog] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [downloadProgress, setDownloadProgress] = useState<{ downloaded: number; total: number | null }>({
    downloaded: 0,
    total: null,
  });
  const [showDebug, setShowDebug] = useState(true);

  const handleMouseDown = async (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    try {
      await appWindow.startDragging();
    } catch (err) {
      console.error('Drag failed:', err);
    }
  };

  const closeWindow = async () => {
    try {
      await appWindow.hide();
    } catch (err) {
      console.error('Failed to hide window:', err);
    }
  };

  const checkForUpdates = useCallback(async () => {
    setStatus('checking');
    setErrorMessage('');
    setDownloadProgress({ downloaded: 0, total: null });

    try {
      const result = await invoke<UpdateCheckResult>('check_for_update');
      if (result.status === 'available') {
        setStatus('available');
        setCurrentVersion(result.currentVersion || '');
        setNewVersion(result.newVersion || '');
        setChangelog(result.body || '');
      } else if (result.status === 'noUpdate') {
        setStatus('no-update');
      } else {
        setStatus('error');
        setErrorMessage(result.message || 'Unknown error occurred while checking.');
      }
    } catch (err) {
      setStatus('error');
      setErrorMessage(String(err));
    }
  }, []);

  const startInstall = async () => {
    setStatus('downloading');
    setDownloadProgress({ downloaded: 0, total: null });

    try {
      await invoke('install_update');
      setStatus('relaunch-pending');
    } catch (err) {
      setStatus('error');
      setErrorMessage(String(err));
    }
  };

  const handleRelaunch = async () => {
    try {
      await invoke('relaunch_app');
    } catch (err) {
      console.error('Failed to relaunch:', err);
    }
  };

  useEffect(() => {
    // Run checking on mount
    checkForUpdates();

    // Listen for manual trigger-check event
    const unlistenTrigger = listen('trigger-check', () => {
      checkForUpdates();
    });

    // Listen for progress updates
    const unlistenProgress = listen<ProgressPayload>('update-progress', (event) => {
      setStatus('downloading');
      setDownloadProgress({
        downloaded: event.payload.downloaded,
        total: event.payload.total_len,
      });
    });

    return () => {
      unlistenTrigger.then((unlisten) => unlisten());
      unlistenProgress.then((unlisten) => unlisten());
    };
  }, [checkForUpdates]);

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
      {import.meta.env.DEV && showDebug && (
        <div className="update-debug-ui">
          <span className="text-slate-400 font-bold mr-1">Debug UI:</span>
          <button
            type="button"
            onClick={() => {
              setStatus('checking');
            }}
            className="update-debug-btn"
          >
            Checking
          </button>
          <button
            type="button"
            onClick={() => {
              setStatus('no-update');
              setCurrentVersion('0.1.1');
            }}
            className="update-debug-btn"
          >
            Up to date
          </button>
          <button
            type="button"
            onClick={() => {
              setStatus('available');
              setCurrentVersion('0.1.1');
              setNewVersion('1.2.0');
              setChangelog(
                '• Added new dark mode themes.\n• Fixed memory leak in tray icon render loop.\n• Improved performance on Linux MATE environment.',
              );
            }}
            className="update-debug-btn"
          >
            Available
          </button>
          <button
            type="button"
            onClick={() => {
              setStatus('downloading');
              setDownloadProgress({ downloaded: 6500000, total: 10000000 });
            }}
            className="update-debug-btn"
          >
            Downloading
          </button>
          <button
            type="button"
            onClick={() => {
              setStatus('relaunch-pending');
              setNewVersion('1.2.0');
            }}
            className="update-debug-btn"
          >
            Relaunch
          </button>
          <button
            type="button"
            onClick={() => {
              setStatus('error');
              setErrorMessage('Network connection lost: Could not connect to update host.');
            }}
            className="update-debug-btn"
          >
            Error
          </button>
        </div>
      )}
      {/* Drag Header */}
      <header role="toolbar" className="panel-header settings-header" onMouseDown={handleMouseDown}>
        <button
          type="button"
          className={`panel-header-title-container ${import.meta.env.DEV ? 'cursor-pointer select-none' : ''} bg-transparent border-none p-0 outline-none text-left`}
          onMouseDown={(e) => {
            if (import.meta.env.DEV) {
              e.stopPropagation();
            }
          }}
          onClick={() => {
            if (import.meta.env.DEV) {
              setShowDebug(!showDebug);
            }
          }}
          title={import.meta.env.DEV ? 'Click to toggle debug controls' : undefined}
        >
          <Sparkles size={18} className="icon-sparkles" />
          <span className="panel-header-title">Software Update</span>
        </button>
        {status !== 'downloading' && (
          <button type="button" onClick={closeWindow} className="settings-close-btn" title="Close">
            <X size={16} />
          </button>
        )}
      </header>

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
                <p className="update-desc-highlight">Zabbix Gadget is currently at the latest version.</p>
              </div>
            </div>
          )}

          {status === 'available' && (
            <div className="flex flex-col gap-2.5">
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
                    A new version is ready to install (current: v{currentVersion || '0.1.1'}).
                  </p>
                </div>
              </div>

              {changelog && (
                <div className="update-notes-container" style={{ padding: '12px' }}>
                  <h4 className="update-notes-title">
                    <Info size={10} /> Release Notes
                  </h4>
                  <p className="update-notes-body">{changelog}</p>
                </div>
              )}
            </div>
          )}

          {status === 'downloading' && (
            <div className="update-downloading-container">
              <div className="update-downloading-header">
                <span className="update-downloading-label">
                  <Loader2 size={12} className="icon-spin text-indigo-500" />
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
          <button type="button" onClick={closeWindow} className="btn-secondary">
            Cancel
          </button>
        )}

        {status === 'downloading' && (
          <button type="button" onClick={closeWindow} className="btn-secondary">
            Cancel
          </button>
        )}

        {status === 'no-update' && (
          <button type="button" onClick={closeWindow} className="btn-primary">
            Done
          </button>
        )}

        {status === 'available' && (
          <>
            <button type="button" onClick={closeWindow} className="btn-secondary">
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
            <button type="button" onClick={closeWindow} className="btn-secondary">
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
            <button type="button" onClick={closeWindow} className="btn-secondary">
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

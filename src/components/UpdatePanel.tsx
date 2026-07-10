import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { AlertCircle, CheckCircle2, Download, Info, Loader2, RefreshCw, Sparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';

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

  const checkForUpdates = async () => {
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
  };

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
  }, []);

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
    <div
      className="flex flex-col bg-white/98 dark:bg-slate-950/98 text-slate-900 dark:text-white select-none border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-xl backdrop-blur-md"
      style={{
        margin: '12px',
        height: 'calc(100% - 24px)',
        width: 'calc(100% - 24px)',
      }}
    >
      {import.meta.env.DEV && (
        <div className="bg-slate-900 text-[10px] p-1 flex flex-wrap gap-1 items-center justify-center border-b border-slate-800 select-none z-50 flex-shrink-0">
          <span className="text-slate-400 font-bold mr-1">Debug UI:</span>
          <button
            onClick={() => {
              setStatus('checking');
            }}
            className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 cursor-pointer font-bold border border-slate-700 hover:text-white"
          >
            Checking
          </button>
          <button
            onClick={() => {
              setStatus('no-update');
              setCurrentVersion('0.1.0');
            }}
            className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 cursor-pointer font-bold border border-slate-700 hover:text-white"
          >
            Up to date
          </button>
          <button
            onClick={() => {
              setStatus('available');
              setCurrentVersion('0.1.0');
              setNewVersion('1.2.0');
              setChangelog(
                '• Added new dark mode themes.\n• Fixed memory leak in tray icon render loop.\n• Improved performance on Linux MATE environment.',
              );
            }}
            className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 cursor-pointer font-bold border border-slate-700 hover:text-white"
          >
            Available
          </button>
          <button
            onClick={() => {
              setStatus('downloading');
              setDownloadProgress({ downloaded: 6500000, total: 10000000 });
            }}
            className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 cursor-pointer font-bold border border-slate-700 hover:text-white"
          >
            Downloading
          </button>
          <button
            onClick={() => {
              setStatus('relaunch-pending');
              setNewVersion('1.2.0');
            }}
            className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 cursor-pointer font-bold border border-slate-700 hover:text-white"
          >
            Relaunch
          </button>
          <button
            onClick={() => {
              setStatus('error');
              setErrorMessage('Network connection lost: Could not connect to update host.');
            }}
            className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 cursor-pointer font-bold border border-slate-700 hover:text-white"
          >
            Error
          </button>
        </div>
      )}
      {/* Drag Header */}
      <header
        className="w-full font-bold flex items-center justify-between cursor-grab select-none border-b border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-900/35"
        style={{ padding: '4px 8px' }}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2 text-indigo-500 dark:text-indigo-400">
          <Sparkles size={14} className="animate-pulse" />
          <span className="text-xxs font-extrabold tracking-wider uppercase">Software Update</span>
        </div>
        {status !== 'downloading' && (
          <button
            onClick={closeWindow}
            className="settings-close-btn rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
            style={{ marginRight: '4px' }}
            title="Close"
          >
            <X size={14} />
          </button>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col justify-center min-h-0" style={{ padding: '16px' }}>
        <div className="flex-1 flex flex-col justify-center gap-3">
          {status === 'checking' && (
            <div className="flex flex-col items-center justify-center py-4 gap-3 text-center">
              <Loader2 className="animate-spin text-indigo-500 dark:text-indigo-400 w-9 h-9" />
              <div>
                <h3 className="font-semibold text-xs text-slate-700 dark:text-slate-200">Checking for updates...</h3>
                <p className="text-xxs text-slate-400 dark:text-slate-500 mt-1">Connecting to update server</p>
              </div>
            </div>
          )}

          {status === 'no-update' && (
            <div className="flex flex-col items-center justify-center py-2 gap-3 text-center">
              <CheckCircle2 className="text-emerald-500 w-9 h-9" />
              <div>
                <h3 className="font-semibold text-xs text-slate-800 dark:text-slate-100">You are up to date!</h3>
                <p className="text-xxs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  Zabbix Gadget is currently at the latest version.
                </p>
              </div>
            </div>
          )}

          {status === 'available' && (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 dark:text-indigo-400 flex-shrink-0 mt-0.5">
                  <Download size={18} />
                </div>
                <div className="flex-1 min-h-0">
                  <h3 className="font-bold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    Update Available
                    <span className="text-xxxs font-extrabold px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300">
                      v{newVersion}
                    </span>
                  </h3>
                  <p className="text-xxs text-slate-500 dark:text-slate-400 mt-1">
                    A new version is ready to install (current: v{currentVersion || '0.1.0'}).
                  </p>
                </div>
              </div>

              {changelog && (
                <div
                  className="flex-1 max-h-[85px] overflow-y-auto scrollbar-thin bg-slate-50 dark:bg-slate-900/50 rounded-md border border-slate-150 dark:border-slate-800/80 mt-1"
                  style={{ padding: '12px' }}
                >
                  <h4 className="text-xxxs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Info size={10} /> Release Notes
                  </h4>
                  <p className="text-xxs text-slate-600 dark:text-slate-300 leading-normal whitespace-pre-wrap">
                    {changelog}
                  </p>
                </div>
              )}
            </div>
          )}

          {status === 'downloading' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-xxs">
                <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Loader2 size={12} className="animate-spin text-indigo-500" />
                  Downloading update...
                </span>
                <span className="text-slate-400 dark:text-slate-500 font-mono">
                  {formatBytes(downloadProgress.downloaded)}
                  {downloadProgress.total && ` / ${formatBytes(downloadProgress.total)}`}
                </span>
              </div>

              <div className="w-full h-2 bg-slate-100 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-850 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-300 ${
                    percent === null ? 'w-1/3 animate-pulse bg-indigo-500/80' : ''
                  }`}
                  style={percent !== null ? { width: `${percent}%` } : undefined}
                />
              </div>

              {percent !== null && (
                <div className="text-right text-xxxs text-indigo-500 dark:text-indigo-400 font-bold font-mono">
                  {percent}% Completed
                </div>
              )}
            </div>
          )}

          {status === 'relaunch-pending' && (
            <div className="flex flex-col items-center justify-center py-2 gap-3 text-center">
              <CheckCircle2 className="text-emerald-500 w-9 h-9 animate-bounce" />
              <div>
                <h3 className="font-bold text-xs text-slate-800 dark:text-slate-100">Update Installed Successfully!</h3>
                <p className="text-xxs text-slate-500 dark:text-gray-400 mt-1.5 leading-relaxed">
                  The software has been updated. Please click 'Relaunch' below to restart and apply the changes.
                </p>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center justify-center py-1 gap-3 text-center w-full">
              <AlertCircle className="text-red-500 w-9 h-9" />
              <div className="w-full">
                <h3 className="font-bold text-xs text-red-500 dark:text-red-400">Update Failed</h3>
                <p className="text-xxs text-rose-600 dark:text-rose-400 mt-2 leading-relaxed break-words text-center">
                  {errorMessage}
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Action Buttons (Footer) */}
      <footer
        className="w-full bg-slate-50/50 dark:bg-slate-900/35 flex items-center justify-end gap-2.5"
        style={{ padding: '4px 8px' }}
      >
        {status === 'checking' && (
          <button
            onClick={closeWindow}
            className="settings-btn-padding text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-750 rounded transition-colors cursor-pointer"
          >
            Cancel
          </button>
        )}

        {status === 'no-update' && (
          <button
            onClick={closeWindow}
            className="settings-btn-padding text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors cursor-pointer"
          >
            Done
          </button>
        )}

        {status === 'available' && (
          <>
            <button
              onClick={closeWindow}
              className="settings-btn-padding text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-750 rounded transition-colors cursor-pointer"
            >
              Later
            </button>
            <button
              onClick={startInstall}
              className="settings-btn-padding text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Download size={12} />
              Update Now
            </button>
          </>
        )}

        {status === 'relaunch-pending' && (
          <>
            <button
              onClick={closeWindow}
              className="settings-btn-padding text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-750 rounded transition-colors cursor-pointer"
            >
              Later
            </button>
            <button
              onClick={handleRelaunch}
              className="settings-btn-padding text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw size={12} className="animate-spin-slow" />
              Relaunch
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <button
              onClick={closeWindow}
              className="settings-btn-padding text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-750 rounded transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={checkForUpdates}
              className="settings-btn-padding text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors cursor-pointer flex items-center gap-1.5"
            >
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

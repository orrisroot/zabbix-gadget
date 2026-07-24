import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useCallback, useEffect, useState } from 'react';

export type UpdateStatus = 'checking' | 'available' | 'no-update' | 'downloading' | 'relaunch-pending' | 'error';

interface UpdateCheckResult {
  status: 'noUpdate' | 'available' | 'error';
  currentVersion?: string;
  current_version?: string;
  newVersion?: string;
  new_version?: string;
  body?: string;
  message?: string;
}

interface ProgressPayload {
  downloaded: number;
  total_len: number | null;
}

export function useAppUpdate() {
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

  const checkForUpdates = useCallback(async () => {
    setStatus('checking');
    setErrorMessage('');
    setDownloadProgress({ downloaded: 0, total: null });

    try {
      const result = await invoke<UpdateCheckResult>('check_for_update');
      if (result.status === 'available') {
        setStatus('available');
        setCurrentVersion(result.currentVersion || result.current_version || '');
        setNewVersion(result.newVersion || result.new_version || '');
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

  return {
    status,
    setStatus,
    currentVersion,
    setCurrentVersion,
    newVersion,
    setNewVersion,
    changelog,
    setChangelog,
    errorMessage,
    setErrorMessage,
    downloadProgress,
    setDownloadProgress,
    showDebug,
    setShowDebug,
    checkForUpdates,
    startInstall,
    handleRelaunch,
  };
}
export default useAppUpdate;

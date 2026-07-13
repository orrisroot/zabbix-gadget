import { emit, listen } from '@tauri-apps/api/event';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { ChevronDown, Plus, Server as ServerIcon, Settings as SettingsIcon, Sliders } from 'lucide-react';
import { useEffect, useState } from 'react';
import PanelHeader from '@/components/PanelHeader';
import SettingsServerItem from '@/components/SettingsServerItem';
import { useTauriWindow } from '@/hooks/useTauriWindow';
import { useZabbixStore } from '@/hooks/useZabbix';
import { loginServer, saveConfig } from '@/lib/zabbix-api';
import type { ServerConfig } from '@/types/config';

interface SettingsPanelProps {
  onClose: () => void;
}

function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { hideWindow } = useTauriWindow();
  const { config } = useZabbixStore();
  const [servers, setServers] = useState<ServerConfig[]>(config?.servers ?? []);
  const [refreshInterval, setRefreshInterval] = useState<number>(config?.settings.refresh_interval_seconds ?? 300);
  const [isIntervalOpen, setIsIntervalOpen] = useState(false);

  // Drag and drop states
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Connection test statuses
  const [testStatus, setTestStatus] = useState<{
    [key: string]: 'idle' | 'loading' | 'ok' | 'error';
  }>({});

  // Sync local states with config when it is loaded or updated in the store
  useEffect(() => {
    if (config) {
      setServers(config.servers);
      setRefreshInterval(config.settings.refresh_interval_seconds);
    }
  }, [config]);

  // Discard unsaved changes and reload config when the settings window becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && config) {
        setServers(config.servers);
        setRefreshInterval(config.settings.refresh_interval_seconds);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [config]);

  // Listen for connection target edits/adds from the separate connection-edit window
  useEffect(() => {
    const listenPromise = listen<{ server: ServerConfig; editIndex: number | null }>('server-saved', (event) => {
      const { server, editIndex } = event.payload;
      setServers((curr) => {
        if (editIndex !== null) {
          const updated = [...curr];
          updated[editIndex] = server;
          return updated;
        }
        return [...curr, server];
      });
    });

    return () => {
      listenPromise.then((unlisten) => unlisten());
    };
  }, []);

  const handleOpenAddWindow = async () => {
    try {
      const win = await WebviewWindow.getByLabel('connection-edit');
      if (win) {
        await win.show();
        await win.setFocus();
        setTimeout(() => {
          emit('connection-edit-init', { editIndex: null, server: null }).catch((err) => {
            console.error('Failed to emit connection-edit-init:', err);
          });
        }, 50);
      } else {
        console.error('Failed to find connection-edit window by label');
      }
    } catch (err) {
      console.error('Failed to open connection edit window:', err);
    }
  };

  const handleOpenEditWindow = async (idx: number) => {
    try {
      const win = await WebviewWindow.getByLabel('connection-edit');
      if (win) {
        await win.show();
        await win.setFocus();
        const s = servers[idx];
        setTimeout(() => {
          emit('connection-edit-init', { editIndex: idx, server: s }).catch((err) => {
            console.error('Failed to emit connection-edit-init:', err);
          });
        }, 50);
      } else {
        console.error('Failed to find connection-edit window by label');
      }
    } catch (err) {
      console.error('Failed to open connection edit window:', err);
    }
  };

  const handleRemove = (idx: number) => {
    setServers(servers.filter((_, i) => i !== idx));
  };

  const handleDragStart = (_e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const updated = [...servers];
    const draggedItem = updated[draggedIndex];
    updated.splice(draggedIndex, 1);
    updated.splice(index, 0, draggedItem);
    setServers(updated);

    setDraggedIndex(index);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleTest = async (server: ServerConfig) => {
    setTestStatus((prev) => ({ ...prev, [server.label]: 'loading' }));
    try {
      const ok = await loginServer(server);
      setTestStatus((prev) => ({
        ...prev,
        [server.label]: ok ? 'ok' : 'error',
      }));
    } catch (_err) {
      setTestStatus((prev) => ({ ...prev, [server.label]: 'error' }));
    }
  };

  const handleSave = async () => {
    if (!config) return;
    try {
      const newConfig = {
        ...config,
        servers,
        settings: {
          ...config.settings,
          refresh_interval_seconds: refreshInterval,
        },
      };

      await saveConfig(newConfig);
      await emit('config-updated', newConfig);
      onClose();
    } catch (err) {
      console.error('Failed to save config:', err);
    }
  };

  const closeWindow = async () => {
    try {
      if (config) {
        setServers(config.servers);
        setRefreshInterval(config.settings.refresh_interval_seconds);
      }
      await hideWindow();
      onClose();
    } catch (err) {
      console.error('Failed to hide settings window:', err);
    }
  };

  const intervalOptions = [
    { value: 60, label: '1 Minute' },
    { value: 180, label: '3 Minutes' },
    { value: 300, label: '5 Minutes' },
    { value: 600, label: '10 Minutes' },
  ];

  const activeIntervalLabel =
    intervalOptions.find((opt) => opt.value === refreshInterval)?.label || `${refreshInterval} Seconds`;

  return (
    <div className="settings-panel-wrapper">
      <PanelHeader title="Settings" icon={<SettingsIcon className="icon-indigo" size={18} />} onClose={closeWindow} />

      <div className="settings-main">
        {/* Section 1: Server List */}
        <div className="settings-section flex-1 min-h-0">
          <div className="settings-section-top">
            <div className="flex-items-center-gap2">
              <ServerIcon size={14} className="icon-muted" />
              <span className="settings-section-subtitle">Connection Targets ({servers.length})</span>
            </div>
            <button
              type="button"
              onClick={handleOpenAddWindow}
              className="btn-primary !py-1 !px-2 text-xs font-bold gap-1 cursor-pointer flex items-center shadow-none bg-indigo-600 hover:bg-indigo-500"
              title="Add Target"
            >
              <Plus size={12} /> Add Target
            </button>
          </div>

          <ul className="settings-server-list">
            {servers.length === 0 ? (
              <div className="settings-empty">No connection targets registered</div>
            ) : (
              servers.map((s, i) => (
                <SettingsServerItem
                  key={s.label}
                  server={s}
                  index={i}
                  isDragging={draggedIndex === i}
                  testStatus={testStatus[s.label] || 'idle'}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
                  onTest={handleTest}
                  onEdit={handleOpenEditWindow}
                  onRemove={handleRemove}
                />
              ))
            )}
          </ul>
        </div>

        {/* Section 3: General Settings */}
        <div className="settings-section">
          <div className="settings-section-top">
            <div className="flex-items-center-gap2">
              <Sliders size={14} className="icon-muted" />
              <span className="settings-section-subtitle">Refresh Interval</span>
            </div>
          </div>
          <div className="settings-select-container">
            <button type="button" onClick={() => setIsIntervalOpen(!isIntervalOpen)} className="settings-select-btn">
              <span>{activeIntervalLabel}</span>
              <ChevronDown
                size={14}
                className={`icon-muted transition-transform ${isIntervalOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {isIntervalOpen && (
              <div className="settings-dropdown">
                {intervalOptions.map((opt) => (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => {
                      setRefreshInterval(opt.value);
                      setIsIntervalOpen(false);
                    }}
                    className={`settings-dropdown-item ${
                      refreshInterval === opt.value
                        ? 'settings-dropdown-item-active'
                        : 'settings-dropdown-item-inactive'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="panel-footer">
        <button type="button" onClick={closeWindow} className="btn-secondary">
          Cancel
        </button>
        <button type="button" onClick={handleSave} className="btn-primary">
          Save & Apply
        </button>
      </footer>
    </div>
  );
}

export default SettingsPanel;

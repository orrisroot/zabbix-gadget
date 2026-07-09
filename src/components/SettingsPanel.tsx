import { emit } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import {
  AlertCircle,
  Check,
  CheckCircle,
  ChevronDown,
  Edit2,
  Plus,
  RefreshCw,
  Server as ServerIcon,
  Settings as SettingsIcon,
  Sliders,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useZabbixStore } from '@/hooks/useZabbix';
import { loginServer, saveConfig } from '@/lib/zabbix-api';
import type { ServerConfig } from '@/types/config';

interface SettingsPanelProps {
  onClose: () => void;
}

function SettingsPanel({ onClose }: SettingsPanelProps) {
  const appWindow = getCurrentWebviewWindow();
  const { config } = useZabbixStore();
  const [servers, setServers] = useState<ServerConfig[]>(config?.servers ?? []);
  const [refreshInterval, setRefreshInterval] = useState<number>(config?.settings.refresh_interval_seconds ?? 300);
  const [isIntervalOpen, setIsIntervalOpen] = useState(false);

  // Form states
  const [formLabel, setFormLabel] = useState('');
  const [formHost, setFormHost] = useState('');
  const [formUser, setFormUser] = useState('');
  const [formPass, setFormPass] = useState('');
  const [formBasicAuthUser, setFormBasicAuthUser] = useState('');
  const [formBasicAuthPass, setFormBasicAuthPass] = useState('');
  const [useBasicAuth, setUseBasicAuth] = useState(false);

  const [editIndex, setEditIndex] = useState<number | null>(null);

  // Connection test statuses
  const [testStatus, setTestStatus] = useState<{
    [key: string]: 'idle' | 'loading' | 'ok' | 'error';
  }>({});
  const [formTestStatus, setFormTestStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null);

  // Reset form test status when inputs change
  useEffect(() => {
    setFormTestStatus('idle');
    setFormErrorMessage(null);
  }, [formLabel, formHost, formUser, formPass, formBasicAuthUser, formBasicAuthPass, useBasicAuth]);

  // Sync local states with config when it is loaded or updated in the store
  useEffect(() => {
    if (config) {
      setServers(config.servers);
      setRefreshInterval(config.settings.refresh_interval_seconds);
    }
  }, [config]);

  // Discard unsaved changes and reload config when the settings window gains focus
  useEffect(() => {
    const unlistenPromise = appWindow.onFocusChanged(({ payload: focused }) => {
      if (focused && config) {
        setServers(config.servers);
        setRefreshInterval(config.settings.refresh_interval_seconds);
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [config]);

  const resetForm = () => {
    setFormLabel('');
    setFormHost('');
    setFormUser('');
    setFormPass('');
    setFormBasicAuthUser('');
    setFormBasicAuthPass('');
    setUseBasicAuth(false);
    setEditIndex(null);
    setFormTestStatus('idle');
    setFormErrorMessage(null);
  };

  const handleEdit = (idx: number) => {
    const s = servers[idx];
    setFormLabel(s.label);
    setFormHost(s.host);
    setFormUser(s.user);
    setFormPass(s.pass);
    setFormBasicAuthUser(s.basic_auth_user ?? '');
    setFormBasicAuthPass(s.basic_auth_pass ?? '');
    setUseBasicAuth(!!s.basic_auth_user);
    setEditIndex(idx);
  };

  const handleAdd = () => {
    if (!formLabel.trim() || !formHost.trim()) return;
    const newServer: ServerConfig = {
      label: formLabel.trim(),
      host: formHost.trim(),
      user: formUser.trim(),
      pass: formPass.trim(),
      ...(useBasicAuth
        ? {
            basic_auth_user: formBasicAuthUser.trim(),
            basic_auth_pass: formBasicAuthPass.trim(),
          }
        : {}),
    };
    setServers([...servers, newServer]);
    resetForm();
  };

  const handleUpdate = () => {
    if (editIndex === null || !formLabel.trim() || !formHost.trim()) return;
    const updatedServers = [...servers];
    updatedServers[editIndex] = {
      label: formLabel.trim(),
      host: formHost.trim(),
      user: formUser.trim(),
      pass: formPass.trim(),
      ...(useBasicAuth
        ? {
            basic_auth_user: formBasicAuthUser.trim(),
            basic_auth_pass: formBasicAuthPass.trim(),
          }
        : {}),
    };
    setServers(updatedServers);
    resetForm();
  };

  const handleRemove = (idx: number) => {
    setServers(servers.filter((_, i) => i !== idx));
    if (editIndex === idx) {
      resetForm();
    } else if (editIndex !== null && editIndex > idx) {
      setEditIndex(editIndex - 1);
    }
  };

  const handleTest = async (server: ServerConfig) => {
    setTestStatus((prev) => ({ ...prev, [server.label]: 'loading' }));
    try {
      const ok = await loginServer(server);
      setTestStatus((prev) => ({
        ...prev,
        [server.label]: ok ? 'ok' : 'error',
      }));
    } catch {
      setTestStatus((prev) => ({ ...prev, [server.label]: 'error' }));
    }
  };

  const handleTestFormServer = async () => {
    if (!formHost.trim()) return;
    setFormTestStatus('loading');
    setFormErrorMessage(null);
    try {
      const serverToTest: ServerConfig = {
        label: formLabel.trim() || 'Test Connection',
        host: formHost.trim(),
        user: formUser.trim(),
        pass: formPass.trim(),
        ...(useBasicAuth
          ? {
              basic_auth_user: formBasicAuthUser.trim(),
              basic_auth_pass: formBasicAuthPass.trim(),
            }
          : {}),
      };
      const ok = await loginServer(serverToTest);
      if (ok) {
        setFormTestStatus('ok');
      } else {
        setFormTestStatus('error');
        setFormErrorMessage('Login failed: Invalid credentials or empty response');
      }
    } catch (err) {
      setFormTestStatus('error');
      setFormErrorMessage(err instanceof Error ? err.message : String(err));
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
      useZabbixStore.setState({ config: newConfig });
      await emit('config-updated', newConfig);
      onClose();
    } catch (err) {
      console.error('Failed to save config:', err);
    }
  };

  const handleMouseDown = async (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (
      (e.target as HTMLElement).closest('button') ||
      (e.target as HTMLElement).closest('input') ||
      (e.target as HTMLElement).closest('select')
    )
      return;
    e.preventDefault();
    try {
      await appWindow.startDragging();
    } catch (err) {
      console.error('Drag failed:', err);
    }
  };

  const intervalOptions = [
    { value: 60, label: '1 minute' },
    { value: 180, label: '3 minutes' },
    { value: 300, label: '5 minutes' },
    { value: 600, label: '10 minutes' },
    { value: 1800, label: '30 minutes' },
  ];

  const activeIntervalLabel =
    intervalOptions.find((o) => o.value === refreshInterval)?.label || `${refreshInterval / 60} minutes`;

  return (
    <div className="flex flex-col h-full w-full text-slate-850 dark:text-slate-100 bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header
        className="settings-header app-header font-bold bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between cursor-grab select-none shadow-sm flex-shrink-0"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2 text-base text-slate-700 dark:text-slate-200 animate-fade-in">
          <SettingsIcon size={18} className="text-indigo-450 dark:text-indigo-400" />
          <span className="font-extrabold text-slate-900 dark:text-slate-100">Settings</span>
        </div>
        <button
          onClick={onClose}
          className="settings-close-btn rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all cursor-pointer"
          title="Close"
        >
          <X size={18} />
        </button>
      </header>

      {/* Main Content Area */}
      <div className="settings-main flex-1 flex flex-col gap-2 bg-slate-50 dark:bg-slate-950 overflow-hidden">
        {/* Section 1: Server List */}
        <div className="flex flex-col gap-1 flex-1 min-h-0">
          <div className="flex items-center justify-between px-0.5 flex-shrink-0">
            <div className="flex items-center gap-2">
              <ServerIcon size={14} className="text-slate-400" />
              <span className="text-sm text-slate-800 dark:text-slate-200 font-bold tracking-wide">
                Connection Targets ({servers.length})
              </span>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-1 scrollbar-thin">
            {servers.length === 0 ? (
              <div className="settings-empty text-center bg-slate-100/50 dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-500 dark:text-slate-400 flex items-center justify-center h-full w-full">
                No connection targets registered
              </div>
            ) : (
              servers.map((s, i) => {
                const isEditingThis = editIndex === i;
                const status = testStatus[s.label] || 'idle';

                return (
                  <div
                    key={i}
                    className={`settings-server-item flex items-center justify-between rounded-lg border transition-all duration-200 ${
                      isEditingThis
                        ? 'bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-500/80 shadow-[0_0_8px_rgba(99,102,241,0.2)]'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700 hover:bg-slate-100/50 dark:hover:bg-slate-900/80'
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-slate-900 dark:text-white tracking-wide truncate">
                          {s.label}
                        </span>
                        {isEditingThis && (
                          <span className="settings-editing-badge text-sm bg-indigo-500/30 text-indigo-200 border border-indigo-500/40 rounded font-bold animate-pulse">
                            Editing
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-500 dark:text-slate-300 font-medium truncate mt-0.5 pl-0">
                        {s.host.replace(/^https?:\/\//, '')}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Connection Test Action */}
                      <button
                        onClick={() => handleTest(s)}
                        className={`settings-action-btn rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer ${
                          status === 'loading'
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : status === 'ok'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : status === 'error'
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-slate-500 dark:text-slate-400'
                        }`}
                        title="Test Connection"
                        disabled={status === 'loading'}
                      >
                        {status === 'loading' ? (
                          <RefreshCw size={15} className="animate-spin" />
                        ) : status === 'ok' ? (
                          <CheckCircle size={15} />
                        ) : status === 'error' ? (
                          <AlertCircle size={15} />
                        ) : (
                          <RefreshCw size={15} />
                        )}
                      </button>

                      {/* Load / Edit Action */}
                      <button
                        onClick={() => handleEdit(i)}
                        className={`settings-action-btn rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer ${
                          isEditingThis
                            ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                        title="Load into Form"
                      >
                        <Edit2 size={15} />
                      </button>

                      {/* Delete Action */}
                      <button
                        onClick={() => handleRemove(i)}
                        className="settings-action-btn rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-rose-650 dark:hover:text-rose-455 transition-colors cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Section 2: Form */}
        <div className="settings-form-container bg-slate-100/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg flex flex-col gap-2 shadow-inner">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <span className="text-sm text-indigo-600 dark:text-indigo-400 font-bold tracking-wide">
              {editIndex !== null ? 'Edit Connection' : 'Add Connection'}
            </span>
            {editIndex !== null && (
              <button
                onClick={resetForm}
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 flex items-center gap-1 cursor-pointer font-bold"
              >
                <Undo2 size={13} /> Cancel Edit
              </button>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            {/* Connection Label */}
            <input
              placeholder="Label"
              value={formLabel}
              onChange={(e) => setFormLabel(e.target.value)}
              className="settings-input w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700/80 rounded text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
            />
            {/* Host URL */}
            <input
              placeholder="Host (https://zabbix.example.com)"
              value={formHost}
              onChange={(e) => setFormHost(e.target.value)}
              className="settings-input w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700/80 rounded text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
            />
            {/* User & Password */}
            <div className="flex gap-2">
              <input
                placeholder="User"
                value={formUser}
                onChange={(e) => setFormUser(e.target.value)}
                className="settings-input flex-1 min-w-0 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700/80 rounded text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
              />
              <input
                placeholder="Password"
                type="password"
                value={formPass}
                onChange={(e) => setFormPass(e.target.value)}
                className="settings-input flex-1 min-w-0 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700/80 rounded text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
              />
            </div>
            {/* Basic Auth Checkbox */}
            <div className="flex items-center gap-2 px-1 py-0.5 mt-0.5">
              <input
                type="checkbox"
                id="use-basic-auth"
                checked={useBasicAuth}
                onChange={(e) => setUseBasicAuth(e.target.checked)}
                className="rounded border-slate-350 dark:border-slate-750 text-indigo-600 focus:ring-indigo-500 bg-white dark:bg-slate-950 h-3.5 w-3.5 cursor-pointer"
              />
              <label
                htmlFor="use-basic-auth"
                className="text-xs text-slate-600 dark:text-slate-400 font-semibold select-none cursor-pointer hover:text-slate-850 dark:hover:text-slate-200 transition-colors"
              >
                Use Basic Authentication
              </label>
            </div>
            {/* Basic Auth Credentials Fields */}
            {useBasicAuth && (
              <div className="flex gap-2 transition-all duration-300 ease-in-out">
                <input
                  placeholder="Basic Auth User"
                  value={formBasicAuthUser}
                  onChange={(e) => setFormBasicAuthUser(e.target.value)}
                  className="settings-input flex-1 min-w-0 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700/80 rounded text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                />
                <input
                  placeholder="Basic Auth Password"
                  type="password"
                  value={formBasicAuthPass}
                  onChange={(e) => setFormBasicAuthPass(e.target.value)}
                  className="settings-input flex-1 min-w-0 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700/80 rounded text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                />
              </div>
            )}
            {formErrorMessage && (
              <div className="text-xs text-rose-600 dark:text-rose-400 font-bold px-1 py-0.5 break-all">
                {formErrorMessage}
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-between items-center mt-0.5">
            {/* Form Connection Test */}
            <button
              onClick={handleTestFormServer}
              disabled={!formHost.trim()}
              className={`settings-btn-padding flex items-center gap-1.5 text-sm rounded font-bold transition-all duration-200 ${
                !formHost.trim()
                  ? 'opacity-40 cursor-not-allowed bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                  : formTestStatus === 'loading'
                    ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-250 dark:border-indigo-500/30'
                    : formTestStatus === 'ok'
                      ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-250 dark:border-emerald-500/30'
                      : formTestStatus === 'error'
                        ? 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-250 dark:border-rose-500/30'
                        : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 cursor-pointer hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {formTestStatus === 'loading' ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> Testing...
                </>
              ) : formTestStatus === 'ok' ? (
                <>
                  <CheckCircle size={14} /> Connection OK
                </>
              ) : formTestStatus === 'error' ? (
                <>
                  <AlertCircle size={14} /> Failed
                </>
              ) : (
                <>
                  <RefreshCw size={14} /> Test Connection
                </>
              )}
            </button>

            {/* Action Buttons */}
            {editIndex !== null ? (
              <button
                onClick={handleUpdate}
                disabled={!formLabel.trim() || !formHost.trim()}
                className="settings-btn-padding flex items-center gap-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded cursor-pointer disabled:opacity-50 font-bold transition-all shadow-md shadow-indigo-600/10 active:scale-[0.98]"
              >
                <Check size={14} /> Update
              </button>
            ) : (
              <button
                onClick={handleAdd}
                disabled={!formLabel.trim() || !formHost.trim()}
                className="settings-btn-padding flex items-center gap-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded cursor-pointer disabled:opacity-50 font-bold transition-all shadow-md shadow-indigo-600/10 active:scale-[0.98]"
              >
                <Plus size={14} /> Add Target
              </button>
            )}
          </div>
        </div>

        {/* Section 3: General Settings */}
        <div className="settings-row flex items-center justify-between bg-slate-100/30 dark:bg-slate-900/20 border border-slate-200 dark:border-slate-900 rounded-lg flex-shrink-0 relative">
          <div className="flex items-center gap-2">
            <Sliders size={14} className="text-slate-400" />
            <span className="text-sm text-slate-800 dark:text-slate-200 font-bold tracking-wide">Refresh Interval</span>
          </div>
          <div className="relative">
            <button
              onClick={() => setIsIntervalOpen(!isIntervalOpen)}
              className="settings-select-btn bg-white dark:bg-slate-900 border border-slate-350 dark:border-slate-700 rounded-md text-sm text-slate-800 dark:text-slate-100 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer flex items-center gap-2 min-w-[120px] justify-between"
            >
              <span>{activeIntervalLabel}</span>
              <ChevronDown
                size={14}
                className={`text-slate-400 transition-transform ${isIntervalOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {isIntervalOpen && (
              <div className="settings-dropdown absolute right-0 bottom-full mb-1.5 z-50 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md shadow-xl min-w-[125px] overflow-hidden">
                {intervalOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setRefreshInterval(opt.value);
                      setIsIntervalOpen(false);
                    }}
                    className={`settings-btn-padding w-full text-left text-sm transition-all cursor-pointer block ${
                      refreshInterval === opt.value
                        ? 'bg-indigo-600 text-white font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Save & Apply Button */}
        <button
          onClick={handleSave}
          className="settings-save-btn w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded text-sm font-bold cursor-pointer transition-all duration-200 shadow-lg shadow-indigo-500/15 active:scale-[0.98] border border-indigo-500/30 flex-shrink-0"
        >
          Save & Apply Settings
        </button>
      </div>
    </div>
  );
}

export default SettingsPanel;

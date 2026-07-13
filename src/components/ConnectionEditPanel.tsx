import { emit, listen } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { AlertCircle, Check, CheckCircle, Plus, RefreshCw, Server, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { loginServer } from '@/lib/zabbix-api';
import type { ServerConfig } from '@/types/config';

function ConnectionEditPanel() {
  const appWindow = getCurrentWebviewWindow();

  // Index and Form states
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [formLabel, setFormLabel] = useState('');
  const [formHost, setFormHost] = useState('');
  const [formUser, setFormUser] = useState('');
  const [formPass, setFormPass] = useState('');
  const [formApiKey, setFormApiKey] = useState('');
  const [authType, setAuthType] = useState<'userpass' | 'apikey'>('apikey');
  const [formBasicAuthUser, setFormBasicAuthUser] = useState('');
  const [formBasicAuthPass, setFormBasicAuthPass] = useState('');
  const [useBasicAuth, setUseBasicAuth] = useState(false);

  const [formTestStatus, setFormTestStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null);

  // Listen to init events to populate fields dynamically
  useEffect(() => {
    const listenPromise = listen<{ editIndex: number | null; server: ServerConfig | null }>(
      'connection-edit-init',
      (event) => {
        const { editIndex, server } = event.payload;
        setEditIndex(editIndex);
        setFormLabel(server?.label ?? '');
        setFormHost(server?.host ?? '');
        setFormUser(server?.user ?? '');
        setFormPass(server?.pass ?? '');
        setFormApiKey(server?.api_key ?? '');
        setAuthType(server?.api_key ? 'apikey' : 'userpass');
        setFormBasicAuthUser(server?.basic_auth_user ?? '');
        setFormBasicAuthPass(server?.basic_auth_pass ?? '');
        setUseBasicAuth(!!server?.basic_auth_user);
        setFormTestStatus('idle');
        setFormErrorMessage(null);
      },
    );

    return () => {
      listenPromise.then((unlisten) => unlisten());
    };
  }, []);

  // Reset form test status when inputs change
  useEffect(() => {
    // Intentionally reference input values to trigger status reset when any change
    if (
      formLabel ||
      formHost ||
      formUser ||
      formPass ||
      formApiKey ||
      authType ||
      formBasicAuthUser ||
      formBasicAuthPass ||
      useBasicAuth
    ) {
      // Input changed
    }
    setFormTestStatus('idle');
    setFormErrorMessage(null);
  }, [
    formLabel,
    formHost,
    formUser,
    formPass,
    formApiKey,
    authType,
    formBasicAuthUser,
    formBasicAuthPass,
    useBasicAuth,
  ]);

  const handleMouseDown = async (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return;
    e.preventDefault();
    try {
      await appWindow.startDragging();
    } catch (err) {
      console.error('Drag failed:', err);
    }
  };

  const handleClose = async () => {
    try {
      await appWindow.hide();
    } catch (err) {
      console.error('Failed to hide window:', err);
    }
  };

  const handleTestFormServer = async () => {
    if (!formHost.trim()) return;
    setFormTestStatus('loading');
    setFormErrorMessage(null);

    const checkServer: ServerConfig = {
      label: formLabel.trim() || 'Test Connection',
      host: formHost.trim(),
      user: authType === 'userpass' ? formUser.trim() : '',
      pass: authType === 'userpass' ? formPass.trim() : '',
      ...(authType === 'apikey' ? { api_key: formApiKey.trim() } : {}),
      ...(useBasicAuth
        ? {
            basic_auth_user: formBasicAuthUser.trim(),
            basic_auth_pass: formBasicAuthPass.trim(),
          }
        : {}),
    };

    try {
      const result = await loginServer(checkServer);
      if (result) {
        setFormTestStatus('ok');
      } else {
        setFormTestStatus('error');
        setFormErrorMessage('Connection failed.');
      }
    } catch (err) {
      setFormTestStatus('error');
      setFormErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSave = async () => {
    if (!formLabel.trim() || !formHost.trim()) return;
    const server: ServerConfig = {
      label: formLabel.trim(),
      host: formHost.trim(),
      user: authType === 'userpass' ? formUser.trim() : '',
      pass: authType === 'userpass' ? formPass.trim() : '',
      ...(authType === 'apikey' ? { api_key: formApiKey.trim() } : {}),
      ...(useBasicAuth
        ? {
            basic_auth_user: formBasicAuthUser.trim(),
            basic_auth_pass: formBasicAuthPass.trim(),
          }
        : {}),
    };

    try {
      await emit('server-saved', { server, editIndex });
      await appWindow.hide();
    } catch (err) {
      console.error('Failed to save connection:', err);
    }
  };

  return (
    <div className="settings-panel-wrapper">
      <header role="toolbar" className="panel-header settings-header" onMouseDown={handleMouseDown}>
        <div className="panel-header-title-container">
          <Server size={18} className="icon-indigo" />
          <span className="panel-header-title">{editIndex !== null ? 'Edit Connection' : 'Add Connection'}</span>
        </div>
        <button type="button" onClick={handleClose} className="settings-close-btn" title="Close">
          <X size={16} />
        </button>
      </header>

      <main className="panel-content flex flex-col gap-3">
        {/* Connection Label */}
        <div className="flex flex-col gap-1">
          <span className="text-xxs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Label</span>
          <input
            placeholder="Label"
            value={formLabel}
            onChange={(e) => setFormLabel(e.target.value)}
            className="settings-input"
          />
        </div>

        {/* Host URL */}
        <div className="flex flex-col gap-1">
          <span className="text-xxs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Host URL
          </span>
          <input
            placeholder="https://zabbix.example.com"
            value={formHost}
            onChange={(e) => setFormHost(e.target.value)}
            className="settings-input"
          />
        </div>

        {/* Authentication Type Switch */}
        <div className="flex flex-col gap-1">
          <span className="text-xxs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Auth Type
          </span>
          <div className="settings-auth-tabs">
            <button
              type="button"
              onClick={() => setAuthType('apikey')}
              className={`settings-auth-tab ${
                authType === 'apikey' ? 'settings-auth-tab-active' : 'settings-auth-tab-inactive'
              }`}
            >
              API Key
            </button>
            <button
              type="button"
              onClick={() => setAuthType('userpass')}
              className={`settings-auth-tab ${
                authType === 'userpass' ? 'settings-auth-tab-active' : 'settings-auth-tab-inactive'
              }`}
            >
              User / Password
            </button>
          </div>
        </div>

        {/* User & Password or API Key Input */}
        {authType === 'userpass' ? (
          <div className="flex gap-2">
            <div className="flex-1 flex flex-col gap-1">
              <span className="text-xxs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                User
              </span>
              <input
                placeholder="User"
                value={formUser}
                onChange={(e) => setFormUser(e.target.value)}
                className="settings-input"
              />
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <span className="text-xxs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Password
              </span>
              <input
                placeholder="Password"
                type="password"
                value={formPass}
                onChange={(e) => setFormPass(e.target.value)}
                className="settings-input"
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <span className="text-xxs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              API Key
            </span>
            <input
              placeholder="API Key"
              type="password"
              value={formApiKey}
              onChange={(e) => setFormApiKey(e.target.value)}
              className="settings-input"
            />
          </div>
        )}

        {/* Basic Auth Checkbox */}
        <div className="settings-checkbox-container">
          <input
            type="checkbox"
            id="use-basic-auth"
            checked={useBasicAuth}
            onChange={(e) => setUseBasicAuth(e.target.checked)}
            className="settings-checkbox"
          />
          <label htmlFor="use-basic-auth" className="settings-checkbox-label">
            Use Basic Authentication
          </label>
        </div>

        {/* Basic Auth Credentials Fields */}
        {useBasicAuth && (
          <div className="settings-basic-auth-fields">
            <div className="flex-1 flex flex-col gap-1">
              <span className="text-xxs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Basic User
              </span>
              <input
                placeholder="User"
                value={formBasicAuthUser}
                onChange={(e) => setFormBasicAuthUser(e.target.value)}
                className="settings-input"
              />
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <span className="text-xxs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Basic Password
              </span>
              <input
                placeholder="Password"
                type="password"
                value={formBasicAuthPass}
                onChange={(e) => setFormBasicAuthPass(e.target.value)}
                className="settings-input"
              />
            </div>
          </div>
        )}

        {formErrorMessage && <div className="settings-form-error">{formErrorMessage}</div>}
      </main>

      <footer className="panel-footer">
        <button
          type="button"
          onClick={handleTestFormServer}
          disabled={!formHost.trim()}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold rounded-md transition-all cursor-pointer border select-none ${
            !formHost.trim()
              ? 'opacity-40 cursor-not-allowed bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-transparent'
              : formTestStatus === 'loading'
                ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30'
                : formTestStatus === 'ok'
                  ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                  : formTestStatus === 'error'
                    ? 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-300 dark:border-slate-700'
          }`}
        >
          {formTestStatus === 'loading' ? (
            <>
              <RefreshCw size={14} className="icon-spin" /> Testing...
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
              <RefreshCw size={14} /> Test
            </>
          )}
        </button>

        <div className="flex gap-2">
          <button type="button" onClick={handleClose} className="btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!formLabel.trim() || !formHost.trim()}
            className="btn-primary"
          >
            {editIndex !== null ? (
              <>
                <Check size={14} /> Update
              </>
            ) : (
              <>
                <Plus size={14} /> Add
              </>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}

export default ConnectionEditPanel;

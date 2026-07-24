import { emit, listen } from '@tauri-apps/api/event';
import { AlertCircle, Check, CheckCircle, Plus, RefreshCw, Server } from 'lucide-react';
import { useEffect, useState } from 'react';
import PanelHeader from '@/components/PanelHeader';
import { useTauriWindow } from '@/hooks/useTauriWindow';
import { loginServer } from '@/lib/zabbix-api';
import type { ServerConfig } from '@/types/config';

export function ConnectionEditPanel() {
  const { hideWindow } = useTauriWindow();

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

  const hostTrimmed = formHost.trim();
  const isHostUrlValid =
    !hostTrimmed ||
    (() => {
      try {
        const parsed = new URL(hostTrimmed);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch (_) {
        return false;
      }
    })();

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
    // Reference inputs to run this effect when any of them change
    const _ = {
      formLabel,
      formHost,
      formUser,
      formPass,
      formApiKey,
      authType,
      formBasicAuthUser,
      formBasicAuthPass,
      useBasicAuth,
    };
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

  const handleClose = async () => {
    try {
      await hideWindow();
    } catch (err) {
      console.error('Failed to hide window:', err);
    }
  };

  const handleTestFormServer = async () => {
    if (!formHost.trim() || !isHostUrlValid) return;
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
    if (!formLabel.trim() || !formHost.trim() || !isHostUrlValid) return;
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
      await hideWindow();
    } catch (err) {
      console.error('Failed to save connection:', err);
    }
  };

  return (
    <div className="settings-panel-wrapper">
      <PanelHeader
        title={editIndex !== null ? 'Edit Connection' : 'Add Connection'}
        icon={<Server size={18} className="icon-indigo" />}
        onClose={handleClose}
      />

      <main className="settings-form-content">
        {/* Connection Label */}
        <div className="settings-form-group">
          <span className="settings-form-label">Label</span>
          <input
            placeholder="Label"
            value={formLabel}
            onChange={(e) => setFormLabel(e.target.value)}
            className="settings-input"
          />
        </div>

        {/* Host URL */}
        <div className="settings-form-group">
          <span className="settings-form-label">Host URL</span>
          <div className="relative group">
            <input
              placeholder="https://zabbix.example.com"
              value={formHost}
              onChange={(e) => setFormHost(e.target.value)}
              className={`settings-input ${!isHostUrlValid ? 'settings-input-error' : ''}`}
            />
            {!isHostUrlValid && (
              <div className="settings-tooltip">
                URL must start with http:// or https://
                <div className="settings-tooltip-arrow" />
              </div>
            )}
          </div>
        </div>

        {/* Authentication Type Switch */}
        <div className="settings-form-group">
          <span className="settings-form-label">Auth Type</span>
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
          <div className="settings-form-row">
            <div className="settings-form-group-flex">
              <span className="settings-form-label">User</span>
              <input
                placeholder="User"
                value={formUser}
                onChange={(e) => setFormUser(e.target.value)}
                className="settings-input"
              />
            </div>
            <div className="settings-form-group-flex">
              <span className="settings-form-label">Password</span>
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
          <div className="settings-form-group">
            <span className="settings-form-label">API Key</span>
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
            <div className="settings-form-group-flex">
              <span className="settings-form-label">Basic User</span>
              <input
                placeholder="User"
                value={formBasicAuthUser}
                onChange={(e) => setFormBasicAuthUser(e.target.value)}
                className="settings-input"
              />
            </div>
            <div className="settings-form-group-flex">
              <span className="settings-form-label">Basic Password</span>
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
        <button type="button" onClick={handleClose} className="btn-secondary">
          Cancel
        </button>

        <div className="settings-form-row">
          <button
            type="button"
            onClick={handleTestFormServer}
            disabled={!formHost.trim() || !isHostUrlValid}
            className={`settings-btn-test ${
              !formHost.trim() || !isHostUrlValid
                ? 'settings-btn-test-disabled'
                : formTestStatus === 'loading'
                  ? 'settings-btn-test-loading'
                  : formTestStatus === 'ok'
                    ? 'settings-btn-test-ok'
                    : formTestStatus === 'error'
                      ? 'settings-btn-test-error'
                      : 'settings-btn-test-idle'
            }`}
          >
            {formTestStatus === 'loading' ? (
              <>
                <RefreshCw size={14} className="icon-spin" /> Testing...
              </>
            ) : formTestStatus === 'ok' ? (
              <>
                <CheckCircle size={14} /> Success
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
          <button
            type="button"
            onClick={handleSave}
            disabled={!formLabel.trim() || !formHost.trim() || !isHostUrlValid || formTestStatus !== 'ok'}
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

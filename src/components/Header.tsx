import { invoke } from '@tauri-apps/api/core';
import { Activity, Moon, RefreshCw, Settings, Sun, X } from 'lucide-react';
import { useTauriWindow } from '@/hooks/useTauriWindow';
import { useZabbixStore } from '@/hooks/useZabbix';

interface HeaderProps {
  loading: boolean;
  onSettingsClick: () => void;
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
}

function Header({ loading, onSettingsClick, theme, onThemeToggle }: HeaderProps) {
  const { refreshAll } = useZabbixStore();
  const { handleMouseDown, closeWindow } = useTauriWindow();

  const handleClose = async () => {
    try {
      await invoke('close_app');
    } catch (err) {
      console.error('Failed to close app:', err);
      closeWindow();
    }
  };

  return (
    <header role="toolbar" className="app-header w-full" onMouseDown={handleMouseDown}>
      <div className="header-title-container">
        <Activity size={13} className="header-icon-activity" />
        <span className="header-title">System Status</span>
      </div>
      <div className="header-actions-container">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onThemeToggle();
          }}
          className="btn-icon"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSettingsClick();
          }}
          className="btn-icon"
          title="Settings"
        >
          <Settings size={13} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            refreshAll();
          }}
          disabled={loading}
          className="btn-icon"
          title="Refresh"
        >
          <RefreshCw size={13} className={loading ? 'icon-spin' : ''} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleClose();
          }}
          className="btn-danger"
          title="Close"
        >
          <X size={13} />
        </button>
      </div>
    </header>
  );
}

export default Header;

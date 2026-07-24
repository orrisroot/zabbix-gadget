import { invoke } from '@tauri-apps/api/core';
import { Activity, Info, Monitor, Moon, RefreshCw, Settings, Sun, X } from 'lucide-react';
import { useTauriWindow } from '@/hooks/useTauriWindow';
import { useZabbixStore } from '@/hooks/useZabbix';

interface HeaderProps {
  loading: boolean;
  onSettingsClick: () => void;
  onAboutClick?: () => void;
  theme: 'dark' | 'light' | 'system';
  onThemeToggle: () => void;
}

export function Header({ loading, onSettingsClick, onAboutClick, theme, onThemeToggle }: HeaderProps) {
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

  const getThemeInfo = () => {
    if (theme === 'system') {
      return {
        icon: <Monitor size={13} />,
        title: 'Theme: System (Switch to Dark Mode)',
      };
    }
    if (theme === 'dark') {
      return {
        icon: <Moon size={13} />,
        title: 'Theme: Dark (Switch to Light Mode)',
      };
    }
    return {
      icon: <Sun size={13} />,
      title: 'Theme: Light (Switch to System Mode)',
    };
  };

  const themeInfo = getThemeInfo();

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
          title={themeInfo.title}
        >
          {themeInfo.icon}
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
        {onAboutClick && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAboutClick();
            }}
            className="btn-icon"
            title="About"
          >
            <Info size={13} />
          </button>
        )}
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

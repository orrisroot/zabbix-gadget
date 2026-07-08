import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { Activity, Moon, RefreshCw, Settings, Sun, X } from 'lucide-react';
import { useZabbixStore } from '@/hooks/useZabbix';

interface HeaderProps {
  loading: boolean;
  onSettingsClick: () => void;
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
}

function Header({ loading, onSettingsClick, theme, onThemeToggle }: HeaderProps) {
  const { refreshAll } = useZabbixStore();
  const appWindow = getCurrentWebviewWindow();

  const handleMouseDown = async (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    // Do not drag on buttons
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    try {
      await appWindow.startDragging();
    } catch (err) {
      console.error('Drag failed:', err);
    }
  };

  const handleClose = async () => {
    try {
      await invoke('close_app');
    } catch (err) {
      console.error('Failed to close app:', err);
      appWindow.close();
    }
  };

  return (
    <header
      className="app-header w-full font-bold flex items-center justify-between cursor-grab select-none"
      onMouseDown={handleMouseDown}
    >
      <div className="flex items-center gap-2">
        <Activity size={13} className="text-orange-500" />
        <span className="text-xs font-bold text-gray-600 dark:text-gray-300 tracking-wider uppercase">
          System Status
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onThemeToggle();
          }}
          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSettingsClick();
          }}
          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
          title="Settings"
        >
          <Settings size={13} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            refreshAll();
          }}
          disabled={loading}
          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
          title="Refresh"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleClose();
          }}
          className="p-1.5 rounded hover:bg-red-600 hover:text-white text-gray-550 dark:text-gray-400 transition-colors cursor-pointer"
          title="Close"
        >
          <X size={13} />
        </button>
      </div>
    </header>
  );
}

export default Header;

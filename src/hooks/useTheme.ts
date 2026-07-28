import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { useEffect } from 'react';
import type { AppSettings } from '@/types/config';

/**
 * Custom hook to apply the application theme to the DOM and Tauri window.
 *
 * @param theme - The theme setting ('dark', 'light', or 'system')
 */
export function useTheme(theme: AppSettings['theme'] = 'system') {
  useEffect(() => {
    const applyTheme = () => {
      const isDark =
        theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

      if (isDark) {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
        document.body.classList.add('dark');
        document.body.classList.remove('light');
      } else {
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
        document.body.classList.add('light');
        document.body.classList.remove('dark');
      }

      try {
        const appWin = getCurrentWebviewWindow();
        if (appWin && typeof appWin.setTheme === 'function') {
          const tauriTheme = theme === 'system' ? null : theme;
          appWin.setTheme(tauriTheme).catch((err) => {
            console.warn('Failed to set Tauri window theme:', err);
          });
        }
      } catch (err) {
        console.error('Failed to get app window for theme updates:', err);
      }
    };

    applyTheme();

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme();
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);
}

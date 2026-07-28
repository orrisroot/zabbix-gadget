import { invoke } from '@tauri-apps/api/core';
import { Menu } from '@tauri-apps/api/menu';
import { useEffect } from 'react';

export function useSecondaryContextMenu(enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleContextMenu = async (e: MouseEvent) => {
      e.preventDefault();
      if (!import.meta.env.DEV) return;

      try {
        const menu = await Menu.new({
          items: [
            {
              text: 'Inspect Element',
              action: async () => {
                try {
                  await invoke('open_devtools');
                } catch (err) {
                  console.error('Failed to open devtools:', err);
                }
              },
            },
          ],
        });
        await menu.popup();
      } catch (err) {
        console.error('Failed to show context menu:', err);
      }
    };

    window.addEventListener('contextmenu', handleContextMenu);
    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [enabled]);
}

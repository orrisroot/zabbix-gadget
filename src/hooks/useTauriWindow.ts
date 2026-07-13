import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import type React from 'react';

export function useTauriWindow() {
  const appWindow = getCurrentWebviewWindow();

  const handleMouseDown = async (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    // Prevent dragging when clicking interactive elements
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('select') ||
      target.closest('textarea') ||
      target.closest('a')
    ) {
      return;
    }
    e.preventDefault();
    try {
      await appWindow.startDragging();
    } catch (err) {
      console.error('Drag failed:', err);
    }
  };

  const hideWindow = async () => {
    try {
      await appWindow.hide();
    } catch (err) {
      console.error('Failed to hide window:', err);
    }
  };

  const closeWindow = async () => {
    try {
      await appWindow.close();
    } catch (err) {
      console.error('Failed to close window:', err);
    }
  };

  return {
    appWindow,
    handleMouseDown,
    hideWindow,
    closeWindow,
  };
}

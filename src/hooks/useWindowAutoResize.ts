import { LogicalSize } from '@tauri-apps/api/dpi';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { useEffect } from 'react';
import type { ServerStatus } from '@/hooks/useZabbix';
import type { ServerConfig } from '@/types/config';

interface UseWindowAutoResizeOptions {
  enabled: boolean;
  servers?: ServerConfig[];
  serverStatuses?: Map<string, ServerStatus> | Record<string, unknown>;
}

export function useWindowAutoResize({ enabled, servers, serverStatuses }: UseWindowAutoResizeOptions) {
  useEffect(() => {
    if (!enabled) return;

    // Reference parameters so that effect dependency tracking triggers resize on update
    const _triggerResize = { servers, serverStatuses };

    const updateWindowHeight = async () => {
      // Small timeout to allow DOM to render and stabilize
      await new Promise((resolve) => setTimeout(resolve, 150));

      const headerEl = document.querySelector('.app-header');
      const mainContentEl = document.querySelector('.app-main table') || document.querySelector('.app-main > div');
      const footerEl = document.querySelector('.app-footer');

      if (headerEl && mainContentEl) {
        const headerHeight = headerEl.getBoundingClientRect().height;
        const mainHeight = mainContentEl.getBoundingClientRect().height;
        const footerHeight = footerEl ? footerEl.getBoundingClientRect().height : 0;

        // Sum elements + main paddings (2px top, 2px bottom) + container border (2px) + 1px safety buffer to prevent OS border discrepancies
        const totalHeight = Math.ceil(headerHeight + mainHeight + footerHeight + 4 + 2 + 1);

        // Cap the window height between 70px min and 550px max to prevent shrinking
        const targetHeight = Math.max(Math.min(totalHeight, 550), 70);

        try {
          console.log('headerHeight', headerHeight);
          console.log('mainHeight', mainHeight);
          console.log('footerHeight', footerHeight);
          console.log('totalHeight', totalHeight, 'targetHeight', targetHeight);
          const appWindow = getCurrentWebviewWindow();
          const logicalSize = new LogicalSize(600, targetHeight);
          await appWindow.setSize(logicalSize);
          await appWindow.setMaxSize(logicalSize);
          await appWindow.setMinSize(logicalSize);
        } catch (err) {
          console.error('useWindowAutoResize: failed to resize window:', err);
        }
      } else {
        console.warn('useWindowAutoResize: header element not found, skipping resize');
      }
    };

    updateWindowHeight();
  }, [enabled, servers, serverStatuses]);
}

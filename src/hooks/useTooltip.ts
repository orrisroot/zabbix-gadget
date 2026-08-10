import { LogicalPosition } from '@tauri-apps/api/dpi';
import { emit } from '@tauri-apps/api/event';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { type MouseEvent, useCallback, useEffect, useRef } from 'react';
import type { ZabbixTrigger } from '@/types/zabbix';

export interface UseTooltipParams {
  priorityLabel: string;
  serverLabel: string;
  count: number;
  colorClass: string;
  bgColor: string;
  details: ZabbixTrigger[];
}

// Shared monotonic counter across all tooltip hook instances.
// Each hovered cell claims a token so a stale cell can detect that the
// cursor has moved to another cell before emitting a hide request.
let lastActiveToken = 0;

/**
 * Custom hook to manage tooltip window positioning, IPC updates, and hover timers.
 */
export function useTooltip({ priorityLabel, serverLabel, count, colorClass, bgColor, details }: UseTooltipParams) {
  const rafIdRef = useRef<number | null>(null);
  const windowRef = useRef<WebviewWindow | null>(null);
  const tokenRef = useRef<number>(0);

  const getTooltipWindow = useCallback(async () => {
    if (!windowRef.current) {
      windowRef.current = await WebviewWindow.getByLabel('tooltip');
    }
    return windowRef.current;
  }, []);

  const updatePosition = useCallback(
    (clientX: number, clientY: number) => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }

      rafIdRef.current = requestAnimationFrame(async () => {
        try {
          const tooltipWin = await getTooltipWindow();
          if (!tooltipWin) return;

          const mouseLogicalX = window.screenX + clientX;
          const mouseLogicalY = window.screenY + clientY;

          // Position offset 30px to the bottom-right of the cursor to prevent overlap
          let x = mouseLogicalX + 30;
          const y = mouseLogicalY + 30;

          if (x < 10) {
            x = 10;
          }

          await tooltipWin.setPosition(new LogicalPosition(x, y));
        } catch (err) {
          console.error('Failed to update tooltip position:', err);
        } finally {
          rafIdRef.current = null;
        }
      });
    },
    [getTooltipWindow],
  );

  const showTooltip = useCallback(
    async (e: MouseEvent, forceUpdateContent = false) => {
      try {
        const tooltipWin = await getTooltipWindow();
        if (!tooltipWin) return;

        updatePosition(e.clientX, e.clientY);

        const isVisible = await tooltipWin.isVisible();
        if (forceUpdateContent || !isVisible) {
          await emit('update-tooltip', {
            token: tokenRef.current,
            label: priorityLabel,
            serverLabel,
            count,
            priorityLabel,
            colorClass,
            bgColor,
            details,
          });
        }

        if (!isVisible) {
          await tooltipWin.show();
          updatePosition(e.clientX, e.clientY);
        }
      } catch (err) {
        console.error('Failed to show tooltip window:', err);
      }
    },
    [priorityLabel, serverLabel, count, colorClass, bgColor, details, updatePosition, getTooltipWindow],
  );

  const handleMouseEnter = useCallback(
    async (e: MouseEvent) => {
      if (count === 0) return;
      // Claim a fresh token so any earlier hide request can be invalidated.
      tokenRef.current = ++lastActiveToken;
      await emit('cancel-hide-tooltip', { token: tokenRef.current });
      await showTooltip(e, true);
    },
    [count, showTooltip],
  );

  const handleMouseMove = useCallback(
    async (e: MouseEvent) => {
      if (count === 0) return;
      // Refresh the token so this cell remains the active hover target.
      tokenRef.current = ++lastActiveToken;
      await emit('cancel-hide-tooltip', { token: tokenRef.current });
      await showTooltip(e, false);
    },
    [count, showTooltip],
  );

  const handleMouseLeave = useCallback(async () => {
    if (count === 0) return;
    // Carry the cell token so the panel can discard this hide request if a
    // newer cell has already claimed the tooltip.
    await emit('request-hide-tooltip', { token: tokenRef.current });
  }, [count]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  return {
    handleMouseEnter,
    handleMouseMove,
    handleMouseLeave,
  };
}

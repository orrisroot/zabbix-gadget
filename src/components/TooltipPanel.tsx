import { listen } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollArea } from '@/components/ScrollArea';
import type { ZabbixTrigger } from '@/types/zabbix';

interface TooltipData {
  token: number;
  label: string;
  serverLabel: string;
  count: number;
  priorityLabel: string;
  colorClass: string;
  bgColor: string;
  details: ZabbixTrigger[];
}

export function TooltipPanel() {
  const [data, setData] = useState<TooltipData | null>(null);
  const hideTimeoutRef = useRef<number | null>(null);
  // Tracks the most recent tooltip activation so stale hide requests
  // emitted from previously hovered cells can be discarded.
  const latestTokenRef = useRef<number>(0);

  const clearHideTimeout = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(
    (delay = 200) => {
      clearHideTimeout();
      hideTimeoutRef.current = window.setTimeout(async () => {
        try {
          const appWin = getCurrentWebviewWindow();
          await appWin.hide();
          setData(null); // Clear data to unmount pulse animations
        } catch (err) {
          console.error('Failed to hide tooltip window:', err);
        }
      }, delay);
    },
    [clearHideTimeout],
  );

  useEffect(() => {
    // Listen for updating the tooltip content; marks this activation as latest
    const unlistenUpdate = listen<TooltipData>('update-tooltip', (event) => {
      latestTokenRef.current = Math.max(latestTokenRef.current, event.payload.token);
      clearHideTimeout();
      setData(event.payload);
    });

    // Listen for host activation events (entering/moving over a cell)
    const unlistenCancelHide = listen<{ token: number }>('cancel-hide-tooltip', (event) => {
      latestTokenRef.current = Math.max(latestTokenRef.current, event.payload.token);
      clearHideTimeout();
    });

    // Listen for host mouseleave requests; ignore stale ones from prior cells
    const unlistenRequestHide = listen<{ token: number }>('request-hide-tooltip', (event) => {
      if (event.payload.token < latestTokenRef.current) return;
      scheduleHide(400); // 400ms buffer to allow cursor to travel from cell to tooltip window
    });

    return () => {
      unlistenUpdate.then((unlisten) => unlisten());
      unlistenCancelHide.then((unlisten) => unlisten());
      unlistenRequestHide.then((unlisten) => unlisten());
      clearHideTimeout();
    };
  }, [clearHideTimeout, scheduleHide]);

  const handleMouseEnter = () => {
    // Keep showing tooltip when mouse enters the tooltip window
    clearHideTimeout();
  };

  const handleMouseLeave = () => {
    // Hide tooltip shortly after mouse leaves the tooltip window
    scheduleHide(400);
  };

  if (!data) {
    return null;
  }

  const getBubbleClass = (priority: string) => {
    switch (priority) {
      case '0':
        return 'tooltip-bubble-not-classified';
      case '1':
        return 'tooltip-bubble-info';
      case '2':
        return 'tooltip-bubble-warning';
      case '3':
        return 'tooltip-bubble-average';
      case '4':
        return 'tooltip-bubble-high';
      case '5':
        return 'tooltip-bubble-disaster';
      default:
        return 'tooltip-bubble-default';
    }
  };

  const statusBgColor = getBubbleClass(data.details[0]?.priority);

  return (
    <div
      role="tooltip"
      className="window-base tooltip-window-inner"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="tooltip-header">
        <div className="tooltip-header-left">
          <span className={`tooltip-status-bubble ${statusBgColor}`} />
          <span className="tooltip-priority-label">{data.priorityLabel}</span>
        </div>
        <span className="tooltip-badge">{data.count} Triggers</span>
      </div>

      <ScrollArea className="tooltip-list">
        {data.details.map((t, i) => {
          const changeTime = t.lastchange ? new Date(parseInt(t.lastchange, 10) * 1000).toLocaleString() : 'Unknown';

          return (
            <div key={t.triggerid || i} className="tooltip-item">
              <div className="tooltip-title">{t.description}</div>
              <div className="tooltip-meta">
                {t.hostname && (
                  <div>
                    <span className="tooltip-meta-label">Host:</span> {t.hostname}
                  </div>
                )}
                <div>
                  <span className="tooltip-meta-label">Time:</span> {changeTime}
                </div>
              </div>
            </div>
          );
        })}
      </ScrollArea>

      <div className="tooltip-footer">
        <span className="tooltip-footer-label">Server:</span>
        <span className="tooltip-footer-server">{data.serverLabel}</span>
      </div>
    </div>
  );
}

export default TooltipPanel;

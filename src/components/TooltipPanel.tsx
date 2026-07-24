import { listen } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ZabbixTrigger } from '@/types/zabbix';

interface TooltipData {
  label: string;
  serverLabel: string;
  count: number;
  priorityLabel: string;
  colorClass: string;
  bgColor: string;
  details: ZabbixTrigger[];
}

function TooltipPanel() {
  const [data, setData] = useState<TooltipData | null>(null);
  const hideTimeoutRef = useRef<number | null>(null);

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
    // Listen for updating the tooltip content
    const unlistenUpdate = listen<TooltipData>('update-tooltip', (event) => {
      clearHideTimeout();
      setData(event.payload);
    });

    // Listen for host mouseleave event requests
    const unlistenRequestHide = listen('request-hide-tooltip', () => {
      scheduleHide(400); // 400ms buffer to allow cursor to travel from cell to tooltip window
    });

    // Listen for cancellations (e.g. entering another cell)
    const unlistenCancelHide = listen('cancel-hide-tooltip', () => {
      clearHideTimeout();
    });

    return () => {
      unlistenUpdate.then((unlisten) => unlisten());
      unlistenRequestHide.then((unlisten) => unlisten());
      unlistenCancelHide.then((unlisten) => unlisten());
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
    <div role="tooltip" className="window-base p-3" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <div className="tooltip-header">
        <div className="tooltip-header-left">
          <span className={`tooltip-status-bubble ${statusBgColor}`} />
          <span className="tooltip-priority-label">{data.priorityLabel}</span>
        </div>
        <span className="tooltip-badge">{data.count} Triggers</span>
      </div>

      <div className="tooltip-list">
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
      </div>

      <div className="tooltip-footer">
        <span className="tooltip-footer-label">Server:</span>
        <span className="tooltip-footer-server">{data.serverLabel}</span>
      </div>
    </div>
  );
}

export default TooltipPanel;

import { listen } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { useEffect, useRef, useState } from 'react';
import type { ZabbixTrigger } from '@/types/zabbix';

interface TooltipData {
  label: string;
  count: number;
  priorityLabel: string;
  colorClass: string;
  bgColor: string;
  details: ZabbixTrigger[];
}

function TooltipPanel() {
  const [data, setData] = useState<TooltipData | null>(null);
  const hideTimeoutRef = useRef<number | null>(null);

  const clearHideTimeout = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  };

  const scheduleHide = (delay = 200) => {
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
  };

  useEffect(() => {
    // Listen for updating the tooltip content
    const unlistenUpdate = listen<TooltipData>('update-tooltip', (event) => {
      clearHideTimeout();
      setData(event.payload);
    });

    // Listen for host mouseleave event requests
    const unlistenRequestHide = listen('request-hide-tooltip', () => {
      scheduleHide(200); // 200ms buffer to allow cursor to travel from cell to tooltip window
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
  }, []);

  const handleMouseEnter = () => {
    // Keep showing tooltip when mouse enters the tooltip window
    clearHideTimeout();
  };

  const handleMouseLeave = () => {
    // Hide tooltip shortly after mouse leaves the tooltip window
    scheduleHide(150);
  };

  if (!data) {
    return null;
  }

  // Priority color mapped to text styling
  const priorityColorMap: Record<string, string> = {
    '0': 'bg-gray-500',
    '1': 'bg-blue-500',
    '2': 'bg-yellow-500',
    '3': 'bg-orange-400',
    '4': 'bg-orange-600',
    '5': 'bg-red-500',
  };

  const statusBgColor = priorityColorMap[data.details[0]?.priority] || 'bg-slate-700';

  return (
    <div
      className="tooltip-container flex flex-col bg-white/98 dark:bg-slate-950/98 text-slate-900 dark:text-white select-none border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden shadow-md backdrop-blur-md"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="tooltip-header flex items-center justify-between border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <span className={`w-3.5 h-3.5 rounded-full ${statusBgColor} animate-pulse`} />
          <span className="text-sm font-extrabold tracking-wide">{data.priorityLabel}</span>
        </div>
        <span className="text-xxs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
          {data.count} Triggers
        </span>
      </div>

      <div className="tooltip-body flex-1 overflow-y-auto scrollbar-thin pr-1 flex flex-col">
        {data.details.map((t, i) => {
          const changeTime = t.lastchange ? new Date(parseInt(t.lastchange, 10) * 1000).toLocaleString() : 'Unknown';

          return (
            <div
              key={t.triggerid || i}
              className="tooltip-item text-xxs bg-slate-50 dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-md transition-all duration-150 shadow-sm"
            >
              <div className="font-semibold text-slate-800 dark:text-slate-100 leading-snug break-words">
                {t.description}
              </div>
              <div className="tooltip-item-meta flex flex-wrap text-xxs text-slate-500 dark:text-slate-400 font-medium">
                {t.hostname && (
                  <div>
                    <span className="text-slate-400 dark:text-slate-500">Host:</span> {t.hostname}
                  </div>
                )}
                <div>
                  <span className="text-slate-400 dark:text-slate-500">Time:</span> {changeTime}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TooltipPanel;

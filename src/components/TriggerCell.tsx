import { LogicalPosition } from '@tauri-apps/api/dpi';
import { emit } from '@tauri-apps/api/event';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import type { MouseEvent } from 'react';
import { PRIORITY_MAP, type ZabbixTrigger } from '@/types/zabbix';

interface TriggerCellProps {
  priority: string;
  status: {
    triggers: Map<string, number>;
    triggerDetails: Map<string, ZabbixTrigger[]>;
  } | null;
  isError: boolean;
  isLoading: boolean;
}

function TriggerCell({ priority, status, isError, isLoading }: TriggerCellProps) {
  const count = status?.triggers.get(priority) ?? 0;
  const details = status?.triggerDetails.get(priority) ?? [];
  const priorityInfo = PRIORITY_MAP[priority] || {
    label: 'Unknown',
    color: 'text-gray-300',
    bgColor: 'bg-gray-500',
  };

  const getStatusClass = () => {
    if (isError || isLoading) return 'bg-gray-550 dark:bg-gray-500';
    if (count === 0) return 'bg-green-500';
    return priorityInfo.bgColor;
  };

  const getCellTextColor = () => {
    if (isError || isLoading) return 'text-slate-200 dark:text-slate-400';
    if (count === 0) return 'text-white';
    if (['2', '3'].includes(priority)) return 'text-slate-900';
    return 'text-white';
  };

  const updateTooltipPosition = async (e: MouseEvent) => {
    try {
      const tooltipWin = await WebviewWindow.getByLabel('tooltip');
      if (!tooltipWin) return;

      const mouseX = e.clientX;
      const mouseY = e.clientY;

      const mouseLogicalX = window.screenX + mouseX;
      const mouseLogicalY = window.screenY + mouseY;

      // Position directly at the cursor's bottom-right (standard tooltip behavior)
      let x = mouseLogicalX + 12;
      const y = mouseLogicalY + 16;

      // Constrain horizontally within screen boundaries (left edge)
      if (x < 10) {
        x = 10;
      }

      await tooltipWin.setPosition(new LogicalPosition(x, y));
    } catch (err) {
      console.error('Failed to update tooltip position:', err);
    }
  };

  const handleMouseEnter = async (e: MouseEvent) => {
    if (count === 0) return;

    // Request to cancel any pending hide operation on the tooltip window
    await emit('cancel-hide-tooltip');

    try {
      const tooltipWin = await WebviewWindow.getByLabel('tooltip');
      if (!tooltipWin) return;

      // 1. Position it before showing
      await updateTooltipPosition(e);

      await emit('update-tooltip', {
        label: priorityInfo.label,
        count,
        priorityLabel: priorityInfo.label,
        colorClass: priorityInfo.color,
        bgColor: priorityInfo.bgColor,
        details,
      });

      // 2. Show the window
      await tooltipWin.show();

      // 3. Position again immediately after showing to enforce position on Windows/Linux window managers
      await updateTooltipPosition(e);
    } catch (err) {
      console.error('Failed to show tooltip window:', err);
    }
  };

  const handleMouseMove = async (e: MouseEvent) => {
    if (count === 0) return;
    await updateTooltipPosition(e);
  };

  const handleMouseLeave = async () => {
    if (count === 0) return;
    // Tell the tooltip window that the cursor left the trigger cell
    await emit('request-hide-tooltip');
  };

  return (
    <td
      className={`text-center py-2 rounded-sm cursor-pointer font-bold transition-all hover:scale-[1.02] hover:brightness-110 active:scale-95 shadow-sm ${getStatusClass()} ${getCellTextColor()}`}
      onMouseEnter={(e) => handleMouseEnter(e)}
      onMouseMove={(e) => handleMouseMove(e)}
      onMouseLeave={handleMouseLeave}
    >
      {count}
    </td>
  );
}

export default TriggerCell;

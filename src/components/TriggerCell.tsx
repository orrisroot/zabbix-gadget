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
  serverLabel: string;
}

function TriggerCell({ priority, status, isError, isLoading, serverLabel }: TriggerCellProps) {
  const count = status?.triggers.get(priority) ?? 0;
  const details = status?.triggerDetails.get(priority) ?? [];
  const priorityInfo = PRIORITY_MAP[priority] || {
    label: 'Unknown',
    color: 'text-gray-300',
    bgColor: 'bg-gray-500',
  };

  const getCellClass = () => {
    if (isError || isLoading) return 'trigger-cell-inactive';
    if (count === 0) return 'trigger-cell-empty';
    switch (priority) {
      case '0':
        return 'trigger-cell-not-classified';
      case '1':
        return 'trigger-cell-info';
      case '2':
        return 'trigger-cell-warning';
      case '3':
        return 'trigger-cell-average';
      case '4':
        return 'trigger-cell-high';
      case '5':
        return 'trigger-cell-disaster';
      default:
        return 'trigger-cell-inactive';
    }
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

  const showTooltip = async (e: MouseEvent, forceUpdateContent = false) => {
    try {
      const tooltipWin = await WebviewWindow.getByLabel('tooltip');
      if (!tooltipWin) return;

      // Always update position to follow cursor
      await updateTooltipPosition(e);

      const isVisible = await tooltipWin.isVisible();
      if (forceUpdateContent || !isVisible) {
        await emit('update-tooltip', {
          label: priorityInfo.label,
          serverLabel,
          count,
          priorityLabel: priorityInfo.label,
          colorClass: priorityInfo.color,
          bgColor: priorityInfo.bgColor,
          details,
        });
      }

      if (!isVisible) {
        // Show the window
        await tooltipWin.show();

        // Position again immediately after showing to enforce position on Windows/Linux window managers
        await updateTooltipPosition(e);
      }
    } catch (err) {
      console.error('Failed to show tooltip window:', err);
    }
  };

  const handleMouseEnter = async (e: MouseEvent) => {
    if (count === 0) return;
    // Request to cancel any pending hide operation on the tooltip window
    await emit('cancel-hide-tooltip');
    await showTooltip(e, true);
  };

  const handleMouseMove = async (e: MouseEvent) => {
    if (count === 0) return;
    // Cancel any pending hide operation since we are actively moving inside the trigger cell
    await emit('cancel-hide-tooltip');
    await showTooltip(e, false);
  };

  const handleMouseLeave = async () => {
    if (count === 0) return;
    // Tell the tooltip window that the cursor left the trigger cell
    await emit('request-hide-tooltip');
  };

  return (
    <td
      className={`trigger-cell ${getCellClass()}`}
      onMouseEnter={(e) => handleMouseEnter(e)}
      onMouseMove={(e) => handleMouseMove(e)}
      onMouseLeave={handleMouseLeave}
    >
      {count}
    </td>
  );
}

export default TriggerCell;

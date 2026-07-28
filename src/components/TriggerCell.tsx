import { useTooltip } from '@/hooks/useTooltip';
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

export function TriggerCell({ priority, status, isError, isLoading, serverLabel }: TriggerCellProps) {
  const count = status?.triggers.get(priority) ?? 0;
  const details = status?.triggerDetails.get(priority) ?? [];
  const priorityInfo = PRIORITY_MAP[priority] || {
    label: 'Unknown',
    color: 'text-gray-300',
    bgColor: 'bg-gray-500',
  };

  const { handleMouseEnter, handleMouseMove, handleMouseLeave } = useTooltip({
    priorityLabel: priorityInfo.label,
    serverLabel,
    count,
    colorClass: priorityInfo.color,
    bgColor: priorityInfo.bgColor,
    details,
  });

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

  return (
    <td
      className={`trigger-cell ${getCellClass()}`}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {count}
    </td>
  );
}

export default TriggerCell;

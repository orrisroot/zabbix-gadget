import { open } from '@tauri-apps/plugin-shell';
import TriggerCell from '@/components/TriggerCell';
import type { ServerConfig } from '@/types/config';
import { PRIORITY_ORDER, type ZabbixTrigger } from '@/types/zabbix';

interface ServerStatus {
  label: string;
  triggers: Map<string, number>;
  triggerDetails: Map<string, ZabbixTrigger[]>;
  error: string | null;
  lastUpdate: number;
  loading: boolean;
}

interface TriggerTableProps {
  server: ServerConfig;
  status: ServerStatus | null;
  idx: number;
}

function TriggerTable({ server, status, idx }: TriggerTableProps) {
  const isError = !status || status.error !== null;
  const isLoading = status?.loading ?? false;

  return (
    <tr id={`server-${idx}`} className="server-row hover:bg-slate-200/40 dark:hover:bg-gray-800/30 transition-colors">
      <td
        className="text-indigo-600 dark:text-blue-400 py-2 px-2 font-medium max-w-[120px] truncate"
        title={server.label}
      >
        <a
          href={server.host}
          className="hover:underline cursor-pointer"
          onClick={(e) => {
            e.preventDefault();
            open(server.host);
          }}
        >
          {server.label}
        </a>
      </td>
      {PRIORITY_ORDER.map((priority) => (
        <TriggerCell key={priority} priority={priority} status={status} isError={isError} isLoading={isLoading} />
      ))}
    </tr>
  );
}

export default TriggerTable;

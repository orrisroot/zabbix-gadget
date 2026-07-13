import { open } from '@tauri-apps/plugin-shell';
import TriggerCell from '@/components/TriggerCell';
import type { ServerStatus } from '@/hooks/useZabbix';
import type { ServerConfig } from '@/types/config';
import { PRIORITY_ORDER } from '@/types/zabbix';

interface TriggerRowProps {
  server: ServerConfig;
  status: ServerStatus | null;
  idx: number;
}

export function TriggerRow({ server, status, idx }: TriggerRowProps) {
  const isError = !status || status.error !== null;
  const isLoading = status?.loading ?? false;

  return (
    <tr id={`server-${idx}`} className="server-row">
      <td className="trigger-table-td-primary" title={server.label}>
        <a
          href={server.host}
          className="server-link"
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

export default TriggerRow;

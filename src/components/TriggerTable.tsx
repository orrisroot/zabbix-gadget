import TriggerRow from '@/components/TriggerRow';
import type { ServerStatus } from '@/hooks/useZabbix';
import type { ServerConfig } from '@/types/config';

interface TriggerTableProps {
  servers: ServerConfig[];
  serverStatuses: Map<string, ServerStatus>;
}

export function TriggerTable({ servers, serverStatuses }: TriggerTableProps) {
  return (
    <table className="trigger-table">
      <thead>
        <tr className="trigger-table-tr">
          <th className="trigger-table-th-primary">Server</th>
          <th className="trigger-table-th-secondary">Disaster</th>
          <th className="trigger-table-th-secondary">High</th>
          <th className="trigger-table-th-secondary">Average</th>
          <th className="trigger-table-th-secondary">Warning</th>
          <th className="trigger-table-th-secondary">Information</th>
          <th className="trigger-table-th-secondary">Not classified</th>
        </tr>
      </thead>
      <tbody id="server-rows">
        {servers.map((server, idx) => {
          const status = serverStatuses.get(server.label);
          return <TriggerRow key={server.label} server={server} status={status ?? null} idx={idx} />;
        })}
      </tbody>
    </table>
  );
}

export default TriggerTable;

export interface ZabbixHost {
  host: string;
  hostid: string;
}

export interface ZabbixTrigger {
  triggerid: string;
  description: string;
  priority: string;
  value: string;
  lastchange: string;
  error: string;
  url: string;
  hostname?: string;
  hosts?: ZabbixHost[];
  comments: string;
  expression: string;
}

export interface TriggerResult {
  label: string;
  success: boolean;
  triggers: ZabbixTrigger[];
  error: string | null;
  last_update: number;
}

export const PRIORITY_MAP: Record<string, { label: string; color: string; bgColor: string }> = {
  '0': {
    label: 'Not classified',
    color: 'text-blue-300',
    bgColor: 'bg-gray-500',
  },
  '1': { label: 'Information', color: 'text-blue-100', bgColor: 'bg-blue-500' },
  '2': { label: 'Warning', color: 'text-white', bgColor: 'bg-yellow-500' },
  '3': { label: 'Average', color: 'text-white', bgColor: 'bg-orange-400' },
  '4': { label: 'High', color: 'text-white', bgColor: 'bg-orange-600' },
  '5': { label: 'Disaster', color: 'text-white', bgColor: 'bg-red-500' },
};

export const PRIORITY_ORDER = ['5', '4', '3', '2', '1', '0'];

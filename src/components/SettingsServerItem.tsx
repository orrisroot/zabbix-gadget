import { AlertCircle, CheckCircle, Edit2, GripVertical, RefreshCw, Trash2 } from 'lucide-react';
import type React from 'react';
import type { ServerConfig } from '@/types/config';

interface SettingsServerItemProps {
  server: ServerConfig;
  index: number;
  isDragging: boolean;
  testStatus: 'idle' | 'loading' | 'ok' | 'error';
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onTest: (server: ServerConfig) => void;
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
}

export function SettingsServerItem({
  server,
  index,
  isDragging,
  testStatus,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onTest,
  onEdit,
  onRemove,
}: SettingsServerItemProps) {
  return (
    <li
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`settings-server-item ${isDragging ? 'settings-server-item-dragging' : ''}`}
    >
      <div className="settings-server-item-left">
        <div className="settings-drag-handle">
          <GripVertical size={14} />
        </div>
        <div className="flex-1-min-w-0">
          <div className="settings-server-name">{server.label}</div>
          <div className="settings-server-url">{server.host}</div>
        </div>
      </div>

      <div className="flex-items-center-gap1-5">
        {/* Connection Test */}
        <button
          type="button"
          onClick={() => onTest(server)}
          disabled={testStatus === 'loading'}
          className="settings-action-btn"
          title="Test Connection"
        >
          {testStatus === 'loading' ? (
            <RefreshCw size={13} className="icon-spin settings-action-btn-loading" />
          ) : testStatus === 'ok' ? (
            <CheckCircle size={13} className="settings-action-btn-ok" />
          ) : testStatus === 'error' ? (
            <AlertCircle size={13} className="settings-action-btn-error" />
          ) : (
            <RefreshCw size={13} className="settings-action-btn-idle" />
          )}
        </button>

        {/* Edit Action */}
        <button
          type="button"
          onClick={() => onEdit(index)}
          className="settings-action-btn settings-action-btn-edit-inactive"
          title="Edit"
        >
          <Edit2 size={13} />
        </button>

        {/* Delete Action */}
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="settings-action-btn settings-action-btn-danger"
          title="Delete"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </li>
  );
}

export default SettingsServerItem;

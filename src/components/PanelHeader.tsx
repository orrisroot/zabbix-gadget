import { X } from 'lucide-react';
import type React from 'react';
import { useTauriWindow } from '@/hooks/useTauriWindow';

interface PanelHeaderProps {
  title: string;
  icon?: React.ReactNode;
  onClose?: () => void;
  showCloseButton?: boolean;
  onTitleClick?: (e: React.MouseEvent) => void;
  titleClassName?: string;
  titleTitle?: string;
  compact?: boolean;
}

export function PanelHeader({
  title,
  icon,
  onClose,
  showCloseButton = true,
  onTitleClick,
  titleClassName = '',
  titleTitle,
  compact = false,
}: PanelHeaderProps) {
  const { handleMouseDown, hideWindow } = useTauriWindow();

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      hideWindow();
    }
  };

  const renderTitle = () => {
    if (onTitleClick) {
      return (
        <button
          type="button"
          className={`panel-header-title-container bg-transparent border-none p-0 outline-none text-left ${titleClassName}`}
          onMouseDown={(e) => {
            // Prevent dragging from title click
            e.stopPropagation();
          }}
          onClick={onTitleClick}
          title={titleTitle}
        >
          {icon}
          <span className="panel-header-title">{title}</span>
        </button>
      );
    }

    return (
      <div className="panel-header-title-container">
        {icon}
        <span className="panel-header-title">{title}</span>
      </div>
    );
  };

  return (
    <header
      role="toolbar"
      className={`panel-header settings-header ${compact ? 'panel-header-compact' : ''}`}
      onMouseDown={handleMouseDown}
    >
      {renderTitle()}
      {showCloseButton && (
        <button
          type="button"
          onClick={handleClose}
          className={`settings-close-btn ${compact ? 'panel-close-btn-compact' : ''}`}
          title="Close"
        >
          <X size={compact ? 14 : 16} />
        </button>
      )}
    </header>
  );
}

export default PanelHeader;

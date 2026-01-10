import React from 'react';
import { CommandBar, type ICommandBarItemProps } from '@fluentui/react';
import { THEME } from '../types';

interface ActionsToolbarProps {
  isSelectionMode: boolean;
  selectedCount: number;
  onBulkCreate: () => void;
  onCopyShifts: () => void;
  onPublishShifts: () => void;
  onSaveTemplate: () => void;
  onToggleSelectionMode: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBulkDelete: () => void;
}

export const ActionsToolbar: React.FC<ActionsToolbarProps> = ({
  isSelectionMode,
  selectedCount,
  onBulkCreate,
  onCopyShifts,
  onPublishShifts,
  onSaveTemplate,
  onToggleSelectionMode,
  onSelectAll,
  onClearSelection,
  onBulkDelete
}) => {
  // Normal mode items
  const normalModeItems: ICommandBarItemProps[] = [
    {
      key: 'bulkCreate',
      text: 'Bulk Create',
      iconProps: { iconName: 'AddMultiple' },
      onClick: onBulkCreate
    },
    {
      key: 'copyShifts',
      text: 'Copy Month',
      iconProps: { iconName: 'Copy' },
      onClick: onCopyShifts
    },
    {
      key: 'publish',
      text: 'Publish All',
      iconProps: { iconName: 'PublishContent' },
      onClick: onPublishShifts
    },
    {
      key: 'template',
      text: 'Save Template',
      iconProps: { iconName: 'SaveTemplate' },
      onClick: onSaveTemplate
    }
  ];

  const normalModeFarItems: ICommandBarItemProps[] = [
    {
      key: 'selectMode',
      text: 'Select Shifts',
      iconProps: { iconName: 'CheckboxComposite' },
      onClick: onToggleSelectionMode
    }
  ];

  // Selection mode items
  const selectionModeItems: ICommandBarItemProps[] = [
    {
      key: 'selectAll',
      text: 'Select All',
      iconProps: { iconName: 'SelectAll' },
      onClick: onSelectAll
    },
    {
      key: 'clearSelection',
      text: 'Clear Selection',
      iconProps: { iconName: 'Cancel' },
      onClick: onClearSelection,
      disabled: selectedCount === 0
    },
    {
      key: 'deleteSelected',
      text: `Delete (${selectedCount})`,
      iconProps: { iconName: 'Delete' },
      onClick: onBulkDelete,
      disabled: selectedCount === 0,
      buttonStyles: {
        root: {
          color: selectedCount > 0 ? '#dc2626' : undefined
        },
        icon: {
          color: selectedCount > 0 ? '#dc2626' : undefined
        }
      }
    }
  ];

  const selectionModeFarItems: ICommandBarItemProps[] = [
    {
      key: 'exitSelection',
      text: 'Exit Selection',
      iconProps: { iconName: 'ChromeClose' },
      onClick: onToggleSelectionMode
    }
  ];

  return (
    <div
      style={{
        backgroundColor: isSelectionMode ? THEME.primaryLight : 'white',
        borderRadius: '10px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
        marginTop: '12px',
        overflow: 'hidden',
        transition: 'background-color 0.2s ease'
      }}
    >
      <CommandBar
        items={isSelectionMode ? selectionModeItems : normalModeItems}
        farItems={isSelectionMode ? selectionModeFarItems : normalModeFarItems}
        styles={{
          root: {
            backgroundColor: 'transparent',
            padding: '0 8px'
          }
        }}
      />

      {/* Selection count indicator */}
      {isSelectionMode && selectedCount > 0 && (
        <div
          style={{
            padding: '8px 16px',
            backgroundColor: THEME.primary,
            color: 'white',
            fontSize: '13px',
            fontWeight: 500,
            textAlign: 'center'
          }}
        >
          {selectedCount} shift{selectedCount !== 1 ? 's' : ''} selected
        </div>
      )}
    </div>
  );
};

export default ActionsToolbar;

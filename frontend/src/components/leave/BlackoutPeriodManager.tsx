import React, { useState, useCallback, useMemo } from 'react';
import {
  Stack,
  Text,

  DefaultButton,
  PrimaryButton,
  IconButton,
  DatePicker,
  TextField,
  Dropdown,
  IDropdownOption,
  Toggle,
  Modal,
  MessageBar,
  MessageBarType,
  DetailsList,
  DetailsListLayoutMode,
  IColumn,
  Selection,
  SelectionMode,
  ContextualMenu,
  IContextualMenuItem,
  IStackTokens
} from '@fluentui/react';
import { Formik, Form, Field, FormikProps } from 'formik';
import * as Yup from 'yup';

interface BlackoutPeriod {
  id?: number;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  venue?: number | null;
  leave_types: number[];
  restriction_level: 'no_requests' | 'emergency_only' | 'manager_approval' | 'limit_percentage';
  max_staff_percentage?: number | null;
  allow_manager_override: boolean;
  override_reason_required: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface BlackoutPeriodManagerProps {
  periods: BlackoutPeriod[];
  leaveTypes: Array<{ id: number; name: string; color_code: string }>;
  onSave: (period: BlackoutPeriod) => Promise<void>;
  onDelete: (periodId: number) => Promise<void>;
  onActivate: (periodId: number, isActive: boolean) => Promise<void>;
  isLoading?: boolean;
  className?: string;
}

interface BlackoutFormData extends Omit<BlackoutPeriod, 'id' | 'created_at' | 'updated_at'> {
  start_date_obj: Date | null;
  end_date_obj: Date | null;
}

const stackTokens: IStackTokens = {
  childrenGap: 16,
};

const validationSchema = Yup.object().shape({
  name: Yup.string()
    .required('Name is required')
    .min(3, 'Name must be at least 3 characters'),
  description: Yup.string()
    .max(500, 'Description cannot exceed 500 characters'),
  start_date_obj: Yup.date()
    .nullable()
    .required('Start date is required'),
  end_date_obj: Yup.date()
    .nullable()
    .required('End date is required')
    .min(Yup.ref('start_date_obj'), 'End date must be after start date'),
  restriction_level: Yup.string()
    .required('Restriction level is required')
    .oneOf(['no_requests', 'emergency_only', 'manager_approval', 'limit_percentage'], 'Invalid restriction level'),
  max_staff_percentage: Yup.number()
    .nullable()
    .when('restriction_level', {
      is: 'limit_percentage',
      then: (schema) => schema.required('Max staff percentage is required when using limit percentage restriction').min(1, 'Must be at least 1%').max(100, 'Cannot exceed 100%'),
      otherwise: (schema) => schema.nullable()
    }),
  leave_types: Yup.array()
    .min(1, 'At least one leave type must be selected'),
});

const BlackoutPeriodManager: React.FC<BlackoutPeriodManagerProps> = ({
  periods,
  leaveTypes,
  onSave,
  onDelete,
  onActivate,
  isLoading = false,
  className = ''
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<BlackoutPeriod | null>(null);
  const [selection] = useState(() => new Selection());
  const [contextMenuTarget, setContextMenuTarget] = useState<HTMLElement | null>(null);
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<BlackoutPeriod | null>(null);
  const [notification, setNotification] = useState<{
    type: MessageBarType;
    message: string;
  } | null>(null);

  // Dropdown options
  const restrictionLevelOptions: IDropdownOption[] = [
    { key: 'no_requests', text: 'No Requests Allowed' },
    { key: 'emergency_only', text: 'Emergency Only' },
    { key: 'manager_approval', text: 'Manager Approval Required' },
    { key: 'limit_percentage', text: 'Limit Staff Percentage' }
  ];

  const leaveTypeOptions: IDropdownOption[] = leaveTypes.map(type => ({
    key: String(type.id),
    text: type.name
  }));

  // Initialize form data
  const getInitialFormData = useCallback((): BlackoutFormData => {
    if (editingPeriod) {
      return {
        name: editingPeriod.name,
        description: editingPeriod.description,
        start_date: editingPeriod.start_date,
        end_date: editingPeriod.end_date,
        start_date_obj: new Date(editingPeriod.start_date),
        end_date_obj: new Date(editingPeriod.end_date),
        venue: editingPeriod.venue,
        leave_types: editingPeriod.leave_types,
        restriction_level: editingPeriod.restriction_level,
        max_staff_percentage: editingPeriod.max_staff_percentage,
        allow_manager_override: editingPeriod.allow_manager_override,
        override_reason_required: editingPeriod.override_reason_required,
        is_active: editingPeriod.is_active,
      };
    }

    return {
      name: '',
      description: '',
      start_date: '',
      end_date: '',
      start_date_obj: null,
      end_date_obj: null,
      venue: null,
      leave_types: [],
      restriction_level: 'no_requests',
      max_staff_percentage: null,
      allow_manager_override: false,
      override_reason_required: false,
      is_active: true,
    };
  }, [editingPeriod]);

  // Handle form submission
  const handleSubmit = useCallback(async (values: BlackoutFormData) => {
    try {
      const periodData: BlackoutPeriod = {
        ...editingPeriod,
        name: values.name,
        description: values.description,
        start_date: values.start_date_obj!.toISOString().split('T')[0],
        end_date: values.end_date_obj!.toISOString().split('T')[0],
        venue: values.venue,
        leave_types: values.leave_types,
        restriction_level: values.restriction_level,
        max_staff_percentage: values.max_staff_percentage,
        allow_manager_override: values.allow_manager_override,
        override_reason_required: values.override_reason_required,
        is_active: values.is_active,
      };

      await onSave(periodData);
      setIsModalOpen(false);
      setEditingPeriod(null);

      setNotification({
        type: MessageBarType.success,
        message: `Blackout period ${editingPeriod ? 'updated' : 'created'} successfully!`
      });
    } catch (error) {
      setNotification({
        type: MessageBarType.error,
        message: `Failed to ${editingPeriod ? 'update' : 'create'} blackout period. Please try again.`
      });
    }
  }, [editingPeriod, onSave]);

  // Context menu items
  const contextMenuItems: IContextualMenuItem[] = [
    {
      key: 'edit',
      text: 'Edit',
      iconProps: { iconName: 'Edit' },
      onClick: () => {
        if (selectedPeriod) {
          setEditingPeriod(selectedPeriod);
          setIsModalOpen(true);
          setContextMenuVisible(false);
        }
      },
    },
    {
      key: 'toggle',
      text: selectedPeriod?.is_active ? 'Deactivate' : 'Activate',
      iconProps: { iconName: selectedPeriod?.is_active ? 'BlockContact' : 'CheckMark' },
      onClick: async () => {
        if (selectedPeriod && selectedPeriod.id) {
          try {
            await onActivate(selectedPeriod.id, !selectedPeriod.is_active);
            setNotification({
              type: MessageBarType.success,
              message: `Blackout period ${selectedPeriod.is_active ? 'deactivated' : 'activated'} successfully!`
            });
          } catch (error) {
            setNotification({
              type: MessageBarType.error,
              message: 'Failed to update blackout period status.'
            });
          }
          setContextMenuVisible(false);
        }
      },
    },
    {
      key: 'delete',
      text: 'Delete',
      iconProps: { iconName: 'Delete' },
      onClick: async () => {
        if (selectedPeriod && selectedPeriod.id && window.confirm('Are you sure you want to delete this blackout period?')) {
          try {
            await onDelete(selectedPeriod.id);
            setNotification({
              type: MessageBarType.success,
              message: 'Blackout period deleted successfully!'
            });
          } catch (error) {
            setNotification({
              type: MessageBarType.error,
              message: 'Failed to delete blackout period.'
            });
          }
          setContextMenuVisible(false);
        }
      },
    },
  ];

  // Table columns
  const columns: IColumn[] = [
    {
      key: 'name',
      name: 'Name',
      fieldName: 'name',
      minWidth: 150,
      maxWidth: 250,
      isResizable: true,
      onRender: (period: BlackoutPeriod) => (
        <Stack>
          <Text variant="medium" styles={{ root: { fontWeight: 600 } }}>
            {period.name}
          </Text>
          {period.description && (
            <Text variant="small" styles={{ root: { color: '#666' } }}>
              {period.description}
            </Text>
          )}
        </Stack>
      )
    },
    {
      key: 'period',
      name: 'Period',
      fieldName: 'period',
      minWidth: 200,
      maxWidth: 250,
      isResizable: true,
      onRender: (period: BlackoutPeriod) => (
        <Text variant="small">
          {new Date(period.start_date).toLocaleDateString()} - {new Date(period.end_date).toLocaleDateString()}
        </Text>
      )
    },
    {
      key: 'restriction',
      name: 'Restriction Level',
      fieldName: 'restriction_level',
      minWidth: 150,
      maxWidth: 200,
      isResizable: true,
      onRender: (period: BlackoutPeriod) => {
        const restrictionText = restrictionLevelOptions.find(opt => opt.key === period.restriction_level)?.text || period.restriction_level;
        return (
          <Stack tokens={{ childrenGap: 2 }}>
            <Text variant="small">{restrictionText}</Text>
            {period.restriction_level === 'limit_percentage' && period.max_staff_percentage && (
              <Text variant="small" styles={{ root: { color: '#0078d4' } }}>
                Max {period.max_staff_percentage}% of staff
              </Text>
            )}
          </Stack>
        );
      }
    },
    {
      key: 'leave_types',
      name: 'Leave Types',
      fieldName: 'leave_types',
      minWidth: 150,
      maxWidth: 200,
      isResizable: true,
      onRender: (period: BlackoutPeriod) => {
        const typeNames = period.leave_types.map(id =>
          leaveTypes.find(lt => lt.id === id)?.name
        ).filter(Boolean);

        return (
          <Text variant="small">
            {typeNames.length > 0 ? typeNames.join(', ') : 'All Types'}
          </Text>
        );
      }
    },
    {
      key: 'status',
      name: 'Status',
      fieldName: 'is_active',
      minWidth: 80,
      maxWidth: 100,
      isResizable: true,
      onRender: (period: BlackoutPeriod) => (
        <div className={`px-2 py-1 rounded text-xs font-medium ${
          period.is_active
            ? 'bg-green-100 text-green-800'
            : 'bg-gray-100 text-gray-600'
        }`}>
          {period.is_active ? 'Active' : 'Inactive'}
        </div>
      )
    },
    {
      key: 'actions',
      name: 'Actions',
      fieldName: 'actions',
      minWidth: 100,
      maxWidth: 120,
      isResizable: false,
      onRender: (period: BlackoutPeriod) => (
        <IconButton
          iconProps={{ iconName: 'MoreVertical' }}
          onClick={(event) => {
            event.preventDefault();
            setSelectedPeriod(period);
            setContextMenuTarget(event.currentTarget as HTMLElement);
            setContextMenuVisible(true);
          }}
        />
      )
    }
  ];

  // Sort periods by start date
  const sortedPeriods = useMemo(() => {
    return [...periods].sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
  }, [periods]);

  // Clear notification after 5 seconds
  React.useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  return (
    <div className={`blackout-period-manager ${className}`}>
      <Stack tokens={stackTokens}>
        {/* Notification */}
        {notification && (
          <MessageBar
            messageBarType={notification.type}
            onDismiss={() => setNotification(null)}
            dismissButtonAriaLabel="Close"
          >
            {notification.message}
          </MessageBar>
        )}

        {/* Header */}
        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
          <Text variant="large" styles={{ root: { fontWeight: 600 } }}>
            Blackout Periods Management
          </Text>
          <PrimaryButton
            text="Add Blackout Period"
            iconProps={{ iconName: 'Add' }}
            onClick={() => {
              setEditingPeriod(null);
              setIsModalOpen(true);
            }}
          />
        </Stack>

        {/* Periods Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
          <DetailsList
            items={sortedPeriods}
            columns={columns}
            layoutMode={DetailsListLayoutMode.justified}
            selection={selection}
            selectionMode={SelectionMode.none}
            isHeaderVisible={true}
            styles={{
              root: {
                backgroundColor: 'white'
              },
              headerWrapper: {
                '& [role="row"]': {
                  backgroundColor: '#f8f9fa',
                  fontWeight: '600'
                }
              }
            }}
          />

          {periods.length === 0 && (
            <div className="text-center py-12">
              <Text variant="medium" styles={{ root: { color: '#666', marginBottom: 16 } }}>
                No blackout periods configured
              </Text>
              <Text variant="small" styles={{ root: { color: '#666' } }}>
                Blackout periods prevent employees from requesting leave during critical business periods.
              </Text>
            </div>
          )}
        </div>

        {/* Context Menu */}
        {contextMenuVisible && (
          <ContextualMenu
            target={contextMenuTarget}
            items={contextMenuItems}
            hidden={!contextMenuVisible}
            onDismiss={() => setContextMenuVisible(false)}
          />
        )}

        {/* Add/Edit Modal */}
        <Modal
          isOpen={isModalOpen}
          onDismiss={() => {
            setIsModalOpen(false);
            setEditingPeriod(null);
          }}
          containerClassName="blackout-period-modal"
        >
          <div className="p-6 bg-white min-w-96 max-w-2xl">
            <Formik
              initialValues={getInitialFormData()}
              validationSchema={validationSchema}
              onSubmit={handleSubmit}
              enableReinitialize
            >
              {(formik: FormikProps<BlackoutFormData>) => (
                <Form>
                  <Stack tokens={stackTokens}>
                    <Text variant="xLarge" styles={{ root: { fontWeight: 600 } }}>
                      {editingPeriod ? 'Edit' : 'Add'} Blackout Period
                    </Text>

                    {/* Basic Information */}
                    <div className="grid grid-cols-1 gap-4">
                      <Field name="name">
                        {({ field, meta }: any) => (
                          <TextField
                            label="Period Name"
                            placeholder="e.g., Holiday Season, Annual Conference"
                            required
                            {...field}
                            errorMessage={meta.touched && meta.error ? meta.error : ''}
                          />
                        )}
                      </Field>

                      <Field name="description">
                        {({ field, meta }: any) => (
                          <TextField
                            label="Description"
                            placeholder="Brief description of the blackout period"
                            multiline
                            rows={2}
                            {...field}
                            errorMessage={meta.touched && meta.error ? meta.error : ''}
                          />
                        )}
                      </Field>
                    </div>

                    {/* Date Range */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field name="start_date_obj">
                        {({ field, meta, form }: any) => (
                          <DatePicker
                            label="Start Date"
                            placeholder="Select start date"
                            value={field.value}
                            onSelectDate={(date) => form.setFieldValue('start_date_obj', date)}
                            isRequired
                          />
                        )}
                      </Field>

                      <Field name="end_date_obj">
                        {({ field, meta, form }: any) => (
                          <DatePicker
                            label="End Date"
                            placeholder="Select end date"
                            value={field.value}
                            onSelectDate={(date) => form.setFieldValue('end_date_obj', date)}
                            isRequired
                          />
                        )}
                      </Field>
                    </div>

                    {/* Restriction Settings */}
                    <Field name="restriction_level">
                      {({ field, meta, form }: any) => (
                        <Dropdown
                          label="Restriction Level"
                          placeholder="Select restriction level"
                          required
                          selectedKey={field.value}
                          options={restrictionLevelOptions}
                          onChange={(_, option) => {
                            form.setFieldValue('restriction_level', option?.key);
                            // Clear max_staff_percentage if not using limit_percentage
                            if (option?.key !== 'limit_percentage') {
                              form.setFieldValue('max_staff_percentage', null);
                            }
                          }}
                          errorMessage={meta.touched && meta.error ? meta.error : ''}
                        />
                      )}
                    </Field>

                    {formik.values.restriction_level === 'limit_percentage' && (
                      <Field name="max_staff_percentage">
                        {({ field, meta }: any) => (
                          <TextField
                            label="Maximum Staff Percentage"
                            placeholder="e.g., 25"
                            type="number"
                            min="1"
                            max="100"
                            suffix="%"
                            required
                            {...field}
                            value={field.value || ''}
                            onChange={(_, newValue) => {
                              const numValue = newValue ? Number(newValue) : null;
                              formik.setFieldValue('max_staff_percentage', numValue);
                            }}
                            errorMessage={meta.touched && meta.error ? meta.error : ''}
                          />
                        )}
                      </Field>
                    )}

                    {/* Override Settings */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field name="allow_manager_override">
                        {({ field, form }: any) => (
                          <Toggle
                            label="Allow Manager Override"
                            checked={field.value}
                            onChange={(_, checked) => form.setFieldValue('allow_manager_override', checked)}
                            onText="Yes"
                            offText="No"
                          />
                        )}
                      </Field>

                      <Field name="override_reason_required">
                        {({ field, form }: any) => (
                          <Toggle
                            label="Override Reason Required"
                            checked={field.value}
                            onChange={(_, checked) => form.setFieldValue('override_reason_required', checked)}
                            onText="Yes"
                            offText="No"
                          />
                        )}
                      </Field>
                    </div>

                    <Field name="leave_types">
                      {({ field, meta, form }: any) => (
                        <Dropdown
                          label="Affected Leave Types"
                          placeholder="Select leave types (leave empty for all)"
                          multiSelect
                          options={leaveTypeOptions}
                          selectedKeys={field.value?.map(String)}
                          onChange={(_, option) => {
                            if (option) {
                              const currentTypes = field.value || [];
                              const newTypes = option.selected
                                ? [...currentTypes, Number(option.key)]
                                : currentTypes.filter((type: number) => type !== Number(option.key));
                              form.setFieldValue('leave_types', newTypes);
                            }
                          }}
                          errorMessage={meta.touched && meta.error ? meta.error : ''}
                        />
                      )}
                    </Field>

                    {/* Status */}
                    <Field name="is_active">
                      {({ field, form }: any) => (
                        <Toggle
                          label="Active"
                          checked={field.value}
                          onChange={(_, checked) => form.setFieldValue('is_active', checked)}
                          onText="Active"
                          offText="Inactive"
                        />
                      )}
                    </Field>

                    {/* Form Actions */}
                    <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 8 }}>
                      <DefaultButton
                        text="Cancel"
                        onClick={() => {
                          setIsModalOpen(false);
                          setEditingPeriod(null);
                        }}
                      />
                      <PrimaryButton
                        text={editingPeriod ? 'Update' : 'Create'}
                        type="submit"
                        disabled={!formik.isValid || formik.isSubmitting}
                      />
                    </Stack>
                  </Stack>
                </Form>
              )}
            </Formik>
          </div>
        </Modal>
      </Stack>
    </div>
  );
};

export default BlackoutPeriodManager;
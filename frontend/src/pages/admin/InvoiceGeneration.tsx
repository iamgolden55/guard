import type React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Stack,
  Text,
  PrimaryButton,
  DefaultButton,
  TextField,
  DatePicker,
  Label,
  ComboBox,
  type IComboBoxOption,
  MessageBar,
  MessageBarType,
  Spinner,
  SpinnerSize,
  Pivot,
  PivotItem,
  DetailsList,
  DetailsListLayoutMode,
  SelectionMode,
  type IColumn,
  Link,
  Dialog,
  DialogType,
  DialogFooter
} from '@fluentui/react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { MainLayout } from '../../layouts';
import { Card, BulkPayrollGeneration } from '../../components';
import { invoiceService, shiftService, userService, financeIntegrationsService } from '../../services';
import { type Invoice, InvoiceStatus } from '../../types';
import type { ProviderConnection } from '../../services/financeIntegrationsService';
import FinanceIntegrations from './FinanceIntegrations';

const InvoiceGeneration: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [staffOptions, setStaffOptions] = useState<IComboBoxOption[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  
  // Finance integrations state
  const [financeConnections, setFinanceConnections] = useState<ProviderConnection[]>([]);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [selectedInvoicesForExport, setSelectedInvoicesForExport] = useState<number[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        // Get all recent invoices
        const invoiceData = await invoiceService.getInvoices();
        setInvoices(invoiceData);

        // Get staff users for dropdown
        const staffUsers = await userService.getStaffUsers();
        const staffOptions = staffUsers.map(user => ({
          key: user.id,
          text: user.full_name || user.username,
          data: user
        }));
        setStaffOptions(staffOptions);

        // Load finance connections
        try {
          const connections = await financeIntegrationsService.getConnections();
          setFinanceConnections(connections.filter(conn => conn.status === 'connected'));
        } catch (error) {
          console.warn('Finance integrations not available:', error);
        }

      } catch (error) {
        console.error('Failed to load data:', error);
        setError('Failed to load data. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Form validation schema
  const generateSchema = Yup.object({
    staffUserId: Yup.number()
      .required('Staff member is required')
      .min(1, 'Please select a staff member'),
    startDate: Yup.date()
      .required('Start date is required'),
    endDate: Yup.date()
      .required('End date is required')
      .min(
        Yup.ref('startDate'),
        'End date must be after start date'
      )
  });

  // Form handling with Formik
  const formik = useFormik({
    initialValues: {
      staffUserId: 0,
      startDate: new Date(new Date().setDate(1)), // First day of current month
      endDate: new Date() // Today
    },
    validationSchema: generateSchema,
    onSubmit: async (values) => {
      await showPreview(values);
    }
  });

  // Show preview of invoice generation
  const showPreview = async (values: typeof formik.values) => {
    try {
      setIsSaving(true);
      setError(null);
      
      const formattedStartDate = values.startDate.toISOString().split('T')[0];
      const formattedEndDate = values.endDate.toISOString().split('T')[0];
      
      const preview = await invoiceService.previewInvoiceGeneration({
        staffUserId: values.staffUserId,
        startDate: formattedStartDate,
        endDate: formattedEndDate
      });
      
      setPreviewData(preview);
      setShowGenerateDialog(true);
      
    } catch (error: any) {
      console.error('Failed to preview invoice:', error);
      setError(error.response?.data?.error || 'Failed to preview invoice generation');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle generating an invoice
  const handleGenerateInvoice = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccess(null);

      // Format dates for API
      const formattedStartDate = formik.values.startDate.toISOString().split('T')[0];
      const formattedEndDate = formik.values.endDate.toISOString().split('T')[0];

      // Generate invoice
      const newInvoice = await invoiceService.generateInvoice({
        staffUserId: formik.values.staffUserId,
        startDate: formattedStartDate,
        endDate: formattedEndDate
      });

      // Update invoices list with the new invoice
      setInvoices(prev => [newInvoice, ...prev]);

      // Show success message
      setSuccess('Invoice generated successfully.');

      // Close dialog
      setShowGenerateDialog(false);
      setPreviewData(null);

    } catch (error: any) {
      console.error('Failed to generate invoice:', error);
      
      // Get specific error message from backend
      let errorMessage = 'Failed to generate invoice. Please try again.';
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      setError(errorMessage);
      setShowGenerateDialog(false);
      setPreviewData(null);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle generating PDF for an invoice
  const handleGeneratePdf = async (invoiceId: number) => {
    try {
      setSelectedInvoiceId(invoiceId);
      setIsSaving(true);

      const pdfBlob = await invoiceService.generateInvoicePdf(invoiceId);

      // Create a URL for the PDF blob
      const pdfUrl = URL.createObjectURL(pdfBlob);

      // Update invoice in list with the blob URL
      setInvoices(prev =>
        prev.map(invoice =>
          invoice.id === invoiceId ? { ...invoice, pdf_url: `/api/v1/invoices/${invoiceId}/pdf/`, pdfUrl } : invoice
        )
      );

      // Open PDF in new tab
      window.open(pdfUrl, '_blank');

    } catch (error) {
      console.error('Failed to generate PDF:', error);
      setError('Failed to generate PDF. Please try again.');
    } finally {
      setSelectedInvoiceId(null);
      setIsSaving(false);
    }
  };

  // Handle viewing existing PDF
  const handleViewPdf = async (invoice: Invoice) => {
    try {
      setSelectedInvoiceId(invoice.id);
      setIsSaving(true);

      // Use the invoice service which has proper authentication and token refresh
      const blob = await invoiceService.getInvoicePdf(invoice.id);
      
      // Create blob and object URL
      const blobUrl = URL.createObjectURL(blob);
      
      // Open in new tab
      window.open(blobUrl, '_blank');
      
      // Clean up the object URL after a delay
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

    } catch (error: any) {
      console.error('Failed to view PDF:', error);
      
      // Provide specific error message for authentication issues
      if (error.response?.status === 401 || error.message?.includes('token')) {
        setError('Your session has expired. Please log in again.');
      } else {
        setError('Failed to view PDF. Please try again.');
      }
    } finally {
      setSelectedInvoiceId(null);
      setIsSaving(false);
    }
  };

  // Handle updating invoice status
  const handleUpdateStatus = async (invoiceId: number, status: InvoiceStatus) => {
    try {
      setSelectedInvoiceId(invoiceId);
      setIsSaving(true);

      const updatedInvoice = await invoiceService.updateInvoiceStatus(invoiceId, status);

      // Update invoice in list
      setInvoices(prev =>
        prev.map(invoice =>
          invoice.id === invoiceId ? updatedInvoice : invoice
        )
      );

      setSuccess(`Invoice status updated to ${status}.`);

    } catch (error) {
      console.error('Failed to update status:', error);
      setError('Failed to update invoice status. Please try again.');
    } finally {
      setSelectedInvoiceId(null);
      setIsSaving(false);
    }
  };

  // Handle export to accounting
  const handleExportToAccounting = (invoiceId: number) => {
    setSelectedInvoicesForExport([invoiceId]);
    setSelectedConnection(financeConnections.length > 0 ? financeConnections[0].id : null);
    setShowExportDialog(true);
  };

  // Handle bulk export to accounting
  const handleBulkExportToAccounting = () => {
    const approvedInvoices = invoices.filter(invoice => 
      invoice.status === InvoiceStatus.PAID
    ).map(invoice => invoice.id);
    
    if (approvedInvoices.length === 0) {
      setError('No approved invoices available for export.');
      return;
    }

    setSelectedInvoicesForExport(approvedInvoices);
    setSelectedConnection(financeConnections.length > 0 ? financeConnections[0].id : null);
    setShowExportDialog(true);
  };

  // Confirm export to accounting
  const handleConfirmExport = async () => {
    if (!selectedConnection || selectedInvoicesForExport.length === 0) {
      return;
    }

    try {
      setIsExporting(true);
      setError(null);

      const result = await financeIntegrationsService.exportInvoices({
        connection_id: selectedConnection,
        invoice_ids: selectedInvoicesForExport
      });

      const successCount = result.exports.filter(exp => exp.status === 'completed').length;
      const failCount = result.exports.filter(exp => exp.status === 'failed').length;

      if (successCount > 0) {
        setSuccess(`Successfully exported ${successCount} invoice(s) to accounting.`);
      }
      if (failCount > 0) {
        setError(`Failed to export ${failCount} invoice(s). Check export history for details.`);
      }

      setShowExportDialog(false);
      setSelectedInvoicesForExport([]);
      setSelectedConnection(null);

    } catch (error) {
      console.error('Export failed:', error);
      setError('Failed to export invoices. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Column definitions for invoices
  const invoiceColumns: IColumn[] = [
    {
      key: 'id',
      name: 'Invoice #',
      fieldName: 'id',
      minWidth: 70,
      isResizable: true
    },
    {
      key: 'staffName',
      name: 'Staff Name',
      fieldName: 'staffName',
      minWidth: 150,
      isResizable: true,
      onRender: (item: Invoice) => {
        if (item.staff_user_details) {
          return `${item.staff_user_details.first_name} ${item.staff_user_details.last_name}`.trim() || item.staff_user_details.username;
        }
        return item.staffName || 'Unknown';
      }
    },
    {
      key: 'dateRange',
      name: 'Period',
      minWidth: 200,
      isResizable: true,
      onRender: (item: Invoice) => {
        const startDate = new Date(item.start_date || item.startDate).toLocaleDateString();
        const endDate = new Date(item.end_date || item.endDate).toLocaleDateString();
        return `${startDate} - ${endDate}`;
      }
    },
    {
      key: 'totalHours',
      name: 'Hours',
      fieldName: 'totalHours',
      minWidth: 70,
      isResizable: true,
      onRender: (item: Invoice) => {
        const hours = item.total_hours || item.totalHours || 0;
        return typeof hours === 'number' ? hours.toFixed(2) : parseFloat(hours || '0').toFixed(2);
      }
    },
    {
      key: 'hourlyRate',
      name: 'Rate',
      fieldName: 'hourlyRate',
      minWidth: 70,
      isResizable: true,
      onRender: (item: Invoice) => {
        const rate = item.hourly_rate || item.hourlyRate || 0;
        return `£${typeof rate === 'number' ? rate.toFixed(2) : parseFloat(rate || '0').toFixed(2)}`;
      }
    },
    {
      key: 'totalAmount',
      name: 'Total',
      fieldName: 'totalAmount',
      minWidth: 90,
      isResizable: true,
      onRender: (item: Invoice) => {
        const amount = item.total_amount || item.totalAmount || 0;
        return `£${typeof amount === 'number' ? amount.toFixed(2) : parseFloat(amount || '0').toFixed(2)}`;
      }
    },
    {
      key: 'status',
      name: 'Status',
      fieldName: 'status',
      minWidth: 100,
      isResizable: true,
      onRender: (item: Invoice) => {
        let statusClass = 'text-gray-600';

        switch (item.status) {
          case InvoiceStatus.PENDING:
            statusClass = 'text-yellow-600 font-semibold';
            break;
          case InvoiceStatus.PAID:
            statusClass = 'text-green-600 font-semibold';
            break;
          case InvoiceStatus.REJECTED:
            statusClass = 'text-red-600 font-semibold';
            break;
        }

        return <span className={statusClass}>{item.status.toUpperCase()}</span>;
      }
    },
    {
      key: 'actions',
      name: 'Actions',
      minWidth: 280,
      isResizable: true,
      onRender: (item: Invoice) => (
        <Stack horizontal tokens={{ childrenGap: 8 }}>
          {/* Generate/View PDF */}
          {(item.pdf_url || item.pdfUrl) ? (
            <Link 
              onClick={() => handleViewPdf(item)}
              disabled={isSaving && selectedInvoiceId === item.id}
            >
              View PDF
              {isSaving && selectedInvoiceId === item.id && (
                <Spinner size={SpinnerSize.xSmall} className="ml-2" />
              )}
            </Link>
          ) : (
            <Link
              onClick={() => handleGeneratePdf(item.id)}
              disabled={isSaving && selectedInvoiceId === item.id}
            >
              Generate PDF
              {isSaving && selectedInvoiceId === item.id && (
                <Spinner size={SpinnerSize.xSmall} className="ml-2" />
              )}
            </Link>
          )}

          {/* Finance Integration Actions */}
          {financeConnections.length > 0 && item.status === InvoiceStatus.PAID && (
            <>
              <span className="text-gray-300">|</span>
              <Link
                onClick={() => handleExportToAccounting(item.id)}
                disabled={isSaving && selectedInvoiceId === item.id}
                style={{ color: '#0078d4' }}
              >
                Send to Accounting
              </Link>
            </>
          )}

          {/* Status actions */}
          {item.status === InvoiceStatus.PENDING && (
            <>
              <span className="text-gray-300">|</span>
              <Link
                onClick={() => handleUpdateStatus(item.id, InvoiceStatus.PAID)}
                disabled={isSaving && selectedInvoiceId === item.id}
              >
                Mark Paid
              </Link>
              <span className="text-gray-300">|</span>
              <Link
                onClick={() => handleUpdateStatus(item.id, InvoiceStatus.REJECTED)}
                disabled={isSaving && selectedInvoiceId === item.id}
                className="text-red-600"
              >
                Reject
              </Link>
            </>
          )}
        </Stack>
      )
    }
  ];

  return (
    <MainLayout>
      <Stack tokens={{ childrenGap: 20 }}>
        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
          <Text variant="xxLarge">Invoice Management</Text>
        </Stack>

        {error && (
          <MessageBar
            messageBarType={MessageBarType.error}
            isMultiline={false}
            dismissButtonAriaLabel="Close"
            onDismiss={() => setError(null)}
          >
            {error}
          </MessageBar>
        )}

        {success && (
          <MessageBar
            messageBarType={MessageBarType.success}
            isMultiline={false}
            dismissButtonAriaLabel="Close"
            onDismiss={() => setSuccess(null)}
          >
            {success}
          </MessageBar>
        )}

        <Pivot>
          <PivotItem headerText="Generate Invoice">
            <Card>
              <form onSubmit={formik.handleSubmit}>
                <Stack tokens={{ childrenGap: 16 }}>
                  <Text variant="large" className="mb-4">Generate a new invoice for a staff member</Text>
                  <Text className="text-gray-600 mb-4">
                    Note: Only staff members with approved shifts that have actual hours worked will be able to generate invoices.
                  </Text>

                  {/* Staff selection */}
                  <Stack>
                    <Label required>Staff Member</Label>
                    <ComboBox
                      placeholder="Select staff member"
                      options={staffOptions}
                      selectedKey={formik.values.staffUserId || undefined}
                      onChange={(_, option) => {
                        formik.setFieldValue('staffUserId', option?.key || 0);
                      }}
                      errorMessage={
                        formik.touched.staffUserId && formik.errors.staffUserId
                          ? formik.errors.staffUserId
                          : undefined
                      }
                      required
                    />
                  </Stack>

                  {/* Date range */}
                  <Stack horizontal tokens={{ childrenGap: 16 }}>
                    <Stack grow>
                      <Label required>Start Date</Label>
                      <DatePicker
                        value={formik.values.startDate}
                        onSelectDate={(date) => {
                          if (date) formik.setFieldValue('startDate', date);
                        }}
                        formatDate={(date?: Date) => date ? date.toLocaleDateString() : ''}
                        isRequired
                        showMonthPickerAsOverlay
                        placeholder="Select a date..."
                        ariaLabel="Select start date"
                      />
                      {formik.touched.startDate && formik.errors.startDate && (
                        <Text className="text-red-600 text-sm mt-1">{String(formik.errors.startDate)}</Text>
                      )}
                    </Stack>

                    <Stack grow>
                      <Label required>End Date</Label>
                      <DatePicker
                        value={formik.values.endDate}
                        onSelectDate={(date) => {
                          if (date) formik.setFieldValue('endDate', date);
                        }}
                        formatDate={(date?: Date) => date ? date.toLocaleDateString() : ''}
                        isRequired
                        minDate={formik.values.startDate}
                        showMonthPickerAsOverlay
                        placeholder="Select a date..."
                        ariaLabel="Select end date"
                      />
                      {formik.touched.endDate && formik.errors.endDate && (
                        <Text className="text-red-600 text-sm mt-1">{String(formik.errors.endDate)}</Text>
                      )}
                    </Stack>
                  </Stack>

                  {/* Submit button */}
                  <Stack horizontalAlign="end">
                    <PrimaryButton
                      type="submit"
                      text="Generate Invoice"
                      disabled={isSaving}
                    />
                  </Stack>
                </Stack>
              </form>
            </Card>
          </PivotItem>

          <PivotItem headerText="Invoice List">
            <Card>
              <Stack tokens={{ childrenGap: 16 }}>
                <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                  <Text variant="large" className="mb-4">Manage Invoices</Text>
                  {financeConnections.length > 0 && invoices.some(inv => inv.status === InvoiceStatus.PAID) && (
                    <PrimaryButton
                      text="Export All Paid to Accounting"
                      iconProps={{ iconName: 'CloudUpload' }}
                      onClick={handleBulkExportToAccounting}
                      disabled={isSaving || isExporting}
                    />
                  )}
                </Stack>

                {financeConnections.length > 0 && (
                  <MessageBar messageBarType={MessageBarType.info}>
                    <Text>
                      Finance integrations are enabled. Paid invoices can be exported to: {' '}
                      {financeConnections.map(conn => conn.provider_name).join(', ')}
                    </Text>
                  </MessageBar>
                )}

                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Spinner size={SpinnerSize.large} label="Loading invoices..." />
                  </div>
                ) : invoices.length > 0 ? (
                  <DetailsList
                    items={invoices}
                    columns={invoiceColumns}
                    layoutMode={DetailsListLayoutMode.justified}
                    selectionMode={SelectionMode.none}
                    isHeaderVisible={true}
                  />
                ) : (
                  <Text className="text-gray-500 italic">No invoices found</Text>
                )}
              </Stack>
            </Card>
          </PivotItem>

          <PivotItem headerText="Bulk Payroll">
            <div className="mt-6">
              <Stack tokens={{ childrenGap: 16 }}>
                <Text variant="large" className="font-semibold">
                  Weekly Payroll Generation
                </Text>
                <Text className="text-gray-600">
                  Generate invoices for all staff members for a weekly payment period. 
                  This will create individual invoices for each staff member with approved shifts.
                </Text>
                
                <BulkPayrollGeneration />
              </Stack>
            </div>
          </PivotItem>

          <PivotItem headerText="Finance Integrations">
            <div className="mt-6">
              <FinanceIntegrations />
            </div>
          </PivotItem>
        </Pivot>
      </Stack>

      {/* Confirmation Dialog */}
      <Dialog
        hidden={!showGenerateDialog}
        onDismiss={() => {
          setShowGenerateDialog(false);
          setPreviewData(null);
        }}
        dialogContentProps={{
          type: DialogType.normal,
          title: 'Invoice Generation Preview',
          subText: previewData ? `Preview for ${previewData.staff_user} (${previewData.date_range})` : 'Loading preview...'
        }}
      >
        {previewData && (
          <Stack tokens={{ childrenGap: 16 }}>
            <Stack horizontal tokens={{ childrenGap: 20 }}>
              <Text><strong>Total Shifts:</strong> {previewData.total_shifts}</Text>
              <Text><strong>Eligible Shifts:</strong> {previewData.eligible_shifts}</Text>
            </Stack>
            
            {previewData.can_generate_invoice ? (
              <Text className="text-green-600">
                ✓ This staff member has {previewData.eligible_shifts} approved shifts with actual hours worked. Invoice can be generated.
              </Text>
            ) : (
              <Text className="text-red-600">
                ✗ This staff member has no approved shifts with actual hours worked for this period. Invoice cannot be generated.
              </Text>
            )}
            
            {previewData.shifts && previewData.shifts.length > 0 && (
              <Stack>
                <Text variant="mediumPlus">Shifts in this period:</Text>
                {previewData.shifts.map((shift: any, index: number) => (
                  <Text key={index} className={shift.is_eligible ? 'text-green-600' : 'text-gray-600'}>
                    {shift.is_eligible ? '✓' : '✗'} {new Date(shift.start_time).toLocaleDateString()} - {shift.venue} ({shift.status})
                    {shift.actual_hours_worked ? ` - ${shift.actual_hours_worked} hours` : ' - No hours recorded'}
                  </Text>
                ))}
              </Stack>
            )}
          </Stack>
        )}
        
        <DialogFooter>
          <PrimaryButton
            onClick={handleGenerateInvoice}
            text="Generate Invoice"
            disabled={isSaving || !previewData?.can_generate_invoice}
          />
          <DefaultButton
            onClick={() => {
              setShowGenerateDialog(false);
              setPreviewData(null);
            }}
            text="Cancel"
            disabled={isSaving}
          />
        </DialogFooter>
      </Dialog>

      {/* Export to Accounting Dialog */}
      <Dialog
        hidden={!showExportDialog}
        onDismiss={() => {
          setShowExportDialog(false);
          setSelectedInvoicesForExport([]);
          setSelectedConnection(null);
        }}
        dialogContentProps={{
          type: DialogType.normal,
          title: 'Export to Accounting Software',
          subText: `Export ${selectedInvoicesForExport.length} invoice(s) to your accounting software`
        }}
        minWidth={500}
      >
        <Stack tokens={{ childrenGap: 16 }}>
          {financeConnections.length > 1 ? (
            <Dropdown
              label="Accounting Connection"
              options={financeConnections.map(conn => ({
                key: conn.id,
                text: `${conn.provider_name} - ${conn.company_name}${conn.is_sandbox ? ' (Sandbox)' : ''}`
              }))}
              selectedKey={selectedConnection}
              onChange={(_, option) => setSelectedConnection(option?.key as number || null)}
              required
            />
          ) : financeConnections.length === 1 ? (
            <div>
              <Label>Accounting Connection</Label>
              <Text>
                {financeConnections[0].provider_name} - {financeConnections[0].company_name}
                {financeConnections[0].is_sandbox && ' (Sandbox)'}
              </Text>
            </div>
          ) : (
            <MessageBar messageBarType={MessageBarType.warning}>
              No accounting connections configured. Please set up a connection in the Finance Integrations tab first.
            </MessageBar>
          )}

          <MessageBar messageBarType={MessageBarType.info}>
            <Text>
              This will create invoices in your accounting software for the selected staff invoices. 
              The invoices will include all shift details and PDF attachments where available.
            </Text>
          </MessageBar>

          {isExporting && (
            <div className="flex items-center">
              <Spinner size={SpinnerSize.small} style={{ marginRight: 8 }} />
              <Text>Exporting invoices...</Text>
            </div>
          )}
        </Stack>

        <DialogFooter>
          <PrimaryButton
            onClick={handleConfirmExport}
            text={`Export ${selectedInvoicesForExport.length} Invoice(s)`}
            disabled={!selectedConnection || isExporting || financeConnections.length === 0}
          />
          <DefaultButton
            onClick={() => {
              setShowExportDialog(false);
              setSelectedInvoicesForExport([]);
              setSelectedConnection(null);
            }}
            text="Cancel"
            disabled={isExporting}
          />
        </DialogFooter>
      </Dialog>
    </MainLayout>
  );
};

export default InvoiceGeneration;

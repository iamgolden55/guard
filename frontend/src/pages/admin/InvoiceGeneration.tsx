import type React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { IComboBoxOption } from '@fluentui/react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Header, Container, CloudscapeTable, StatusIndicator, EmptyState, ConfirmationModal, SpaceBetween, Alert } from '../../components/cloudscape';
import Flashbar, { useFlashbar } from '../../components/cloudscape/Flashbar';
import type { ColumnDefinition } from '../../components/cloudscape/CloudscapeTable';
import { BulkPayrollGeneration } from '../../components';
import { invoiceService, shiftService, userService, financeIntegrationsService } from '../../services';
import { type Invoice, InvoiceStatus } from '../../types';
import type { ProviderConnection } from '../../services/financeIntegrationsService';
import FinanceIntegrations from './FinanceIntegrations';

const InvoiceGeneration: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [staffOptions, setStaffOptions] = useState<IComboBoxOption[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const { items: flashItems, addFlash, removeFlash } = useFlashbar();

  // Finance integrations state
  const [financeConnections, setFinanceConnections] = useState<ProviderConnection[]>([]);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [selectedInvoicesForExport, setSelectedInvoicesForExport] = useState<number[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState<'generate' | 'list' | 'bulk' | 'integrations'>('generate');

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
        const staffOpts = staffUsers.map(user => ({
          key: user.id,
          text: user.full_name || user.username,
          data: user
        }));
        setStaffOptions(staffOpts);

        // Load finance connections
        try {
          const connections = await financeIntegrationsService.getConnections();
          setFinanceConnections(connections.filter(conn => conn.status === 'connected'));
        } catch (error) {
          console.warn('Finance integrations not available:', error);
        }

      } catch (error) {
        console.error('Failed to load data:', error);
        addFlash({ type: 'error', content: 'Failed to load data. Please try again later.' });
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
      addFlash({ type: 'error', content: error.response?.data?.error || 'Failed to preview invoice generation' });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle generating an invoice
  const handleGenerateInvoice = async () => {
    try {
      setIsSaving(true);

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
      addFlash({ type: 'success', content: 'Invoice generated successfully.' });

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

      addFlash({ type: 'error', content: errorMessage });
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
      addFlash({ type: 'error', content: 'Failed to generate PDF. Please try again.' });
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
        addFlash({ type: 'error', content: 'Your session has expired. Please log in again.' });
      } else {
        addFlash({ type: 'error', content: 'Failed to view PDF. Please try again.' });
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

      addFlash({ type: 'success', content: `Invoice status updated to ${status}.` });

    } catch (error) {
      console.error('Failed to update status:', error);
      addFlash({ type: 'error', content: 'Failed to update invoice status. Please try again.' });
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
      addFlash({ type: 'error', content: 'No approved invoices available for export.' });
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

      const result = await financeIntegrationsService.exportInvoices({
        connection_id: selectedConnection,
        invoice_ids: selectedInvoicesForExport
      });

      const successCount = result.exports.filter(exp => exp.status === 'completed').length;
      const failCount = result.exports.filter(exp => exp.status === 'failed').length;

      if (successCount > 0) {
        addFlash({ type: 'success', content: `Successfully exported ${successCount} invoice(s) to accounting.` });
      }
      if (failCount > 0) {
        addFlash({ type: 'error', content: `Failed to export ${failCount} invoice(s). Check export history for details.` });
      }

      setShowExportDialog(false);
      setSelectedInvoicesForExport([]);
      setSelectedConnection(null);

    } catch (error) {
      console.error('Export failed:', error);
      addFlash({ type: 'error', content: 'Failed to export invoices. Please try again.' });
    } finally {
      setIsExporting(false);
    }
  };

  // Column definitions for invoices table
  const invoiceColumns: ColumnDefinition<Invoice>[] = [
    {
      id: 'id',
      header: 'Invoice #',
      cell: (item) => `#${item.id}`,
      width: 90,
    },
    {
      id: 'staffName',
      header: 'Staff name',
      cell: (item) => {
        if (item.staff_user_details) {
          return `${item.staff_user_details.first_name} ${item.staff_user_details.last_name}`.trim() || item.staff_user_details.username;
        }
        return item.staffName || 'Unknown';
      },
    },
    {
      id: 'period',
      header: 'Period',
      cell: (item) => {
        const startDate = new Date(item.start_date || item.startDate).toLocaleDateString();
        const endDate = new Date(item.end_date || item.endDate).toLocaleDateString();
        return `${startDate} - ${endDate}`;
      },
    },
    {
      id: 'hours',
      header: 'Hours',
      cell: (item) => {
        const hours = item.total_hours || item.totalHours || 0;
        return typeof hours === 'number' ? hours.toFixed(2) : parseFloat(hours || '0').toFixed(2);
      },
      width: 80,
    },
    {
      id: 'rate',
      header: 'Rate',
      cell: (item) => {
        const rate = item.hourly_rate || (item as any).hourlyRate || 0;
        return `£${typeof rate === 'number' ? rate.toFixed(2) : parseFloat(rate || '0').toFixed(2)}`;
      },
      width: 80,
    },
    {
      id: 'total',
      header: 'Total',
      cell: (item) => {
        const amount = item.total_amount || item.totalAmount || 0;
        return (
          <span className="font-medium">
            £{typeof amount === 'number' ? amount.toFixed(2) : parseFloat(amount || '0').toFixed(2)}
          </span>
        );
      },
      width: 100,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (item) => {
        switch (item.status) {
          case InvoiceStatus.PENDING:
            return <StatusIndicator type="pending">Pending</StatusIndicator>;
          case InvoiceStatus.PAID:
            return <StatusIndicator type="success">Paid</StatusIndicator>;
          case InvoiceStatus.REJECTED:
            return <StatusIndicator type="error">Rejected</StatusIndicator>;
          default:
            return <StatusIndicator type="info">{item.status}</StatusIndicator>;
        }
      },
      width: 120,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (item) => (
        <div className="flex items-center gap-2 flex-wrap">
          {(item.pdf_url || item.pdfUrl) ? (
            <button
              onClick={() => handleViewPdf(item)}
              disabled={isSaving && selectedInvoiceId === item.id}
              className="text-sm text-red-600 hover:text-red-800 hover:underline disabled:opacity-50 transition-colors"
            >
              {isSaving && selectedInvoiceId === item.id ? 'Loading...' : 'View PDF'}
            </button>
          ) : (
            <button
              onClick={() => handleGeneratePdf(item.id)}
              disabled={isSaving && selectedInvoiceId === item.id}
              className="text-sm text-red-600 hover:text-red-800 hover:underline disabled:opacity-50 transition-colors"
            >
              {isSaving && selectedInvoiceId === item.id ? 'Generating...' : 'Generate PDF'}
            </button>
          )}

          {financeConnections.length > 0 && item.status === InvoiceStatus.PAID && (
            <>
              <span className="text-gray-300">|</span>
              <button
                onClick={() => handleExportToAccounting(item.id)}
                disabled={isSaving && selectedInvoiceId === item.id}
                className="text-sm text-red-600 hover:text-red-800 hover:underline disabled:opacity-50 transition-colors"
              >
                Send to accounting
              </button>
            </>
          )}

          {item.status === InvoiceStatus.PENDING && (
            <>
              <span className="text-gray-300">|</span>
              <button
                onClick={() => handleUpdateStatus(item.id, InvoiceStatus.PAID)}
                disabled={isSaving && selectedInvoiceId === item.id}
                className="text-sm text-green-600 hover:text-green-800 hover:underline disabled:opacity-50 transition-colors"
              >
                Mark paid
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={() => handleUpdateStatus(item.id, InvoiceStatus.REJECTED)}
                disabled={isSaving && selectedInvoiceId === item.id}
                className="text-sm text-red-600 hover:text-red-800 hover:underline disabled:opacity-50 transition-colors"
              >
                Reject
              </button>
            </>
          )}
        </div>
      ),
      minWidth: 280,
    },
  ];

  const tabs = [
    { key: 'generate' as const, label: 'Generate invoice' },
    { key: 'list' as const, label: 'Invoice list' },
    { key: 'bulk' as const, label: 'Bulk payroll' },
    { key: 'integrations' as const, label: 'Finance integrations' },
  ];

  return (
    <SpaceBetween size="l">
      <Header
        variant="h1"
        description="Generate, manage, and export invoices for staff members"
      >
        Invoice management
      </Header>

      <Flashbar items={flashItems} onDismiss={removeFlash} />

      {/* Tab navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-0 -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={
                activeTab === tab.key
                  ? 'px-4 py-2 text-sm font-medium text-red-600 border-b-2 border-red-600'
                  : 'px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent'
              }
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Generate invoice tab */}
      {activeTab === 'generate' && (
        <Container
          header={
            <Header variant="h2" description="Only staff members with approved shifts that have actual hours worked will generate invoices.">
              Generate a new invoice
            </Header>
          }
        >
          <form onSubmit={formik.handleSubmit}>
            <SpaceBetween size="m">
              {/* Staff selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Staff member <span className="text-red-500">*</span>
                </label>
                <select
                  value={formik.values.staffUserId || ''}
                  onChange={(e) => formik.setFieldValue('staffUserId', Number(e.target.value) || 0)}
                  onBlur={() => formik.setFieldTouched('staffUserId', true)}
                  className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                >
                  <option value="">Select staff member</option>
                  {staffOptions.map((opt) => (
                    <option key={String(opt.key)} value={String(opt.key)}>
                      {opt.text}
                    </option>
                  ))}
                </select>
                {formik.touched.staffUserId && formik.errors.staffUserId && (
                  <p className="text-red-600 text-sm mt-1">{formik.errors.staffUserId}</p>
                )}
              </div>

              {/* Date range */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formik.values.startDate.toISOString().split('T')[0]}
                    onChange={(e) => {
                      if (e.target.value) formik.setFieldValue('startDate', new Date(e.target.value));
                    }}
                    className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                  {formik.touched.startDate && formik.errors.startDate && (
                    <p className="text-red-600 text-sm mt-1">{String(formik.errors.startDate)}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formik.values.endDate.toISOString().split('T')[0]}
                    min={formik.values.startDate.toISOString().split('T')[0]}
                    onChange={(e) => {
                      if (e.target.value) formik.setFieldValue('endDate', new Date(e.target.value));
                    }}
                    className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                  {formik.touched.endDate && formik.errors.endDate && (
                    <p className="text-red-600 text-sm mt-1">{String(formik.errors.endDate)}</p>
                  )}
                </div>
              </div>

              {/* Submit button */}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 transition-colors"
                >
                  {isSaving ? 'Generating...' : 'Generate invoice'}
                </button>
              </div>
            </SpaceBetween>
          </form>
        </Container>
      )}

      {/* Invoice list tab */}
      {activeTab === 'list' && (
        <CloudscapeTable
          items={invoices}
          columnDefinitions={invoiceColumns}
          loading={isLoading}
          loadingText="Loading invoices"
          trackBy="id"
          header={
            <Header
              variant="h2"
              counter={`${invoices.length}`}
              actions={
                financeConnections.length > 0 && invoices.some(inv => inv.status === InvoiceStatus.PAID) ? (
                  <button
                    onClick={handleBulkExportToAccounting}
                    disabled={isSaving || isExporting}
                    className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 transition-colors"
                  >
                    Export all paid to accounting
                  </button>
                ) : undefined
              }
            >
              Invoices
            </Header>
          }
          empty={
            <EmptyState
              title="No invoices"
              description="No invoices have been generated yet. Use the generate invoice tab to create one."
            />
          }
          filter={
            financeConnections.length > 0 ? (
              <Alert type="info">
                Finance integrations are enabled. Paid invoices can be exported to:{' '}
                {financeConnections.map(conn => conn.provider_name).join(', ')}
              </Alert>
            ) : undefined
          }
        />
      )}

      {/* Bulk payroll tab */}
      {activeTab === 'bulk' && (
        <Container
          header={
            <Header
              variant="h2"
              description="Generate invoices for all staff members for a weekly payment period. This will create individual invoices for each staff member with approved shifts."
            >
              Weekly payroll generation
            </Header>
          }
        >
          <BulkPayrollGeneration />
        </Container>
      )}

      {/* Finance integrations tab */}
      {activeTab === 'integrations' && (
        <FinanceIntegrations />
      )}

      {/* Invoice preview / confirmation modal */}
      <ConfirmationModal
        visible={showGenerateDialog}
        header="Invoice generation preview"
        confirmLabel="Generate invoice"
        cancelLabel="Cancel"
        onConfirm={handleGenerateInvoice}
        onCancel={() => {
          setShowGenerateDialog(false);
          setPreviewData(null);
        }}
        loading={isSaving}
      >
        {previewData && (
          <SpaceBetween size="m">
            <p className="text-sm text-gray-600">
              Preview for {previewData.staff_user} ({previewData.date_range})
            </p>

            <div className="flex gap-6">
              <p className="text-sm"><span className="font-medium">Total shifts:</span> {previewData.total_shifts}</p>
              <p className="text-sm"><span className="font-medium">Eligible shifts:</span> {previewData.eligible_shifts}</p>
            </div>

            {previewData.can_generate_invoice ? (
              <Alert type="success">
                This staff member has {previewData.eligible_shifts} approved shifts with actual hours worked. Invoice can be generated.
              </Alert>
            ) : (
              <Alert type="error">
                This staff member has no approved shifts with actual hours worked for this period. Invoice cannot be generated.
              </Alert>
            )}

            {previewData.shifts && previewData.shifts.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-900 mb-2">Shifts in this period:</p>
                <div className="flex flex-col gap-1">
                  {previewData.shifts.map((shift: any, index: number) => (
                    <p key={index} className={`text-sm ${shift.is_eligible ? 'text-green-700' : 'text-gray-500'}`}>
                      {shift.is_eligible ? '✓' : '✗'} {new Date(shift.start_time).toLocaleDateString()} - {shift.venue} ({shift.status})
                      {shift.actual_hours_worked ? ` - ${shift.actual_hours_worked} hours` : ' - No hours recorded'}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </SpaceBetween>
        )}
      </ConfirmationModal>

      {/* Export to accounting modal */}
      {showExportDialog && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={() => {
              setShowExportDialog(false);
              setSelectedInvoicesForExport([]);
              setSelectedConnection(null);
            }}
            aria-hidden="true"
          />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full animate-scale-in" role="dialog" aria-modal="true">
            <div className="px-6 pt-6 pb-0">
              <h2 className="text-lg font-semibold text-gray-900">Export to accounting software</h2>
              <p className="text-sm text-gray-500 mt-1">
                Export {selectedInvoicesForExport.length} invoice(s) to your accounting software
              </p>
            </div>

            <div className="px-6 py-4">
              <SpaceBetween size="m">
                {financeConnections.length > 1 ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Accounting connection</label>
                    <select
                      value={selectedConnection || ''}
                      onChange={(e) => setSelectedConnection(Number(e.target.value) || null)}
                      className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    >
                      <option value="">Select a connection</option>
                      {financeConnections.map(conn => (
                        <option key={conn.id} value={conn.id}>
                          {conn.provider_name} - {conn.company_name}{conn.is_sandbox ? ' (Sandbox)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : financeConnections.length === 1 ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Accounting connection</label>
                    <p className="text-sm text-gray-900">
                      {financeConnections[0].provider_name} - {financeConnections[0].company_name}
                      {financeConnections[0].is_sandbox && ' (Sandbox)'}
                    </p>
                  </div>
                ) : (
                  <Alert type="warning">
                    No accounting connections configured. Please set up a connection in the finance integrations tab first.
                  </Alert>
                )}

                <Alert type="info">
                  This will create invoices in your accounting software for the selected staff invoices.
                  The invoices will include all shift details and PDF attachments where available.
                </Alert>

                {isExporting && (
                  <div className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <p className="text-sm text-gray-600">Exporting invoices...</p>
                  </div>
                )}
              </SpaceBetween>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 pb-6 pt-2">
              <button
                onClick={() => {
                  setShowExportDialog(false);
                  setSelectedInvoicesForExport([]);
                  setSelectedConnection(null);
                }}
                disabled={isExporting}
                className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmExport}
                disabled={!selectedConnection || isExporting || financeConnections.length === 0}
                className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Export {selectedInvoicesForExport.length} invoice(s)
              </button>
            </div>
          </div>
        </div>
      )}
    </SpaceBetween>
  );
};

export default InvoiceGeneration;

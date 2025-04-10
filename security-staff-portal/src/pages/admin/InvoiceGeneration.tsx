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
import { Card } from '../../components';
import { invoiceService, shiftService } from '../../services';
import { type Invoice, InvoiceStatus } from '../../types';

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

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        // Get all recent invoices
        const invoiceData = await invoiceService.getInvoices();
        setInvoices(invoiceData);

        // TODO: Replace with actual staff data from an API endpoint
        // This is a placeholder for staff options
        setStaffOptions([
          { key: 1, text: 'John Smith' },
          { key: 2, text: 'Jane Doe' },
          { key: 3, text: 'Mike Johnson' },
          { key: 4, text: 'Sarah Williams' }
        ]);

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
      setShowGenerateDialog(true);
    }
  });

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

    } catch (error) {
      console.error('Failed to generate invoice:', error);
      setError('Failed to generate invoice. Please try again.');
      setShowGenerateDialog(false);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle generating PDF for an invoice
  const handleGeneratePdf = async (invoiceId: number) => {
    try {
      setSelectedInvoiceId(invoiceId);
      setIsSaving(true);

      const pdfUrl = await invoiceService.generateInvoicePdf(invoiceId);

      // Update invoice in list
      setInvoices(prev =>
        prev.map(invoice =>
          invoice.id === invoiceId ? { ...invoice, pdfUrl } : invoice
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
      isResizable: true
    },
    {
      key: 'dateRange',
      name: 'Period',
      minWidth: 200,
      isResizable: true,
      onRender: (item: Invoice) => {
        const startDate = new Date(item.startDate).toLocaleDateString();
        const endDate = new Date(item.endDate).toLocaleDateString();
        return `${startDate} - ${endDate}`;
      }
    },
    {
      key: 'totalHours',
      name: 'Hours',
      fieldName: 'totalHours',
      minWidth: 70,
      isResizable: true
    },
    {
      key: 'hourlyRate',
      name: 'Rate',
      fieldName: 'hourlyRate',
      minWidth: 70,
      isResizable: true,
      onRender: (item: Invoice) => `£${item.hourlyRate.toFixed(2)}`
    },
    {
      key: 'totalAmount',
      name: 'Total',
      fieldName: 'totalAmount',
      minWidth: 90,
      isResizable: true,
      onRender: (item: Invoice) => `£${item.totalAmount.toFixed(2)}`
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
      minWidth: 200,
      isResizable: true,
      onRender: (item: Invoice) => (
        <Stack horizontal tokens={{ childrenGap: 8 }}>
          {/* Generate PDF */}
          <Link
            onClick={() => handleGeneratePdf(item.id)}
            disabled={isSaving && selectedInvoiceId === item.id}
          >
            {item.pdfUrl ? 'View PDF' : 'Generate PDF'}
            {isSaving && selectedInvoiceId === item.id && (
              <Spinner size={SpinnerSize.xSmall} className="ml-2" />
            )}
          </Link>

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
                <Text variant="large" className="mb-4">Manage Invoices</Text>

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
        </Pivot>
      </Stack>

      {/* Confirmation Dialog */}
      <Dialog
        hidden={!showGenerateDialog}
        onDismiss={() => setShowGenerateDialog(false)}
        dialogContentProps={{
          type: DialogType.normal,
          title: 'Confirm Invoice Generation',
          subText: 'Are you sure you want to generate an invoice for this period? This will include all approved shifts within the date range.'
        }}
      >
        <DialogFooter>
          <PrimaryButton
            onClick={handleGenerateInvoice}
            text="Generate"
            disabled={isSaving}
          />
          <DefaultButton
            onClick={() => setShowGenerateDialog(false)}
            text="Cancel"
            disabled={isSaving}
          />
        </DialogFooter>
      </Dialog>
    </MainLayout>
  );
};

export default InvoiceGeneration;

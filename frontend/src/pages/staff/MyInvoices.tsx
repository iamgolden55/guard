import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header, Container, SpaceBetween, CloudscapeTable, StatusIndicator, Alert, EmptyState, ConfirmationModal, KeyValuePairs } from '../../components/cloudscape';
import type { ColumnDefinition } from '../../components/cloudscape/CloudscapeTable';
import { invoiceService } from '../../services';
import type { Invoice, InvoiceItem, PaymentBreakdown } from '../../types';

enum InvoiceStatus {
  PENDING = 'pending',
  PAID = 'paid',
  OVERDUE = 'overdue'
}

interface InvoiceDisplay {
  id: number;
  period: string;
  startDate: string;
  endDate: string;
  amount: number;
  status: InvoiceStatus;
  paidDate: string | null;
  pdfUrl: string | null;
  payment_breakdown?: PaymentBreakdown;
  items?: InvoiceItem[];
}

const MyInvoices: React.FC = () => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<InvoiceDisplay[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<InvoiceDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDisplay | null>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);

  const getStatusType = (status: InvoiceStatus): 'success' | 'warning' | 'error' => {
    switch (status) {
      case InvoiceStatus.PAID: return 'success';
      case InvoiceStatus.PENDING: return 'warning';
      case InvoiceStatus.OVERDUE: return 'error';
    }
  };

  // Column definitions for CloudscapeTable
  const columns: ColumnDefinition<InvoiceDisplay>[] = [
    {
      id: 'id',
      header: 'ID',
      cell: (item) => item.id,
      width: 60,
      sortingField: 'id',
    },
    {
      id: 'period',
      header: 'Period',
      cell: (item) => item.period,
      sortingField: 'period',
    },
    {
      id: 'dateRange',
      header: 'Date Range',
      cell: (item) => `${new Date(item.startDate).toLocaleDateString()} - ${new Date(item.endDate).toLocaleDateString()}`,
    },
    {
      id: 'amount',
      header: 'Amount',
      cell: (item) => `\u00A3${item.amount.toFixed(2)}`,
      sortingField: 'amount',
    },
    {
      id: 'status',
      header: 'Status',
      cell: (item) => (
        <StatusIndicator type={getStatusType(item.status)}>
          {item.status}
        </StatusIndicator>
      ),
    },
    {
      id: 'paidDate',
      header: 'Paid Date',
      cell: (item) => item.paidDate ? new Date(item.paidDate).toLocaleDateString() : '-',
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (item) => (
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleViewInvoice(item)}
            className="text-sm text-red-600 hover:text-red-800 font-medium"
          >
            View
          </button>
          {item.pdfUrl && (
            <a
              href={item.pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-red-600 hover:text-red-800 font-medium"
            >
              PDF
            </a>
          )}
        </div>
      ),
    },
  ];

  // Load invoices from API
  const loadInvoices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await invoiceService.getInvoices();
      const invoiceData = Array.isArray(response) ? response : (response as any).results || [];

      const displayInvoices: InvoiceDisplay[] = invoiceData.map((invoice: any) => ({
        id: invoice.id,
        period: formatPeriod(invoice.start_date, invoice.end_date),
        startDate: invoice.start_date,
        endDate: invoice.end_date,
        amount: parseFloat(invoice.total_amount) || 0,
        status: invoice.status as InvoiceStatus,
        paidDate: invoice.status === 'paid' ? invoice.updated_at : null,
        pdfUrl: invoice.pdf_url,
        payment_breakdown: invoice.payment_breakdown ? {
          regular_shifts: {
            ...invoice.payment_breakdown.regular_shifts,
            hours: parseFloat(invoice.payment_breakdown.regular_shifts.hours) || 0,
            amount: parseFloat(invoice.payment_breakdown.regular_shifts.amount) || 0,
            average_rate: parseFloat(invoice.payment_breakdown.regular_shifts.average_rate) || 0
          },
          special_event_shifts: {
            ...invoice.payment_breakdown.special_event_shifts,
            hours: parseFloat(invoice.payment_breakdown.special_event_shifts.hours) || 0,
            amount: parseFloat(invoice.payment_breakdown.special_event_shifts.amount) || 0,
            average_rate: parseFloat(invoice.payment_breakdown.special_event_shifts.average_rate) || 0
          },
          total: {
            ...invoice.payment_breakdown.total,
            hours: parseFloat(invoice.payment_breakdown.total.hours) || 0,
            amount: parseFloat(invoice.payment_breakdown.total.amount) || 0
          }
        } : undefined,
        items: invoice.items ? invoice.items.map((item: any) => ({
          ...item,
          hoursWorked: parseFloat(item.hours_worked) || 0,
          rate: parseFloat(item.rate) || 0,
          amount: parseFloat(item.amount) || 0
        })) : []
      }));

      setInvoices(displayInvoices);
      setFilteredInvoices(displayInvoices);
    } catch (error) {
      console.error('Failed to load invoices:', error);
      setError('Failed to load invoices. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const formatPeriod = (startDate: string, endDate: string): string => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
      return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    return `${start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
  };

  const handleRefresh = useCallback(() => {
    loadInvoices();
  }, [loadInvoices]);

  const handleViewInvoice = useCallback((invoice: InvoiceDisplay) => {
    setSelectedInvoice(invoice);
    setShowPreviewDialog(true);
  }, []);

  // Apply filters
  useEffect(() => {
    let result = invoices;

    if (searchText) {
      const lowerCaseSearch = searchText.toLowerCase();
      result = result.filter(invoice =>
        invoice.period.toLowerCase().includes(lowerCaseSearch) ||
        invoice.id.toString().includes(lowerCaseSearch)
      );
    }

    if (statusFilter) {
      result = result.filter(invoice => invoice.status === statusFilter);
    }

    setFilteredInvoices(result);
  }, [searchText, statusFilter, invoices]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const closePreviewDialog = useCallback(() => {
    setShowPreviewDialog(false);
    setSelectedInvoice(null);
  }, []);

  return (
    <SpaceBetween size="l">
      <Header
        variant="h1"
        actions={
          <button
            onClick={handleRefresh}
            className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Refresh
          </button>
        }
      >
        My Invoices
      </Header>

      {/* Filters */}
      <Container>
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by period or invoice ID"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
          <div className="w-full md:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="">All Statuses</option>
              <option value={InvoiceStatus.PENDING}>Pending</option>
              <option value={InvoiceStatus.PAID}>Paid</option>
              <option value={InvoiceStatus.OVERDUE}>Overdue</option>
            </select>
          </div>
        </div>
      </Container>

      {error && (
        <Alert type="error" dismissible>
          {error}
        </Alert>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-red-600 rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Loading invoices...</p>
          </div>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <Container>
          <EmptyState
            title="No invoices found"
            description="Adjust your search criteria or check back later."
            variant="no-match"
          />
        </Container>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <CloudscapeTable
              items={filteredInvoices}
              columnDefinitions={columns}
              variant="container"
            />
          </div>

          {/* Mobile cards */}
          <div className="block md:hidden space-y-3">
            {filteredInvoices.map((invoice) => (
              <Container key={invoice.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">Invoice #{invoice.id}</p>
                    <p className="text-xs text-gray-500">{invoice.period}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(invoice.startDate).toLocaleDateString()} - {new Date(invoice.endDate).toLocaleDateString()}
                    </p>
                    <p className="text-sm font-semibold text-gray-900">{'\u00A3'}{invoice.amount.toFixed(2)}</p>
                  </div>
                  <StatusIndicator type={getStatusType(invoice.status)}>
                    {invoice.status}
                  </StatusIndicator>
                </div>
                <div className="flex gap-3 mt-3">
                  <button
                    onClick={() => handleViewInvoice(invoice)}
                    className="text-sm text-red-600 hover:text-red-800 font-medium"
                  >
                    View Details
                  </button>
                  {invoice.pdfUrl && (
                    <a
                      href={invoice.pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-red-600 hover:text-red-800 font-medium"
                    >
                      Download PDF
                    </a>
                  )}
                </div>
              </Container>
            ))}
          </div>
        </>
      )}

      {/* Invoice Preview Modal */}
      {selectedInvoice && (
        <ConfirmationModal
          visible={showPreviewDialog}
          header={`Invoice #${selectedInvoice.id} - ${selectedInvoice.period}`}
          confirmLabel={selectedInvoice.pdfUrl ? 'Download PDF' : 'Close'}
          cancelLabel="Close"
          onConfirm={() => {
            if (selectedInvoice.pdfUrl) {
              window.open(selectedInvoice.pdfUrl, '_blank');
            }
            closePreviewDialog();
          }}
          onCancel={closePreviewDialog}
        >
          <SpaceBetween size="m">
            <KeyValuePairs
              columns={2}
              items={[
                { label: 'Period', value: selectedInvoice.period },
                { label: 'Status', value: <StatusIndicator type={getStatusType(selectedInvoice.status)}>{selectedInvoice.status}</StatusIndicator> },
                { label: 'Date Range', value: `${new Date(selectedInvoice.startDate).toLocaleDateString()} - ${new Date(selectedInvoice.endDate).toLocaleDateString()}` },
                { label: 'Amount', value: <span className="font-bold">{'\u00A3'}{selectedInvoice.amount.toFixed(2)}</span> },
              ]}
            />

            {selectedInvoice.paidDate && (
              <p className="text-sm"><span className="font-medium">Paid on:</span> {new Date(selectedInvoice.paidDate).toLocaleDateString()}</p>
            )}

            {selectedInvoice.payment_breakdown && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-900">Payment Breakdown</p>

                {selectedInvoice.payment_breakdown.regular_shifts.count > 0 && (
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg text-sm">
                    <div>
                      <p className="font-medium">Regular Shifts</p>
                      <p className="text-xs text-gray-500">
                        {selectedInvoice.payment_breakdown.regular_shifts.count} shifts {'\u2022'} {selectedInvoice.payment_breakdown.regular_shifts.hours} hours
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{'\u00A3'}{selectedInvoice.payment_breakdown.regular_shifts.amount.toFixed(2)}</p>
                      <p className="text-xs text-gray-500">@{'\u00A3'}{selectedInvoice.payment_breakdown.regular_shifts.average_rate.toFixed(2)}/hr</p>
                    </div>
                  </div>
                )}

                {selectedInvoice.payment_breakdown.special_event_shifts.count > 0 && (
                  <div className="flex justify-between items-center p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                    <div>
                      <p className="font-medium text-amber-800">Special Event Shifts</p>
                      <p className="text-xs text-amber-600">
                        {selectedInvoice.payment_breakdown.special_event_shifts.count} shifts {'\u2022'} {selectedInvoice.payment_breakdown.special_event_shifts.hours} hours
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-amber-800">{'\u00A3'}{selectedInvoice.payment_breakdown.special_event_shifts.amount.toFixed(2)}</p>
                      <p className="text-xs text-amber-600">@{'\u00A3'}{selectedInvoice.payment_breakdown.special_event_shifts.average_rate.toFixed(2)}/hr</p>
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center pt-3 border-t-2 border-gray-200">
                  <div>
                    <p className="font-bold text-sm">Total</p>
                    <p className="text-xs text-gray-500">
                      {selectedInvoice.payment_breakdown.total.count} shifts {'\u2022'} {selectedInvoice.payment_breakdown.total.hours} hours
                    </p>
                  </div>
                  <p className="font-bold text-base">{'\u00A3'}{selectedInvoice.payment_breakdown.total.amount.toFixed(2)}</p>
                </div>
              </div>
            )}

            {selectedInvoice.items && selectedInvoice.items.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-900">Shift Details</p>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="grid grid-cols-5 gap-2 p-2 bg-gray-50 text-xs font-medium text-gray-600 border-b border-gray-200">
                    <span>Date</span>
                    <span>Venue</span>
                    <span className="text-center">Hours</span>
                    <span className="text-center">Rate</span>
                    <span className="text-right">Amount</span>
                  </div>
                  {selectedInvoice.items.map((item, index) => (
                    <div
                      key={item.id}
                      className={`grid grid-cols-5 gap-2 p-2 text-xs ${
                        item.shift_details?.is_special_event ? 'bg-amber-50' : 'bg-white'
                      } ${index < selectedInvoice.items!.length - 1 ? 'border-b border-gray-100' : ''}`}
                    >
                      <span>{new Date(item.date).toLocaleDateString()}</span>
                      <span>{item.venue_details?.name || item.venue}</span>
                      <span className="text-center">{item.hoursWorked}</span>
                      <span className="text-center">{'\u00A3'}{item.rate.toFixed(2)}</span>
                      <span className="text-right font-medium">{'\u00A3'}{item.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-gray-400">
              If you have any questions regarding this invoice, please contact accounts@securitystaff.com
            </p>
          </SpaceBetween>
        </ConfirmationModal>
      )}
    </SpaceBetween>
  );
};

export default MyInvoices;

import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  DetailsList,
  DetailsListLayoutMode,
  SelectionMode,
  type IColumn,
  CommandBar,
  type ICommandBarItemProps,
  SearchBox,
  Dropdown,
  type IDropdownOption,
  Stack,
  Text,
  StackItem,
  Spinner,
  SpinnerSize,
  MessageBar,
  MessageBarType,
  PrimaryButton,
  Link,
  Dialog,
  DialogType,
  ContextualMenu,
  DialogFooter,
  DefaultButton,
  Icon,
  Separator
} from '@fluentui/react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../../layouts';
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

// Status indicator pill component
const StatusPill: React.FC<{status: InvoiceStatus}> = ({ status }) => {
  let backgroundColor = '';
  let color = 'white';

  switch(status) {
    case InvoiceStatus.PENDING:
      backgroundColor = '#F59E0B'; // Yellow
      color = 'black';
      break;
    case InvoiceStatus.PAID:
      backgroundColor = '#10B981'; // Green
      break;
    case InvoiceStatus.OVERDUE:
      backgroundColor = '#EF4444'; // Red
      break;
    default:
      backgroundColor = '#9CA3AF'; // Gray
  }

  return (
    <div
      style={{
        backgroundColor,
        color,
        padding: '4px 8px',
        borderRadius: '12px',
        display: 'inline-block',
        fontSize: '12px',
        fontWeight: 'bold',
        textTransform: 'uppercase'
      }}
    >
      {status}
    </div>
  );
};

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

  // Set up columns for the DetailsList
  const columns: IColumn[] = [
    {
      key: 'id',
      name: 'ID',
      fieldName: 'id',
      minWidth: 50,
      maxWidth: 50,
      isResizable: true,
    },
    {
      key: 'period',
      name: 'Period',
      fieldName: 'period',
      minWidth: 120,
      maxWidth: 150,
      isResizable: true,
    },
    {
      key: 'dateRange',
      name: 'Date Range',
      fieldName: 'startDate',
      minWidth: 150,
      maxWidth: 200,
      isResizable: true,
      onRender: (item: InvoiceDisplay) => (
        <Text>
          {new Date(item.startDate).toLocaleDateString()} - {new Date(item.endDate).toLocaleDateString()}
        </Text>
      ),
    },
    {
      key: 'amount',
      name: 'Amount',
      fieldName: 'amount',
      minWidth: 80,
      maxWidth: 100,
      isResizable: true,
      onRender: (item: InvoiceDisplay) => <Text>£{item.amount.toFixed(2)}</Text>,
    },
    {
      key: 'status',
      name: 'Status',
      fieldName: 'status',
      minWidth: 100,
      maxWidth: 100,
      isResizable: true,
      onRender: (item: InvoiceDisplay) => <StatusPill status={item.status} />,
    },
    {
      key: 'paidDate',
      name: 'Paid Date',
      fieldName: 'paidDate',
      minWidth: 100,
      maxWidth: 120,
      isResizable: true,
      onRender: (item: InvoiceDisplay) => (
        <Text>{item.paidDate ? new Date(item.paidDate).toLocaleDateString() : '-'}</Text>
      ),
    },
    {
      key: 'actions',
      name: 'Actions',
      minWidth: 100,
      maxWidth: 100,
      isResizable: true,
      onRender: (item: InvoiceDisplay) => (
        <Stack horizontal tokens={{ childrenGap: 8 }}>
          <Link onClick={() => handleViewInvoice(item)}>
            <Icon iconName="View" /> View
          </Link>
          {item.pdfUrl && (
            <Link href={item.pdfUrl} target="_blank">
              <Icon iconName="PDF" /> PDF
            </Link>
          )}
        </Stack>
      ),
    },
  ];

  // Status filter options
  const statusOptions: IDropdownOption[] = [
    { key: '', text: 'All Statuses' },
    { key: InvoiceStatus.PENDING, text: 'Pending' },
    { key: InvoiceStatus.PAID, text: 'Paid' },
    { key: InvoiceStatus.OVERDUE, text: 'Overdue' },
  ];

  // Load invoices from API - using useCallback to avoid dependency issues in useEffect
  const loadInvoices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch real invoices from API
      const response = await invoiceService.getInvoices();
      
      // Handle paginated response from DRF
      const invoiceData = Array.isArray(response) ? response : (response as any).results || [];
      
      
      // Transform API response to match our display format
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

  // Helper function to format period from dates
  const formatPeriod = (startDate: string, endDate: string): string => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
      return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    
    return `${start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
  };

  // Handler functions
  const handleRefresh = useCallback(() => {
    loadInvoices();
    return false; // Return false to prevent default behavior
  }, [loadInvoices]);

  const handleViewInvoice = useCallback((invoice: InvoiceDisplay) => {
    setSelectedInvoice(invoice);
    setShowPreviewDialog(true);
  }, []);

  // Command bar items
  const commandBarItems: ICommandBarItemProps[] = [
    {
      key: 'refresh',
      text: 'Refresh',
      iconProps: { iconName: 'Refresh' },
      onClick: handleRefresh,
    }
  ];

  // Apply filters when search text or status filter changes
  useEffect(() => {
    let result = invoices;

    // Apply search filter
    if (searchText) {
      const lowerCaseSearch = searchText.toLowerCase();
      result = result.filter(invoice =>
        invoice.period.toLowerCase().includes(lowerCaseSearch) ||
        invoice.id.toString().includes(lowerCaseSearch)
      );
    }

    // Apply status filter
    if (statusFilter) {
      result = result.filter(invoice => invoice.status === statusFilter);
    }

    setFilteredInvoices(result);
  }, [searchText, statusFilter, invoices]);

  // Load invoices when component mounts
  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  // Handle closing the preview dialog
  const closePreviewDialog = useCallback(() => {
    setShowPreviewDialog(false);
    setSelectedInvoice(null);
  }, []);

  return (
    <MainLayout>
      <Stack tokens={{ childrenGap: 20 }}>
        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
          <Text variant="xxLarge">My Invoices</Text>
        </Stack>

        <CommandBar items={commandBarItems} />

        <Stack horizontal tokens={{ childrenGap: 10 }}>
          <StackItem grow={3}>
            <SearchBox
              placeholder="Search by period or invoice ID"
              onChange={(_, newValue) => setSearchText(newValue || '')}
              onClear={() => setSearchText('')}
            />
          </StackItem>
          <StackItem grow={1}>
            <Dropdown
              placeholder="Filter by status"
              options={statusOptions}
              selectedKey={statusFilter}
              onChange={(_, option) => setStatusFilter(option?.key as string)}
            />
          </StackItem>
        </Stack>

        {error && (
          <MessageBar
            messageBarType={MessageBarType.error}
            isMultiline={false}
            dismissButtonAriaLabel="Close"
          >
            {error}
          </MessageBar>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size={SpinnerSize.large} label="Loading invoices..." />
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <Text variant="large">No invoices found</Text>
            <Text>Adjust your search criteria or check back later.</Text>
          </div>
        ) : (
          <DetailsList
            items={filteredInvoices}
            columns={columns}
            layoutMode={DetailsListLayoutMode.justified}
            selectionMode={SelectionMode.none}
          />
        )}
      </Stack>

      {selectedInvoice && (
        <Dialog
          hidden={!showPreviewDialog}
          onDismiss={closePreviewDialog}
          dialogContentProps={{
            type: DialogType.largeHeader,
            title: `Invoice #${selectedInvoice.id} - ${selectedInvoice.period}`,
          }}
          minWidth={600}
        >
          <Stack tokens={{ childrenGap: 15 }} styles={{ root: { padding: '0 0 20px 0' } }}>
            <Stack horizontal horizontalAlign="space-between">
              <Stack>
                <Text variant="medium" styles={{ root: { fontWeight: 600 } }}>Period</Text>
                <Text>{selectedInvoice.period}</Text>
              </Stack>
              <Stack>
                <Text variant="medium" styles={{ root: { fontWeight: 600 } }}>Status</Text>
                <StatusPill status={selectedInvoice.status} />
              </Stack>
            </Stack>

            <Stack horizontal horizontalAlign="space-between">
              <Stack>
                <Text variant="medium" styles={{ root: { fontWeight: 600 } }}>Date Range</Text>
                <Text>
                  {new Date(selectedInvoice.startDate).toLocaleDateString()} - {new Date(selectedInvoice.endDate).toLocaleDateString()}
                </Text>
              </Stack>
              <Stack>
                <Text variant="medium" styles={{ root: { fontWeight: 600 } }}>Amount</Text>
                <Text styles={{ root: { fontWeight: 700, fontSize: '1.1em' } }}>£{selectedInvoice.amount.toFixed(2)}</Text>
              </Stack>
            </Stack>

            {selectedInvoice.paidDate && (
              <Stack>
                <Text variant="medium" styles={{ root: { fontWeight: 600 } }}>Paid on</Text>
                <Text>{new Date(selectedInvoice.paidDate).toLocaleDateString()}</Text>
              </Stack>
            )}

            {selectedInvoice.payment_breakdown && (
              <>
                <Separator />
                <Stack>
                  <Text variant="medium" styles={{ root: { fontWeight: 600, marginBottom: '10px' } }}>Payment Breakdown</Text>
                  
                  {/* Regular Shifts */}
                  {selectedInvoice.payment_breakdown.regular_shifts.count > 0 && (
                    <Stack horizontal horizontalAlign="space-between" styles={{ root: { padding: '8px 0', backgroundColor: '#f8f9fa', paddingLeft: '12px', paddingRight: '12px', borderRadius: '4px', marginBottom: '8px' } }}>
                      <Stack>
                        <Text variant="small" styles={{ root: { fontWeight: 600 } }}>Regular Shifts</Text>
                        <Text variant="small">
                          {selectedInvoice.payment_breakdown.regular_shifts.count} shifts • {selectedInvoice.payment_breakdown.regular_shifts.hours} hours
                        </Text>
                      </Stack>
                      <Stack horizontalAlign="end">
                        <Text variant="small" styles={{ root: { fontWeight: 600 } }}>£{selectedInvoice.payment_breakdown.regular_shifts.amount.toFixed(2)}</Text>
                        <Text variant="small">@£{selectedInvoice.payment_breakdown.regular_shifts.average_rate.toFixed(2)}/hr</Text>
                      </Stack>
                    </Stack>
                  )}

                  {/* Special Event Shifts */}
                  {selectedInvoice.payment_breakdown.special_event_shifts.count > 0 && (
                    <Stack horizontal horizontalAlign="space-between" styles={{ root: { padding: '8px 0', backgroundColor: '#fff4e6', paddingLeft: '12px', paddingRight: '12px', borderRadius: '4px', marginBottom: '8px', border: '1px solid #ffa726' } }}>
                      <Stack>
                        <Text variant="small" styles={{ root: { fontWeight: 600, color: '#e65100' } }}>
                          <Icon iconName="Event" style={{ marginRight: '4px' }} />
                          Special Event Shifts
                        </Text>
                        <Text variant="small">
                          {selectedInvoice.payment_breakdown.special_event_shifts.count} shifts • {selectedInvoice.payment_breakdown.special_event_shifts.hours} hours
                        </Text>
                      </Stack>
                      <Stack horizontalAlign="end">
                        <Text variant="small" styles={{ root: { fontWeight: 600, color: '#e65100' } }}>£{selectedInvoice.payment_breakdown.special_event_shifts.amount.toFixed(2)}</Text>
                        <Text variant="small">@£{selectedInvoice.payment_breakdown.special_event_shifts.average_rate.toFixed(2)}/hr</Text>
                      </Stack>
                    </Stack>
                  )}

                  {/* Total */}
                  <Stack horizontal horizontalAlign="space-between" styles={{ root: { padding: '12px 0', borderTop: '2px solid #ddd', marginTop: '8px' } }}>
                    <Stack>
                      <Text variant="medium" styles={{ root: { fontWeight: 700 } }}>Total</Text>
                      <Text variant="small">
                        {selectedInvoice.payment_breakdown.total.count} total shifts • {selectedInvoice.payment_breakdown.total.hours} total hours
                      </Text>
                    </Stack>
                    <Stack horizontalAlign="end">
                      <Text variant="medium" styles={{ root: { fontWeight: 700, fontSize: '1.2em' } }}>£{selectedInvoice.payment_breakdown.total.amount.toFixed(2)}</Text>
                    </Stack>
                  </Stack>
                </Stack>
              </>
            )}

            {selectedInvoice.items && selectedInvoice.items.length > 0 && (
              <>
                <Separator />
                <Stack>
                  <Text variant="medium" styles={{ root: { fontWeight: 600, marginBottom: '10px' } }}>Shift Details</Text>
                  
                  {/* Shift-by-shift table */}
                  <div style={{ border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden' }}>
                    {/* Table header */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 80px 100px', backgroundColor: '#f5f5f5', padding: '8px', borderBottom: '1px solid #ddd' }}>
                      <Text variant="small" styles={{ root: { fontWeight: 600 } }}>Date</Text>
                      <Text variant="small" styles={{ root: { fontWeight: 600 } }}>Venue</Text>
                      <Text variant="small" styles={{ root: { fontWeight: 600, textAlign: 'center' } }}>Hours</Text>
                      <Text variant="small" styles={{ root: { fontWeight: 600, textAlign: 'center' } }}>Rate</Text>
                      <Text variant="small" styles={{ root: { fontWeight: 600, textAlign: 'right' } }}>Amount</Text>
                    </div>
                    
                    {/* Table rows */}
                    {selectedInvoice.items.map((item, index) => (
                      <div 
                        key={item.id} 
                        style={{ 
                          display: 'grid', 
                          gridTemplateColumns: '1fr 1fr 80px 80px 100px', 
                          padding: '8px', 
                          borderBottom: index < selectedInvoice.items!.length - 1 ? '1px solid #eee' : 'none',
                          backgroundColor: item.shift_details?.is_special_event ? '#fff4e6' : 'white'
                        }}
                      >
                        <Text variant="small">
                          {new Date(item.date).toLocaleDateString()}
                          {item.shift_details?.is_special_event && (
                            <Icon iconName="Event" style={{ marginLeft: '4px', color: '#e65100', fontSize: '12px' }} />
                          )}
                        </Text>
                        <Text variant="small">{item.venue_details?.name || item.venue}</Text>
                        <Text variant="small" style={{ textAlign: 'center' }}>{item.hoursWorked}</Text>
                        <Text variant="small" style={{ textAlign: 'center' }}>£{item.rate.toFixed(2)}</Text>
                        <Text variant="small" style={{ textAlign: 'right', fontWeight: '600' }}>£{item.amount.toFixed(2)}</Text>
                      </div>
                    ))}
                  </div>
                  
                  {/* Legend */}
                  <Stack horizontal tokens={{ childrenGap: 20 }} styles={{ root: { marginTop: '8px' } }}>
                    <Stack horizontal tokens={{ childrenGap: 4 }}>
                      <div style={{ width: '12px', height: '12px', backgroundColor: '#f8f9fa', border: '1px solid #ddd', borderRadius: '2px' }}></div>
                      <Text variant="small">Regular Shifts</Text>
                    </Stack>
                    <Stack horizontal tokens={{ childrenGap: 4 }}>
                      <div style={{ width: '12px', height: '12px', backgroundColor: '#fff4e6', border: '1px solid #ffa726', borderRadius: '2px' }}></div>
                      <Text variant="small">Special Event Shifts</Text>
                    </Stack>
                  </Stack>
                </Stack>
              </>
            )}

            <Stack>
              <Text variant="medium" styles={{ root: { fontWeight: 600 } }}>Payment Information</Text>
              <Text>If you have any questions regarding this invoice, please contact accounts@securitystaff.com</Text>
            </Stack>
          </Stack>
          <DialogFooter>
            {selectedInvoice.pdfUrl && (
              <PrimaryButton
                text="Download PDF"
                iconProps={{ iconName: 'PDF' }}
                href={selectedInvoice.pdfUrl}
                target="_blank"
              />
            )}
            <DefaultButton text="Close" onClick={closePreviewDialog} />
          </DialogFooter>
        </Dialog>
      )}
    </MainLayout>
  );
};

export default MyInvoices;

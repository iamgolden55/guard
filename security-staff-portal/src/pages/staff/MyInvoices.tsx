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
  Icon
} from '@fluentui/react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../../layouts';
import { invoiceService } from '../../services';

enum InvoiceStatus {
  PENDING = 'pending',
  PAID = 'paid',
  OVERDUE = 'overdue'
}

interface Invoice {
  id: number;
  period: string;
  startDate: string;
  endDate: string;
  amount: number;
  status: InvoiceStatus;
  paidDate: string | null;
  pdfUrl: string | null;
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
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
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
      onRender: (item: Invoice) => (
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
      onRender: (item: Invoice) => <Text>£{item.amount.toFixed(2)}</Text>,
    },
    {
      key: 'status',
      name: 'Status',
      fieldName: 'status',
      minWidth: 100,
      maxWidth: 100,
      isResizable: true,
      onRender: (item: Invoice) => <StatusPill status={item.status} />,
    },
    {
      key: 'paidDate',
      name: 'Paid Date',
      fieldName: 'paidDate',
      minWidth: 100,
      maxWidth: 120,
      isResizable: true,
      onRender: (item: Invoice) => (
        <Text>{item.paidDate ? new Date(item.paidDate).toLocaleDateString() : '-'}</Text>
      ),
    },
    {
      key: 'actions',
      name: 'Actions',
      minWidth: 100,
      maxWidth: 100,
      isResizable: true,
      onRender: (item: Invoice) => (
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
      // In a real application, this would use the actual API
      // const response = await invoiceService.getMyInvoices();
      // setInvoices(response);

      // For demo purposes, we'll use mock data
      const mockInvoices: Invoice[] = [
        {
          id: 1,
          period: 'March 2025',
          startDate: '2025-03-01T00:00:00Z',
          endDate: '2025-03-31T23:59:59Z',
          amount: 1250.00,
          status: InvoiceStatus.PAID,
          paidDate: '2025-04-05T14:30:00Z',
          pdfUrl: '/invoices/1.pdf'
        },
        {
          id: 2,
          period: 'February 2025',
          startDate: '2025-02-01T00:00:00Z',
          endDate: '2025-02-28T23:59:59Z',
          amount: 1100.50,
          status: InvoiceStatus.PAID,
          paidDate: '2025-03-06T10:15:00Z',
          pdfUrl: '/invoices/2.pdf'
        },
        {
          id: 3,
          period: 'January 2025',
          startDate: '2025-01-01T00:00:00Z',
          endDate: '2025-01-31T23:59:59Z',
          amount: 1350.75,
          status: InvoiceStatus.PAID,
          paidDate: '2025-02-04T09:45:00Z',
          pdfUrl: '/invoices/3.pdf'
        },
        {
          id: 4,
          period: 'April 2025',
          startDate: '2025-04-01T00:00:00Z',
          endDate: '2025-04-30T23:59:59Z',
          amount: 875.25,
          status: InvoiceStatus.PENDING,
          paidDate: null,
          pdfUrl: '/invoices/4.pdf'
        },
      ];

      setInvoices(mockInvoices);
      setFilteredInvoices(mockInvoices);
    } catch (error) {
      console.error('Failed to load invoices:', error);
      setError('Failed to load invoices. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handler functions
  const handleRefresh = useCallback(() => {
    loadInvoices();
    return false; // Return false to prevent default behavior
  }, [loadInvoices]);

  const handleViewInvoice = useCallback((invoice: Invoice) => {
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

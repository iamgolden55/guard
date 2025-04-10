import type React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Stack,
  Text,
  PrimaryButton,
  DefaultButton,
  DocumentCard,
  DocumentCardTitle,
  DocumentCardDetails,
  DocumentCardActions,
  type IButtonProps,
  Shimmer,
  ShimmerElementType
} from '@fluentui/react';
import { MainLayout } from '../../layouts';
import { Card } from '../../components';
import { useAuth } from '../../contexts/AuthContext';
import { shiftService, invoiceService } from '../../services';
import { type Shift, type Invoice, ShiftStatus } from '../../types';

const staffCardTokens = { childrenGap: 12 };

const StaffDashboard: React.FC = () => {
  const { authState } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [recentShifts, setRecentShifts] = useState<Shift[]>([]);
  const [pendingInvoices, setPendingInvoices] = useState<Invoice[]>([]);

  // Load dashboard data
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setIsLoading(true);

        // Get shifts, filter the active one
        const shifts = await shiftService.getShifts();
        const active = shifts.find(shift => shift.status === ShiftStatus.ACTIVE);
        const recent = shifts
          .filter(shift => shift.status !== ShiftStatus.ACTIVE)
          .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
          .slice(0, 3);

        setActiveShift(active || null);
        setRecentShifts(recent);

        // Get pending invoices
        const invoices = await invoiceService.getInvoices();
        setPendingInvoices(invoices.slice(0, 3));

      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Format time for display
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Render loading shimmer
  const renderShimmer = () => (
    <Shimmer
      shimmerElements={[
        { type: ShimmerElementType.line, height: 40, width: '100%' },
        { type: ShimmerElementType.gap, width: '100%', height: 10 },
        { type: ShimmerElementType.line, height: 100, width: '100%' },
        { type: ShimmerElementType.gap, width: '100%', height: 10 },
        { type: ShimmerElementType.line, height: 100, width: '100%' },
        { type: ShimmerElementType.gap, width: '100%', height: 10 },
        { type: ShimmerElementType.line, height: 100, width: '100%' }
      ]}
    />
  );

  return (
    <MainLayout>
      <Stack tokens={{ childrenGap: 20 }}>
        {/* Welcome section */}
        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
          <Text variant="xxLarge">
            Welcome, {authState.user?.firstName}
          </Text>

          {!activeShift && (
            <PrimaryButton
              text="Start New Shift"
              iconProps={{ iconName: 'Play' }}
              onClick={() => navigate('/shifts/new')}
            />
          )}
        </Stack>

        {/* Active shift section */}
        <Stack tokens={{ childrenGap: 16 }}>
          <Text variant="xLarge">Active Shift</Text>

          {isLoading ? (
            renderShimmer()
          ) : activeShift ? (
            <Card tokens={staffCardTokens}>
              <Text variant="large" className="font-semibold">
                {activeShift.venue.name}
              </Text>
              <Text>
                Started: {formatDate(activeShift.startTime)} at {formatTime(activeShift.startTime)}
              </Text>
              <Stack horizontal tokens={{ childrenGap: 10 }}>
                <PrimaryButton
                  text="End Shift"
                  iconProps={{ iconName: 'Stop' }}
                  onClick={() => navigate(`/shifts/${activeShift.id}/end`)}
                />
                <DefaultButton
                  text="Add Checks"
                  iconProps={{ iconName: 'CheckList' }}
                  onClick={() => navigate(`/shifts/${activeShift.id}/checks`)}
                />
              </Stack>
            </Card>
          ) : (
            <Card tokens={staffCardTokens}>
              <Text>You have no active shifts.</Text>
              <PrimaryButton
                text="Start New Shift"
                iconProps={{ iconName: 'Play' }}
                onClick={() => navigate('/shifts/new')}
              />
            </Card>
          )}
        </Stack>

        {/* Recent shifts */}
        <Stack tokens={{ childrenGap: 16 }}>
          <Text variant="xLarge">Recent Shifts</Text>

          {isLoading ? (
            renderShimmer()
          ) : recentShifts.length > 0 ? (
            <Stack horizontal wrap tokens={{ childrenGap: 16 }}>
              {recentShifts.map(shift => (
                <DocumentCard key={shift.id} className="w-full md:w-[calc(33.333%-16px)]">
                  <DocumentCardDetails>
                    <DocumentCardTitle
                      title={shift.venue.name}
                      shouldTruncate
                    />
                    <Stack tokens={{ childrenGap: 8 }} className="p-2">
                      <Text>Date: {formatDate(shift.startTime)}</Text>
                      <Text>
                        Time: {formatTime(shift.startTime)} - {
                          shift.endTime ? formatTime(shift.endTime) : 'In progress'
                        }
                      </Text>
                      <Text>Status: {shift.status}</Text>
                    </Stack>
                  </DocumentCardDetails>
                  <DocumentCardActions
                    actions={[
                      {
                        iconProps: { iconName: 'Info' },
                        title: 'View details',
                        onClick: () => navigate(`/shifts/${shift.id}`)
                      } as IButtonProps
                    ]}
                  />
                </DocumentCard>
              ))}
            </Stack>
          ) : (
            <Card tokens={staffCardTokens}>
              <Text>You have no recent shifts.</Text>
            </Card>
          )}

          <DefaultButton
            text="View All Shifts"
            iconProps={{ iconName: 'Calendar' }}
            onClick={() => navigate('/shifts')}
          />
        </Stack>

        {/* Pending invoices */}
        <Stack tokens={{ childrenGap: 16 }}>
          <Text variant="xLarge">Invoices</Text>

          {isLoading ? (
            renderShimmer()
          ) : pendingInvoices.length > 0 ? (
            <Stack tokens={{ childrenGap: 16 }}>
              {pendingInvoices.map(invoice => (
                <Card key={invoice.id} tokens={staffCardTokens}>
                  <Stack horizontal horizontalAlign="space-between">
                    <Stack>
                      <Text variant="large">Invoice #{invoice.id}</Text>
                      <Text>
                        Period: {formatDate(invoice.startDate)} - {formatDate(invoice.endDate)}
                      </Text>
                      <Text>Amount: £{invoice.totalAmount.toFixed(2)}</Text>
                      <Text>Status: {invoice.status}</Text>
                    </Stack>
                    <Stack horizontalAlign="end" verticalAlign="center">
                      <PrimaryButton
                        text="View Invoice"
                        onClick={() => navigate(`/invoices/${invoice.id}`)}
                      />
                    </Stack>
                  </Stack>
                </Card>
              ))}
            </Stack>
          ) : (
            <Card tokens={staffCardTokens}>
              <Text>You have no recent invoices.</Text>
            </Card>
          )}

          <DefaultButton
            text="View All Invoices"
            iconProps={{ iconName: 'PaymentCard' }}
            onClick={() => navigate('/invoices')}
          />
        </Stack>
      </Stack>
    </MainLayout>
  );
};

export default StaffDashboard;

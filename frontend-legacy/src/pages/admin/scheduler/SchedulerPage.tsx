import React, { useState, useCallback, useRef, useMemo } from 'react';
import './scheduler.css';
import FullCalendar from '@fullcalendar/react';
import type {
  EventDropArg,
  DateSelectArg,
  EventClickArg,
} from '@fullcalendar/core';
import type { EventResizeDoneArg } from '@fullcalendar/interaction';
import { TooltipProvider } from '../../../components/ui/tooltip';
import { ResourceTimeline } from './components/ResourceTimeline';
import { FilterToolbar } from './components/FilterToolbar';
import { ScheduleHealthSummary } from './components/ScheduleHealthSummary';
import { PublishBar } from './components/PublishBar';
import { ShiftEditorDrawer } from './components/ShiftEditorDrawer';
import {
  useResourceTimeline,
  useShiftMutations,
  usePublish,
  useScheduleHealth,
  useSchedulerFilters,
} from './hooks';
import type { ShiftFormValues, ShiftExtendedProps } from './types/scheduler';

const SchedulerPage: React.FC = () => {
  const calendarRef = useRef<FullCalendar | null>(null);

  // Date range managed by FullCalendar
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date().toISOString(),
    end: new Date(Date.now() + 7 * 86400000).toISOString(),
  });

  // Filters
  const {
    filters,
    setGroupBy,
    setVenueIds,
    setRoles,
    setStatus,
    reset: resetFilters,
  } = useSchedulerFilters();

  // Data queries
  const timelineQuery = useResourceTimeline({
    start: dateRange.start,
    end: dateRange.end,
    group_by: filters.groupBy,
    venue_ids: filters.venueIds.length > 0 ? filters.venueIds : undefined,
    roles: filters.roles.length > 0 ? filters.roles : undefined,
    status: filters.status || undefined,
  });

  const healthQuery = useScheduleHealth({
    start: dateRange.start,
    end: dateRange.end,
    venue_ids: filters.venueIds.length > 0 ? filters.venueIds : undefined,
  });

  // Mutations
  const { createShift, updateShift, deleteShift, bulkUpdate } = useShiftMutations();
  const publishMutation = usePublish();

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [drawerData, setDrawerData] = useState<Partial<ShiftFormValues> & { id?: number }>({});

  // ─── Calendar Callbacks ──────────────────────────────────────

  const handleDatesSet = useCallback((start: string, end: string) => {
    setDateRange({ start, end });
  }, []);

  const handleEventDrop = useCallback(
    (info: EventDropArg) => {
      const props = info.event.extendedProps as ShiftExtendedProps;
      const newResourceId = info.event.getResources()[0]?.id;

      // Determine new staff_user from resource ID
      let newStaffId: number | null = props.staffId;
      if (newResourceId && newResourceId.startsWith('staff_')) {
        const id = newResourceId.replace('staff_', '');
        newStaffId = id === 'unassigned' ? null : Number(id);
      }

      bulkUpdate.mutate(
        {
          updates: [
            {
              id: props.shiftId,
              staff_user: newStaffId,
              start_time: info.event.start?.toISOString(),
              end_time: info.event.end?.toISOString(),
            },
          ],
        },
        {
          onError: () => {
            info.revert();
          },
        }
      );
    },
    [bulkUpdate]
  );

  const handleEventResize = useCallback(
    (info: EventResizeDoneArg) => {
      const props = info.event.extendedProps as ShiftExtendedProps;

      bulkUpdate.mutate(
        {
          updates: [
            {
              id: props.shiftId,
              start_time: info.event.start?.toISOString(),
              end_time: info.event.end?.toISOString(),
            },
          ],
        },
        {
          onError: () => {
            info.revert();
          },
        }
      );
    },
    [bulkUpdate]
  );

  const handleDateSelect = useCallback(
    (info: DateSelectArg) => {
      const resourceId = (info as any).resource?.id;
      let staffUser: number | null = null;
      let venue = 0;

      if (resourceId) {
        if (resourceId.startsWith('staff_') && resourceId !== 'staff_unassigned') {
          staffUser = Number(resourceId.replace('staff_', ''));
        } else if (resourceId.startsWith('venue_')) {
          venue = Number(resourceId.replace('venue_', ''));
        }
      }

      // Convert to local datetime-local format for the form
      const toLocalDatetime = (d: Date) => {
        const offset = d.getTimezoneOffset();
        const local = new Date(d.getTime() - offset * 60000);
        return local.toISOString().slice(0, 16);
      };

      setDrawerData({
        staff_user: staffUser,
        venue,
        start_time: toLocalDatetime(info.start),
        end_time: toLocalDatetime(info.end),
        required_security_role: 'sg',
        break_duration: 0,
        hourly_rate: '',
        bill_rate: '',
        notes: '',
        status: 'scheduled',
      });
      setDrawerMode('create');
      setDrawerOpen(true);

      // Unselect the calendar selection
      const calApi = calendarRef.current?.getApi();
      calApi?.unselect();
    },
    []
  );

  const handleEventClick = useCallback((info: EventClickArg) => {
    const props = info.event.extendedProps as ShiftExtendedProps;

    const toLocalDatetime = (isoStr: string) => {
      const d = new Date(isoStr);
      const offset = d.getTimezoneOffset();
      const local = new Date(d.getTime() - offset * 60000);
      return local.toISOString().slice(0, 16);
    };

    setDrawerData({
      id: props.shiftId,
      venue: props.venueId,
      staff_user: props.staffId,
      start_time: info.event.start ? toLocalDatetime(info.event.start.toISOString()) : '',
      end_time: info.event.end ? toLocalDatetime(info.event.end.toISOString()) : '',
      break_duration: props.breakDuration,
      required_security_role: props.requiredRole,
      hourly_rate: props.hourlyRate || '',
      bill_rate: props.billRate || '',
      notes: props.notes || '',
      status: props.status,
    });
    setDrawerMode('edit');
    setDrawerOpen(true);
  }, []);

  // ─── Form Handlers ──────────────────────────────────────────

  const handleDrawerSubmit = useCallback(
    (data: ShiftFormValues & { id?: number }) => {
      // Convert local datetime-local back to ISO for the API
      const toISO = (dt: string) => new Date(dt).toISOString();

      const payload = {
        venue: data.venue,
        staff_user: data.staff_user,
        start_time: toISO(data.start_time),
        end_time: toISO(data.end_time),
        break_duration: data.break_duration,
        required_security_role: data.required_security_role,
        hourly_rate: data.hourly_rate || undefined,
        bill_rate: data.bill_rate || undefined,
        notes: data.notes || undefined,
        status: data.status,
        is_published: false,
      };

      if (data.id) {
        updateShift.mutate({ id: data.id, ...payload }, {
          onSuccess: () => setDrawerOpen(false),
        });
      } else {
        createShift.mutate(payload, {
          onSuccess: () => setDrawerOpen(false),
        });
      }
    },
    [createShift, updateShift]
  );

  const handleDelete = useCallback(
    (id: number) => {
      if (window.confirm('Delete this shift?')) {
        deleteShift.mutate(id, {
          onSuccess: () => setDrawerOpen(false),
        });
      }
    },
    [deleteShift]
  );

  const handleDuplicate = useCallback((data: ShiftFormValues) => {
    setDrawerData({ ...data, status: 'scheduled' });
    setDrawerMode('create');
  }, []);

  const handlePublishAll = useCallback(() => {
    publishMutation.mutate({
      date_range: { start: dateRange.start, end: dateRange.end },
      venue_ids: filters.venueIds.length > 0 ? filters.venueIds : undefined,
    });
  }, [publishMutation, dateRange, filters.venueIds]);

  // ─── Render ─────────────────────────────────────────────────

  const resources = timelineQuery.data?.resources || [];
  const events = timelineQuery.data?.events || [];

  return (
    <TooltipProvider>
      <div className="flex flex-col h-[calc(100vh-64px)] bg-gray-50">
        {/* Health summary bar */}
        <ScheduleHealthSummary health={healthQuery.data} isLoading={healthQuery.isLoading} />

        {/* Filter toolbar */}
        <FilterToolbar
          groupBy={filters.groupBy}
          onGroupByChange={setGroupBy}
          venueIds={filters.venueIds}
          onVenueIdsChange={setVenueIds}
          roles={filters.roles}
          onRolesChange={setRoles}
          status={filters.status}
          onStatusChange={setStatus}
          onReset={resetFilters}
        />

        {/* Main timeline */}
        <ResourceTimeline
          resources={resources}
          events={events}
          groupBy={filters.groupBy}
          isLoading={timelineQuery.isLoading}
          onEventDrop={handleEventDrop}
          onEventResize={handleEventResize}
          onDateSelect={handleDateSelect}
          onEventClick={handleEventClick}
          onDatesSet={handleDatesSet}
          calendarRef={calendarRef}
        />

        {/* Publish bar */}
        <PublishBar
          draftCount={healthQuery.data?.draftShifts || 0}
          isPublishing={publishMutation.isPending}
          onPublish={handlePublishAll}
        />

        {/* Shift editor drawer */}
        <ShiftEditorDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          mode={drawerMode}
          initialData={drawerData}
          onSubmit={handleDrawerSubmit}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
        />
      </div>
    </TooltipProvider>
  );
};

export default SchedulerPage;

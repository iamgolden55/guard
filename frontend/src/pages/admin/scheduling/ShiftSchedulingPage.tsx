import React, { useState, useEffect, useCallback } from 'react';
import { MessageBar, MessageBarType } from '@fluentui/react';
import { MainLayout } from '../../../layouts';
import venueService from '../../../services/venueService';
import shiftService from '../../../services/shiftService';
import settingsService from '../../../services/settingsService';
import { bulkCreateShifts } from '../../../services/api';
import type { Venue, StaffProfile } from '../../../types';

// Local imports
import { useCalendar, useFilters, useShifts, useDayView } from './hooks';
import type { ScheduleShift, ViewMode, CalendarEvent, PositionedEvent } from './types';

// Components
import {
  SchedulerHeader,
  MonthView,
  DayView,
  FilterBar,
  ActionsToolbar,
  CreateShiftDialog,
  EditShiftDialog,
  BulkCreateDialog,
  CopyShiftsDialog,
  type CreateShiftFormData,
  type EditShiftFormData,
  type BulkCreateFormData
} from './components';

export const ShiftSchedulingPage: React.FC = () => {
  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('month');

  // Data state
  const [venues, setVenues] = useState<Venue[]>([]);
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  // Settings state
  const [staticRate, setStaticRate] = useState('15.50');
  const [standardRate, setStandardRate] = useState('18.00');

  // Dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [editingShift, setEditingShift] = useState<ScheduleShift | null>(null);
  const [newShiftDate, setNewShiftDate] = useState<Date | null>(null);

  // Custom hooks
  const calendar = useCalendar();
  const filters = useFilters();
  const shiftsHook = useShifts();

  // Day view hook
  const dayView = useDayView({
    shifts: shiftsHook.shifts,
    selectedDate: calendar.currentDate
  });

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setIsDataLoading(true);
      setDataError(null);

      try {
        const venuesData = await venueService.getAllVenues();
        const mappedVenues = (Array.isArray(venuesData) ? venuesData : []).map(
          (venue) => ({
            ...venue,
            id: venue.id ?? 0,
            isActive: true
          })
        );
        setVenues(mappedVenues);

        const staffData = await shiftService.getStaffProfiles();
        if (Array.isArray(staffData)) {
          setStaff(staffData);
        } else {
          setStaff([]);
          setDataError('Failed to load staff profiles');
        }

        try {
          const settings = await settingsService.getSettings();
          setStaticRate(settings.default_hourly_rate.toString());
          setStandardRate(settings.special_event_pay_rate.toString());
        } catch {
          // Use defaults if settings fail
        }
      } catch (err) {
        console.error('Failed to load data:', err);
        setDataError('Failed to load venues and staff');
      } finally {
        setIsDataLoading(false);
      }
    };

    loadData();
  }, []);

  // Load shifts when filters change
  useEffect(() => {
    shiftsHook.loadShifts(filters.filters);
  }, [filters.filters]);

  // Event handlers
  const handleAddShift = useCallback((date: Date) => {
    setNewShiftDate(date);
    setShowCreateDialog(true);
  }, []);

  const handleEditShift = useCallback((shift: ScheduleShift) => {
    setEditingShift(shift);
    setShowEditDialog(true);
  }, []);

  const handleDeleteShift = useCallback(
    async (shift: ScheduleShift) => {
      if (window.confirm('Are you sure you want to delete this shift?')) {
        await shiftsHook.handleDeleteShift(shift.id);
      }
    },
    [shiftsHook]
  );

  // Handle day click from month view - switch to day view
  const handleDayClick = useCallback((date: Date) => {
    calendar.setCurrentDate(date);
    setViewMode('day');
  }, [calendar]);

  // Handle navigation based on view mode
  const handlePrevious = useCallback(() => {
    if (viewMode === 'month') {
      calendar.goToPreviousMonth();
    } else {
      calendar.goToPreviousDay();
    }
  }, [viewMode, calendar]);

  const handleNext = useCallback(() => {
    if (viewMode === 'month') {
      calendar.goToNextMonth();
    } else {
      calendar.goToNextDay();
    }
  }, [viewMode, calendar]);

  // Handle event edit from day view
  const handleEditEvent = useCallback((event: CalendarEvent) => {
    if (event.shift) {
      setEditingShift(event.shift);
      setShowEditDialog(true);
    }
  }, []);

  // Handle event delete from day view
  const handleDeleteEvent = useCallback(async (event: CalendarEvent) => {
    if (event.shift && window.confirm('Are you sure you want to delete this shift?')) {
      await shiftsHook.handleDeleteShift(event.shift.id);
      dayView.clearSelection();
    }
  }, [shiftsHook, dayView]);

  // Create shift handler
  const handleCreateShift = useCallback(
    async (data: CreateShiftFormData) => {
      const formatTimeToISO = (date: Date, timeString: string): string => {
        const [hours, minutes] = timeString.split(':').map(Number);
        const dateObj = new Date(date);
        dateObj.setHours(hours, minutes, 0, 0);
        return dateObj.toISOString();
      };

      const startDateTime = formatTimeToISO(data.date, data.startTime);
      let endDateTime = formatTimeToISO(data.date, data.endTime);

      if (new Date(endDateTime) < new Date(startDateTime)) {
        const nextDay = new Date(data.date);
        nextDay.setDate(nextDay.getDate() + 1);
        endDateTime = formatTimeToISO(nextDay, data.endTime);
      }

      let payRate: number | null = null;
      let isSpecialEvent = false;

      if (data.payRateType === 'static') {
        payRate = parseFloat(staticRate);
      } else if (data.payRateType === 'standard') {
        payRate = parseFloat(standardRate);
        isSpecialEvent = true;
      } else if (data.payRateType === 'custom' && data.customPayRate) {
        payRate = parseFloat(data.customPayRate);
      }

      let success = false;

      if (data.isMultiStaffMode && data.multiStaff.length > 0) {
        success = await shiftsHook.createMultiStaffShifts(
          data.venueId,
          data.multiStaff,
          startDateTime,
          endDateTime,
          data.notes,
          payRate,
          isSpecialEvent
        );
      } else {
        // Using any type due to mismatch between Shift type (camelCase) and API format (snake_case)
        const shiftData = {
          venue: data.venueId,
          staff_user: data.staffId || null,
          start_time: startDateTime,
          end_time: endDateTime,
          notes: data.notes,
          status: 'scheduled',
          required_security_role: 'sg',
          hourly_rate: payRate,
          is_special_event: isSpecialEvent
        };

        success = await shiftsHook.createShift(shiftData as any);
      }

      if (success) {
        setShowCreateDialog(false);
        setNewShiftDate(null);
        await shiftsHook.loadShifts(filters.filters);
      }
    },
    [staticRate, standardRate, shiftsHook, filters.filters]
  );

  // Update shift handler
  const handleUpdateShift = useCallback(
    async (shiftId: number, data: EditShiftFormData) => {
      const formatTimeToISO = (date: Date, timeString: string): string => {
        const [hours, minutes] = timeString.split(':').map(Number);
        const dateObj = new Date(date);
        dateObj.setHours(hours, minutes, 0, 0);
        return dateObj.toISOString();
      };

      const startDateTime = formatTimeToISO(data.date, data.startTime);
      let endDateTime = formatTimeToISO(data.date, data.endTime);

      if (new Date(endDateTime) < new Date(startDateTime)) {
        const nextDay = new Date(data.date);
        nextDay.setDate(nextDay.getDate() + 1);
        endDateTime = formatTimeToISO(nextDay, data.endTime);
      }

      const updateData = {
        venue: data.venueId,
        staff_user: data.staffId || null,
        start_time: startDateTime,
        end_time: endDateTime,
        notes: data.notes,
        status: 'scheduled',
        required_security_role: 'sg'
      };

      const success = await shiftsHook.handleUpdateShift(shiftId, updateData);

      if (success) {
        setShowEditDialog(false);
        setEditingShift(null);
      }
    },
    [shiftsHook]
  );

  // Bulk create handler
  const handleBulkCreate = useCallback(
    async (data: BulkCreateFormData) => {
      const formatTimeToISO = (date: Date, timeString: string): string => {
        const [hours, minutes] = timeString.split(':').map(Number);
        const dateObj = new Date(date);
        dateObj.setHours(hours, minutes, 0, 0);
        return dateObj.toISOString();
      };

      const shifts: any[] = [];
      const current = new Date(data.startDate);
      const end = new Date(data.endDate);
      let staffIndex = 0;

      while (current <= end) {
        if (data.daysOfWeek.includes(current.getDay())) {
          const startDateTime = formatTimeToISO(
            new Date(current),
            data.startTime
          );
          let endDateTime = formatTimeToISO(new Date(current), data.endTime);

          if (new Date(endDateTime) < new Date(startDateTime)) {
            const nextDay = new Date(current);
            nextDay.setDate(nextDay.getDate() + 1);
            endDateTime = formatTimeToISO(nextDay, data.endTime);
          }

          if (data.selectedStaff.length === 0) {
            shifts.push({
              venue: data.venueId,
              staff_user: null,
              start_time: startDateTime,
              end_time: endDateTime,
              status: 'scheduled',
              required_security_role: 'sg'
            });
          } else if (data.isSequential) {
            shifts.push({
              venue: data.venueId,
              staff_user: data.selectedStaff[staffIndex % data.selectedStaff.length],
              start_time: startDateTime,
              end_time: endDateTime,
              status: 'scheduled',
              required_security_role: 'sg'
            });
            staffIndex++;
          } else {
            for (const staffId of data.selectedStaff) {
              shifts.push({
                venue: data.venueId,
                staff_user: staffId,
                start_time: startDateTime,
                end_time: endDateTime,
                status: 'scheduled',
                required_security_role: 'sg'
              });
            }
          }
        }
        current.setDate(current.getDate() + 1);
      }

      try {
        await bulkCreateShifts(shifts);
        setShowBulkDialog(false);
        await shiftsHook.loadShifts(filters.filters);
      } catch (err) {
        console.error('Bulk create failed:', err);
        shiftsHook.setError('Failed to create shifts');
      }
    },
    [shiftsHook, filters.filters]
  );

  // Copy shifts handler
  const handleCopyShifts = useCallback(
    async (sourceMonth: Date, targetMonth: Date) => {
      const sourceShifts = shiftsHook.shifts.filter((s) => {
        const date = new Date(s.date);
        return (
          date.getMonth() === sourceMonth.getMonth() &&
          date.getFullYear() === sourceMonth.getFullYear()
        );
      });

      const monthDiff =
        (targetMonth.getFullYear() - sourceMonth.getFullYear()) * 12 +
        (targetMonth.getMonth() - sourceMonth.getMonth());

      const newShifts = sourceShifts.map((shift) => {
        const newDate = new Date(shift.date);
        newDate.setMonth(newDate.getMonth() + monthDiff);

        const [startHours, startMinutes] = shift.startTime.split(':').map(Number);
        const [endHours, endMinutes] = shift.endTime.split(':').map(Number);

        const startDateTime = new Date(newDate);
        startDateTime.setHours(startHours, startMinutes, 0, 0);

        let endDateTime = new Date(newDate);
        endDateTime.setHours(endHours, endMinutes, 0, 0);

        if (endDateTime < startDateTime) {
          endDateTime.setDate(endDateTime.getDate() + 1);
        }

        return {
          venueId: shift.venueId.toString(),
          staffIds: shift.staffId ? [shift.staffId] : undefined,
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString()
        };
      });

      try {
        await bulkCreateShifts(newShifts);
        setShowCopyDialog(false);
        calendar.goToMonth(targetMonth);
        await shiftsHook.loadShifts(filters.filters);
      } catch (err) {
        console.error('Copy shifts failed:', err);
        shiftsHook.setError('Failed to copy shifts');
      }
    },
    [shiftsHook, calendar, filters.filters]
  );

  const handlePublishShifts = useCallback(() => {
    console.log('Publish shifts');
  }, []);

  const handleSaveTemplate = useCallback(() => {
    console.log('Save template');
  }, []);

  return (
    <MainLayout>
      <div className="p-6 max-w-[1400px] mx-auto">
        {/* Header */}
        <SchedulerHeader
          currentDate={calendar.currentDate}
          monthYearDisplay={viewMode === 'day' ? calendar.dayDisplayLabel : calendar.monthYearDisplay}
          viewMode={viewMode}
          onPrevious={handlePrevious}
          onNext={handleNext}
          onToday={calendar.goToToday}
          onViewModeChange={setViewMode}
          onAddEvent={() => handleAddShift(calendar.currentDate)}
        />

        {/* Filter bar */}
        <FilterBar
          venues={venues}
          staff={staff}
          venueFilter={filters.filters.venueId}
          staffFilter={filters.filters.staffId}
          onVenueFilterChange={filters.setVenueFilter}
          onStaffFilterChange={filters.setStaffFilter}
          onClearFilters={filters.clearFilters}
          hasActiveFilters={filters.hasActiveFilters}
        />

        {/* Actions toolbar */}
        <ActionsToolbar
          isSelectionMode={shiftsHook.isSelectionMode}
          selectedCount={shiftsHook.selectedShifts.size}
          onBulkCreate={() => setShowBulkDialog(true)}
          onCopyShifts={() => setShowCopyDialog(true)}
          onPublishShifts={handlePublishShifts}
          onSaveTemplate={handleSaveTemplate}
          onToggleSelectionMode={shiftsHook.toggleSelectionMode}
          onSelectAll={shiftsHook.selectAllShifts}
          onClearSelection={shiftsHook.clearAllSelections}
          onBulkDelete={shiftsHook.handleBulkDelete}
        />

        {/* Error message */}
        {(dataError || shiftsHook.error) && (
          <MessageBar
            messageBarType={MessageBarType.error}
            onDismiss={() => {
              setDataError(null);
              shiftsHook.setError(null);
            }}
            styles={{ root: { marginTop: '16px' } }}
          >
            {dataError || shiftsHook.error}
          </MessageBar>
        )}

        {/* Calendar views */}
        <div className="mt-4">
          {viewMode === 'month' ? (
            <MonthView
              calendarDays={calendar.calendarDays}
              currentDate={calendar.currentDate}
              shifts={shiftsHook.shifts}
              isLoading={isDataLoading || shiftsHook.isLoading}
              isSelectionMode={shiftsHook.isSelectionMode}
              selectedShifts={shiftsHook.selectedShifts}
              getShiftsForDay={shiftsHook.getShiftsForDay}
              isCurrentMonth={calendar.isCurrentMonth}
              isToday={calendar.isToday}
              onAddShift={handleAddShift}
              onEditShift={handleEditShift}
              onSelectShift={shiftsHook.toggleShiftSelection}
              onDayClick={handleDayClick}
            />
          ) : (
            <DayView
              currentDate={calendar.currentDate}
              selectedDate={calendar.currentDate}
              events={dayView.positionedEvents}
              selectedEvent={dayView.selectedEvent}
              eventDates={dayView.eventDates}
              isLoading={isDataLoading || shiftsHook.isLoading}
              onDateSelect={(date) => calendar.setCurrentDate(date)}
              onMonthChange={calendar.goToMonth}
              onEventClick={dayView.handleEventClick}
              onEditEvent={handleEditEvent}
              onDeleteEvent={handleDeleteEvent}
            />
          )}
        </div>

        {/* Dialogs */}
        <CreateShiftDialog
          isOpen={showCreateDialog}
          onDismiss={() => {
            setShowCreateDialog(false);
            setNewShiftDate(null);
          }}
          onSubmit={handleCreateShift}
          venues={venues}
          staff={staff}
          initialDate={newShiftDate}
          defaultStaticRate={staticRate}
          defaultStandardRate={standardRate}
          isLoading={shiftsHook.isLoading}
          error={shiftsHook.error}
        />

        <EditShiftDialog
          isOpen={showEditDialog}
          onDismiss={() => {
            setShowEditDialog(false);
            setEditingShift(null);
          }}
          onSubmit={handleUpdateShift}
          onDelete={async (id) => {
            await shiftsHook.handleDeleteShift(id);
            setShowEditDialog(false);
            setEditingShift(null);
          }}
          shift={editingShift}
          venues={venues}
          staff={staff}
          isLoading={shiftsHook.isLoading}
          error={shiftsHook.error}
        />

        <BulkCreateDialog
          isOpen={showBulkDialog}
          onDismiss={() => setShowBulkDialog(false)}
          onSubmit={handleBulkCreate}
          venues={venues}
          staff={staff}
          isLoading={shiftsHook.isLoading}
          error={shiftsHook.error}
        />

        <CopyShiftsDialog
          isOpen={showCopyDialog}
          onDismiss={() => setShowCopyDialog(false)}
          onSubmit={handleCopyShifts}
          currentDate={calendar.currentDate}
          shifts={shiftsHook.shifts}
          isLoading={shiftsHook.isLoading}
          error={shiftsHook.error}
        />
      </div>
    </MainLayout>
  );
};

export default ShiftSchedulingPage;

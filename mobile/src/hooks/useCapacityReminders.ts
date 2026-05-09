/**
 * useCapacityReminders
 *
 * Drives the on-device cadence engine for the digital capacity-check logbook.
 * Mounted once at the top of the authed app, this hook keeps a chain of local
 * notifications scheduled so staff get prompted to log a count every 30 min
 * (or whatever interval the venue has configured).
 *
 * Behaviour:
 *  - When an active monitored shift exists, fetch the latest capacity check
 *    across the shift_group (so multi-staff continuation is honoured) and
 *    schedule the reminder chain anchored on that timestamp — or on shift
 *    start if no checks yet.
 *  - When the WS broadcasts capacity_logged for our shift_group (i.e. a
 *    teammate logged a count), reschedule from the new timestamp so the
 *    next prompt fires 30 min after THEIR log, not from shift start.
 *  - When the active shift goes away (checkout / cancellation / re-login),
 *    cancel the scheduled chain so we don't keep firing notifications for a
 *    shift that's already done.
 *
 * Why a hook (not a service): we need to react to Redux state changes, and
 * the WS subscription must be tied to the lifecycle of an authed session.
 */

import { useEffect, useRef } from 'react';

import { useAppSelector } from './useRedux';
import { selectActiveShift, type Shift } from '../store/slices/shiftsSlice';
import notificationService from '../services/notificationService';
import {
  notificationWebSocket,
  type CapacityEventMessage,
} from '../services/NotificationWebSocket';
import { shiftChecksService } from '../services/shiftChecksService';
import { logger } from '../utils/logger';

function effectiveShiftGroup(shift: Pick<Shift, 'id' | 'shift_group'>): string {
  return shift.shift_group || `shift_${shift.id}`;
}

function isMonitoredActiveShift(shift: Shift | null | undefined): shift is Shift {
  if (!shift) return false;
  if (!shift.venue?.requires_capacity_check) return false;
  // Only schedule once the user has actually checked in. If we schedule from
  // a "scheduled" shift's start_time, the first reminder might already be in
  // the past.
  if (!shift.check_in_time) return false;
  // Treat any non-terminal status as eligible.
  const terminal: Shift['status'][] = ['completed', 'cancelled', 'approved', 'no_show'];
  return !terminal.includes(shift.status);
}

export function useCapacityReminders(): void {
  const activeShift = useAppSelector(selectActiveShift);

  // Track the shift we last scheduled for, so we can cancel cleanly when it
  // changes (staff swap, shift end, etc.).
  const lastScheduledShiftIdRef = useRef<number | null>(null);

  // Schedule / reschedule whenever the active shift identity changes.
  useEffect(() => {
    let cancelled = false;

    const cancelPrevious = async () => {
      const prev = lastScheduledShiftIdRef.current;
      if (prev != null) {
        await notificationService.cancelCapacityReminders(prev);
        lastScheduledShiftIdRef.current = null;
      }
    };

    if (!isMonitoredActiveShift(activeShift)) {
      void cancelPrevious();
      return () => {
        cancelled = true;
      };
    }

    const shift = activeShift;

    (async () => {
      try {
        // Switch shifts: clear old chain before scheduling the new one.
        if (
          lastScheduledShiftIdRef.current != null &&
          lastScheduledShiftIdRef.current !== shift.id
        ) {
          await cancelPrevious();
        }

        const shiftGroup = effectiveShiftGroup(shift);

        // Anchor on the latest check across the group (multi-staff continuation),
        // falling back to shift check-in time. Failure is non-fatal — we still
        // schedule from start_time.
        let lastCheckAt: string | null = null;
        try {
          const latest = await shiftChecksService.getLatestCapacityCheck(shiftGroup);
          lastCheckAt = latest?.timestamp || null;
        } catch (e) {
          logger.warn('[useCapacityReminders] could not fetch latest check (non-fatal)', e);
        }

        if (cancelled) return;

        await notificationService.scheduleCapacityReminders({
          shiftId: shift.id,
          venueName: shift.venue.name,
          startTime: shift.check_in_time || shift.start_time,
          endTime: shift.end_time,
          intervalMinutes: shift.venue.capacity_check_interval_minutes ?? 30,
          lastCheckAt,
        });
        lastScheduledShiftIdRef.current = shift.id;
      } catch (e) {
        logger.error('[useCapacityReminders] scheduling failed', e);
      }
    })();

    return () => {
      cancelled = true;
    };
    // We deliberately key on the few fields that matter for scheduling; the
    // WS effect below handles intra-shift updates without retriggering this.
  }, [
    activeShift?.id,
    activeShift?.status,
    activeShift?.check_in_time,
    activeShift?.venue?.requires_capacity_check,
    activeShift?.venue?.capacity_check_interval_minutes,
    activeShift?.end_time,
  ]);

  // Reschedule on WS capacity_logged so the next prompt fires from the latest
  // log across the shift_group, not from the local schedule.
  useEffect(() => {
    if (!isMonitoredActiveShift(activeShift)) return;
    const shift = activeShift;
    const shiftGroup = effectiveShiftGroup(shift);

    const unsubscribe = notificationWebSocket.addCapacityEventListener(
      async (msg: CapacityEventMessage) => {
        if (msg.shift_group !== shiftGroup) return;
        if (msg.event !== 'capacity_logged') return;

        try {
          await notificationService.scheduleCapacityReminders({
            shiftId: shift.id,
            venueName: shift.venue.name,
            startTime: shift.check_in_time || shift.start_time,
            endTime: shift.end_time,
            intervalMinutes: shift.venue.capacity_check_interval_minutes ?? 30,
            lastCheckAt: msg.logged_at || null,
          });
          lastScheduledShiftIdRef.current = shift.id;
          logger.info('[useCapacityReminders] rescheduled after capacity_logged', {
            shiftId: shift.id,
            lastCheckAt: msg.logged_at,
          });
        } catch (e) {
          logger.error('[useCapacityReminders] reschedule on WS event failed', e);
        }
      },
    );

    return unsubscribe;
  }, [
    activeShift?.id,
    activeShift?.shift_group,
    activeShift?.status,
    activeShift?.check_in_time,
    activeShift?.venue?.requires_capacity_check,
    activeShift?.venue?.capacity_check_interval_minutes,
    activeShift?.venue?.name,
    activeShift?.end_time,
    activeShift?.start_time,
  ]);
}

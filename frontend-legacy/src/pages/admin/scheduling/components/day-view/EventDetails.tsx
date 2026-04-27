import React from 'react';
import { Clock16Regular, Location16Regular, Person16Regular, CalendarLtr24Regular } from '@fluentui/react-icons';
import type { CalendarEvent } from '../../types';
import { getEventColors } from '../../constants';
import { formatTime } from '../../utils/timeUtils';

interface EventDetailsProps {
  event: CalendarEvent | null;
  onEdit?: (event: CalendarEvent) => void;
  onDelete?: (event: CalendarEvent) => void;
}

export const EventDetails: React.FC<EventDetailsProps> = ({
  event,
  onEdit,
  onDelete
}) => {
  if (!event) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <div className="flex flex-col items-center justify-center text-gray-400 py-10">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
            <CalendarLtr24Regular className="w-6 h-6 text-gray-300" />
          </div>
          <p className="text-sm font-medium text-gray-500">No event selected</p>
          <p className="text-xs text-gray-400 mt-1">Click an event to view details</p>
        </div>
      </div>
    );
  }

  const colors = getEventColors(event.type);
  const startTime = `${event.start.getHours().toString().padStart(2, '0')}:${event.start.getMinutes().toString().padStart(2, '0')}`;
  const endTime = `${event.end.getHours().toString().padStart(2, '0')}:${event.end.getMinutes().toString().padStart(2, '0')}`;

  const accentColorClass = colors.bg.replace('-50', '-500');

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
      {/* Accent bar at top */}
      <div className={`h-1.5 ${accentColorClass}`} />

      <div className="p-4">
        <h3 className="font-semibold text-gray-900 text-lg mb-3 leading-tight">
          {event.title}
        </h3>

        {/* Date and time section */}
        <div className="space-y-1.5 mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock16Regular className="w-4 h-4 text-gray-400" />
            <span>
              {event.start.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric'
              })}
            </span>
          </div>

          <div className="text-sm text-gray-600 ml-6">
            {formatTime(startTime)} - {formatTime(endTime)}
          </div>
        </div>

        {event.shift?.venueName && (
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
            <Location16Regular className="w-4 h-4 text-gray-400" />
            <span>{event.shift.venueName}</span>
          </div>
        )}

        {event.attendees && event.attendees.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
              <Person16Regular className="w-4 h-4 text-gray-400" />
              <span>Attendees ({event.attendees.length})</span>
            </div>
            <div className="flex -space-x-2 ml-6">
              {event.attendees.slice(0, 5).map((attendee) => (
                <div
                  key={attendee.id}
                  className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 border-2 border-white flex items-center justify-center text-white text-xs font-medium shadow-sm"
                  title={attendee.name}
                >
                  {attendee.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
              ))}
              {event.attendees.length > 5 && (
                <div className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-gray-600 text-xs font-medium">
                  +{event.attendees.length - 5}
                </div>
              )}
            </div>
          </div>
        )}

        {event.description && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 leading-relaxed">
              {event.description}
            </p>
          </div>
        )}

        <div className="flex gap-2 pt-3 border-t border-gray-100">
          {onEdit && (
            <button
              onClick={() => onEdit(event)}
              className="flex-1 px-3 py-2 text-sm font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(event)}
              className="px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

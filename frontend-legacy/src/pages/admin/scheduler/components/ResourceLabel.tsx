import React from 'react';
import type { ResourceLabelContentArg } from '@fullcalendar/resource';
import { AlertTriangle, Shield } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import type { SchedulerResource } from '../types/scheduler';

export const ResourceLabel: React.FC<{ info: ResourceLabelContentArg }> = ({ info }) => {
  const resource = info.resource.extendedProps as Omit<SchedulerResource, 'id' | 'title'>;
  const title = info.resource.title;
  const isUnassigned = resource.type === 'unassigned';

  return (
    <div className={cn('flex items-center gap-2 py-1 px-2 min-w-0', isUnassigned && 'opacity-60')}>
      {/* Avatar or icon */}
      {resource.type === 'staff' || resource.type === 'unassigned' ? (
        resource.avatar ? (
          <img
            src={resource.avatar}
            alt={title}
            className="h-7 w-7 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className={cn(
            'h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
            isUnassigned
              ? 'bg-gray-200 text-gray-500'
              : 'bg-blue-100 text-blue-700'
          )}>
            {isUnassigned ? '?' : title.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
        )
      ) : (
        <div className="h-7 w-7 rounded flex items-center justify-center bg-emerald-100 text-emerald-700 shrink-0">
          <Shield className="h-3.5 w-3.5" />
        </div>
      )}

      {/* Name + meta */}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{title}</div>
        <div className="flex items-center gap-2 text-[10px] text-gray-500">
          {resource.role && <span className="uppercase">{resource.role}</span>}
          {resource.weeklyHours != null && resource.weeklyHours > 0 && (
            <span>{resource.weeklyHours.toFixed(1)}h</span>
          )}
          {resource.address && <span className="truncate">{resource.address}</span>}
        </div>
      </div>
    </div>
  );
};

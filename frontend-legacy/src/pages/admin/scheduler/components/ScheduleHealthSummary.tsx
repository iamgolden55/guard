import React from 'react';
import { Calendar, Clock, AlertTriangle, Eye, EyeOff, Users } from 'lucide-react';
import { Badge } from '../../../../components/ui/badge';
import type { ScheduleHealth } from '../types/scheduler';

interface Props {
  health: ScheduleHealth | undefined;
  isLoading: boolean;
}

export const ScheduleHealthSummary: React.FC<Props> = ({ health, isLoading }) => {
  if (isLoading || !health) {
    return (
      <div className="flex items-center gap-6 px-4 py-3 bg-white border-b animate-pulse">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-5 w-24 bg-gray-200 rounded" />
        ))}
      </div>
    );
  }

  const stats = [
    {
      icon: Calendar,
      label: 'Total',
      value: health.totalShifts,
      color: 'text-gray-700',
    },
    {
      icon: EyeOff,
      label: 'Draft',
      value: health.draftShifts,
      color: health.draftShifts > 0 ? 'text-amber-600' : 'text-gray-500',
    },
    {
      icon: Eye,
      label: 'Published',
      value: health.publishedShifts,
      color: 'text-green-600',
    },
    {
      icon: Users,
      label: 'Open',
      value: health.openShifts,
      color: health.openShifts > 0 ? 'text-blue-600' : 'text-gray-500',
    },
    {
      icon: Clock,
      label: 'Hours',
      value: health.totalHours.toFixed(1),
      color: 'text-gray-700',
    },
  ];

  return (
    <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b">
      <div className="flex items-center gap-5">
        {stats.map((stat) => (
          <div key={stat.label} className="flex items-center gap-1.5">
            <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
            <span className="text-xs text-gray-500">{stat.label}</span>
            <span className={`text-sm font-semibold ${stat.color}`}>{stat.value}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        {health.conflicts > 0 && (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            {health.conflicts} conflict{health.conflicts !== 1 ? 's' : ''}
          </Badge>
        )}
        {health.overtimeWarnings > 0 && (
          <Badge variant="warning" className="gap-1">
            <Clock className="h-3 w-3" />
            {health.overtimeWarnings} overtime
          </Badge>
        )}
        {health.estimatedCost > 0 && (
          <span className="text-xs text-gray-500">
            Est. cost: <span className="font-semibold text-gray-700">{'\u00A3'}{health.estimatedCost.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
          </span>
        )}
      </div>
    </div>
  );
};

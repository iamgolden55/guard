import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '../../../../components/ui/tooltip';
import type { ScheduleWarning } from '../types/scheduler';

interface Props {
  warnings: ScheduleWarning[];
}

export const ConflictBadge: React.FC<Props> = ({ warnings }) => {
  if (warnings.length === 0) return null;

  const hasErrors = warnings.some((w) => w.severity === 'error');
  const Icon = hasErrors ? AlertTriangle : Info;
  const colorClass = hasErrors ? 'text-red-500' : 'text-amber-500';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex ${colorClass}`}>
            <Icon className="h-3.5 w-3.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <ul className="space-y-1 text-xs">
            {warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className={w.severity === 'error' ? 'text-red-400' : 'text-amber-400'}>
                  {w.severity === 'error' ? '\u2716' : '\u26A0'}
                </span>
                {w.message}
              </li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

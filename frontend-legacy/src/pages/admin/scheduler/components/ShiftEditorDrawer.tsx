import React, { useEffect, useState } from 'react';
import { useForm, Controller, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Trash2, Copy, AlertTriangle, Send } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '../../../../components/ui/sheet';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Badge } from '../../../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../components/ui/select';
import { SECURITY_ROLES } from '../types/scheduler';
import type { ShiftFormValues, ShiftExtendedProps, ValidationResult } from '../types/scheduler';
import { useShiftValidation } from '../hooks/useShiftValidation';
import venueService from '../../../../services/venueService';
import shiftService from '../../../../services/shiftService';

const shiftSchema = z.object({
  venue: z.number().min(1, 'Venue is required'),
  staff_user: z.number().nullable(),
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
  break_duration: z.number().min(0).max(480),
  required_security_role: z.string().min(1, 'Role is required'),
  hourly_rate: z.string(),
  bill_rate: z.string(),
  notes: z.string(),
  status: z.string(),
});

interface Props {
  open: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  initialData?: Partial<ShiftFormValues> & { id?: number };
  onSubmit: (data: ShiftFormValues & { id?: number }) => void;
  onDelete?: (id: number) => void;
  onDuplicate?: (data: ShiftFormValues) => void;
  onPublishSingle?: (id: number) => void;
}

export const ShiftEditorDrawer: React.FC<Props> = ({
  open,
  onClose,
  mode,
  initialData,
  onSubmit,
  onDelete,
  onDuplicate,
  onPublishSingle,
}) => {
  const [venues, setVenues] = useState<Array<{ id: number; name: string }>>([]);
  const [staff, setStaff] = useState<Array<{ id: number; name: string }>>([]);
  const [validation, setValidation] = useState<ValidationResult | null>(null);

  const validateMutation = useShiftValidation();

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ShiftFormValues>({
    resolver: zodResolver(shiftSchema) as unknown as Resolver<ShiftFormValues>,
    defaultValues: {
      venue: 0,
      staff_user: null,
      start_time: '',
      end_time: '',
      break_duration: 0,
      required_security_role: 'sg',
      hourly_rate: '',
      bill_rate: '',
      notes: '',
      status: 'scheduled',
    },
  });

  // Load venues + staff
  useEffect(() => {
    venueService.getAllVenues().then((data) => {
      if (Array.isArray(data)) setVenues(data.map((v: any) => ({ id: v.id, name: v.name })));
    }).catch(() => {});

    shiftService.getStaffProfiles().then((data) => {
      if (Array.isArray(data)) setStaff(data.map((s: any) => ({
        id: s.id,
        name: `${s.firstName || s.first_name || ''} ${s.lastName || s.last_name || ''}`.trim() || s.username || `Staff ${s.id}`,
      })));
    }).catch(() => {});
  }, []);

  // Reset form when initialData changes
  useEffect(() => {
    if (initialData && open) {
      reset({
        venue: initialData.venue || 0,
        staff_user: initialData.staff_user ?? null,
        start_time: initialData.start_time || '',
        end_time: initialData.end_time || '',
        break_duration: initialData.break_duration || 0,
        required_security_role: initialData.required_security_role || 'sg',
        hourly_rate: initialData.hourly_rate || '',
        bill_rate: initialData.bill_rate || '',
        notes: initialData.notes || '',
        status: initialData.status || 'scheduled',
      });
      setValidation(null);
    }
  }, [initialData, open, reset]);

  // Watch key fields for validation
  const watchedStaff = watch('staff_user');
  const watchedStart = watch('start_time');
  const watchedEnd = watch('end_time');
  const watchedRole = watch('required_security_role');

  // Run pre-flight validation when key fields change
  useEffect(() => {
    if (!watchedStart || !watchedEnd || !open) return;
    const timeout = setTimeout(() => {
      validateMutation.mutate(
        {
          staff_user: watchedStaff,
          start_time: watchedStart,
          end_time: watchedEnd,
          required_security_role: watchedRole,
          exclude_shift_id: mode === 'edit' ? initialData?.id : null,
        },
        {
          onSuccess: (result) => setValidation(result),
        }
      );
    }, 500);
    return () => clearTimeout(timeout);
  }, [watchedStaff, watchedStart, watchedEnd, watchedRole, open]);

  const handleFormSubmit = (data: ShiftFormValues) => {
    onSubmit({ ...data, id: initialData?.id });
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{mode === 'create' ? 'Create Shift' : 'Edit Shift'}</SheetTitle>
          <SheetDescription>
            {mode === 'create'
              ? 'Add a new shift to the schedule'
              : `Shift #${initialData?.id}`}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 mt-6">
          {/* Venue */}
          <div className="space-y-1.5">
            <Label>Venue *</Label>
            <Controller
              name="venue"
              control={control}
              render={({ field }) => (
                <Select value={String(field.value || '')} onValueChange={(v) => field.onChange(Number(v))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select venue" />
                  </SelectTrigger>
                  <SelectContent>
                    {venues.map((v) => (
                      <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.venue && <p className="text-xs text-red-500">{errors.venue.message}</p>}
          </div>

          {/* Staff */}
          <div className="space-y-1.5">
            <Label>Guard (leave empty for open shift)</Label>
            <Controller
              name="staff_user"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value != null ? String(field.value) : '__none__'}
                  onValueChange={(v) => field.onChange(v === '__none__' ? null : Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned (open shift)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unassigned (open shift)</SelectItem>
                    {staff.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Date/Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start *</Label>
              <Input type="datetime-local" {...register('start_time')} />
              {errors.start_time && <p className="text-xs text-red-500">{errors.start_time.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>End *</Label>
              <Input type="datetime-local" {...register('end_time')} />
              {errors.end_time && <p className="text-xs text-red-500">{errors.end_time.message}</p>}
            </div>
          </div>

          {/* Break + Role */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Break (min)</Label>
              <Input type="number" {...register('break_duration', { valueAsNumber: true })} />
            </div>
            <div className="space-y-1.5">
              <Label>Role *</Label>
              <Controller
                name="required_security_role"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SECURITY_ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* Rates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Pay rate ({'\u00A3'}/hr)</Label>
              <Input type="text" placeholder="18.00" {...register('hourly_rate')} />
            </div>
            <div className="space-y-1.5">
              <Label>Bill rate ({'\u00A3'}/hr)</Label>
              <Input type="text" placeholder="25.00" {...register('bill_rate')} />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <textarea
              {...register('notes')}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[60px]"
              placeholder="Site instructions, special requirements..."
            />
          </div>

          {/* Validation warnings */}
          {validation && (validation.errors.length > 0 || validation.warnings.length > 0) && (
            <div className="space-y-2">
              {validation.errors.map((e, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  {e.message}
                </div>
              ))}
              {validation.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-md px-3 py-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  {w.message}
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <SheetFooter className="pt-4 border-t">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                {mode === 'edit' && initialData?.id && onDelete && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => onDelete(initialData.id!)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
                {mode === 'edit' && onDuplicate && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const values = watch();
                      onDuplicate(values);
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting || (validation ? !validation.valid : false)}
                >
                  {mode === 'create' ? 'Create Shift' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
};

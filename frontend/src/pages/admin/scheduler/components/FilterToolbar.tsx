import React, { useState, useEffect } from 'react';
import { Search, Filter, Users, MapPin, X } from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Badge } from '../../../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../components/ui/select';
import { SECURITY_ROLES } from '../types/scheduler';
import type { GroupBy } from '../types/scheduler';
import venueService from '../../../../services/venueService';
import shiftService from '../../../../services/shiftService';

interface Props {
  groupBy: GroupBy;
  onGroupByChange: (v: GroupBy) => void;
  venueIds: number[];
  onVenueIdsChange: (ids: number[]) => void;
  roles: string[];
  onRolesChange: (roles: string[]) => void;
  status: string;
  onStatusChange: (s: string) => void;
  onReset: () => void;
}

export const FilterToolbar: React.FC<Props> = ({
  groupBy,
  onGroupByChange,
  venueIds,
  onVenueIdsChange,
  roles,
  onRolesChange,
  status,
  onStatusChange,
  onReset,
}) => {
  const [venues, setVenues] = useState<Array<{ id: number; name: string }>>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    venueService.getAllVenues().then((data) => {
      if (Array.isArray(data)) {
        setVenues(data.map((v: any) => ({ id: v.id, name: v.name })));
      }
    }).catch(() => {});
  }, []);

  const activeFilterCount = venueIds.length + roles.length + (status ? 1 : 0);

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-white border-b">
      {/* Group by toggle */}
      <div className="flex items-center bg-gray-100 rounded-md p-0.5">
        <button
          onClick={() => onGroupByChange('staff')}
          className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            groupBy === 'staff' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          Guards
        </button>
        <button
          onClick={() => onGroupByChange('venue')}
          className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            groupBy === 'venue' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <MapPin className="h-3.5 w-3.5" />
          Venues
        </button>
      </div>

      <div className="w-px h-6 bg-gray-200" />

      {/* Venue filter */}
      <Select
        value={venueIds.length === 1 ? String(venueIds[0]) : '__all__'}
        onValueChange={(val) => onVenueIdsChange(val === '__all__' ? [] : [Number(val)])}
      >
        <SelectTrigger className="w-[180px] h-8 text-xs">
          <SelectValue placeholder="All venues" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All venues</SelectItem>
          {venues.map((v) => (
            <SelectItem key={v.id} value={String(v.id)}>
              {v.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Role filter */}
      <Select
        value={roles.length === 1 ? roles[0] : '__all__'}
        onValueChange={(val) => onRolesChange(val === '__all__' ? [] : [val])}
      >
        <SelectTrigger className="w-[160px] h-8 text-xs">
          <SelectValue placeholder="All roles" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All roles</SelectItem>
          {SECURITY_ROLES.map((r) => (
            <SelectItem key={r.value} value={r.value}>
              {r.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Status filter */}
      <Select
        value={status || '__all__'}
        onValueChange={(val) => onStatusChange(val === '__all__' ? '' : val)}
      >
        <SelectTrigger className="w-[140px] h-8 text-xs">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All statuses</SelectItem>
          <SelectItem value="scheduled">Scheduled</SelectItem>
          <SelectItem value="open">Open</SelectItem>
          <SelectItem value="in_progress">In Progress</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="cancelled">Cancelled</SelectItem>
        </SelectContent>
      </Select>

      {/* Active filter count + reset */}
      {activeFilterCount > 0 && (
        <Button variant="ghost" size="sm" onClick={onReset} className="h-8 gap-1 text-xs">
          <X className="h-3 w-3" />
          Clear ({activeFilterCount})
        </Button>
      )}

      <div className="flex-1" />

      {/* Search (future) */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        <Input
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 w-48 pl-8 text-xs"
        />
      </div>
    </div>
  );
};

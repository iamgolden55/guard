export type IncidentType =
  | 'security_breach'
  | 'medical_emergency'
  | 'fire_alarm'
  | 'suspicious_activity'
  | 'property_damage'
  | 'assault'
  | 'other';

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface Incident {
  id?: number;
  shift?: number;
  incident_type: IncidentType;
  severity: IncidentSeverity;
  title: string;
  description: string;
  location_description: string;
  latitude?: number;
  longitude?: number;
  occurred_at: string;
  reported_at: string;

  // Evidence
  photos?: string[];
  videos?: string[];
  voice_note?: string;

  // People involved
  witnesses?: string[];
  persons_involved?: string[];

  // Actions taken
  actions_taken?: string;
  police_notified?: boolean;
  ambulance_called?: boolean;

  // Status
  status?: 'draft' | 'submitted' | 'under_review' | 'resolved';
  sync_status?: 'pending' | 'synced' | 'failed';
}

export interface IncidentTypeOption {
  type: IncidentType;
  icon: string;
  label: string;
  color: string;
  severity: IncidentSeverity;
}

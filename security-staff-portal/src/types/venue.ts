export interface Venue {
  id?: number;
  name: string;
  address: string;
  city: string;
  postal_code: string;
  country: string;
  is_active: boolean;
  capacity: number;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  description: string;
  terms_and_conditions: string;
  requires_fire_safety_checks: boolean;
  requires_capacity_monitoring: boolean;
  requires_toilet_checks: boolean;
  terms_version?: string;
  latitude?: number;
  longitude?: number;
  created_at?: string;
  updated_at?: string;
}

export interface VenueRequest {
  name: string;
  address: string;
  city: string;
  postal_code: string;
  country: string;
  is_active: boolean;
  capacity: number;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  description: string;
  terms_and_conditions: string;
  requires_fire_safety_checks: boolean;
  requires_capacity_monitoring: boolean;
  requires_toilet_checks: boolean;
  terms_version?: string;
  latitude?: number;
  longitude?: number;
}

export interface VenueResponse {
  message: string;
  venue: Venue;
}

export interface VenuesResponse {
  venues: Venue[];
} 
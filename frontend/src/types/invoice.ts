export interface Invoice {
  id: number;
  staff_user: number;
  staff_user_details?: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  start_date: string;
  end_date: string;
  total_hours: number;
  hourly_rate: number;
  total_amount: number;
  status: InvoiceStatus;
  pdf_url: string | null;
  created_at: string;
  updated_at: string;
  items?: InvoiceItem[];
  payment_breakdown?: PaymentBreakdown;
  
  // Legacy fields for backward compatibility
  staffUser?: number;
  staffName?: string;
  startDate?: string;
  endDate?: string;
  totalHours?: number;
  totalAmount?: number;
  pdfUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaymentBreakdown {
  regular_shifts: {
    count: number;
    hours: number;
    amount: number;
    average_rate: number;
  };
  special_event_shifts: {
    count: number;
    hours: number;
    amount: number;
    average_rate: number;
  };
  total: {
    count: number;
    hours: number;
    amount: number;
  };
}

export enum InvoiceStatus {
  PENDING = 'pending',
  PAID = 'paid',
  REJECTED = 'rejected'
}

export interface InvoiceItem {
  id: number;
  invoice: number;
  shift: number;
  date: string;
  venue: string;
  hoursWorked: number;
  rate: number;
  amount: number;
  venue_details?: {
    id: number;
    name: string;
    address: string;
  };
  shift_details?: {
    id: number;
    start_time: string;
    end_time: string;
    is_special_event: boolean;
    hourly_rate: number;
    actual_hours_worked: number;
    calculated_payment: number;
  };
}

export interface InvoiceFilter {
  startDate?: string;
  endDate?: string;
  status?: InvoiceStatus;
  staffUser?: number;
}

export interface PayRate {
  id: number;
  staffUser: number;
  venueName?: string;
  venue?: number | null; // Null for default rate
  hourlyRate: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

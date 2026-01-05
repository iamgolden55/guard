export interface InvoiceItem {
  id: number;
  date: string;
  venue: string;
  venue_details?: {
    name: string;
  };
  hours_worked: string | number; // API might return string
  rate: string | number;
  amount: string | number;
  shift_details?: {
    is_special_event: boolean;
  };
}

export interface PaymentCategory {
  count: number;
  hours: number | string;
  amount: number | string;
  average_rate?: number | string;
}

export interface PaymentBreakdown {
  regular_shifts: PaymentCategory;
  special_event_shifts: PaymentCategory;
  total: PaymentCategory;
}

export interface Invoice {
  id: number;
  start_date: string;
  end_date: string;
  total_amount: string | number;
  status: 'pending' | 'paid' | 'overdue';
  pdf_url: string | null;
  created_at: string;
  updated_at: string;
  payment_breakdown?: PaymentBreakdown;
  items?: InvoiceItem[];
}

// Invoices page data layer — TanStack Query against billingService.
//
// Reads
//   ["billing", "invoices", kind]        getInvoices(kind)
//   ["billing", "stats", kind]           getStats(kind)
//   ["billing", "providers"]             getFinanceProviders()
//
// Writes
//   exportToXero(invoiceId)              POST /billing/exports/{id}/export-to-xero/
//   createStatement(payload)             POST /billing/statements/
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import billingService from "../../../services/billingService";
import type { InvoiceKind, InvoiceRecord, InvoiceStats } from "../data/mocks";

const INVOICES_KEY = (kind: InvoiceKind) => ["billing", "invoices", kind] as const;
const STATS_KEY = (kind: InvoiceKind) => ["billing", "stats", kind] as const;
const PROVIDERS_KEY = ["billing", "providers"] as const;

const EMPTY_STATS: InvoiceStats = {
  counts: { total: 0, draft: 0, sent: 0, pending: 0, overdue: 0, paid: 0, rejected: 0, resolved: 0 },
  totals: { sent: 0, overdue: 0, paid: 0, draft: 0, outstanding: 0 },
  buckets: { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 },
};

export function useInvoicesData(kind: InvoiceKind) {
  const queryClient = useQueryClient();

  const invoicesQuery = useQuery<InvoiceRecord[]>({
    queryKey: INVOICES_KEY(kind),
    queryFn: () => billingService.getInvoices(kind),
    staleTime: 30_000,
  });

  const statsQuery = useQuery<InvoiceStats>({
    queryKey: STATS_KEY(kind),
    queryFn: () => billingService.getStats(kind),
    staleTime: 30_000,
  });

  const providersQuery = useQuery({
    queryKey: PROVIDERS_KEY,
    queryFn: () => billingService.getFinanceProviders(),
    staleTime: 5 * 60_000,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: INVOICES_KEY(kind) });
    queryClient.invalidateQueries({ queryKey: STATS_KEY(kind) });
    queryClient.invalidateQueries({ queryKey: ["billing", "activity"] });
  };

  const exportToXero = useMutation({
    mutationFn: (invoiceId: string) => billingService.exportToXero(invoiceId),
    onSuccess: invalidateAll,
  });

  const createStatement = useMutation({
    mutationFn: (payload: Parameters<typeof billingService.createStatement>[0]) =>
      billingService.createStatement(payload),
  });

  const markPaid = useMutation({
    mutationFn: (invoiceId: string) => billingService.markPaid(invoiceId),
    onSuccess: invalidateAll,
  });

  const reject = useMutation({
    mutationFn: ({ invoiceId, reason }: { invoiceId: string; reason: string }) =>
      billingService.reject(invoiceId, reason),
    onSuccess: invalidateAll,
  });

  const voidInvoice = useMutation({
    mutationFn: ({ invoiceId, reason }: { invoiceId: string; reason?: string }) =>
      billingService.void(invoiceId, reason),
    onSuccess: invalidateAll,
  });

  const remind = useMutation({
    mutationFn: (invoiceId: string) => billingService.remind(invoiceId),
    onSuccess: invalidateAll,
  });

  const duplicate = useMutation({
    mutationFn: (invoiceId: string) => billingService.duplicate(invoiceId),
    onSuccess: invalidateAll,
  });

  const resolveAndReissue = useMutation({
    mutationFn: (invoiceId: string) => billingService.resolve(invoiceId),
    onSuccess: invalidateAll,
  });

  const createClientInvoice = useMutation({
    mutationFn: (payload: {
      venueId: string | number;
      periodStart: string;
      periodEnd: string;
      notes?: string;
    }) => billingService.createClientInvoiceFromShifts(payload),
    onSuccess: invalidateAll,
  });

  const downloadPdf = useMutation({
    mutationFn: (invoiceId: string) => billingService.downloadPdf(invoiceId),
  });

  const issue = useMutation({
    mutationFn: (invoiceId: string) => billingService.issue(invoiceId),
    onSuccess: invalidateAll,
  });

  const updateNote = useMutation({
    mutationFn: ({ invoiceId, note }: { invoiceId: string; note: string }) =>
      billingService.updateNote(invoiceId, note),
    onSuccess: invalidateAll,
  });

  const recalculate = useMutation({
    mutationFn: (invoiceId: string) => billingService.recalculate(invoiceId),
    onSuccess: invalidateAll,
  });

  const editShiftRate = useMutation({
    mutationFn: ({
      invoiceId,
      shiftId,
      hourlyRate,
    }: {
      invoiceId: string;
      shiftId: number;
      hourlyRate: number;
    }) => billingService.editShiftRate(invoiceId, shiftId, hourlyRate),
    onSuccess: invalidateAll,
  });

  const emailPayslip = useMutation({
    mutationFn: (invoiceId: string) => billingService.emailPayslip(invoiceId),
    onSuccess: invalidateAll,
  });

  return {
    invoices: invoicesQuery.data ?? [],
    stats: statsQuery.data ?? EMPTY_STATS,
    providers: providersQuery.data ?? [],
    isLoading: invoicesQuery.isLoading || statsQuery.isLoading,
    error: invoicesQuery.error || statsQuery.error,
    refetchInvoices: () => invoicesQuery.refetch(),
    exportToXero,
    createStatement,
    markPaid,
    reject,
    voidInvoice,
    remind,
    duplicate,
    resolveAndReissue,
    downloadPdf,
    emailPayslip,
    issue,
    updateNote,
    recalculate,
    editShiftRate,
    createClientInvoice,
  };
}

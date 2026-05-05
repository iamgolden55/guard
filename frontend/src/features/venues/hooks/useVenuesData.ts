// Venues admin data layer — TanStack Query against venueService.
//
// Reads
//   ["venues"]                    getAllVenues()
//
// Writes (all optimistic over the cached list)
//   createVenue                   add to cache; invalidate on settle
//   updateVenue                   replace by id in cache
//   toggleStatus                  flip is_active in cache (PATCH)
//   deleteVenue                   remove by id; invalidate on settle
//
// Every mutation calls invalidateQueries(["venues"]) in onSettled so server
// reality wins after the round-trip.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import venueService from "../../../services/venueService";
import type { Venue } from "../../../types/venue";

const VENUES_KEY = ["venues"] as const;

export function useVenuesData() {
  const queryClient = useQueryClient();

  const venuesQuery = useQuery<Venue[]>({
    queryKey: VENUES_KEY,
    queryFn: () => venueService.getAllVenues(),
  });

  // ── Create ─────────────────────────────────────────────────────────────────
  const createVenue = useMutation({
    mutationFn: (venue: Venue) => venueService.createVenue(venue),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: VENUES_KEY });
    },
  });

  // ── Update (full PUT) ─────────────────────────────────────────────────────
  const updateVenue = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Venue> }) =>
      venueService.updateVenue(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: VENUES_KEY });
      const prev = queryClient.getQueryData<Venue[]>(VENUES_KEY);
      if (prev) {
        queryClient.setQueryData<Venue[]>(VENUES_KEY, (curr) =>
          (curr ?? []).map((v) => (v.id === id ? { ...v, ...data } : v)),
        );
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(VENUES_KEY, ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: VENUES_KEY });
    },
  });

  // ── Toggle status (PATCH) ─────────────────────────────────────────────────
  const toggleStatus = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      venueService.updateVenueStatus(id, isActive),
    onMutate: async ({ id, isActive }) => {
      await queryClient.cancelQueries({ queryKey: VENUES_KEY });
      const prev = queryClient.getQueryData<Venue[]>(VENUES_KEY);
      if (prev) {
        queryClient.setQueryData<Venue[]>(VENUES_KEY, (curr) =>
          (curr ?? []).map((v) => (v.id === id ? { ...v, is_active: isActive } : v)),
        );
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(VENUES_KEY, ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: VENUES_KEY });
    },
  });

  // ── Delete ─────────────────────────────────────────────────────────────────
  const deleteVenue = useMutation({
    mutationFn: (id: number) => venueService.deleteVenue(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: VENUES_KEY });
      const prev = queryClient.getQueryData<Venue[]>(VENUES_KEY);
      if (prev) {
        queryClient.setQueryData<Venue[]>(VENUES_KEY, (curr) =>
          (curr ?? []).filter((v) => v.id !== id),
        );
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(VENUES_KEY, ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: VENUES_KEY });
    },
  });

  const venues = venuesQuery.data ?? [];

  return {
    venues,
    counts: {
      all: venues.length,
      active: venues.filter((v) => v.is_active).length,
      inactive: venues.filter((v) => !v.is_active).length,
    },
    isLoading: venuesQuery.isLoading,
    isError: venuesQuery.isError,
    error: venuesQuery.error,
    createVenue,
    updateVenue,
    toggleStatus,
    deleteVenue,
  };
}

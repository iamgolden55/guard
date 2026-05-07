// Mapbox Search Box API wrapper.
//
// Endpoints (https://docs.mapbox.com/api/search/search-box/):
//   GET /search/searchbox/v1/suggest      — autocomplete suggestions
//   GET /search/searchbox/v1/retrieve/:id — full feature (with coordinates)
//
// Both calls share a session_token UUID so Mapbox bills the entire
// "find an address" interaction as ONE session, not N requests.

const SUGGEST_ENDPOINT = "https://api.mapbox.com/search/searchbox/v1/suggest";
const RETRIEVE_ENDPOINT = "https://api.mapbox.com/search/searchbox/v1/retrieve";

export interface MapboxSuggestion {
  mapbox_id: string;
  name: string;
  name_preferred?: string;
  place_formatted: string;
  feature_type: string;
  context?: {
    country?: { name?: string };
    postcode?: { name?: string };
    place?: { name?: string };
    locality?: { name?: string };
    region?: { name?: string };
    address?: { name?: string };
    street?: { name?: string };
  };
}

export interface MapboxRetrieved {
  address: string;
  city: string;
  postcode: string;
  country: string;
  latitude: number;
  longitude: number;
  fullName: string;
}

export interface SuggestOptions {
  /** ISO 3166-1 alpha-2 country code(s), comma-separated. Defaults to "gb". */
  country?: string;
  /** Maximum suggestions to return. Default 6. */
  limit?: number;
  /** Optional bias point [lng, lat] — Mapbox prefers results near this. */
  proximity?: [number, number];
  signal?: AbortSignal;
}

export class MissingMapboxTokenError extends Error {
  constructor() {
    super(
      "Mapbox token missing. Set VITE_MAPBOX_TOKEN in your .env to enable address autocomplete.",
    );
    this.name = "MissingMapboxTokenError";
  }
}

function getToken(): string {
  const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
  if (!token) throw new MissingMapboxTokenError();
  return token;
}

export function isMapboxConfigured(): boolean {
  return Boolean(import.meta.env.VITE_MAPBOX_TOKEN);
}

/** Fetch autocomplete suggestions for a query. Honours AbortSignal. */
export async function suggest(
  query: string,
  sessionToken: string,
  options: SuggestOptions = {},
): Promise<MapboxSuggestion[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const token = getToken();

  const params = new URLSearchParams({
    q: trimmed,
    access_token: token,
    session_token: sessionToken,
    country: options.country ?? "gb",
    limit: String(options.limit ?? 6),
    language: "en",
    types: "address,postcode,place,locality,neighborhood,street",
  });
  if (options.proximity) {
    params.set("proximity", `${options.proximity[0]},${options.proximity[1]}`);
  }

  const response = await fetch(`${SUGGEST_ENDPOINT}?${params.toString()}`, {
    signal: options.signal,
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Mapbox suggest failed (${response.status}): ${body}`);
  }
  const data = (await response.json()) as { suggestions?: MapboxSuggestion[] };
  return data.suggestions ?? [];
}

/** Fetch the full feature (with coordinates) for a previously suggested id. */
export async function retrieve(
  mapboxId: string,
  sessionToken: string,
  signal?: AbortSignal,
): Promise<MapboxRetrieved> {
  const token = getToken();
  const params = new URLSearchParams({
    access_token: token,
    session_token: sessionToken,
    language: "en",
  });
  const response = await fetch(
    `${RETRIEVE_ENDPOINT}/${encodeURIComponent(mapboxId)}?${params.toString()}`,
    { signal },
  );
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Mapbox retrieve failed (${response.status}): ${body}`);
  }
  const data = (await response.json()) as RetrieveResponse;
  const feature = data.features?.[0];
  if (!feature) {
    throw new Error("Mapbox retrieve returned no features");
  }
  return normalize(feature);
}

/** Generate an RFC4122 v4 UUID for the Mapbox session_token field. */
export function newSessionToken(): string {
  // Use crypto.randomUUID when available; fall back to a manual implementation
  // for older browsers (mostly Safari < 15.4 / Edge < 91).
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => {
    const n = Number(c);
    return (
      n ^
      (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (n / 4)))
    ).toString(16);
  });
}

// ── Internal: normalize a Mapbox feature into our flat shape ────────────────

interface RetrieveFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    name_preferred?: string;
    full_address?: string;
    place_formatted?: string;
    feature_type?: string;
    context?: {
      country?: { name?: string };
      postcode?: { name?: string };
      place?: { name?: string };
      locality?: { name?: string };
      region?: { name?: string };
      address?: { name?: string; address_number?: string; street_name?: string };
      street?: { name?: string };
    };
  };
}

interface RetrieveResponse {
  features?: RetrieveFeature[];
}

function normalize(feature: RetrieveFeature): MapboxRetrieved {
  const props = feature.properties ?? {};
  const ctx = props.context ?? {};
  const coords = feature.geometry?.coordinates ?? [0, 0];

  // Address line: prefer the explicit address (number + street) when feature
  // is an address; otherwise use the feature name.
  let address = "";
  if (props.feature_type === "address") {
    const num = ctx.address?.address_number;
    const street = ctx.address?.street_name ?? ctx.street?.name;
    if (num && street) address = `${num} ${street}`;
    else if (street) address = street;
    else if (props.name) address = props.name;
  } else if (props.feature_type === "street") {
    address = ctx.street?.name ?? props.name ?? "";
  } else {
    address = props.name ?? "";
  }

  const city =
    ctx.place?.name ?? ctx.locality?.name ?? ctx.region?.name ?? "";
  const postcode = ctx.postcode?.name ?? "";
  const country = ctx.country?.name ?? "";

  return {
    address,
    city,
    postcode,
    country,
    latitude: coords[1] ?? 0,
    longitude: coords[0] ?? 0,
    fullName: props.full_address ?? props.place_formatted ?? props.name ?? "",
  };
}

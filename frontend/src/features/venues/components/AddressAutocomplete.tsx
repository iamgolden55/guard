// AddressAutocomplete — Mapbox-backed combobox.
//
// UX targets ("Uber-grade"):
//   - 250ms trailing debounce; AbortController cancels in-flight on every
//     keystroke so latest query always wins
//   - One Mapbox session_token per typing flow; regenerated after a selection
//   - Keyboard nav (↑/↓ Enter Esc), click-outside close, no stale results
//   - Helpful inline messages when the token is missing or the network fails
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useAccent } from "../../../contexts/AccentContext";
import { Icon } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import {
  isMapboxConfigured,
  MissingMapboxTokenError,
  newSessionToken,
  retrieve,
  suggest,
  type MapboxRetrieved,
  type MapboxSuggestion,
} from "../../../services/mapboxGeocoding";

const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

export interface AddressAutocompleteProps {
  /** Optional current input value (controlled). Falls back to internal state. */
  value?: string;
  onValueChange?: (value: string) => void;
  /** Called once the user picks a suggestion AND we've retrieved its full feature. */
  onSelect: (result: MapboxRetrieved) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function AddressAutocomplete({
  value: valueProp,
  onValueChange,
  onSelect,
  placeholder = "Search by postcode or address…",
  disabled,
}: AddressAutocompleteProps) {
  const { palette } = useAccent();
  const configured = isMapboxConfigured();

  // Controlled-or-not pattern.
  const [internalValue, setInternalValue] = useState("");
  const value = valueProp ?? internalValue;
  const setValue = useCallback(
    (next: string) => {
      if (onValueChange) onValueChange(next);
      else setInternalValue(next);
    },
    [onValueChange],
  );

  const [suggestions, setSuggestions] = useState<MapboxSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [hoverIndex, setHoverIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const sessionTokenRef = useRef<string>(newSessionToken());
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Click-outside closes the dropdown but keeps the input value.
  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (containerRef.current && target && !containerRef.current.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const runSearch = useCallback(
    async (query: string) => {
      if (!configured) return;

      // Cancel any in-flight request — keystrokes win.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);
      try {
        const results = await suggest(query, sessionTokenRef.current, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setSuggestions(results);
        setHoverIndex(results.length > 0 ? 0 : -1);
        setHasSearched(true);
      } catch (err) {
        if (controller.signal.aborted || (err as Error).name === "AbortError") {
          return;
        }
        if (err instanceof MissingMapboxTokenError) {
          setError(err.message);
        } else {
          setError(
            "Couldn't reach the address service. You can still fill the fields manually.",
          );
        }
        setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    },
    [configured],
  );

  const handleChange = (raw: string) => {
    setValue(raw);
    setError(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = raw.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      // Reset cleanly when the input shrinks below the threshold or empties.
      abortRef.current?.abort();
      setSuggestions([]);
      setHoverIndex(-1);
      setLoading(false);
      setHasSearched(false);
      setOpen(trimmed.length > 0);
      return;
    }

    setOpen(true);
    debounceRef.current = setTimeout(() => {
      void runSearch(trimmed);
    }, DEBOUNCE_MS);
  };

  const pick = useCallback(
    async (suggestion: MapboxSuggestion) => {
      try {
        // Use the same session token, then start a fresh one for next session.
        setLoading(true);
        const result = await retrieve(suggestion.mapbox_id, sessionTokenRef.current);
        sessionTokenRef.current = newSessionToken();
        onSelect(result);
        setValue(result.fullName || `${result.address}, ${result.city}`);
        setOpen(false);
        setSuggestions([]);
        setHasSearched(false);
        setError(null);
      } catch (err) {
        if (err instanceof MissingMapboxTokenError) {
          setError(err.message);
        } else {
          setError("Couldn't fetch that address. Please try another.");
        }
      } finally {
        setLoading(false);
      }
    },
    [onSelect, setValue],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) {
      if (event.key === "Escape") {
        setOpen(false);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHoverIndex((i) => (i + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHoverIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const choice = suggestions[hoverIndex] ?? suggestions[0];
      if (choice) void pick(choice);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  };

  const handleClear = () => {
    setValue("");
    abortRef.current?.abort();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSuggestions([]);
    setHoverIndex(-1);
    setHasSearched(false);
    setOpen(false);
    setError(null);
    inputRef.current?.focus();
  };

  const showDropdown = open && configured && !disabled;

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "100%" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "white",
          border: `1px solid ${
            showDropdown ? palette.primary : tokens.color.ink200
          }`,
          borderRadius: tokens.radius.md,
          padding: "8px 12px",
          boxShadow: showDropdown ? tokens.shadow.focus : "none",
          transition: `border-color ${tokens.motion.fast}, box-shadow ${tokens.motion.fast}`,
        }}
      >
        <Icon
          name="search"
          size={16}
          style={{ color: tokens.color.ink500, flexShrink: 0 }}
        />
        <input
          ref={inputRef}
          type="text"
          value={value}
          placeholder={placeholder}
          disabled={disabled || !configured}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0 || value.trim().length >= MIN_QUERY_LENGTH) {
              setOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={
            showDropdown && hoverIndex >= 0
              ? `${listboxId}-option-${hoverIndex}`
              : undefined
          }
          autoComplete="off"
          spellCheck={false}
          style={{
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: 13.5,
            fontFamily: tokens.font.body,
            flex: 1,
            color: tokens.color.ink900,
            minWidth: 0,
          }}
        />
        {loading && <Spinner color={palette.primary} />}
        {!loading && value && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear address search"
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              border: "none",
              background: tokens.color.ink100,
              color: tokens.color.ink600,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <Icon name="x" size={11} />
          </button>
        )}
      </div>

      {!configured && (
        <div
          style={{
            marginTop: 6,
            background: tokens.color.warnSoft,
            border: `1px solid ${tokens.color.warn}33`,
            color: tokens.color.warnInk,
            borderRadius: tokens.radius.md,
            padding: "8px 10px",
            fontSize: 12,
            fontFamily: tokens.font.body,
            lineHeight: 1.45,
          }}
        >
          Address autocomplete is unavailable — set <code>VITE_MAPBOX_TOKEN</code>{" "}
          in your <code>.env</code> to enable it. You can still fill the fields
          manually below.
        </div>
      )}

      {error && configured && (
        <div
          role="alert"
          style={{
            marginTop: 6,
            background: tokens.color.dangerSoft,
            border: `1px solid ${tokens.color.danger}33`,
            color: tokens.color.dangerInk,
            borderRadius: tokens.radius.md,
            padding: "8px 10px",
            fontSize: 12,
            fontFamily: tokens.font.body,
          }}
        >
          {error}
        </div>
      )}

      {showDropdown && (
        <ul
          id={listboxId}
          role="listbox"
          tabIndex={-1}
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            margin: 0,
            padding: 0,
            listStyle: "none",
            background: "white",
            border: `1px solid ${tokens.color.ink200}`,
            borderRadius: tokens.radius.md,
            boxShadow: tokens.shadow.md,
            maxHeight: 320,
            overflowY: "auto",
            zIndex: tokens.z.overlay,
          }}
        >
          {suggestions.length === 0 && hasSearched && !loading && (
            <li
              style={{
                padding: "14px 14px",
                fontSize: 12.5,
                color: tokens.color.ink500,
                fontFamily: tokens.font.body,
              }}
            >
              No matches — try a different postcode or address.
            </li>
          )}

          {suggestions.length === 0 && !hasSearched && !loading && (
            <li
              style={{
                padding: "14px 14px",
                fontSize: 12.5,
                color: tokens.color.ink500,
                fontFamily: tokens.font.body,
              }}
            >
              Keep typing — at least {MIN_QUERY_LENGTH} characters.
            </li>
          )}

          {suggestions.map((sug, index) => {
            const isActive = index === hoverIndex;
            return (
              <li
                key={sug.mapbox_id}
                id={`${listboxId}-option-${index}`}
                role="option"
                aria-selected={isActive}
                onClick={() => void pick(sug)}
                onMouseEnter={() => setHoverIndex(index)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    void pick(sug);
                  }
                }}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  width: "100%",
                  padding: "10px 14px",
                  background: isActive ? palette.soft : "white",
                  cursor: "pointer",
                  textAlign: "left",
                  borderBottom: `1px solid ${tokens.color.ink100}`,
                  fontFamily: tokens.font.body,
                }}
              >
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background: isActive ? palette.primary : tokens.color.ink100,
                    color: isActive ? "white" : tokens.color.ink600,
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  <Icon name="map-pin" size={12} />
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: 13,
                      fontWeight: 600,
                      color: isActive ? palette.ink : tokens.color.ink900,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {sug.name}
                  </span>
                  <span
                    style={{
                      display: "block",
                      fontSize: 11.5,
                      color: tokens.color.ink500,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      marginTop: 1,
                    }}
                  >
                    {sug.place_formatted}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Spinner({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      style={{
        width: 14,
        height: 14,
        borderRadius: 7,
        border: `2px solid ${color}33`,
        borderTopColor: color,
        animation: "ms-spin 0.8s linear infinite",
        flexShrink: 0,
      }}
    />
  );
}

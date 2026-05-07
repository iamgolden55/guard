import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ColumnDefinition<T> {
  id: string;
  header: string;
  cell: (item: T) => React.ReactNode;
  sortingField?: string;
  width?: number | string;
  minWidth?: number;
}

export interface CloudscapeTableProps<T> {
  items: T[];
  columnDefinitions: ColumnDefinition<T>[];
  header?: React.ReactNode;
  loading?: boolean;
  loadingText?: string;
  empty?: React.ReactNode;
  filter?: React.ReactNode;
  pagination?: React.ReactNode;
  preferences?: React.ReactNode;
  selectionType?: 'single' | 'multi';
  selectedItems?: T[];
  onSelectionChange?: (items: T[]) => void;
  sortingColumn?: { sortingField: string };
  sortingDescending?: boolean;
  onSortingChange?: (detail: {
    sortingColumn: { sortingField: string };
    isDescending: boolean;
  }) => void;
  trackBy?: string | ((item: T) => string);
  variant?: 'full-page' | 'container' | 'embedded';
  stickyHeader?: boolean;
  wrapLines?: boolean;
  stripedRows?: boolean;
  className?: string;
  /** When provided and viewport is below mobileBreakpoint, renders cards instead of rows. */
  cardDefinition?: {
    header: (item: T) => React.ReactNode;
    sections: Array<{
      id: string;
      header: string;
      content: (item: T) => React.ReactNode;
    }>;
  };
  /** Viewport width (px) below which the card layout is used. @default 768 */
  mobileBreakpoint?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getItemKey<T>(item: T, index: number, trackBy?: string | ((item: T) => string)): string {
  if (!trackBy) return String(index);
  if (typeof trackBy === 'function') return trackBy(item);
  return String((item as Record<string, unknown>)[trackBy] ?? index);
}

function isItemSelected<T>(
  item: T,
  index: number,
  selectedItems: T[],
  trackBy?: string | ((item: T) => string),
): boolean {
  const key = getItemKey(item, index, trackBy);
  return selectedItems.some((s, si) => getItemKey(s, si, trackBy) === key);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Sort direction indicator arrow */
const SortIndicator: React.FC<{ active: boolean; descending: boolean }> = ({ active, descending }) => (
  <span
    className={`inline-flex ml-1 transition-transform duration-150 ${
      active ? 'text-gray-900' : 'text-gray-300 opacity-0 group-hover/sortable:opacity-100'
    } ${active && descending ? 'rotate-180' : ''}`}
    aria-hidden
  >
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  </span>
);

/** Spinner used in the loading overlay */
const Spinner: React.FC = () => (
  <svg
    className="animate-spin h-6 w-6 text-red-600"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

/** Checkbox matching the project accent colour */
const Checkbox: React.FC<{
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel?: string;
}> = ({ checked, indeterminate = false, onChange, ariaLabel }) => {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="w-4 h-4 accent-red-600 rounded border-gray-300 cursor-pointer focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
      aria-label={ariaLabel}
    />
  );
};

// ---------------------------------------------------------------------------
// useMediaQuery hook (lightweight, no external deps)
// ---------------------------------------------------------------------------

function useMediaQuery(maxWidth: number): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < maxWidth : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mql = window.matchMedia(`(max-width: ${maxWidth - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);

    // Set initial value
    setMatches(mql.matches);

    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [maxWidth]);

  return matches;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

function CloudscapeTableInner<T>(
  {
    items,
    columnDefinitions,
    header,
    loading = false,
    loadingText = 'Loading items',
    empty,
    filter,
    pagination,
    preferences,
    selectionType,
    selectedItems = [],
    onSelectionChange,
    sortingColumn,
    sortingDescending = false,
    onSortingChange,
    trackBy,
    variant = 'container',
    stickyHeader = false,
    wrapLines = false,
    stripedRows = false,
    className = '',
    cardDefinition,
    mobileBreakpoint = 768,
  }: CloudscapeTableProps<T>,
) {
  const isMobile = useMediaQuery(mobileBreakpoint);
  const showCards = isMobile && !!cardDefinition;

  // ----- selection helpers -----

  const allSelected = useMemo(
    () => items.length > 0 && items.every((item, i) => isItemSelected(item, i, selectedItems, trackBy)),
    [items, selectedItems, trackBy],
  );

  const someSelected = useMemo(
    () => !allSelected && items.some((item, i) => isItemSelected(item, i, selectedItems, trackBy)),
    [items, selectedItems, allSelected, trackBy],
  );

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (!onSelectionChange) return;
      onSelectionChange(checked ? [...items] : []);
    },
    [items, onSelectionChange],
  );

  const handleSelectItem = useCallback(
    (item: T, index: number, checked: boolean) => {
      if (!onSelectionChange) return;

      if (selectionType === 'single') {
        onSelectionChange(checked ? [item] : []);
        return;
      }

      if (checked) {
        onSelectionChange([...selectedItems, item]);
      } else {
        const key = getItemKey(item, index, trackBy);
        onSelectionChange(selectedItems.filter((s, si) => getItemKey(s, si, trackBy) !== key));
      }
    },
    [onSelectionChange, selectionType, selectedItems, trackBy],
  );

  // ----- sorting handler -----

  const handleSort = useCallback(
    (field: string) => {
      if (!onSortingChange) return;
      const isSameColumn = sortingColumn?.sortingField === field;
      onSortingChange({
        sortingColumn: { sortingField: field },
        isDescending: isSameColumn ? !sortingDescending : false,
      });
    },
    [onSortingChange, sortingColumn, sortingDescending],
  );

  // ----- variant styles -----

  const wrapperClasses = useMemo(() => {
    const base = 'bg-white';
    switch (variant) {
      case 'full-page':
        return base;
      case 'embedded':
        return `${base} border border-gray-200 rounded-xl`;
      case 'container':
      default:
        return `${base} border border-gray-200 rounded-xl shadow-[0_1px_2px_0_rgba(0,7,22,0.05)]`;
    }
  }, [variant]);

  // ----- render: card view (mobile) -----

  const renderCards = () => {
    if (!cardDefinition) return null;

    return (
      <div className="flex flex-col gap-3 p-3">
        {items.map((item, index) => {
          const key = getItemKey(item, index, trackBy);
          const selected = isItemSelected(item, index, selectedItems, trackBy);

          return (
            <div
              key={key}
              className={`bg-white border rounded-xl shadow-sm overflow-hidden transition-colors ${
                selected ? 'border-red-300 bg-red-50' : 'border-gray-200'
              }`}
            >
              {/* Card header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                {selectionType && (
                  <Checkbox
                    checked={selected}
                    onChange={(checked) => handleSelectItem(item, index, checked)}
                    ariaLabel={`Select item ${key}`}
                  />
                )}
                <div className="font-semibold text-sm text-gray-900 min-w-0 truncate">
                  {cardDefinition.header(item)}
                </div>
              </div>

              {/* Card sections */}
              <div className="divide-y divide-gray-100">
                {cardDefinition.sections.map((section) => (
                  <div key={section.id} className="px-4 py-2.5">
                    <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">
                      {section.header}
                    </dt>
                    <dd className="text-sm text-gray-900">{section.content(item)}</dd>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ----- render: table view -----

  const renderTable = () => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        {/* Table Head */}
        <thead
          className={`bg-gray-50 border-b border-gray-200 ${
            stickyHeader ? 'sticky top-0 z-10' : ''
          }`}
        >
          <tr>
            {/* Selection header checkbox */}
            {selectionType && (
              <th className="w-11 px-3 py-3">
                {selectionType === 'multi' && (
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={handleSelectAll}
                    ariaLabel="Select all items"
                  />
                )}
              </th>
            )}

            {columnDefinitions.map((col) => {
              const isSortable = !!col.sortingField && !!onSortingChange;
              const isActive = sortingColumn?.sortingField === col.sortingField;

              const widthStyle: React.CSSProperties = {};
              if (col.width) {
                widthStyle.width = typeof col.width === 'number' ? `${col.width}px` : col.width;
              }
              if (col.minWidth) {
                widthStyle.minWidth = `${col.minWidth}px`;
              }

              return (
                <th
                  key={col.id}
                  style={widthStyle}
                  className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider select-none ${
                    isSortable ? 'group/sortable cursor-pointer hover:text-gray-700' : ''
                  }`}
                  onClick={isSortable ? () => handleSort(col.sortingField!) : undefined}
                  aria-sort={
                    isActive
                      ? sortingDescending
                        ? 'descending'
                        : 'ascending'
                      : undefined
                  }
                >
                  <span className="inline-flex items-center">
                    {col.header}
                    {isSortable && (
                      <SortIndicator active={isActive} descending={isActive && sortingDescending} />
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>

        {/* Table Body */}
        <tbody className="divide-y divide-gray-100">
          {/* Loading overlay */}
          {loading && (
            <tr>
              <td
                colSpan={(selectionType ? 1 : 0) + columnDefinitions.length}
                className="py-16"
              >
                <div className="flex flex-col items-center justify-center gap-3 text-gray-500">
                  <Spinner />
                  <span className="text-sm">{loadingText}</span>
                </div>
              </td>
            </tr>
          )}

          {/* Empty state */}
          {!loading && items.length === 0 && (
            <tr>
              <td
                colSpan={(selectionType ? 1 : 0) + columnDefinitions.length}
              >
                {empty ?? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-500 text-sm">
                    No items to display
                  </div>
                )}
              </td>
            </tr>
          )}

          {/* Data rows */}
          {!loading &&
            items.map((item, index) => {
              const key = getItemKey(item, index, trackBy);
              const selected = isItemSelected(item, index, selectedItems, trackBy);

              return (
                <tr
                  key={key}
                  className={[
                    'transition-colors',
                    selected ? 'bg-red-50' : '',
                    !selected && stripedRows && index % 2 === 1 ? 'bg-gray-50/50' : '',
                    'hover:bg-gray-50',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {selectionType && (
                    <td className="w-11 px-3 py-3">
                      <Checkbox
                        checked={selected}
                        onChange={(checked) => handleSelectItem(item, index, checked)}
                        ariaLabel={`Select item ${key}`}
                      />
                    </td>
                  )}

                  {columnDefinitions.map((col) => {
                    const widthStyle: React.CSSProperties = {};
                    if (col.width) {
                      widthStyle.width = typeof col.width === 'number' ? `${col.width}px` : col.width;
                    }
                    if (col.minWidth) {
                      widthStyle.minWidth = `${col.minWidth}px`;
                    }

                    return (
                      <td
                        key={col.id}
                        style={widthStyle}
                        className={`px-4 py-3 text-sm text-gray-700 ${
                          wrapLines ? '' : 'truncate max-w-[1px]'
                        }`}
                      >
                        {col.cell(item)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );

  // ----- full render -----

  return (
    <div className={`${wrapperClasses} ${className}`}>
      {/* Header + toolbar row */}
      {(header || filter || preferences) && (
        <div className="px-5 py-4 border-b border-gray-100">
          {/* Header */}
          {header && <div className="mb-3 last:mb-0">{header}</div>}

          {/* Filter + preferences row */}
          {(filter || preferences) && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              {filter && <div className="flex-1 min-w-0 w-full sm:w-auto">{filter}</div>}
              {preferences && <div className="flex-shrink-0">{preferences}</div>}
            </div>
          )}
        </div>
      )}

      {/* Table or cards */}
      {showCards ? renderCards() : renderTable()}

      {/* Pagination footer */}
      {pagination && (
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 rounded-b-xl">
          {pagination}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Memoised export (preserves generic type parameter via cast)
// ---------------------------------------------------------------------------

const CloudscapeTable = React.memo(CloudscapeTableInner) as typeof CloudscapeTableInner;

export default CloudscapeTable;

import React, { useState, useEffect, useCallback } from 'react';

type FlashbarType = 'success' | 'warning' | 'error' | 'info';

export interface FlashbarItem {
  id: string;
  type: FlashbarType;
  header?: string;
  content: React.ReactNode;
  dismissible?: boolean;
  action?: React.ReactNode;
  autoDismiss?: boolean;
  autoDismissMs?: number;
}

interface FlashbarProps {
  items: FlashbarItem[];
  onDismiss?: (id: string) => void;
  className?: string;
}

const flashStyles: Record<FlashbarType, { bg: string; border: string; icon: string; iconPath: string }> = {
  success: {
    bg: 'bg-green-50',
    border: 'border-green-300',
    icon: 'text-green-600',
    iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    icon: 'text-amber-600',
    iconPath: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z',
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-300',
    icon: 'text-red-600',
    iconPath: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    icon: 'text-blue-600',
    iconPath: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
};

const FlashbarItemComponent: React.FC<{
  item: FlashbarItem;
  onDismiss?: (id: string) => void;
}> = ({ item, onDismiss }) => {
  const styles = flashStyles[item.type] || flashStyles.info;

  useEffect(() => {
    if (item.autoDismiss !== false && item.type === 'success') {
      const timer = setTimeout(() => {
        onDismiss?.(item.id);
      }, item.autoDismissMs || 5000);
      return () => clearTimeout(timer);
    }
  }, [item, onDismiss]);

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 border rounded-xl ${styles.bg} ${styles.border} animate-fade-in`}
      role="alert"
    >
      <svg
        className={`w-5 h-5 flex-shrink-0 mt-0.5 ${styles.icon}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={styles.iconPath} />
      </svg>

      <div className="flex-1 min-w-0">
        {item.header && (
          <p className="text-sm font-semibold text-gray-900 mb-0.5">{item.header}</p>
        )}
        <div className="text-sm text-gray-700">{item.content}</div>
        {item.action && <div className="mt-2">{item.action}</div>}
      </div>

      {(item.dismissible !== false) && (
        <button
          onClick={() => onDismiss?.(item.id)}
          className="flex-shrink-0 p-1 rounded-lg hover:bg-black/5 transition-colors"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
};

const Flashbar: React.FC<FlashbarProps> = ({ items, onDismiss, className = '' }) => {
  if (items.length === 0) return null;

  return (
    <div className={`flex flex-col gap-2 ${className}`} role="region" aria-label="Notifications">
      {items.map((item) => (
        <FlashbarItemComponent key={item.id} item={item} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

// Hook for managing flashbar items
export function useFlashbar() {
  const [items, setItems] = useState<FlashbarItem[]>([]);

  const addFlash = useCallback((item: Omit<FlashbarItem, 'id'>) => {
    const id = `flash-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setItems((prev) => [...prev, { ...item, id }]);
    return id;
  }, []);

  const removeFlash = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
  }, []);

  return { items, addFlash, removeFlash, clearAll };
}

export default Flashbar;

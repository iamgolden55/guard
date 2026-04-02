import React, { useState, useEffect, useRef } from 'react';

interface ConfirmationModalProps {
  visible: boolean;
  header: string;
  children: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  /** For destructive actions: require user to type this text to confirm */
  confirmationText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  visible,
  header,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  confirmationText,
  onConfirm,
  onCancel,
  loading = false,
}) => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (visible) {
      setInputValue('');
      // Focus input if confirmation text is required
      if (confirmationText) {
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    }
  }, [visible, confirmationText]);

  // Handle ESC key
  useEffect(() => {
    if (!visible) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [visible, onCancel]);

  if (!visible) return null;

  const isConfirmDisabled = loading || (confirmationText && inputValue !== confirmationText);

  const confirmButtonClass = variant === 'destructive'
    ? 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500'
    : 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500';

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="relative bg-white rounded-2xl shadow-xl max-w-md w-full animate-scale-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-0">
          <h2 id="modal-title" className="text-lg font-semibold text-gray-900">
            {header}
          </h2>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          <div className="text-sm text-gray-600">{children}</div>

          {confirmationText && (
            <div className="mt-4">
              <p className="text-sm text-gray-600 mb-2">
                To confirm, type <span className="font-mono font-semibold text-gray-900">{confirmationText}</span> below.
              </p>
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder={confirmationText}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 pb-6 pt-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={!!isConfirmDisabled}
            className={`px-4 h-9 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${confirmButtonClass}`}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Processing...
              </span>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;

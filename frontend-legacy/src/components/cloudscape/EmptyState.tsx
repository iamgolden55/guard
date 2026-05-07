import React from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  variant?: 'empty' | 'no-match' | 'error';
  icon?: React.ReactNode;
  className?: string;
}

const defaultIcons: Record<string, React.ReactNode> = {
  empty: (
    <svg className="w-12 h-12 text-[#D1D5DB]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
    </svg>
  ),
  'no-match': (
    <svg className="w-12 h-12 text-[#D1D5DB]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  error: (
    <svg className="w-12 h-12 text-[#FECACA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
    </svg>
  ),
};

const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  action,
  variant = 'empty',
  icon,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center py-14 px-6 text-center ${className}`}>
      <div className="mb-5">
        {icon || defaultIcons[variant]}
      </div>
      <h3 className="text-[15px] font-semibold text-[#1A1A2E] mb-1">{title}</h3>
      {description && (
        <p className="text-[13px] text-[#9CA3AF] max-w-md mb-5">{description}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
};

export default EmptyState;

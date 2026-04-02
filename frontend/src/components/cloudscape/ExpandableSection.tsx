import React, { useState } from 'react';

interface ExpandableSectionProps {
  children: React.ReactNode;
  headerText: string;
  headerDescription?: string;
  defaultExpanded?: boolean;
  variant?: 'default' | 'container';
  headerCounter?: string;
  className?: string;
}

const ExpandableSection: React.FC<ExpandableSectionProps> = ({
  children,
  headerText,
  headerDescription,
  defaultExpanded = false,
  variant = 'default',
  headerCounter,
  className = '',
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const containerClass = variant === 'container'
    ? 'bg-white border border-gray-200 rounded-xl shadow-[0_1px_2px_0_rgba(0,7,22,0.05)]'
    : '';

  return (
    <div className={`${containerClass} ${className}`}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={`
          w-full flex items-center justify-between text-left
          ${variant === 'container' ? 'px-5 py-4' : 'py-3'}
          hover:bg-gray-50/50 transition-colors rounded-t-xl
        `}
        aria-expanded={expanded}
      >
        <div>
          <span className="text-base font-semibold text-gray-900">
            {headerText}
            {headerCounter && (
              <span className="text-gray-500 font-normal ml-1.5">({headerCounter})</span>
            )}
          </span>
          {headerDescription && (
            <p className="text-sm text-gray-500 mt-0.5">{headerDescription}</p>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200 ${
            expanded ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className={variant === 'container' ? 'px-5 pb-5 border-t border-gray-100 pt-4' : 'pt-2'}>
          {children}
        </div>
      )}
    </div>
  );
};

export default ExpandableSection;

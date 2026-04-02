import React from 'react';

interface ContainerProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  variant?: 'default' | 'stacked';
  disablePadding?: boolean;
  className?: string;
}

const Container: React.FC<ContainerProps> = ({
  children,
  header,
  footer,
  variant = 'default',
  disablePadding = false,
  className = '',
}) => {
  const shadowClass = variant === 'stacked'
    ? 'shadow-[0_1px_2px_0_rgba(0,7,22,0.05),0_2px_6px_0_rgba(0,7,22,0.05)]'
    : 'shadow-[0_1px_2px_0_rgba(0,7,22,0.05)]';

  return (
    <div
      className={`bg-white border border-gray-200 rounded-xl ${shadowClass} ${className}`}
    >
      {header && (
        <div className="px-5 py-4 border-b border-gray-100">
          {typeof header === 'string' ? (
            <h2 className="text-base font-semibold text-gray-900">{header}</h2>
          ) : (
            header
          )}
        </div>
      )}

      <div className={disablePadding ? '' : 'p-5'}>
        {children}
      </div>

      {footer && (
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 rounded-b-xl">
          {footer}
        </div>
      )}
    </div>
  );
};

export default Container;

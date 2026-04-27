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
  return (
    <div
      className={`bg-white border border-[#EAEAF0] rounded-2xl ${className}`}
    >
      {header && (
        <div className="px-6 py-5 border-b border-[#F0F0F5]">
          {typeof header === 'string' ? (
            <h2 className="text-[15px] font-semibold text-[#1A1A2E]">{header}</h2>
          ) : (
            header
          )}
        </div>
      )}

      <div className={disablePadding ? '' : 'p-6'}>
        {children}
      </div>

      {footer && (
        <div className="px-6 py-4 border-t border-[#F0F0F5] bg-[#FAFAFE] rounded-b-2xl">
          {footer}
        </div>
      )}
    </div>
  );
};

export default Container;

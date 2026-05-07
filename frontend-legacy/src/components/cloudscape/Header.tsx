import React from 'react';

interface HeaderProps {
  children: React.ReactNode;
  variant?: 'h1' | 'h2' | 'h3';
  description?: React.ReactNode;
  counter?: string;
  actions?: React.ReactNode;
  info?: React.ReactNode;
  className?: string;
}

const variantStyles = {
  h1: 'text-[28px] font-bold text-[#1A1A2E] tracking-[-0.02em] leading-9',
  h2: 'text-[18px] font-semibold text-[#1A1A2E] tracking-[-0.01em]',
  h3: 'text-[15px] font-semibold text-[#1A1A2E]',
};

const Header: React.FC<HeaderProps> = ({
  children,
  variant = 'h1',
  description,
  counter,
  actions,
  info,
  className = '',
}) => {
  const Tag = variant;

  return (
    <div className={`flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <Tag className={variantStyles[variant]}>
            {children}
            {counter && (
              <span className="text-[#9CA3AF] font-normal ml-2">({counter})</span>
            )}
          </Tag>
          {info}
        </div>
        {description && (
          <p className="mt-1.5 text-[14px] text-[#6B7280] leading-relaxed">{description}</p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2.5 flex-shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
};

export default Header;

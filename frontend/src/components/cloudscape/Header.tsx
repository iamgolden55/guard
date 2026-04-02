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
  h1: 'text-2xl font-semibold text-gray-900 font-heading tracking-tight',
  h2: 'text-lg font-semibold text-gray-900',
  h3: 'text-base font-semibold text-gray-900',
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
        <div className="flex items-center gap-2 flex-wrap">
          <Tag className={variantStyles[variant]}>
            {children}
            {counter && (
              <span className="text-gray-500 font-normal ml-1.5">({counter})</span>
            )}
          </Tag>
          {info}
        </div>
        {description && (
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
};

export default Header;

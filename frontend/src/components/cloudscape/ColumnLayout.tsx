import React from 'react';

interface ColumnLayoutProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4;
  variant?: 'default' | 'text-grid';
  className?: string;
}

const columnMap = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
};

const ColumnLayout: React.FC<ColumnLayoutProps> = ({
  children,
  columns = 2,
  variant = 'default',
  className = '',
}) => {
  const gapClass = variant === 'text-grid' ? 'gap-4' : 'gap-6';

  return (
    <div className={`grid ${columnMap[columns]} ${gapClass} ${className}`}>
      {children}
    </div>
  );
};

export default ColumnLayout;

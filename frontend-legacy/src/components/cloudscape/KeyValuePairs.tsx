import React from 'react';

interface KeyValueItem {
  label: string;
  value: React.ReactNode;
}

interface KeyValuePairsProps {
  items: KeyValueItem[];
  columns?: 2 | 3 | 4;
  className?: string;
}

const columnMap = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
};

const KeyValuePairs: React.FC<KeyValuePairsProps> = ({
  items,
  columns = 2,
  className = '',
}) => {
  return (
    <dl className={`grid ${columnMap[columns]} gap-x-6 gap-y-4 ${className}`}>
      {items.map((item, index) => (
        <div key={index}>
          <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
            {item.label}
          </dt>
          <dd className="text-sm text-gray-900">
            {item.value ?? <span className="text-gray-400">&ndash;</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
};

export default KeyValuePairs;

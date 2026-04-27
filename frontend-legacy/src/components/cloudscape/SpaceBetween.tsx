import React from 'react';

type SpaceSize = 'xxxs' | 'xxs' | 'xs' | 's' | 'm' | 'l' | 'xl' | 'xxl' | 'xxxl';

interface SpaceBetweenProps {
  children: React.ReactNode;
  size?: SpaceSize;
  direction?: 'vertical' | 'horizontal';
  alignItems?: 'center' | 'start' | 'end' | 'stretch';
  className?: string;
}

const sizeMap: Record<SpaceSize, string> = {
  xxxs: 'gap-0.5',
  xxs: 'gap-1',
  xs: 'gap-2',
  s: 'gap-3',
  m: 'gap-4',
  l: 'gap-5',
  xl: 'gap-6',
  xxl: 'gap-8',
  xxxl: 'gap-10',
};

const alignMap: Record<string, string> = {
  center: 'items-center',
  start: 'items-start',
  end: 'items-end',
  stretch: 'items-stretch',
};

const SpaceBetween: React.FC<SpaceBetweenProps> = ({
  children,
  size = 'm',
  direction = 'vertical',
  alignItems,
  className = '',
}) => {
  const directionClass = direction === 'horizontal' ? 'flex flex-row flex-wrap' : 'flex flex-col';
  const alignClass = alignItems ? alignMap[alignItems] : '';

  return (
    <div className={`${directionClass} ${sizeMap[size]} ${alignClass} ${className}`}>
      {children}
    </div>
  );
};

export default SpaceBetween;

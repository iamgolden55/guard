import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  tokens?: {
    childrenGap?: number;
    padding?: number;
  };
}

const Card: React.FC<CardProps> = ({ children, className = '', tokens = {} }) => {
  const padding = tokens.padding !== undefined ? tokens.padding : 16; // Default padding

  // Apply childrenGap to direct children if specified
  const renderChildrenWithGap = () => {
    return React.Children.map(children, (child, index) => {
      const isLastChild = index === React.Children.count(children) - 1;

      // Only add gap after non-last children
      if (!isLastChild && tokens.childrenGap) {
        return (
          <>
            {child}
            <div style={{ height: tokens.childrenGap }} />
          </>
        );
      }

      return child;
    });
  };

  return (
    <div
      className={`bg-white rounded-md border border-gray-200 shadow-sm ${className}`}
      style={{ padding }}
    >
      {tokens.childrenGap ? renderChildrenWithGap() : children}
    </div>
  );
};

export default Card;

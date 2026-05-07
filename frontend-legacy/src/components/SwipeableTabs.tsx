import React, { useState, useRef, useEffect } from 'react';
import {
  Stack,
  Text,
  useTheme,
  mergeStyles,
  IStackTokens
} from '@fluentui/react';

interface TabItem {
  key: string;
  headerText: string;
  content: React.ReactNode;
}

interface SwipeableTabsProps {
  tabs: TabItem[];
  defaultSelectedKey?: string;
  onTabChange?: (key: string) => void;
  isMobile?: boolean;
}

const SwipeableTabs: React.FC<SwipeableTabsProps> = ({
  tabs,
  defaultSelectedKey,
  onTabChange,
  isMobile = false
}) => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(defaultSelectedKey || tabs[0]?.key || '');
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const [translateX, setTranslateX] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  const activeIndex = tabs.findIndex(tab => tab.key === activeTab);

  useEffect(() => {
    if (onTabChange) {
      onTabChange(activeTab);
    }
  }, [activeTab, onTabChange]);

  // Handle tab header click
  const handleTabClick = (key: string) => {
    setActiveTab(key);
    setTranslateX(0);
  };

  // Touch event handlers for mobile swiping
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;
    
    const touch = e.touches[0];
    setStartX(touch.clientX);
    setCurrentX(touch.clientX);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isMobile || !isDragging) return;
    
    const touch = e.touches[0];
    const diff = touch.clientX - startX;
    setCurrentX(touch.clientX);
    setTranslateX(diff);
  };

  const handleTouchEnd = () => {
    if (!isMobile || !isDragging) return;
    
    const diff = currentX - startX;
    const threshold = 50; // Minimum swipe distance
    
    if (Math.abs(diff) > threshold) {
      if (diff > 0 && activeIndex > 0) {
        // Swiped right - go to previous tab
        setActiveTab(tabs[activeIndex - 1].key);
      } else if (diff < 0 && activeIndex < tabs.length - 1) {
        // Swiped left - go to next tab
        setActiveTab(tabs[activeIndex + 1].key);
      }
    }
    
    setIsDragging(false);
    setTranslateX(0);
  };

  // Mouse event handlers for desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMobile) return;
    
    setStartX(e.clientX);
    setCurrentX(e.clientX);
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isMobile || !isDragging) return;
    
    const diff = e.clientX - startX;
    setCurrentX(e.clientX);
    setTranslateX(diff);
  };

  const handleMouseUp = () => {
    if (isMobile || !isDragging) return;
    
    const diff = currentX - startX;
    const threshold = 50;
    
    if (Math.abs(diff) > threshold) {
      if (diff > 0 && activeIndex > 0) {
        setActiveTab(tabs[activeIndex - 1].key);
      } else if (diff < 0 && activeIndex < tabs.length - 1) {
        setActiveTab(tabs[activeIndex + 1].key);
      }
    }
    
    setIsDragging(false);
    setTranslateX(0);
  };

  // Styles
  const tabHeaderStyle = mergeStyles({
    display: 'flex',
    borderBottom: `2px solid ${theme.palette.neutralLighter}`,
    overflowX: 'auto',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
    '::-webkit-scrollbar': {
      display: 'none'
    },
    ...(isMobile && {
      scrollSnapType: 'x mandatory',
      scrollBehavior: 'smooth'
    })
  });

  const tabItemStyle = (isActive: boolean) => mergeStyles({
    padding: isMobile ? '12px 16px' : '16px 24px',
    cursor: 'pointer',
    borderBottom: `2px solid ${isActive ? theme.palette.themePrimary : 'transparent'}`,
    backgroundColor: isActive ? theme.palette.themeLighterAlt : 'transparent',
    color: isActive ? theme.palette.themePrimary : theme.palette.neutralPrimary,
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap',
    minWidth: isMobile ? '120px' : 'auto',
    textAlign: 'center',
    fontSize: isMobile ? '14px' : '16px',
    fontWeight: isActive ? '600' : '400',
    ':hover': {
      backgroundColor: theme.palette.neutralLighterAlt,
      color: theme.palette.themePrimary
    },
    ...(isMobile && {
      scrollSnapAlign: 'center',
      flex: '0 0 auto'
    })
  });

  const contentStyle = mergeStyles({
    minHeight: '400px',
    transition: isDragging ? 'none' : 'transform 0.3s ease',
    transform: `translateX(${translateX}px)`,
    ...(isMobile && {
      touchAction: 'pan-y',
      userSelect: 'none'
    })
  });

  const indicatorStyle = mergeStyles({
    display: 'flex',
    justifyContent: 'center',
    padding: '8px 0',
    gap: '4px'
  });

  const dotStyle = (isActive: boolean) => mergeStyles({
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: isActive ? theme.palette.themePrimary : theme.palette.neutralTertiary,
    transition: 'all 0.2s ease'
  });

  const stackTokens: IStackTokens = { childrenGap: 0 };

  return (
    <Stack tokens={stackTokens}>
      {/* Tab Headers */}
      <div ref={tabsRef} className={tabHeaderStyle}>
        {tabs.map((tab) => (
          <div
            key={tab.key}
            className={tabItemStyle(tab.key === activeTab)}
            onClick={() => handleTabClick(tab.key)}
          >
            <Text variant={isMobile ? 'medium' : 'mediumPlus'}>
              {tab.headerText}
            </Text>
          </div>
        ))}
      </div>

      {/* Tab Content */}
      <div
        ref={contentRef}
        className={contentStyle}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {tabs.find(tab => tab.key === activeTab)?.content}
      </div>

      {/* Mobile Indicator Dots */}
      {isMobile && tabs.length > 1 && (
        <div className={indicatorStyle}>
          {tabs.map((tab, index) => (
            <div
              key={tab.key}
              className={dotStyle(tab.key === activeTab)}
              onClick={() => handleTabClick(tab.key)}
            />
          ))}
        </div>
      )}

      {/* Swipe Hint for Mobile */}
      {isMobile && (
        <Stack horizontalAlign="center" style={{ padding: '8px 0' }}>
          <Text variant="small" style={{ color: theme.palette.neutralSecondary }}>
            Swipe left or right to navigate between tabs
          </Text>
        </Stack>
      )}
    </Stack>
  );
};

export default SwipeableTabs;
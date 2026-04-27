import React from 'react';
import {
  Card,
  Skeleton,
  SkeletonItem
} from '@fluentui/react-components';

// Generic skeleton patterns for different content types

export const TextSkeleton: React.FC<{
  lines?: number;
  height?: number;
  width?: string[];
}> = ({ lines = 3, height = 16, width = ['100%', '85%', '60%'] }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
    {Array.from({ length: lines }).map((_, index) => (
      <SkeletonItem
        key={index}
        size={height}
        style={{
          width: width[index] || width[width.length - 1]
        }}
      />
    ))}
  </div>
);

export const CardSkeleton: React.FC<{
  showHeader?: boolean;
  contentLines?: number;
}> = ({ showHeader = true, contentLines = 4 }) => (
  <Card>
    <div style={{ padding: '16px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {showHeader && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <SkeletonItem size={32} shape="circular" />
            <div style={{ flex: 1 }}>
              <SkeletonItem size={20} style={{ width: '40%', marginBottom: '4px' }} />
              <SkeletonItem size={14} style={{ width: '25%' }} />
            </div>
          </div>
        )}
        <TextSkeleton lines={contentLines} />
      </div>
    </div>
  </Card>
);

// Report-specific skeletons

export const ReportJobSkeleton: React.FC = () => (
  <Card>
    <div style={{ padding: '16px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Header with icon and title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <SkeletonItem size={24} shape="circular" />
          <div style={{ flex: 1 }}>
            <SkeletonItem size={18} style={{ width: '60%', marginBottom: '4px' }} />
            <SkeletonItem size={14} style={{ width: '30%' }} />
          </div>
          <SkeletonItem size={28} style={{ width: '80px' }} />
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <SkeletonItem size={14} style={{ width: '25%' }} />
            <SkeletonItem size={14} style={{ width: '15%' }} />
          </div>
          <SkeletonItem size={8} style={{ width: '100%' }} />
        </div>
      </div>
    </div>
  </Card>
);

export const ReportDashboardSkeleton: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' }}>
    {/* Header */}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <SkeletonItem size={32} style={{ width: '300px' }} />
      <div style={{ display: 'flex', gap: '8px' }}>
        <SkeletonItem size={36} style={{ width: '100px' }} />
        <SkeletonItem size={36} style={{ width: '120px' }} />
      </div>
    </div>

    {/* Statistics Cards */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={index}>
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <SkeletonItem size={18} style={{ width: '70%' }} />
              <SkeletonItem size={28} style={{ width: '40%' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
                <SkeletonItem size={14} style={{ width: '90%' }} />
                <SkeletonItem size={14} style={{ width: '80%' }} />
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>

    {/* Filters */}
    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
      <SkeletonItem size={32} style={{ width: '250px' }} />
      <SkeletonItem size={32} style={{ width: '120px' }} />
      <SkeletonItem size={32} style={{ width: '100px' }} />
    </div>

    {/* Active Jobs */}
    <Card>
      <div style={{ padding: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <SkeletonItem size={20} style={{ width: '150px' }} />
          {Array.from({ length: 2 }).map((_, index) => (
            <ReportJobSkeleton key={index} />
          ))}
        </div>
      </div>
    </Card>

    {/* Reports Table */}
    <Card>
      <div style={{ padding: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Table header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <SkeletonItem size={20} style={{ width: '200px' }} />
            <SkeletonItem size={32} style={{ width: '140px' }} />
          </div>

          {/* Table rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto',
                gap: '16px',
                alignItems: 'center',
                padding: '12px',
                border: '1px solid #f0f0f0',
                borderRadius: '4px'
              }}>
                <div>
                  <SkeletonItem size={16} style={{ width: '80%', marginBottom: '4px' }} />
                  <SkeletonItem size={12} style={{ width: '60%' }} />
                </div>
                <SkeletonItem size={20} style={{ width: '80px' }} />
                <SkeletonItem size={18} style={{ width: '50px' }} />
                <div>
                  <SkeletonItem size={8} style={{ width: '60px', marginBottom: '4px' }} />
                  <SkeletonItem size={12} style={{ width: '30px' }} />
                </div>
                <SkeletonItem size={12} style={{ width: '80px' }} />
                <SkeletonItem size={24} shape="circular" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  </div>
);

export const ReportFormSkeleton: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' }}>
    {/* Header */}
    <div>
      <SkeletonItem size={28} style={{ width: '300px', marginBottom: '8px' }} />
      <SkeletonItem size={16} style={{ width: '500px' }} />
    </div>

    {/* Form sections */}
    {Array.from({ length: 3 }).map((_, sectionIndex) => (
      <Card key={sectionIndex}>
        <div style={{ padding: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <SkeletonItem size={20} style={{ width: '200px' }} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
              {Array.from({ length: 2 }).map((_, fieldIndex) => (
                <div key={fieldIndex} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <SkeletonItem size={14} style={{ width: '40%' }} />
                  <SkeletonItem size={32} style={{ width: '100%' }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    ))}

    {/* Action buttons */}
    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
      <SkeletonItem size={36} style={{ width: '80px' }} />
      <SkeletonItem size={36} style={{ width: '120px' }} />
    </div>
  </div>
);

export const EmptyState: React.FC<{
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: React.ReactElement;
}> = ({ title, description, action, icon }) => (
  <Card>
    <div style={{ padding: '16px' }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        textAlign: 'center'
      }}>
        {icon && (
          <div style={{
            fontSize: '48px',
            color: '#d1d1d1',
            marginBottom: '16px'
          }}>
            {icon}
          </div>
        )}
        <h3 style={{
          margin: '0 0 8px 0',
          fontSize: '18px',
          fontWeight: '600',
          color: '#323130'
        }}>
          {title}
        </h3>
        {description && (
          <p style={{
            margin: '0 0 24px 0',
            fontSize: '14px',
            color: '#605e5c',
            maxWidth: '400px'
          }}>
            {description}
          </p>
        )}
        {action && (
          <button
            onClick={action.onClick}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: '600',
              color: 'white',
              backgroundColor: '#0078d4',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  </Card>
);

// Shimmer effect styles for enhanced visual feedback
export const shimmerStyles = `
  @keyframes shimmer {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }

  .shimmer {
    position: relative;
    overflow: hidden;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .shimmer::after {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    transform: translateX(-100%);
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.6),
      transparent
    );
    animation: shimmer 1.5s infinite;
  }
`;

export default {
  TextSkeleton,
  CardSkeleton,
  ReportJobSkeleton,
  ReportDashboardSkeleton,
  ReportFormSkeleton,
  EmptyState
};
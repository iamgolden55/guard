import type React from 'react';

// Icon components (inline SVGs for simplicity)
const IconComponents: Record<string, React.FC<{ className?: string; style?: React.CSSProperties }>> = {
  Clock: ({ className, style }) => (
    <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Permissions: ({ className, style }) => (
    <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  People: ({ className, style }) => (
    <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  Timer: ({ className, style }) => (
    <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  PaymentCard: ({ className, style }) => (
    <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  ),
  POI: ({ className, style }) => (
    <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  TrendUp: ({ className, style }) => (
    <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
  TrendDown: ({ className, style }) => (
    <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
    </svg>
  ),
  Calendar: ({ className, style }) => (
    <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  Activity: ({ className, style }) => (
    <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
};

export interface MetricCardProps {
  title: string;
  value: string | number;
  icon?: string;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  onClick?: () => void;
  isLoading?: boolean;
  subtitle?: string;
  iconColor?: string;
  variant?: 'default' | 'warning' | 'critical';
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon = 'Activity',
  trend,
  trendDirection = 'neutral',
  onClick,
  isLoading = false,
  subtitle,
  iconColor = '#6B7280',
  variant = 'default',
}) => {
  const IconComponent = IconComponents[icon] || IconComponents.Activity;

  // Determine trend colors
  const trendColors = {
    up: 'text-emerald-600 bg-emerald-50',
    down: 'text-red-600 bg-red-50',
    neutral: 'text-gray-600 bg-gray-100',
  };

  // Variant-based styling
  const variantStyles = {
    default: 'bg-[#F9F9F9] border-[#F0F0F0]',
    warning: 'bg-amber-50 border-amber-200 border-l-4 border-l-amber-400',
    critical: 'bg-red-50 border-red-200 border-l-4 border-l-red-500',
  };

  return (
    <div
      onClick={onClick}
      className={`
        relative overflow-hidden
        ${variantStyles[variant]} border rounded-lg p-4
        transition-all duration-200
        ${onClick ? 'cursor-pointer hover:shadow-md hover:border-gray-300 hover:-translate-y-0.5' : ''}
      `}
    >
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      <div className="flex items-start justify-between">
        {/* Content */}
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>

          {/* Subtitle or Trend */}
          <div className="mt-2 flex items-center gap-2">
            {trend && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${trendColors[trendDirection]}`}>
                {trendDirection === 'up' && <IconComponents.TrendUp className="w-3 h-3" />}
                {trendDirection === 'down' && <IconComponents.TrendDown className="w-3 h-3" />}
                {trend}
              </span>
            )}
            {subtitle && !trend && (
              <span className="text-xs text-gray-400">{subtitle}</span>
            )}
          </div>
        </div>

        {/* Icon */}
        <div
          className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${iconColor}15` }}
        >
          <IconComponent className="w-6 h-6" style={{ color: iconColor }} />
        </div>
      </div>
    </div>
  );
};

export default MetricCard;

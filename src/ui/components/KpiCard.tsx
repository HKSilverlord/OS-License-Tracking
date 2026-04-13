import React from 'react';
import { Card } from './Card';
import { LucideIcon, TrendingUp } from 'lucide-react';
import { formatCurrency } from '../../../utils/helpers';

export interface KpiCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value?: number;
    label?: string;
    direction: 'up' | 'down' | 'neutral';
  };
  accentColor?: 'sky' | 'emerald' | 'rose' | 'teal' | 'amber';
  gradient?: boolean;
  gradientFrom?: string;
  gradientTo?: string;
  className?: string;
  headingSize?: number;
  isCurrency?: boolean;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  subtitle,
  icon: Icon,
  trend,
  accentColor = 'sky',
  gradient = false,
  gradientFrom,
  gradientTo,
  className = '',
  headingSize = 18,
  isCurrency = false
}) => {
  const displayValue = isCurrency && typeof value === 'number' 
    ? formatCurrency(value) 
    : value;

  // Solid border variant
  if (!gradient) {
    const accents = {
      sky: 'border-sky-500 text-sky-600',
      emerald: 'border-emerald-500 text-emerald-600',
      rose: 'border-rose-500 text-rose-600',
      teal: 'border-teal-500 text-teal-600',
      amber: 'border-amber-500 text-amber-600',
    };
    
    // Fallbacks if trend direction defines it
    const activeColor = trend?.direction === 'up' ? 'emerald' : trend?.direction === 'down' ? 'rose' : accentColor;
    const colorClasses = accents[activeColor];
    const baseColor = colorClasses.split(' ')[1].replace('text-', ''); // e.g. emerald-600

    return (
      <Card className={`p-5 flex flex-col justify-center border-l-4 animate-fade-up ${colorClasses.split(' ')[0]} ${className}`}>
        <div className="flex items-center justify-between">
          <div 
            className={`text-xs font-semibold uppercase tracking-wider ${colorClasses.split(' ')[1]}`} 
            style={{ fontSize: `${headingSize}px` }}
          >
            {label}
          </div>
          {Icon && <Icon className={`w-5 h-5 text-${baseColor.replace('600', '500')}`} />}
        </div>
        
        <div className={`mt-3 text-3xl font-bold ${trend ? (trend.direction === 'up' ? 'text-emerald-700 dark:text-emerald-400' : trend.direction === 'down' ? 'text-rose-700 dark:text-rose-400' : 'text-slate-900 dark:text-white') : 'text-slate-900 dark:text-white'}`}>
          {trend?.direction && trend.direction !== 'neutral' && (
            <span className="mr-1 text-2xl">{trend.direction === 'up' ? '▲' : '▼'}</span>
          )}
          {displayValue}
        </div>
        
        {(trend?.label || subtitle) && (
          <div className={`text-sm mt-1 font-medium ${trend ? (trend.direction === 'up' ? 'text-emerald-600 dark:text-emerald-500' : trend.direction === 'down' ? 'text-rose-600 dark:text-rose-500' : 'text-slate-500 dark:text-slate-400') : 'text-slate-500 dark:text-slate-400'}`}>
            {trend?.label || subtitle}
          </div>
        )}
      </Card>
    );
  }

  // Gradient Variant
  return (
    <Card 
      gradient 
      fromColor={gradientFrom} 
      toColor={gradientTo} 
      className={`p-5 animate-fade-up ${className}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p 
            className="text-xs uppercase tracking-wider text-white/90 font-semibold" 
            style={{ fontSize: `${headingSize}px` }}
          >
            {label}
          </p>
        </div>
        {Icon && <Icon className="w-5 h-5 text-white/70" />}
      </div>
      <div className="mt-3 text-3xl font-bold text-white">{displayValue}</div>
      {subtitle && <div className="text-sm text-white/80 mt-1">{subtitle}</div>}
      {trend && (
        <div className="mt-3 text-xs text-white/80 border-t border-white/20 pt-2 flex items-center">
          <TrendingUp className="w-3 h-3 mr-1" />
          {trend.label}
        </div>
      )}
    </Card>
  );
};

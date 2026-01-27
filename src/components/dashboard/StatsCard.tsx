import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  trend?: {
    value: number;
    positive: boolean;
  };
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'info';
}

const variantStyles = {
  default: 'bg-white border-2 border-keon-200 hover:border-keon-300',
  primary: 'bg-gradient-to-br from-keon-blue/5 via-white to-keon-blue/10 border-2 border-keon-blue/30 hover:border-keon-blue/50',
  success: 'bg-gradient-to-br from-keon-green/5 via-white to-keon-green/10 border-2 border-keon-green/30 hover:border-keon-green/50',
  warning: 'bg-gradient-to-br from-keon-orange/5 via-white to-keon-orange/10 border-2 border-keon-orange/30 hover:border-keon-orange/50',
  info: 'bg-gradient-to-br from-purple-50 via-white to-purple-100/50 border-2 border-purple-200 hover:border-purple-300',
};

const iconStyles = {
  default: 'bg-keon-100 text-keon-700',
  primary: 'bg-gradient-to-br from-keon-blue to-cyan-500 text-white shadow-lg shadow-keon-blue/30',
  success: 'bg-gradient-to-br from-keon-green to-emerald-500 text-white shadow-lg shadow-keon-green/30',
  warning: 'bg-gradient-to-br from-keon-orange to-amber-500 text-white shadow-lg shadow-keon-orange/30',
  info: 'bg-gradient-to-br from-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-500/30',
};

export function StatsCard({ title, value, icon: Icon, trend, variant = 'default' }: StatsCardProps) {
  return (
    <div className={cn(
      "rounded-xl p-5 shadow-card transition-all duration-200 hover:shadow-card-hover animate-fade-in",
      variantStyles[variant]
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold text-foreground mt-1">{value}</p>
          {trend && (
            <p className={cn(
              "text-sm mt-2 font-medium",
              trend.positive ? "text-success" : "text-destructive"
            )}>
              {trend.positive ? '+' : ''}{trend.value}% vs hier
            </p>
          )}
        </div>
        <div className={cn(
          "p-3 rounded-xl",
          iconStyles[variant]
        )}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

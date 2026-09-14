import type { LucideIcon } from 'lucide-react';
import { NumberTicker } from '@/components/magicui/number-ticker';
import { detectIOSNativeHost } from '@/lib/tauri';
import { cn } from '@/lib/utils';

export interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tone?: 'default' | 'success' | 'primary';
}

const ACCENT_BORDER: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'border-l-slate-200',
  success: 'border-l-success',
  primary: 'border-l-primary/60',
};

function StatValue({ value, className }: { value: string | number; className?: string }) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return <NumberTicker value={value} className={className} />;
  }
  return <div className={className}>{value}</div>;
}

/** Compact stat tile used across the Dashboard's stats row. */
export function StatCard({ icon: Icon, label, value, tone = 'default' }: StatCardProps) {
  const isIOSNativeHost = detectIOSNativeHost();

  if (isIOSNativeHost) {
    return (
      <div className="rounded-[24px] border border-white/70 bg-white/82 px-4 py-3.5 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</span>
          <Icon className="h-4 w-4 text-slate-400" />
        </div>
        <StatValue value={value} className="text-[1.75rem] font-bold tracking-[-0.03em] text-slate-950" />
      </div>
    );
  }

  return (
    <div
      className={cn('rounded-lg border border-l-3 border-slate-100 bg-card px-3 py-2.5 shadow-sm', ACCENT_BORDER[tone])}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-primary">{label}</span>
        <Icon className="h-3.5 w-3.5 text-primary/60" />
      </div>
      <StatValue value={value} className="text-xl font-bold text-foreground" />
    </div>
  );
}

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

const ACCENT: Record<NonNullable<StatCardProps['tone']>, { icon: string; value: string; hover: string }> = {
  default: { icon: 'bg-slate-100 text-slate-500', value: 'text-slate-900', hover: 'hover:border-slate-300' },
  success: { icon: 'bg-emerald-100 text-emerald-600', value: 'text-emerald-600', hover: 'hover:border-emerald-300' },
  primary: { icon: 'bg-indigo-100 text-indigo-600', value: 'text-indigo-600', hover: 'hover:border-indigo-300' },
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
      className={cn('rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors', ACCENT[tone].hover)}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</span>
        <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', ACCENT[tone].icon)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <StatValue value={value} className={cn('text-3xl font-extrabold tracking-tight', ACCENT[tone].value)} />
    </div>
  );
}

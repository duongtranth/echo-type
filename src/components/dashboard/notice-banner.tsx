import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { IOS_SUBCARD_CLASS } from '@/components/shared/ios-native-ui';
import { detectIOSNativeHost } from '@/lib/tauri';
import { cn } from '@/lib/utils';

type NoticeTone = 'indigo' | 'violet' | 'amber' | 'emerald';

const TONE_STYLES: Record<NoticeTone, { border: string; bg: string; icon: string; title: string; text: string }> = {
  indigo: {
    border: 'border-indigo-200',
    bg: 'bg-indigo-50/60',
    icon: 'bg-indigo-600',
    title: 'text-indigo-900',
    text: 'text-indigo-500',
  },
  violet: {
    border: 'border-violet-200',
    bg: 'bg-gradient-to-r from-violet-50 to-indigo-50',
    icon: 'bg-gradient-to-br from-violet-500 to-indigo-600',
    title: 'text-indigo-900',
    text: 'text-indigo-500',
  },
  amber: {
    border: 'border-amber-200',
    bg: 'bg-amber-50/60',
    icon: 'bg-amber-500',
    title: 'text-indigo-900',
    text: 'text-indigo-500',
  },
  emerald: {
    border: 'border-emerald-200',
    bg: 'bg-emerald-50/60',
    icon: 'bg-emerald-500',
    title: 'text-indigo-900',
    text: 'text-indigo-500',
  },
};

export interface NoticeBannerProps {
  icon: LucideIcon;
  title: string;
  description: string;
  tone?: NoticeTone;
  actions?: ReactNode;
}

/**
 * A single reusable "here's something worth your attention" card, replacing the
 * five near-identical hand-rolled banners the Dashboard used to carry (AI setup,
 * disconnected provider, onboarding, assessment prompt, re-test reminder).
 * Handles its own iOS-native vs web presentation so callers never branch on it.
 */
export function NoticeBanner({ icon: Icon, title, description, tone = 'indigo', actions }: NoticeBannerProps) {
  const isIOSNativeHost = detectIOSNativeHost();
  const style = TONE_STYLES[tone];

  if (isIOSNativeHost) {
    return (
      <div className={cn(IOS_SUBCARD_CLASS, 'flex flex-col gap-3 p-4')}>
        <div className="flex items-start gap-3">
          <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-sm', style.icon)}>
            <Icon className="h-4.5 w-4.5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
          </div>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-3 rounded-xl border px-4 py-3', style.border, style.bg)}>
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', style.icon)}>
        <Icon className="h-4.5 w-4.5 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-semibold', style.title)}>{title}</p>
        <p className={cn('text-xs', style.text)}>{description}</p>
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  );
}

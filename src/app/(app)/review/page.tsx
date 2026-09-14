'use client';

import { ArrowRight, BookOpen, Heart, Radar } from 'lucide-react';
import Link from 'next/link';
import { DailyTaskQueue } from '@/components/learning/daily-task-queue';
import { useReviewSummary } from '@/hooks/use-review-summary';
import { useLanguageStore } from '@/stores/language-store';

export default function ReviewCenterPage() {
  const { data, error, retry } = useReviewSummary();
  const zh = useLanguageStore((s) => s.interfaceLanguage) === 'zh';
  const t = (en: string, cn: string) => (zh ? cn : en);
  const queues = data
    ? [
        {
          href: '/review/today',
          title: t('Lesson review', 'Ôn tập bài học'),
          icon: BookOpen,
          count: data.lessons,
          description: t(
            'Revisit due exercises from your listening, speaking, reading and spelling practice.',
            'Ôn lại các bài luyện nghe, nói, đọc và đánh vần đã đến hạn.',
          ),
        },
        {
          href: '/favorites/review',
          title: t('Notes review', 'Ôn tập ghi chú'),
          icon: Heart,
          count: data.notes,
          description: t(
            'Recall saved words and expressions with spaced repetition.',
            'Nhớ lại các từ và cách diễn đạt đã lưu bằng phương pháp lặp lại ngắt quãng.',
          ),
        },
        {
          href: '/weak-spots',
          title: t('Weak spots', 'Điểm yếu'),
          icon: Radar,
          count: data.weakSpots,
          description: t(
            'Retry difficult items and check what still needs attention.',
            'Luyện lại các nội dung khó và xem những gì còn cần chú ý.',
          ),
        },
      ]
    : [];
  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-24">
      <DailyTaskQueue reviewOnly />
      <p className="text-sm text-slate-600">
        {t(
          'Choose a queue. Each keeps its own progress and review schedule.',
          'Chọn một mục để bắt đầu. Mỗi mục sẽ giữ tiến độ và lịch ôn tập riêng.',
        )}
      </p>
      {error ? (
        <div role="alert" className="rounded-xl bg-amber-50 p-5">
          {t('Could not load review queues.', 'Không thể tải nội dung ôn tập.')}
          <button type="button" className="ml-3 min-h-11 underline" onClick={retry}>
            {t('Retry', 'Thử lại')}
          </button>
        </div>
      ) : !data ? (
        <output>{t('Loading review queues…', 'Đang tải nội dung ôn tập…')}</output>
      ) : (
        <div data-testid="review-queues" className="divide-y divide-slate-200 rounded-2xl bg-white px-5 shadow-sm">
          {queues.map((queue) => (
            <Link
              key={queue.href}
              href={queue.href}
              className="group flex items-center gap-4 py-6 focus-visible:outline-2 focus-visible:outline-indigo-600"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 shadow-sm">
                <queue.icon className="h-5 w-5 text-indigo-600" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-heading font-bold text-indigo-950">{queue.title}</h2>
                <p className="mt-1 text-sm text-slate-500">{queue.description}</p>
                <p className="mt-2 font-mono text-xs font-semibold uppercase tracking-wide text-indigo-600">
                  {queue.count
                    ? t(`${queue.count} ready to review`, `${queue.count} mục sẵn sàng ôn tập`)
                    : t('Nothing due. View this section', 'Chưa có gì đến hạn. Xem mục này')}
                </p>
              </div>
              <ArrowRight className="h-5 w-5 shrink-0 text-slate-400 group-hover:text-indigo-600" />
            </Link>
          ))}
        </div>
      )}
      <Link href="/learn" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-indigo-600">
        {t('Continue learning', 'Tiếp tục học')}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

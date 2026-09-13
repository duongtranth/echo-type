'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LearningSettings } from '@/components/learning/learning-settings';
import { useLearningWorkspace } from '@/hooks/use-learning-workspace';
import {
  applyDailyEvidence,
  reconcileDailyTasks,
  remainingDailyMinutes,
  selectBudgetTasks,
  transitionDailyTask,
} from '@/lib/daily-task-planner';
import { dailyWorkspaceProgress } from '@/lib/daily-workspace-progress';
import { toLocalDateKey } from '@/lib/date-key';
import { db } from '@/lib/db';
import { workshopProgress } from '@/lib/learning-activity';
import { buildTodayReviewItems } from '@/lib/today-review';
import { useLanguageStore } from '@/stores/language-store';
import type { DailyTask } from '@/types/daily-task';

const control =
  'min-h-11 rounded-xl px-3 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50';
const allDays = [0, 1, 2, 3, 4, 5, 6];

export function DailyTaskQueue({ reviewOnly = false }: { reviewOnly?: boolean }) {
  const router = useRouter();
  const { data, error, retry } = useLearningWorkspace();
  const zh = useLanguageStore((state) => state.interfaceLanguage) === 'zh';
  const t = (en: string, cn: string) => (zh ? cn : en);
  const [now, setNow] = useState(Date.now());
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);
  const database = data?.database;
  const state = useLiveQuery(async () => {
    if (!database) return undefined;
    const [tasks, attempts, pronunciation] = await Promise.all([
      database.dailyTasks.toArray(),
      database.learningAttempts.toArray(),
      database.pronunciationProgress.toArray(),
    ]);
    return { tasks, attempts, pronunciation };
  }, [database]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const dateKey = toLocalDateKey(now);
  const settings = state?.tasks.find((task) => task.id === 'preferences:daily');
  const minutes = settings?.minutes ?? 20;
  const learningDays = settings?.learningDays ?? allDays;

  useEffect(() => {
    if (!database || database !== db || !data || !state) return;
    let cancelled = false;
    const make = (
      kind: DailyTask['kind'],
      sourceId: string,
      title: string,
      reason: string,
      reasonZh: string,
      href: string,
      duration: number,
      extra: Partial<DailyTask> = {},
    ): DailyTask => ({
      id: `${dateKey}:${kind}:${sourceId}`,
      dateKey,
      originDateKey: dateKey,
      kind,
      sourceId,
      title,
      titleZh: title,
      reason,
      reasonZh,
      href,
      minutes: duration,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      ...extra,
    });
    const candidates: DailyTask[] = buildTodayReviewItems(data.records, data.contents, now).map((item) =>
      make('review', item.recordId, item.title, 'Due for spaced review', 'Đến hạn ôn tập ngắt quãng', item.href, 2, {
        contentIds: [item.contentId],
        module: item.module,
      }),
    );
    for (const item of data.favorites.filter((item) => (item.fsrsCard?.due ?? item.nextReview ?? Infinity) <= now)) {
      candidates.push(
        make(
          'favorite',
          item.id,
          item.text,
          'Recall a saved expression',
          'Nhớ lại một cách diễn đạt đã lưu',
          `/favorites/review?item=${encodeURIComponent(item.id)}`,
          2,
        ),
      );
    }
    const ordered = [...data.lessons].sort((a, b) => {
      const unitA = data.units.find((unit) => unit.id === a.unitId);
      const unitB = data.units.find((unit) => unit.id === b.unitId);
      return Number(unitB?.source === 'imported') - Number(unitA?.source === 'imported') || a.order - b.order;
    });
    const lesson = ordered.find((item) => !workshopProgress(item.id, state.attempts).completed);
    if (lesson)
      candidates.push(
        make(
          'course',
          lesson.id,
          lesson.title,
          'One short practice block; save a response or finish an exercise',
          'Hoàn thành một bài luyện tập ngắn: lưu câu trả lời hoặc hoàn tất một bài tập',
          `/learn/${encodeURIComponent(lesson.unitId)}?lesson=${encodeURIComponent(lesson.id)}`,
          Math.max(1, Math.min(10, lesson.estimatedMinutes)),
          { lessonId: lesson.id, contentIds: lesson.exercises.map((item) => item.id) },
        ),
      );
    const weak = data.weakSpots[0];
    if (weak)
      candidates.push(
        make(
          'weak-spot',
          weak.id,
          weak.text,
          'Retry a recent difficulty',
          'Luyện lại điểm yếu gần đây',
          weak.targetHref,
          3,
          {
            contentIds: [weak.sourceId],
            module: weak.module,
          },
        ),
      );
    else
      candidates.push(
        make(
          'pronunciation',
          'daily-sentence',
          'Practice a sound',
          'Record a sound and listen back',
          'Ghi âm một âm và nghe lại',
          '/pronunciation',
          3,
          { titleZh: 'Luyện tập một âm' },
        ),
      );
    void database
      .transaction('rw', database.dailyTasks, async () => {
        if (database !== db) return;
        const saved = await database.dailyTasks.toArray();
        const merged = reconcileDailyTasks(saved, candidates, dateKey, now);
        const next = applyDailyEvidence(
          merged,
          {
            sessions: data.sessions,
            attempts: state.attempts,
            favorites: data.favorites,
            records: data.records,
            weakSpots: data.weakSpots,
            pronunciation: state.pronunciation,
          },
          Date.now(),
        );
        const originals = new Map(saved.map((task) => [task.id, JSON.stringify(task)]));
        const changed = next.filter((task) => originals.get(task.id) !== JSON.stringify(task));
        if (database !== db) throw new Error('Account changed. Reopen your daily queue.');
        if (changed.length) await database.dailyTasks.bulkPut(changed);
      })
      .catch((cause) => {
        if (!cancelled && database === db)
          setFailure(cause instanceof Error ? cause.message : 'Could not save daily queue.');
      });
    return () => {
      cancelled = true;
    };
  }, [database, data, state, dateKey, now]);

  async function changeSettings(patch: Partial<DailyTask>) {
    const active = database;
    if (!active || active !== db) return;
    setBusy(true);
    setFailure('');
    try {
      await active.transaction('rw', active.dailyTasks, async () => {
        const current = await active.dailyTasks.get('preferences:daily');
        if (active !== db) throw new Error('Account changed. Try again.');
        const time = Date.now();
        await active.dailyTasks.put({
          id: 'preferences:daily',
          kind: 'settings',
          sourceId: 'daily',
          dateKey,
          originDateKey: dateKey,
          title: 'Daily preferences',
          titleZh: 'Tùy chọn hằng ngày',
          reason: '',
          reasonZh: '',
          href: '/dashboard',
          minutes: 20,
          status: 'pending',
          createdAt: time,
          learningDays: allDays,
          ...current,
          ...patch,
          updatedAt: time,
        });
      });
    } catch (cause) {
      if (active === db) setFailure(cause instanceof Error ? cause.message : 'Could not save.');
    } finally {
      if (active === db) setBusy(false);
    }
  }
  async function act(task: DailyTask, action: 'start' | 'pause' | 'defer' | 'skip' | 'restore') {
    const active = database;
    if (!active || active !== db) return;
    setBusy(true);
    setFailure('');
    try {
      const updated = await active.transaction('rw', active.dailyTasks, async () => {
        const current = await active.dailyTasks.get(task.id);
        if (!current || active !== db) throw new Error('Task unavailable. Reopen your queue.');
        const allocated = action === 'start' && !current.startedAt ? { ...current, minutes: task.minutes } : current;
        const next = transitionDailyTask(allocated, action, Date.now());
        await active.dailyTasks.put(next);
        return next;
      });
      if (active !== db) return;
      if (action === 'start' && updated.status === 'in-progress') {
        if (!updated.href.startsWith('/') || updated.href.startsWith('//') || updated.href.includes('\\'))
          throw new Error('Invalid practice destination.');
        router.push(updated.href);
      }
    } catch (cause) {
      if (active === db) setFailure(cause instanceof Error ? cause.message : 'Could not save.');
    } finally {
      if (active === db) setBusy(false);
    }
  }

  if (error)
    return (
      <div role="alert">
        {error}
        <button className={control} type="button" onClick={retry}>
          {t('Retry', 'Thử lại')}
        </button>
      </div>
    );
  if (!data || !state) return <output>{t('Preparing your daily queue…', 'Đang chuẩn bị nhiệm vụ hằng ngày…')}</output>;
  const eligible = state.tasks.filter(
    (task) => task.kind !== 'settings' && (!reviewOnly || ['review', 'favorite', 'weak-spot'].includes(task.kind)),
  );
  const active = eligible.filter(
    (task) => task.dateKey === dateKey && ['pending', 'paused', 'in-progress'].includes(task.status),
  );
  const isLearningDay = learningDays.includes(new Date(now).getDay());
  const remaining = remainingDailyMinutes(state.tasks, dateKey, minutes);
  const visible = isLearningDay ? selectBudgetTasks(active, remaining) : [];
  const history = eligible.filter(
    (task) =>
      task.status === 'deferred' ||
      (task.status === 'skipped' && task.dateKey <= dateKey) ||
      (task.status === 'completed' && task.dateKey === dateKey),
  );
  const progress = dailyWorkspaceProgress(data.sessions, data.contents);
  const statusLabel = (status: DailyTask['status']) =>
    ({
      pending: t('Ready', 'Sẵn sàng'),
      'in-progress': t('In progress', 'Đang thực hiện'),
      paused: t('Paused', 'Đã tạm dừng'),
      completed: t('Completed', 'Đã hoàn thành'),
      skipped: t('Skipped', 'Đã bỏ qua'),
      deferred: t('Deferred', 'Đã hoãn'),
    })[status];
  return (
    <section
      data-testid="daily-task-queue"
      className="min-w-0 overflow-hidden rounded-3xl bg-white text-slate-800 shadow-sm"
    >
      <div className="space-y-5 p-5 sm:p-7">
        <div>
          <h2 className="font-[var(--font-poppins)] text-2xl font-semibold text-indigo-950">
            {reviewOnly
              ? t('Your review plan', 'Kế hoạch ôn tập hôm nay')
              : t('What to practice today', 'Hôm nay luyện gì')}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {t(
              'Choose your time. Saved practice updates this queue when you return.',
              'Chọn thời gian bạn có. Khi quay lại, hàng đợi sẽ cập nhật dựa trên tiến độ đã lưu.',
            )}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {t(
              `Estimated time remaining: ${remaining} of ${minutes} min`,
              `Thời gian ước tính còn lại: ${remaining} / ${minutes} phút`,
            )}
          </p>
        </div>
        <div
          role="group"
          className="flex flex-wrap items-center gap-2"
          aria-label={t('Daily time budget', 'Ngân sách thời gian hằng ngày')}
        >
          {[5, 10, 20, 30, 45].map((value) => (
            <button
              key={value}
              type="button"
              disabled={busy}
              aria-pressed={minutes === value}
              onClick={() => void changeSettings({ minutes: value })}
              className={`${control} ${minutes === value ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}
            >
              {value} min
            </button>
          ))}
        </div>
        <p className="text-sm text-slate-600">
          <span data-testid="daily-budget">{minutes}</span> {t('min budget', 'phút ngân sách')} ·{' '}
          {visible.reduce((sum, task) => sum + task.minutes, 0)} {t('min planned', 'phút đã lên kế hoạch')}
        </p>
        <details>
          <summary className="min-h-11 cursor-pointer py-2 text-sm text-indigo-700">
            {t('Learning days', 'Ngày học')}
          </summary>
          <div className="flex flex-wrap gap-2">
            {allDays.map((day) => (
              <button
                key={day}
                type="button"
                disabled={busy}
                aria-pressed={learningDays.includes(day)}
                className={`${control} ${learningDays.includes(day) ? 'bg-indigo-50 text-indigo-800' : 'bg-slate-50 text-slate-500'}`}
                onClick={() =>
                  void changeSettings({
                    learningDays: learningDays.includes(day)
                      ? learningDays.filter((value) => value !== day)
                      : [...learningDays, day],
                  })
                }
              >
                {zh
                  ? ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][day]
                  : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]}
              </button>
            ))}
          </div>
        </details>
        {failure && (
          <p role="alert" className="text-sm text-red-700">
            {failure}
          </p>
        )}
        {!visible.length && (
          <p className="rounded-xl bg-slate-50 p-4 text-sm">
            {isLearningDay
              ? t(
                  'No tasks ready in this queue. You can still open your courses.',
                  'Hiện chưa có nhiệm vụ nào sẵn sàng trong hàng đợi này. Bạn vẫn có thể mở khóa học để học.',
                )
              : t(
                  'A rest day. Your unfinished work is retained.',
                  'Hôm nay là ngày nghỉ. Công việc dang dở của bạn vẫn được giữ lại.',
                )}
          </p>
        )}
        <ol className="divide-y divide-slate-100">
          {visible.map((task) => (
            <li key={task.id} data-testid="daily-task-row" className="space-y-3 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words font-semibold text-slate-900">{zh ? task.titleZh : task.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{zh ? task.reasonZh : task.reason}</p>
                </div>
                <span className="shrink-0 text-xs text-slate-500">{task.minutes} min</span>
              </div>
              <p className="text-xs text-slate-500">{statusLabel(task.status)}</p>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  disabled={busy}
                  className={`${control} bg-indigo-600 text-white`}
                  onClick={() => void act(task, 'start')}
                >
                  {task.status === 'pending' ? t('Start', 'Bắt đầu') : t('Continue', 'Tiếp tục')}
                </button>
                <button type="button" disabled={busy} className={control} onClick={() => void act(task, 'pause')}>
                  {t('Pause', 'Tạm dừng')}
                </button>
                <button type="button" disabled={busy} className={control} onClick={() => void act(task, 'defer')}>
                  {t('Tomorrow', 'Ngày mai')}
                </button>
                <button type="button" disabled={busy} className={control} onClick={() => void act(task, 'skip')}>
                  {t('Skip', 'Bỏ qua')}
                </button>
              </div>
            </li>
          ))}
        </ol>
        {!!history.length && (
          <div className="space-y-3 rounded-xl bg-slate-50 p-4">
            <h3 className="text-sm font-semibold">{t('Saved task status', 'Trạng thái nhiệm vụ đã lưu')}</h3>
            {history.map((task) => (
              <div key={task.id} className="flex items-start justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="break-words">{zh ? task.titleZh : task.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    <span>{statusLabel(task.status)}</span> · {task.dateKey}
                  </p>
                </div>
                {task.status === 'skipped' && (
                  <button
                    type="button"
                    disabled={busy}
                    className={`${control} text-indigo-700`}
                    onClick={() => void act(task, 'restore')}
                  >
                    {t('Restore', 'Khôi phục')}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <Link href="/learn" className="inline-flex min-h-11 items-center text-sm font-medium text-indigo-700">
          {t('All courses', 'Tất cả khóa học')}
        </Link>
        <p className="text-xs leading-5 text-slate-500">
          {t(
            'Times are estimates for a short practice block. Opening a task never marks it complete.',
            'Thời gian chỉ là ước tính cho một bài luyện tập ngắn. Chỉ mở nhiệm vụ sẽ không đánh dấu hoàn thành.',
          )}
        </p>
      </div>
      {!reviewOnly && <LearningSettings practices={progress.practices} words={progress.words} />}
    </section>
  );
}

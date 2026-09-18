'use client';

import { ChevronDown, Settings2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { LEARNING_GOAL_CONFIG, type LearningGoal } from '@/lib/learning-goals';
import { useDailyPlanStore } from '@/stores/daily-plan-store';
import { useLanguageStore } from '@/stores/language-store';
import { useLearningGoalStore } from '@/stores/learning-goal-store';

const focusZh: Record<LearningGoal, string> = {
  speaking: 'Nói',
  exam: 'Thi cử',
  travel: 'Du lịch',
  work: 'Công việc',
  balanced: 'Cân bằng',
};
const choiceClass = (selected: boolean) =>
  `min-h-11 rounded-xl px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${selected ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-indigo-50'}`;

export function LearningSettings({ practices, words }: { practices: number; words: number }) {
  const zh = useLanguageStore((s) => s.interfaceLanguage === 'zh');
  const t = (en: string, cn: string) => (zh ? cn : en);
  const goal = useDailyPlanStore((s) => s.goal);
  const setGoal = useDailyPlanStore((s) => s.setGoal);
  const focus = useLearningGoalStore((s) => s.currentGoal);
  const setFocus = useLearningGoalStore((s) => s.setGoal);
  useEffect(() => {
    useDailyPlanStore.getState().hydrate();
    useLearningGoalStore.getState().hydrate();
  }, []);
  return (
    <details data-testid="learning-settings" className="group border-t border-slate-100 bg-slate-50/80">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-4 text-sm [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1 text-slate-600">
          <span className="tabular-nums">
            {t('Today', 'Hôm nay')}{' '}
            <strong className="text-slate-900">
              {practices} / {goal.sessionsPerDay}
            </strong>{' '}
            {t('practices', 'buổi luyện tập')}
          </span>
          <span className="tabular-nums">
            {words} / {goal.wordsPerDay} {t('words practiced', 'từ đã luyện tập')}
          </span>
        </span>
        <span className="inline-flex min-h-11 items-center gap-2 font-medium text-indigo-700">
          <Settings2 className="h-4 w-4" />
          {t('Learning settings', 'Cài đặt học tập')}
          <ChevronDown className="h-4 w-4 group-open:rotate-180" />
        </span>
      </summary>
      <div className="space-y-6 px-6 pb-6">
        <div>
          <h3 id="learning-focus-heading" className="text-base font-semibold text-slate-900">
            {t('Learning focus', 'Trọng tâm học tập')}
          </h3>
          <p
            data-testid="learning-focus-description"
            className="mt-2 w-full max-w-3xl text-sm leading-6 text-slate-600"
          >
            {t(
              'Choose a focus for today’s targeted practice. Your course still includes listening, reading, speaking and writing.',
              'Chọn một trọng tâm cho bài luyện tập chuyên sâu hôm nay. Khóa học của bạn vẫn bao gồm cả nghe, đọc, nói và viết.',
            )}
          </p>
          <div
            role="group"
            aria-labelledby="learning-focus-heading"
            className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
          >
            {(Object.keys(LEARNING_GOAL_CONFIG) as LearningGoal[]).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={focus === key}
                onClick={() => setFocus(key)}
                className={choiceClass(focus === key)}
              >
                {zh ? focusZh[key] : LEARNING_GOAL_CONFIG[key].shortLabel}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 id="daily-practice-target" className="text-sm font-semibold text-slate-900">
              {t('Daily practice target', 'Chỉ tiêu luyện tập hằng ngày')}
            </h3>
            <div role="group" aria-labelledby="daily-practice-target" className="mt-3 flex flex-wrap gap-2">
              {[...new Set([2, 4, 6, 8, goal.sessionsPerDay])]
                .sort((a, b) => a - b)
                .map((count) => (
                  <button
                    type="button"
                    key={count}
                    className={choiceClass(goal.sessionsPerDay === count)}
                    aria-pressed={goal.sessionsPerDay === count}
                    onClick={() => setGoal({ sessionsPerDay: count })}
                  >
                    {count} {t('practices', 'buổi luyện tập')}
                  </button>
                ))}
            </div>
          </div>
          <div>
            <h3 id="daily-vocabulary-target" className="text-sm font-semibold text-slate-900">
              {t('Vocabulary practice target', 'Chỉ tiêu từ vựng hằng ngày')}
            </h3>
            <div role="group" aria-labelledby="daily-vocabulary-target" className="mt-3 flex flex-wrap gap-2">
              {[...new Set([10, 20, 30, 50, goal.wordsPerDay])]
                .sort((a, b) => a - b)
                .map((count) => (
                  <button
                    type="button"
                    key={count}
                    className={choiceClass(goal.wordsPerDay === count)}
                    aria-pressed={goal.wordsPerDay === count}
                    onClick={() => setGoal({ wordsPerDay: count })}
                  >
                    {count} {t('words', 'từ')}
                  </button>
                ))}
            </div>
          </div>
        </div>
        <p className="text-xs leading-5 text-slate-500">
          {t(
            'Targets update automatically from saved practice. Vocabulary counts distinct library items practiced today, not mastery.',
            'Chỉ tiêu tự động cập nhật từ tiến độ luyện tập đã lưu. Từ vựng được tính theo số mục thư viện khác nhau đã luyện hôm nay, không phải mức độ thành thạo.',
          )}
        </p>
        <Link
          href="/settings"
          className="inline-flex min-h-11 items-center text-sm font-medium text-indigo-700 underline underline-offset-4"
        >
          {t('Assess or update my English level', 'Đánh giá hoặc cập nhật trình độ tiếng Anh của tôi')}
        </Link>
      </div>
    </details>
  );
}

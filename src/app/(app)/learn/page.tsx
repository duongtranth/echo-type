'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRight, BookOpen, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { QuickPractice } from '@/components/learning/quick-practice';
import { useLearningWorkspace } from '@/hooks/use-learning-workspace';
import { db } from '@/lib/db';
import { workshopProgress } from '@/lib/learning-activity';
import { lessonProgress } from '@/lib/learning-units';
import { useLanguageStore } from '@/stores/language-store';

export default function LearnPage() {
  const { data, error, retry } = useLearningWorkspace();
  const attempts = useLiveQuery(() => db.learningAttempts.toArray(), [data?.database.name]) ?? [];
  const [search, setSearch] = useState('');
  const zh = useLanguageStore((s) => s.interfaceLanguage) === 'zh';
  const t = (en: string, cn: string) => (zh ? cn : en);
  return (
    <main className="mx-auto max-w-6xl space-y-7 pb-24">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/dashboard" className="text-sm text-indigo-600">
            {t('Today', 'Hôm nay')}
          </Link>
          <h1 className="mt-2 font-heading text-3xl font-extrabold tracking-tight text-indigo-950">
            {t('Your learning shelf', 'Kệ học tập của bạn')}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {t(
              'Your materials, organized into lessons. Original files and progress stay with you.',
              'Tài liệu của bạn được sắp xếp thành từng bài học. Tệp gốc và tiến độ học tập luôn được giữ lại.',
            )}
          </p>
        </div>
        <Link
          href="/library/import"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" />
          {t('Import material', 'Nhập tài liệu')}
        </Link>
      </header>
      <QuickPractice />
      <label className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm">
        <Search className="h-5 w-5 text-slate-400" />
        <input
          aria-label={t('Search courses', 'Tìm khóa học')}
          className="w-full bg-transparent text-sm outline-none"
          placeholder={t('Find a course…', 'Tìm khóa học…')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      {error ? (
        <div role="alert">
          {t('Unable to load courses.', 'Không thể tải khóa học.')}{' '}
          <button type="button" onClick={retry} className="underline">
            {t('Retry', 'Thử lại')}
          </button>
        </div>
      ) : !data ? (
        <p role="status">{t('Preparing lessons…', 'Đang chuẩn bị bài học…')}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {[...data.units]
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .filter((u) => u.title.toLowerCase().includes(search.toLowerCase()))
            .map((unit) => {
              const lessons = data.lessons.filter((l) => l.unitId === unit.id);
              const completed = lessons.filter((l) => workshopProgress(l.id, attempts).completed).length;
              const drills = lessons.filter((l) => !lessonProgress(l, data.sessions).next).length;
              return (
                <Link
                  key={unit.id}
                  href={`/learn/${encodeURIComponent(unit.id)}`}
                  className="group rounded-2xl bg-white p-6 shadow-sm hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-indigo-600"
                >
                  <div className="flex items-center justify-between">
                    <BookOpen className="h-6 w-6 text-indigo-500" />
                    <span className="text-xs text-slate-500">{unit.difficulty}</span>
                  </div>
                  <h2 className="mt-5 break-words text-xl font-semibold text-slate-900">{unit.title}</h2>
                  <p className="mt-2 text-sm text-slate-500">
                    {t(
                      `${lessons.length} lessons · ${completed} completed`,
                      `${lessons.length} bài · đã hoàn thành ${completed} bài`,
                    )}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {t(
                      `${drills} drill lessons complete · practice history preserved`,
                      `${drills} bài luyện tập chuyên sâu hoàn thành · lịch sử luyện tập được giữ lại`,
                    )}
                  </p>
                  <progress
                    aria-label={t('Course progress', 'Tiến độ khóa học')}
                    className="mt-5 h-1.5 w-full accent-indigo-600"
                    value={completed}
                    max={lessons.length || 1}
                  />
                  <div className="mt-4 flex items-center justify-between text-sm font-medium text-indigo-600">
                    {t(
                      completed ? 'Continue course' : 'Open course',
                      completed ? 'Tiếp tục khóa học' : 'Bắt đầu khóa học',
                    )}
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </Link>
              );
            })}
          {data.units.length === 0 && (
            <p className="rounded-2xl bg-white p-6 text-slate-600">
              {t(
                'Import an article, book, or audio to start your first course.',
                'Nhập một bài viết, sách hoặc âm thanh để bắt đầu khóa học đầu tiên của bạn.',
              )}
            </p>
          )}
        </div>
      )}
    </main>
  );
}

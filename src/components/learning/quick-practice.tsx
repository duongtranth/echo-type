'use client';

import Link from 'next/link';
import { useLanguageStore } from '@/stores/language-store';

export function QuickPractice() {
  const zh = useLanguageStore((s) => s.interfaceLanguage) === 'zh';
  return (
    <details className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <summary className="min-h-11 cursor-pointer content-center text-sm font-medium text-indigo-700">
        {zh ? 'Chỉ luyện một kỹ năng' : 'Practice one skill'}
      </summary>
      <p className="mb-3 text-sm text-slate-500">
        {zh
          ? 'Không cần hoàn thành cả bài học, chọn tài liệu và luyện tập tự do.'
          : 'Choose material and practice independently, without completing a whole lesson.'}
      </p>
      <nav aria-label={zh ? 'Luyện tập nhanh' : 'Quick practice'} className="flex flex-wrap gap-2">
        {[
          ['/listen', 'Listening', 'Luyện nghe'],
          ['/read', 'Read aloud', 'Luyện đọc to'],
          ['/write', 'Spelling practice', 'Luyện đánh vần'],
          ['/speak', 'AI conversation', 'Hội thoại AI'],
          ['/pronunciation', 'Pronunciation', 'Luyện phát âm'],
        ].map(([href, en, cn]) => (
          <Link
            key={href}
            href={href}
            className="inline-flex min-h-11 items-center rounded-lg bg-indigo-50 px-3 text-sm text-indigo-700 hover:bg-indigo-100"
          >
            {zh ? cn : en}
          </Link>
        ))}
      </nav>
    </details>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { learningSection, withinRoute } from '@/lib/learning-navigation';
import { useLanguageStore } from '@/stores/language-store';

const sections = {
  notes: {
    en: 'My notes',
    zh: 'Ghi chú của tôi',
    description: [
      'Keep words, useful expressions and their context together.',
      'Lưu từ vựng, cách diễn đạt hữu ích cùng ngữ cảnh của chúng ở một nơi.',
    ],
    links: [
      ['/favorites', 'Saved notes', 'Ghi chú đã lưu'],
      ['/journal', 'Useful expressions', 'Cụm từ hữu ích'],
    ],
  },
  review: {
    en: 'Review center',
    zh: 'Trung tâm ôn tập',
    description: [
      'Revisit lessons, recall saved notes and work on weak spots.',
      'Ôn lại bài học, nhớ lại ghi chú đã lưu và luyện tập các điểm yếu.',
    ],
    links: [
      ['/review', 'Overview', 'Tổng quan'],
      ['/review/today', 'Lesson review', 'Ôn tập bài học'],
      ['/favorites/review', 'Notes review', 'Ôn tập ghi chú'],
      ['/weak-spots', 'Weak spots', 'Điểm yếu'],
    ],
  },
  materials: {
    en: 'Learning materials',
    zh: 'Tài liệu học tập',
    description: [
      'Manage originals here. Follow lessons and progress in My courses.',
      'Quản lý tài liệu gốc tại đây. Theo dõi bài học và tiến độ trong Khóa học của tôi.',
    ],
    links: [
      ['/library', 'My materials', 'Tài liệu của tôi'],
      ['/library/wordbooks', 'Word books', 'Sổ từ vựng'],
      ['/library/import', 'Import material', 'Nhập tài liệu'],
    ],
  },
} as const;

export function LearningSectionNav() {
  const pathname = usePathname();
  const zh = useLanguageStore((s) => s.interfaceLanguage) === 'zh';
  const section = learningSection(pathname);
  if (section !== 'notes' && section !== 'review' && section !== 'materials') return null;
  const config = sections[section];
  const Heading = pathname === '/review' ? 'h1' : 'p';
  // The most specific matching link wins: /review must not steal /review/today.
  const selected = [...config.links]
    .sort((a, b) => b[0].length - a[0].length)
    .find(([href]) => withinRoute(pathname, href))?.[0];
  return (
    <section className="mx-auto mb-6 max-w-6xl border-b border-slate-200 pb-4" aria-label={zh ? config.zh : config.en}>
      <Heading className="text-xl font-semibold text-slate-900">{zh ? config.zh : config.en}</Heading>
      <p className="mt-1 text-sm text-slate-500">{config.description[zh ? 1 : 0]}</p>
      <nav aria-label={zh ? 'Điều hướng danh mục' : 'Section navigation'} className="mt-3 flex flex-wrap gap-2">
        {config.links.map(([href, en, cn]) => (
          <Link
            key={href}
            href={href}
            aria-current={selected === href ? 'page' : undefined}
            className={`inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-indigo-600 ${selected === href ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-indigo-50'}`}
          >
            {zh ? cn : en}
          </Link>
        ))}
      </nav>
    </section>
  );
}

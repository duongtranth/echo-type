export type LearningSection =
  | 'today'
  | 'courses'
  | 'materials'
  | 'review'
  | 'notes'
  | 'conversation'
  | 'pronunciation'
  | 'exams'
  | 'settings';

export const PRIMARY_LEARNING_LINKS = [
  { section: 'today', href: '/dashboard', en: 'Today', zh: 'Hôm nay' },
  { section: 'courses', href: '/learn', en: 'My courses', zh: 'Khóa học của tôi' },
  { section: 'materials', href: '/library', en: 'Learning materials', zh: 'Tài liệu học' },
  { section: 'review', href: '/review', en: 'Review center', zh: 'Trung tâm ôn tập' },
  { section: 'notes', href: '/favorites', en: 'My notes', zh: 'Ghi chú của tôi' },
  { section: 'conversation', href: '/speak', en: 'AI conversation', zh: 'Hội thoại AI' },
  { section: 'pronunciation', href: '/pronunciation', en: 'Pronunciation', zh: 'Luyện phát âm' },
  { section: 'exams', href: '/exams', en: 'IELTS & TOEIC', zh: 'Luyện IELTS & TOEIC' },
] as const;

export function withinRoute(path: string, root: string): boolean {
  return path === root || path.startsWith(`${root}/`);
}

export function learningSection(path: string): LearningSection | null {
  if (['/review', '/favorites/review', '/weak-spots'].some((root) => withinRoute(path, root))) return 'review';
  if (['/favorites', '/journal'].some((root) => withinRoute(path, root))) return 'notes';
  if (['/learn', '/listen', '/read', '/write'].some((root) => withinRoute(path, root))) return 'courses';
  if (withinRoute(path, '/settings')) return 'settings';
  return PRIMARY_LEARNING_LINKS.find((link) => withinRoute(path, link.href))?.section ?? null;
}

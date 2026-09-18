import { nanoid } from 'nanoid';
import type { CollectionItem } from '@/types/content';

export function buildLibraryCollection(title: string, itemIds: string[]): CollectionItem {
  const now = Date.now();
  return {
    id: nanoid(),
    title,
    titleZh: title,
    description: `${itemIds.length} saved items`,
    descriptionZh: `${itemIds.length} mục đã lưu`,
    scenario: title,
    category: 'custom',
    difficulty: 'beginner',
    icon: '📚',
    itemIds,
    tags: ['custom'],
    source: 'user-created',
    createdAt: now,
    updatedAt: now,
  };
}

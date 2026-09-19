'use client';

import { ImageOff, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { Rating } from 'ts-fsrs';
import {
  IOS_EYEBROW_CLASS,
  IOS_PILL_CLASS,
  IOS_SUBCARD_CLASS,
  IOS_TINTED_SUBCARD_CLASS,
} from '@/components/shared/ios-native-ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useWordImage } from '@/hooks/use-word-image';
import { previewRatings } from '@/lib/fsrs';
import { detectIOSNativeHost } from '@/lib/tauri';
import { cn } from '@/lib/utils';
import { useFavoriteStore } from '@/stores/favorite-store';
import type { FavoriteItem } from '@/types/favorite';

interface Props {
  item: FavoriteItem;
}

const RATING_LABELS: Record<number, { label: string; color: string }> = {
  [Rating.Again]: { label: 'Again', color: 'bg-red-500 hover:bg-red-600' },
  [Rating.Hard]: { label: 'Hard', color: 'bg-amber-500 hover:bg-amber-600' },
  [Rating.Good]: { label: 'Good', color: 'bg-green-500 hover:bg-green-600' },
  [Rating.Easy]: { label: 'Easy', color: 'bg-blue-500 hover:bg-blue-600' },
};

export function FavoriteDetail({ item }: Props) {
  const isIOSNativeHost = detectIOSNativeHost();
  const gradeReview = useFavoriteStore((s) => s.gradeReview);
  const updateFavorite = useFavoriteStore((s) => s.updateFavorite);
  const updateFavoriteFolders = useFavoriteStore((s) => s.updateFavoriteFolders);
  const folders = useFavoriteStore((s) => s.folders);
  const [notes, setNotes] = useState(item.notes || '');
  const [newExample, setNewExample] = useState('');

  const previews = previewRatings(item.fsrsCard);
  const { url: imageUrl, attribution, isLoading: isImageLoading } = useWordImage(item.text, !!item.hasImage);

  const handleSaveNotes = () => {
    updateFavorite(item.id, { notes });
  };

  const handleToggleFolder = (folderId: string) => {
    const next = item.folderIds.includes(folderId)
      ? item.folderIds.filter((id) => id !== folderId)
      : [...item.folderIds, folderId];
    updateFavoriteFolders(item.id, next);
  };

  const handleAddExample = () => {
    const trimmed = newExample.trim();
    if (!trimmed) return;
    updateFavorite(item.id, { examples: [...(item.examples ?? []), trimmed] });
    setNewExample('');
  };

  const handleRemoveExample = (index: number) => {
    const next = (item.examples ?? []).filter((_, i) => i !== index);
    updateFavorite(item.id, { examples: next });
  };

  return (
    <div
      data-testid={`favorite-detail-${item.id}`}
      className={cn(
        'space-y-3',
        isIOSNativeHost
          ? `ml-3 mr-0 mb-1 p-4 ${IOS_TINTED_SUBCARD_CLASS}`
          : 'ml-12 mr-3 mb-2 rounded-lg border border-slate-100 bg-white p-3',
      )}
    >
      {/* Full translation */}
      <div className={isIOSNativeHost ? `${IOS_SUBCARD_CLASS} p-3.5` : undefined}>
        <p className={cn('mb-0.5 text-xs text-slate-400', isIOSNativeHost && IOS_EYEBROW_CLASS)}>Translation</p>
        <p className="text-sm text-slate-800">{item.translation}</p>
      </div>

      {/* Illustration */}
      {item.hasImage && (
        <div className="flex flex-col items-center gap-1">
          <div className="relative h-28 w-28 overflow-hidden rounded-2xl bg-indigo-50">
            {isImageLoading && <Skeleton className="h-full w-full" />}
            {!isImageLoading && imageUrl && (
              <img src={imageUrl} alt={item.text} className="h-full w-full object-cover" />
            )}
            {!isImageLoading && !imageUrl && (
              <div className="flex h-full w-full items-center justify-center text-indigo-200">
                <ImageOff className="h-6 w-6" />
              </div>
            )}
          </div>
          {attribution && (
            <p className="text-[9px] text-slate-300">
              Ảnh:{' '}
              <a href={attribution.photographerUrl} target="_blank" rel="noopener noreferrer" className="underline">
                {attribution.photographer}
              </a>{' '}
              /{' '}
              <a href={attribution.unsplashUrl} target="_blank" rel="noopener noreferrer" className="underline">
                Unsplash
              </a>
            </p>
          )}
        </div>
      )}

      {/* Part of speech + tags */}
      {(item.pos || (item.tags && item.tags.length > 0)) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {item.pos && (
            <Badge variant="secondary" className="text-[10px]">
              {item.pos}
            </Badge>
          )}
          {item.tags?.map((tag) => (
            <Badge key={tag} variant="outline" className="text-[10px] border-indigo-100 text-indigo-500">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Folder membership */}
      {folders.length > 0 && (
        <div className={isIOSNativeHost ? `${IOS_SUBCARD_CLASS} p-3.5` : undefined}>
          <p className={cn('mb-1.5 text-xs text-slate-400', isIOSNativeHost && IOS_EYEBROW_CLASS)}>Folders</p>
          <div className="flex flex-wrap gap-1.5">
            {folders.map((f) => {
              const active = item.folderIds.includes(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => handleToggleFolder(f.id)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                    active
                      ? 'border-indigo-300 bg-indigo-100 text-indigo-700'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50',
                  )}
                >
                  {f.emoji} {f.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* User-authored examples */}
      <div className={isIOSNativeHost ? `${IOS_SUBCARD_CLASS} p-3.5` : undefined}>
        <p className={cn('mb-1.5 text-xs text-slate-400', isIOSNativeHost && IOS_EYEBROW_CLASS)}>Examples</p>
        {(item.examples ?? []).length > 0 && (
          <ul className="mb-2 space-y-1">
            {(item.examples ?? []).map((example, index) => (
              <li
                key={`${item.id}-example-${index}`}
                className="flex items-start justify-between gap-2 rounded bg-slate-50 px-2 py-1.5 text-xs text-slate-700"
              >
                <span>{example}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveExample(index)}
                  aria-label={`Remove example ${index + 1}`}
                  className="shrink-0 text-slate-300 hover:text-red-500"
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-1.5">
          <Input
            value={newExample}
            onChange={(e) => setNewExample(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddExample();
              }
            }}
            placeholder="Add an example..."
            className="h-8 flex-1 bg-white text-xs"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8 shrink-0 px-2"
            onClick={handleAddExample}
            disabled={!newExample.trim()}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Context */}
      {item.context && (
        <div className={isIOSNativeHost ? `${IOS_SUBCARD_CLASS} p-3.5` : undefined}>
          <p className={cn('mb-1 text-xs text-slate-400', isIOSNativeHost && IOS_EYEBROW_CLASS)}>Context</p>
          <p
            className={cn(
              'text-xs text-slate-600',
              isIOSNativeHost ? 'rounded-[18px] bg-slate-50/90 px-3 py-2.5' : 'bg-slate-50 rounded px-2 py-1.5',
            )}
          >
            {item.context}
          </p>
        </div>
      )}

      {/* Related */}
      {item.related && (
        <div className={isIOSNativeHost ? `${IOS_SUBCARD_CLASS} p-3.5` : undefined}>
          <p className={cn('mb-1.5 text-xs text-slate-400', isIOSNativeHost && IOS_EYEBROW_CLASS)}>Related</p>
          <div className="flex flex-wrap gap-1">
            {item.related.synonyms?.map((s) => (
              <span
                key={s}
                className={cn(
                  'text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600',
                  isIOSNativeHost && IOS_PILL_CLASS,
                )}
              >
                {s}
              </span>
            ))}
            {item.related.wordFamily?.map((w) => (
              <span
                key={w.word}
                className={cn(
                  'text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600',
                  isIOSNativeHost && IOS_PILL_CLASS,
                )}
              >
                {w.word} ({w.pos})
              </span>
            ))}
            {item.related.relatedPhrases?.map((p) => (
              <span
                key={p}
                className={cn(
                  'text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-600',
                  isIOSNativeHost && IOS_PILL_CLASS,
                )}
              >
                {p}
              </span>
            ))}
            {item.related.keyVocabulary?.map((kv) => (
              <span
                key={kv.word}
                className={cn(
                  'text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600',
                  isIOSNativeHost && IOS_PILL_CLASS,
                )}
              >
                {kv.word}: {kv.translation}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      <div className={isIOSNativeHost ? `${IOS_SUBCARD_CLASS} p-3.5` : undefined}>
        <p className={cn('mb-1 text-xs text-slate-400', isIOSNativeHost && IOS_EYEBROW_CLASS)}>Notes</p>
        <textarea
          data-testid={`favorite-notes-${item.id}`}
          aria-label={`Favorite notes ${item.text}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleSaveNotes}
          placeholder="Add notes..."
          className={cn(
            'w-full resize-none border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-300',
            isIOSNativeHost ? 'h-20 rounded-2xl bg-slate-50/85 p-3 text-[13px]' : 'h-16 rounded p-2 text-xs',
          )}
        />
      </div>

      {/* FSRS rating */}
      <div className={isIOSNativeHost ? `${IOS_SUBCARD_CLASS} p-3.5` : undefined}>
        <p className={cn('mb-1.5 text-xs text-slate-400', isIOSNativeHost && IOS_EYEBROW_CLASS)}>Review</p>
        <div className="flex gap-1.5">
          {[Rating.Again, Rating.Hard, Rating.Good, Rating.Easy].map((r) => {
            const { label, color } = RATING_LABELS[r]!;
            const preview = previews[r];
            return (
              <Button
                key={r}
                size="sm"
                data-testid={`favorite-rate-${item.id}-${r}`}
                aria-label={`Favorite rate ${r}`}
                className={cn(
                  `text-white ${color} flex-1`,
                  isIOSNativeHost ? 'h-9 rounded-full text-[11px]' : 'h-7 text-xs',
                )}
                onClick={() => gradeReview(item.id, r)}
              >
                {label} ({preview.interval})
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

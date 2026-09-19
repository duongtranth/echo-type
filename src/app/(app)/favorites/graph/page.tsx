'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { FavoritesGraph } from '@/components/favorites/favorites-graph';
import { useI18n } from '@/lib/i18n/use-i18n';
import { useFavoriteStore } from '@/stores/favorite-store';

export default function FavoritesGraphPage() {
  const loadFavorites = useFavoriteStore((s) => s.loadFavorites);
  const isLoaded = useFavoriteStore((s) => s.isLoaded);
  const { messages: t } = useI18n('favorites');

  useEffect(() => {
    if (!isLoaded) loadFavorites();
  }, [isLoaded, loadFavorites]);

  return (
    <div className="max-w-4xl">
      <div className="mb-4">
        <Link
          href="/favorites"
          className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-indigo-600"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t.title}
        </Link>
        <h1 className="font-heading text-xl font-extrabold tracking-tight text-slate-950 md:text-2xl">
          {t.graphTitle}
        </h1>
        <p className="mt-0.5 text-xs text-slate-500 md:text-sm">{t.graphDescription}</p>
      </div>

      {isLoaded ? <FavoritesGraph /> : <div className="h-[560px] animate-pulse rounded-2xl bg-slate-100" />}
    </div>
  );
}

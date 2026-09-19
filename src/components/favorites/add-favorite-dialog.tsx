'use client';

import { List, Plus, Type as TypeIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/lib/i18n/use-i18n';
import { useFavoriteStore } from '@/stores/favorite-store';
import { useTTSStore } from '@/stores/tts-store';
import type { FavoriteType } from '@/types/favorite';

interface AddFavoriteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function inferFavoriteType(text: string): FavoriteType {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return 'word';
  if (words.length <= 6) return 'phrase';
  return 'sentence';
}

async function translateOne(text: string, targetLang: string): Promise<string> {
  try {
    const response = await fetch('/api/translate/free', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLang }),
    });
    if (!response.ok) return '';
    const data = (await response.json()) as { translation?: string };
    return data.translation || '';
  } catch {
    return '';
  }
}

async function translateBatch(texts: string[], targetLang: string): Promise<string[]> {
  if (texts.length === 0) return [];
  try {
    const response = await fetch('/api/translate/free', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sentences: texts, targetLang }),
    });
    if (!response.ok) return texts.map(() => '');
    const data = (await response.json()) as { translations?: string[] };
    return data.translations?.length === texts.length ? data.translations : texts.map(() => '');
  } catch {
    return texts.map(() => '');
  }
}

export function AddFavoriteDialog({ open, onOpenChange }: AddFavoriteDialogProps) {
  const { addFavorite, folders, activeFolderId } = useFavoriteStore();
  const targetLang = useTTSStore((s) => s.targetLang);
  const { messages } = useI18n('favorites');
  const [mode, setMode] = useState<'single' | 'batch'>('single');

  const [text, setText] = useState('');
  const [translation, setTranslation] = useState('');
  const [folderId, setFolderId] = useState(activeFolderId ?? 'default');

  const [batchText, setBatchText] = useState('');
  const [batchFolderId, setBatchFolderId] = useState(activeFolderId ?? 'default');

  const [saving, setSaving] = useState(false);

  const batchLines = batchText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const resetForm = () => {
    setText('');
    setTranslation('');
    setFolderId(activeFolderId ?? 'default');
    setBatchText('');
    setBatchFolderId(activeFolderId ?? 'default');
    setSaving(false);
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  };

  const handleSaveSingle = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSaving(true);
    const finalTranslation = translation.trim() || (await translateOne(trimmed, targetLang));
    await addFavorite({
      text: trimmed,
      translation: finalTranslation,
      type: inferFavoriteType(trimmed),
      folderId,
      sourceModule: 'library',
      targetLang,
    });
    handleClose(false);
  };

  const handleSaveBatch = async () => {
    if (batchLines.length === 0) return;
    setSaving(true);
    const translations = await translateBatch(batchLines, targetLang);
    for (let i = 0; i < batchLines.length; i++) {
      const line = batchLines[i]!;
      await addFavorite({
        text: line,
        translation: translations[i] || '',
        type: inferFavoriteType(line),
        folderId: batchFolderId,
        sourceModule: 'library',
        targetLang,
      });
    }
    handleClose(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-indigo-900">{messages.addDialogTitle}</DialogTitle>
          <DialogDescription>{messages.addDialogDescription}</DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5 w-fit">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMode('single')}
            className={`rounded-md text-xs cursor-pointer ${mode === 'single' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500'}`}
          >
            <TypeIcon className="w-3.5 h-3.5 mr-1" />
            {messages.modeSingle}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMode('batch')}
            className={`rounded-md text-xs cursor-pointer ${mode === 'batch' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500'}`}
          >
            <List className="w-3.5 h-3.5 mr-1" />
            {messages.modeBatch}
          </Button>
        </div>

        {mode === 'single' ? (
          <div className="space-y-4">
            <div>
              <label htmlFor="add-favorite-text" className="text-sm font-medium text-indigo-700 mb-1 block">
                {messages.labelText}
              </label>
              <Input
                id="add-favorite-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={messages.placeholderText}
                className="bg-white/50 border-indigo-200"
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="add-favorite-translation" className="text-sm font-medium text-indigo-700 mb-1 block">
                {messages.labelTranslation}
              </label>
              <Input
                id="add-favorite-translation"
                value={translation}
                onChange={(e) => setTranslation(e.target.value)}
                placeholder={messages.placeholderTranslation}
                className="bg-white/50 border-indigo-200"
              />
            </div>

            {folders.length > 0 && (
              <div>
                <p className="text-sm font-medium text-indigo-700 mb-1">{messages.folder}</p>
                <div className="flex gap-2 flex-wrap">
                  {folders.map((f) => (
                    <Button
                      key={f.id}
                      variant={folderId === f.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFolderId(f.id)}
                      className={
                        folderId === f.id
                          ? 'bg-indigo-600 cursor-pointer'
                          : 'border-indigo-200 text-indigo-600 cursor-pointer'
                      }
                    >
                      {f.emoji} {f.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                onClick={handleSaveSingle}
                disabled={!text.trim() || saving}
                className="w-full bg-green-500 hover:bg-green-600 text-white cursor-pointer"
              >
                {saving ? (
                  translation.trim() ? (
                    messages.saving
                  ) : (
                    messages.translating
                  )
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    {messages.saveSingle}
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="add-favorite-batch" className="text-sm font-medium text-indigo-700 mb-1 block">
                {messages.labelBatch}
              </label>
              <Textarea
                id="add-favorite-batch"
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                placeholder={messages.placeholderBatch}
                rows={6}
                className="bg-white/50 border-indigo-200"
                autoFocus
              />
              {batchLines.length > 0 && (
                <p className="text-xs text-indigo-500 mt-1">
                  {batchLines.length === 1
                    ? messages.itemsDetected.replace('{{count}}', '1')
                    : messages.itemsDetectedPlural.replace('{{count}}', String(batchLines.length))}
                </p>
              )}
            </div>

            {folders.length > 0 && (
              <div>
                <p className="text-sm font-medium text-indigo-700 mb-1">{messages.folder}</p>
                <div className="flex gap-2 flex-wrap">
                  {folders.map((f) => (
                    <Button
                      key={f.id}
                      variant={batchFolderId === f.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setBatchFolderId(f.id)}
                      className={
                        batchFolderId === f.id
                          ? 'bg-indigo-600 cursor-pointer'
                          : 'border-indigo-200 text-indigo-600 cursor-pointer'
                      }
                    >
                      {f.emoji} {f.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                onClick={handleSaveBatch}
                disabled={batchLines.length === 0 || saving}
                className="w-full bg-green-500 hover:bg-green-600 text-white cursor-pointer"
              >
                {saving ? (
                  messages.translating
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    {batchLines.length === 1
                      ? messages.saveBatch.replace('{{count}}', '1')
                      : messages.saveBatchPlural.replace('{{count}}', String(batchLines.length))}
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

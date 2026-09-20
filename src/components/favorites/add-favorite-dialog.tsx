'use client';

import { ImagePlus, List, Plus, Type as TypeIcon } from 'lucide-react';
import { useState } from 'react';
import { TagSelector } from '@/components/shared/tag-selector';
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
import { cn } from '@/lib/utils';
import { useFavoriteStore } from '@/stores/favorite-store';
import { useTTSStore } from '@/stores/tts-store';
import type { FavoriteType } from '@/types/favorite';

interface AddFavoriteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const POS_OPTIONS = ['noun', 'verb', 'adjective', 'adverb', 'phrase', 'idiom'] as const;
const MAX_WORDS = 6;

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function inferFavoriteType(text: string): FavoriteType {
  return wordCount(text) <= 1 ? 'word' : 'phrase';
}

function toggleInArray(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
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

function FolderPicker({
  folders,
  selected,
  onToggle,
  label,
}: {
  folders: { id: string; emoji: string; name: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  label: string;
}) {
  if (folders.length === 0) return null;
  return (
    <div>
      <p className="text-sm font-medium text-indigo-700 mb-1">{label}</p>
      <div className="flex gap-2 flex-wrap">
        {folders.map((f) => {
          const active = selected.includes(f.id);
          return (
            <Button
              key={f.id}
              type="button"
              variant={active ? 'default' : 'outline'}
              size="sm"
              onClick={() => onToggle(f.id)}
              className={active ? 'bg-indigo-600 cursor-pointer' : 'border-indigo-200 text-indigo-600 cursor-pointer'}
            >
              {f.emoji} {f.name}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export function AddFavoriteDialog({ open, onOpenChange }: AddFavoriteDialogProps) {
  const { addFavorite, folders, activeFolderId } = useFavoriteStore();
  const targetLang = useTTSStore((s) => s.targetLang);
  const { messages } = useI18n('favorites');
  const [mode, setMode] = useState<'single' | 'batch'>('single');

  const defaultFolderIds = activeFolderId ? [activeFolderId] : ['default'];

  const [text, setText] = useState('');
  const [translation, setTranslation] = useState('');
  const [folderIds, setFolderIds] = useState<string[]>(defaultFolderIds);
  const [pos, setPos] = useState<string>('');
  const [tagsValue, setTagsValue] = useState('');
  const [examplesText, setExamplesText] = useState('');
  const [hasImage, setHasImage] = useState(false);

  const [batchText, setBatchText] = useState('');
  const [batchFolderIds, setBatchFolderIds] = useState<string[]>(defaultFolderIds);
  const [batchTagsValue, setBatchTagsValue] = useState('');

  const [saving, setSaving] = useState(false);

  const trimmedText = text.trim();
  const isTextTooLong = trimmedText.length > 0 && wordCount(trimmedText) > MAX_WORDS;

  const allBatchLines = batchText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const batchLines = allBatchLines.filter((line) => wordCount(line) <= MAX_WORDS);
  const skippedBatchLines = allBatchLines.length - batchLines.length;

  const resetForm = () => {
    setText('');
    setTranslation('');
    setFolderIds(defaultFolderIds);
    setPos('');
    setTagsValue('');
    setExamplesText('');
    setHasImage(false);
    setBatchText('');
    setBatchFolderIds(defaultFolderIds);
    setBatchTagsValue('');
    setSaving(false);
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  };

  const handleSaveSingle = async () => {
    const trimmed = text.trim();
    if (!trimmed || wordCount(trimmed) > MAX_WORDS) return;
    setSaving(true);
    const finalTranslation = translation.trim() || (await translateOne(trimmed, targetLang));
    const examples = examplesText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const tags = tagsValue
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    await addFavorite({
      text: trimmed,
      translation: finalTranslation,
      type: inferFavoriteType(trimmed),
      folderIds: folderIds.length > 0 ? folderIds : ['default'],
      pos: pos || undefined,
      tags: tags.length > 0 ? tags : undefined,
      examples: examples.length > 0 ? examples : undefined,
      hasImage,
      sourceModule: 'library',
      targetLang,
    });
    handleClose(false);
  };

  const handleSaveBatch = async () => {
    if (batchLines.length === 0) return;
    setSaving(true);
    const translations = await translateBatch(batchLines, targetLang);
    const tags = batchTagsValue
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    for (let i = 0; i < batchLines.length; i++) {
      const line = batchLines[i]!;
      await addFavorite({
        text: line,
        translation: translations[i] || '',
        type: inferFavoriteType(line),
        folderIds: batchFolderIds.length > 0 ? batchFolderIds : ['default'],
        tags: tags.length > 0 ? tags : undefined,
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
                className={cn('bg-white/50 border-indigo-200', isTextTooLong && 'border-red-300')}
                autoFocus
              />
              {isTextTooLong && <p className="mt-1 text-xs text-red-500">{messages.tooLongSingle}</p>}
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

            <FolderPicker
              folders={folders}
              selected={folderIds}
              onToggle={(id) => setFolderIds((prev) => toggleInArray(prev, id))}
              label={messages.folder}
            />

            <div>
              <p className="text-sm font-medium text-indigo-700 mb-1">{messages.pos}</p>
              <div className="flex gap-2 flex-wrap">
                {POS_OPTIONS.map((p) => (
                  <Button
                    key={p}
                    type="button"
                    variant={pos === p ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPos(pos === p ? '' : p)}
                    className={
                      pos === p ? 'bg-indigo-600 cursor-pointer' : 'border-indigo-200 text-indigo-600 cursor-pointer'
                    }
                  >
                    {messages[`pos_${p}` as keyof typeof messages] as string}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-indigo-700 mb-1">{messages.tags}</p>
              <TagSelector value={tagsValue} onChange={setTagsValue} className="bg-white/50 border-indigo-200" />
            </div>

            <div>
              <label htmlFor="add-favorite-examples" className="text-sm font-medium text-indigo-700 mb-1 block">
                {messages.labelExamples}
              </label>
              <Textarea
                id="add-favorite-examples"
                value={examplesText}
                onChange={(e) => setExamplesText(e.target.value)}
                placeholder={messages.placeholderExamples}
                rows={3}
                className="bg-white/50 border-indigo-200"
              />
            </div>

            <Button
              type="button"
              variant={hasImage ? 'default' : 'outline'}
              size="sm"
              onClick={() => setHasImage((v) => !v)}
              className={cn(
                'gap-1.5',
                hasImage ? 'bg-indigo-600 cursor-pointer' : 'border-indigo-200 text-indigo-600 cursor-pointer',
              )}
            >
              <ImagePlus className="h-3.5 w-3.5" />
              {messages.addImage}
            </Button>

            <DialogFooter>
              <Button
                onClick={handleSaveSingle}
                disabled={!text.trim() || isTextTooLong || saving}
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
              {skippedBatchLines > 0 && (
                <p className="text-xs text-red-500 mt-1">
                  {skippedBatchLines === 1
                    ? messages.tooLongBatchSkipped.replace('{{count}}', '1')
                    : messages.tooLongBatchSkippedPlural.replace('{{count}}', String(skippedBatchLines))}
                </p>
              )}
            </div>

            <FolderPicker
              folders={folders}
              selected={batchFolderIds}
              onToggle={(id) => setBatchFolderIds((prev) => toggleInArray(prev, id))}
              label={messages.folder}
            />

            <div>
              <p className="text-sm font-medium text-indigo-700 mb-1">{messages.tags}</p>
              <TagSelector
                value={batchTagsValue}
                onChange={setBatchTagsValue}
                className="bg-white/50 border-indigo-200"
              />
            </div>

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

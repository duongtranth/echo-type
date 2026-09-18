'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { shouldUseDirectBrowserTranscription, transcribeInBrowser } from '@/lib/browser-transcription';
import { db, LOCAL_DATABASE_CHANGED_EVENT } from '@/lib/db';
import { parseSubtitles, shiftSubtitleBlocks, textSourceBlocks } from '@/lib/import-job';
import { captureImportScope, createImportJob, publishImportJob } from '@/lib/import-job-repository';
import { fetchUrlImportResult } from '@/lib/url-import-fetch';
import { useAuthStore } from '@/stores/auth-store';
import { useLanguageStore } from '@/stores/language-store';
import { useProviderStore } from '@/stores/provider-store';
import type { ImportJob, ImportSourceBlock } from '@/types/import-job';

const formats = '.txt,.md,.text,.pdf,.docx,.epub,.srt,.vtt,.mp3,.wav,.m4a,.ogg,.flac,.mp4,.webm,.avi';
const statusLabels: Record<ImportJob['status'], [string, string]> = {
  queued: ['Ready to process', 'Sẵn sàng xử lý'],
  processing: ['Processing / resume if interrupted', 'Đang xử lý / tiếp tục nếu bị gián đoạn'],
  needsReview: ['Review before learning', 'Cần soát lại trước khi học'],
  ready: ['In your library', 'Đã có trong thư viện'],
  failed: ['Needs retry', 'Cần thử lại'],
  cancelled: ['Paused — original retained', 'Đã tạm dừng — vẫn giữ tệp gốc'],
};

export function DurableImport() {
  const zh = useLanguageStore((state) => state.interfaceLanguage) === 'zh';
  const t = (en: string, cn: string) => (zh ? cn : en);
  const ownerId = useAuthStore((state) => state.user?.id || 'guest');
  const [database, setDatabase] = useState(db);
  const jobs = useLiveQuery(() => database.importJobs.orderBy('createdAt').reverse().toArray(), [database], []);
  const [selected, setSelected] = useState<ImportJob | null>(null);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const openedFromLink = useRef(false);

  useEffect(() => {
    if (openedFromLink.current) return;
    const requested = new URLSearchParams(window.location.search).get('job');
    const job = jobs.find((entry) => entry.id === requested);
    if (job) {
      setSelected(job);
      openedFromLink.current = true;
    }
  }, [jobs]);

  useEffect(() => {
    const changed = () => {
      setDatabase(db);
      setSelected(null);
      setBusy(false);
      setError('');
      openedFromLink.current = false;
    };
    window.addEventListener(LOCAL_DATABASE_CHANGED_EVENT, changed);
    return () => window.removeEventListener(LOCAL_DATABASE_CHANGED_EVENT, changed);
  }, []);

  const attempt = async (action: () => Promise<void>) => {
    setError('');
    setBusy(true);
    setSaved(false);
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  const add = (file?: File) =>
    attempt(async () => {
      const scope = captureImportScope();
      const next = await createImportJob({ file, url: file ? undefined : url, ownerId });
      scope.assertActive();
      setSelected(next);
    });

  const persistSelected = async (next: ImportJob) => {
    if (!selected) return;
    const scope = captureImportScope();
    const stored = await scope.database.transaction('rw', scope.database.importJobs, async () => {
      const current = await scope.database.importJobs.get(selected.id);
      if (
        !current ||
        current.updatedAt !== selected.updatedAt ||
        current.status !== selected.status ||
        current.status === 'ready'
      )
        throw new Error('Task changed in another window. Open it again.');
      const updated = { ...next, updatedAt: Math.max(Date.now(), current.updatedAt + 1) };
      await scope.database.importJobs.put(updated);
      return updated;
    });
    scope.assertActive();
    setSelected(stored);
  };

  const process = () =>
    attempt(async () => {
      if (!selected) return;
      const scope = captureImportScope();
      const job = selected;
      const runId = crypto.randomUUID();
      await persistSelected({ ...job, status: 'processing', runId, error: undefined });
      try {
        let text = '';
        let title = job.title;
        let blocks: ImportSourceBlock[] = [];
        if (job.kind === 'url') {
          const host = new URL(job.sourceUrl!).hostname;
          if (/(^|\.)youtube\.com$/.test(host) || host === 'youtu.be') {
            const response = await fetch('/api/import/youtube', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: job.sourceUrl }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Caption extraction failed');
            title = result.title || `YouTube: ${result.videoId}`;
            text = result.segments.map((segment: { text: string }) => segment.text.trim()).join('\n\n');
            let cursor = 0;
            blocks = result.segments.map(
              (segment: { text: string; offset: number; duration: number }, index: number) => {
                const value = segment.text.trim();
                const start = cursor;
                cursor += value.length + 2;
                return {
                  id: `cue-${index + 1}`,
                  title: `Cue ${index + 1}`,
                  text: value,
                  start,
                  end: start + value.length,
                  timeStart: segment.offset,
                  timeEnd: segment.offset + segment.duration,
                };
              },
            );
          } else {
            const result = await fetchUrlImportResult(job.sourceUrl!);
            text = result.text;
            title = result.title;
            blocks = textSourceBlocks(text);
          }
        } else {
          if (!job.originalFile)
            throw new Error(
              t(
                'Original file missing. Reselect the same file to restore it.',
                'Không tìm thấy tệp gốc. Hãy chọn lại cùng một tệp để khôi phục.',
              ),
            );
          const file = new File([job.originalFile], job.filename!, { type: job.mimeType });
          if (job.kind === 'subtitle') {
            blocks = parseSubtitles(await file.text());
            text = blocks.map((block) => block.text).join('\n\n');
          } else if (job.kind === 'media') {
            const { activeProviderId, providers } = useProviderStore.getState();
            const form = new FormData();
            form.append('file', file);
            form.append('provider', activeProviderId);
            form.append('providerConfigs', JSON.stringify(providers));
            const result = shouldUseDirectBrowserTranscription(file)
              ? await transcribeInBrowser({ file, provider: activeProviderId, providerConfigs: providers })
              : await (async () => {
                  const response = await fetch('/api/import/transcribe', { method: 'POST', body: form });
                  const payload = await response.json();
                  if (!response.ok) throw new Error(payload.error || 'Transcription failed');
                  return payload;
                })();
            text = result.text;
            blocks = textSourceBlocks(text);
            if (result.segments?.length) {
              text = result.segments.map((segment: { text: string }) => segment.text.trim()).join('\n\n');
              let cursor = 0;
              blocks = result.segments.map((segment: { text: string; start: number; end: number }, index: number) => {
                const value = segment.text.trim();
                const start = cursor;
                cursor += value.length + 2;
                return {
                  id: `cue-${index + 1}`,
                  title: `Cue ${index + 1}`,
                  text: value,
                  start,
                  end: start + value.length,
                  timeStart: segment.start,
                  timeEnd: segment.end,
                };
              });
            }
          } else {
            const form = new FormData();
            form.append('file', file);
            const response = await fetch('/api/import/extract-text', { method: 'POST', body: form });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Extraction failed');
            title = result.metadata?.title || title;
            // Canonical extracted text is the exact chapter concatenation, so all source offsets remain verifiable.
            text = result.chapters?.length
              ? result.chapters.map((chapter: { text: string }) => chapter.text).join('\n\n')
              : result.text;
            blocks = textSourceBlocks(text, result.chapters);
          }
        }
        if (!text?.trim() || !blocks.length)
          throw new Error('No readable text found. Try another source or OCR using the existing tools.');
        scope.assertActive();
        await scope.database.transaction('rw', scope.database.importJobs, async () => {
          const current = await scope.database.importJobs.get(job.id);
          if (current?.runId !== runId || current.status !== 'processing') return;
          const next: ImportJob = {
            ...current,
            title,
            originalText: text,
            originalBlocks: blocks,
            blocks,
            status: 'needsReview',
            updatedAt: Date.now(),
          };
          await scope.database.importJobs.put(next);
          setSelected(next);
        });
      } catch (failure) {
        scope.assertActive();
        await scope.database.transaction('rw', scope.database.importJobs, async () => {
          const current = await scope.database.importJobs.get(job.id);
          if (current?.runId !== runId || current.status !== 'processing') return;
          const next: ImportJob = {
            ...current,
            status: 'failed',
            error: failure instanceof Error ? failure.message : 'Import failed',
            updatedAt: Date.now(),
          };
          await scope.database.importJobs.put(next);
          setSelected(next);
        });
        throw failure;
      }
    });

  const save = async () => {
    if (!selected) return;
    if (selected.status !== 'needsReview') throw new Error('Task changed in another window. Open it again.');
    await persistSelected(selected);
    setSaved(true);
  };

  const publish = () =>
    attempt(async () => {
      if (!selected) return;
      const scope = captureImportScope();
      await save();
      const ready = await publishImportJob(selected.id);
      scope.assertActive();
      setSelected(ready);
    });
  const editBlock = (id: string, patch: Partial<ImportSourceBlock>) => {
    if (selected) {
      setSelected({
        ...selected,
        blocks: selected.blocks.map((block) => (block.id === id ? { ...block, ...patch } : block)),
      });
      setSaved(false);
    }
  };
  const attachSubtitles = (file: File) =>
    attempt(async () => {
      if (!selected) return;
      const scope = captureImportScope();
      const raw = await file.text();
      const blocks = parseSubtitles(raw);
      scope.assertActive();
      const next: ImportJob = {
        ...selected,
        originalSubtitles: raw,
        originalText: selected.originalText || blocks.map((block) => block.text).join('\n\n'),
        originalBlocks: selected.originalBlocks || blocks,
        blocks,
        subtitleOffset: 0,
        status: 'needsReview',
        updatedAt: Date.now(),
      };
      await persistSelected(next);
    });

  return (
    <section
      className="space-y-5 rounded-xl bg-white p-4 text-slate-800 shadow-sm sm:p-6"
      aria-label={t('Resumable import', 'Nhập liệu có thể tiếp tục')}
    >
      <div>
        <h2 className="font-heading text-xl font-bold text-slate-950">
          {t('Prepare your material', 'Chuẩn bị tài liệu học tập')}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {t(
            'Original files and review drafts stay on this device. Keep this page open while processing; after interruption, resume here. Media transcription may use your configured provider and quota.',
            'Tệp gốc và bản nháp soát lỗi được lưu trên thiết bị này. Hãy giữ trang này mở trong khi xử lý; nếu bị gián đoạn, quay lại đây để tiếp tục. Việc phiên âm media có thể dùng nhà cung cấp và hạn mức bạn đã cấu hình.',
          )}
        </p>
      </div>
      <label className="block space-y-2 text-sm font-medium">
        {t('Document, audio, video or subtitles · up to 25 MB', 'Tài liệu, âm thanh, video hoặc phụ đề · tối đa 25 MB')}
        <input
          data-testid="durable-import-file"
          type="file"
          accept={formats}
          disabled={busy}
          className="block w-full min-w-0 rounded-lg bg-slate-100 p-3 text-sm"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void add(file);
            event.target.value = '';
          }}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Input
          aria-label={t('Source URL', 'URL nguồn')}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://…"
          className="min-w-0 flex-1"
        />
        <Button variant="outline" disabled={busy || !url.trim()} onClick={() => void add()}>
          {t('Add URL', 'Thêm URL')}
        </Button>
      </div>
      {!!jobs.length && (
        <details open={!selected}>
          <summary className="cursor-pointer py-2 text-sm font-medium">
            {t('Saved import tasks', 'Tác vụ nhập đã lưu')} ({jobs.length})
          </summary>
          <ul className="max-h-60 divide-y divide-slate-100 overflow-auto">
            {jobs.map((job) => (
              <li key={job.id} className="flex min-w-0 items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm">{job.title}</p>
                  <p className="text-xs text-slate-500">{t(...statusLabels[job.status])}</p>
                </div>
                <Button
                  data-testid="import-resume"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setSelected(job);
                    setError('');
                    setSaved(false);
                  }}
                >
                  {t('Open', 'Mở')}
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {selected && (
        <div className="space-y-4 border-t border-slate-100 pt-4">
          <h3 className="break-words font-semibold">{selected.title}</h3>
          {selected.error && !error && <p className="text-sm text-amber-800">{selected.error}</p>}
          {['queued', 'failed', 'cancelled', 'processing'].includes(selected.status) && (
            <div className="space-y-3">
              {selected.status === 'processing' && (
                <p className="text-sm text-slate-600">
                  {t(
                    'Processing. If this was interrupted, retry restarts extraction safely; it does not create duplicate material.',
                    'Đang xử lý. Nếu bị gián đoạn, thử lại sẽ an toàn khởi động lại việc trích xuất mà không tạo tài liệu trùng lặp.',
                  )}
                </p>
              )}
              {selected.blocks.length > 0 && selected.status !== 'processing' ? (
                <Button
                  disabled={busy}
                  onClick={() =>
                    void attempt(async () => {
                      const scope = captureImportScope();
                      const next: ImportJob = {
                        ...selected,
                        status: 'needsReview',
                        error: undefined,
                        updatedAt: Date.now(),
                      };
                      scope.assertActive();
                      await persistSelected(next);
                    })
                  }
                >
                  {t('Continue review', 'Tiếp tục soát lỗi')}
                </Button>
              ) : (
                <Button data-testid="import-process" disabled={busy} onClick={() => void process()}>
                  {busy ? t('Processing…', 'Đang xử lý…') : t('Process / retry', 'Xử lý / Thử lại')}
                </Button>
              )}
            </div>
          )}
          {selected.kind === 'media' && selected.status !== 'ready' && (
            <label className="block space-y-2 text-sm">
              {t('Use an SRT/VTT transcript instead of transcribing', 'Dùng phụ đề SRT/VTT thay vì phiên âm')}
              <input
                type="file"
                accept=".srt,.vtt"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void attachSubtitles(file);
                }}
              />
            </label>
          )}
          {selected.status === 'needsReview' && (
            <>
              <label className="block space-y-1 text-sm">
                {t('Material title', 'Tiêu đề tài liệu')}
                <Input
                  value={selected.title}
                  onChange={(event) => {
                    setSelected({ ...selected, title: event.target.value });
                    setSaved(false);
                  }}
                />
              </label>
              <label className="block space-y-1 text-sm">
                {t('Difficulty', 'Độ khó')}
                <select
                  className="min-h-10 rounded-lg bg-slate-100 p-2"
                  value={selected.difficulty || 'intermediate'}
                  onChange={(event) =>
                    setSelected({ ...selected, difficulty: event.target.value as ImportJob['difficulty'] })
                  }
                >
                  <option value="beginner">{t('Beginner', 'Sơ cấp')}</option>
                  <option value="intermediate">{t('Intermediate', 'Trung cấp')}</option>
                  <option value="advanced">{t('Advanced', 'Nâng cao')}</option>
                </select>
              </label>
              {selected.blocks.some((block) => block.timeStart !== undefined) && (
                <label className="block space-y-1 text-sm">
                  {t('Subtitle offset (seconds)', 'Độ lệch phụ đề (giây)')}
                  <Input
                    type="number"
                    step="0.1"
                    value={selected.subtitleOffset || 0}
                    onChange={(event) => {
                      try {
                        const next = Number(event.target.value);
                        setSelected({
                          ...selected,
                          blocks: shiftSubtitleBlocks(selected.blocks, next - (selected.subtitleOffset || 0)),
                          subtitleOffset: next,
                        });
                        setSaved(false);
                        setError('');
                      } catch (failure) {
                        setError((failure as Error).message);
                      }
                    }}
                  />
                </label>
              )}
              <p className="text-sm text-slate-600">
                {t(
                  'Review chapter names and transcript. Save review before leaving; corrections do not replace the original.',
                  'Soát lại tên chương và nội dung. Hãy lưu trước khi rời trang; chỉnh sửa không thay thế bản gốc.',
                )}
              </p>
              <div className="max-h-[32rem] space-y-4 overflow-auto">
                {selected.blocks.map((block, index) => (
                  <div key={block.id} id={`source-${block.id}`} className="space-y-2 rounded-lg bg-slate-50 p-3">
                    <label className="block text-sm">
                      {t('Section', 'Phần')} {index + 1}
                      <Input
                        aria-label={`${t('Section title', 'Tiêu đề phần')} ${index + 1}`}
                        value={block.title}
                        onChange={(event) => editBlock(block.id, { title: event.target.value })}
                      />
                    </label>
                    <p className="text-xs tabular-nums text-slate-500">
                      {block.timeStart !== undefined
                        ? `${block.timeStart.toFixed(2)}–${block.timeEnd?.toFixed(2)}s`
                        : `${t('Original characters', 'Ký tự gốc')} ${block.start}–${block.end}`}
                    </p>
                    <textarea
                      data-testid="import-block-text"
                      aria-label={`${t('Review text', 'Văn bản soát lỗi')} ${index + 1}`}
                      className="min-h-28 w-full rounded-lg bg-white p-3 text-base leading-relaxed focus-visible:ring-2 focus-visible:ring-indigo-500"
                      value={block.text}
                      onChange={(event) => editBlock(block.id, { text: event.target.value })}
                    />
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  data-testid="import-save-review"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void attempt(save)}
                >
                  {t('Save review', 'Lưu bản soát lỗi')}
                </Button>
                <Button
                  data-testid="import-publish"
                  disabled={busy || !selected.title.trim() || selected.blocks.some((block) => !block.text.trim())}
                  onClick={() => void publish()}
                >
                  {t('Add to library', 'Thêm vào thư viện')}
                </Button>
                {saved && (
                  <span role="status" className="text-sm text-green-700">
                    {t('Saved on this device', 'Đã lưu trên thiết bị này')}
                  </span>
                )}
              </div>
            </>
          )}
          {selected.status === 'ready' && (
            <div data-testid="import-ready" className="space-y-2">
              <p className="text-sm text-green-700">
                {t(
                  'Added to library. Original and reviewed versions are retained.',
                  'Đã thêm vào thư viện. Bản gốc và bản đã soát lỗi đều được giữ lại.',
                )}
              </p>
              <Link className="inline-block py-2 font-medium text-indigo-600 underline" href="/learn">
                {t('Open my courses', 'Mở khóa học của tôi')}
              </Link>
            </div>
          )}
          {selected.status === 'ready' && (
            <section
              id="source-transcript"
              className="max-h-96 space-y-4 overflow-auto"
              aria-label={t('Source locations', 'Vị trí nguồn')}
              ref={(element) => {
                if (element && new URLSearchParams(window.location.search).get('block') === 'transcript')
                  element.scrollIntoView({ block: 'nearest' });
              }}
            >
              {selected.blocks.map((block) => (
                <section
                  key={block.id}
                  id={`source-${block.id}`}
                  className="rounded-lg bg-slate-50 p-3"
                  ref={(element) => {
                    if (element && new URLSearchParams(window.location.search).get('block') === block.id)
                      element.scrollIntoView({ block: 'nearest' });
                  }}
                >
                  <h4 className="font-medium">{block.title}</h4>
                  <p className="text-xs tabular-nums text-slate-500">
                    {block.timeStart !== undefined
                      ? `${block.timeStart.toFixed(2)}–${block.timeEnd?.toFixed(2)}s`
                      : `${t('Original characters', 'Ký tự gốc')} ${block.start}–${block.end}`}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{block.text}</p>
                  <details>
                    <summary className="cursor-pointer py-2 text-xs">{t('Original source', 'Nguồn gốc')}</summary>
                    <p className="whitespace-pre-wrap text-sm">
                      {selected.originalBlocks?.find((original) => original.id === block.id)?.text ||
                        selected.originalText?.slice(block.start, block.end)}
                    </p>
                  </details>
                </section>
              ))}
            </section>
          )}
          {selected.originalText && (
            <details>
              <summary className="cursor-pointer py-2 text-sm">
                {t('Original extraction (read-only)', 'Văn bản trích xuất gốc (chỉ đọc)')}
              </summary>
              <p className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm">
                {selected.originalText}
              </p>
            </details>
          )}
          {selected.originalFile && (
            <Button
              variant="ghost"
              onClick={() => {
                const blobUrl = URL.createObjectURL(selected.originalFile!);
                const anchor = document.createElement('a');
                anchor.href = blobUrl;
                anchor.download = selected.filename || 'original';
                anchor.click();
                setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
              }}
            >
              {t('Download original file', 'Tải tệp gốc')}
            </Button>
          )}
          {selected.status !== 'ready' && (
            <Button
              variant="ghost"
              onClick={() =>
                void attempt(async () => {
                  const scope = captureImportScope();
                  const next: ImportJob = { ...selected, status: 'cancelled', runId: undefined, updatedAt: Date.now() };
                  scope.assertActive();
                  await persistSelected(next);
                })
              }
            >
              {t('Cancel task (keep original)', 'Hủy tác vụ (giữ tệp gốc)')}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

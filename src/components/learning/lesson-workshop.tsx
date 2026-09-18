'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ReadAloudContent } from '@/components/read-aloud';
import { TranslationBar } from '@/components/translation/translation-bar';
import { useTranslation } from '@/hooks/use-translation';
import { db } from '@/lib/db';
import {
  activityPrompt,
  canResolveTransfer,
  createLearningAttempt,
  LEARNING_ACTIVITIES,
  validateLearningResponse,
  workshopProgress,
} from '@/lib/learning-activity';
import { persistLearningAttempt } from '@/lib/learning-activity-persistence';
import { alignPracticeTranslations } from '@/lib/practice-translation';
import { usePracticeTranslationStore } from '@/stores/practice-translation-store';
import { useProviderStore } from '@/stores/provider-store';
import { useTTSStore } from '@/stores/tts-store';
import type { LearningActivity, LearningAttempt } from '@/types/learning-activity';
import type { Lesson } from '@/types/learning-unit';

const button =
  'min-h-11 rounded-xl px-4 py-2 text-sm font-medium active:scale-95 focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50';
export function LessonWorkshop({
  lesson,
  zh,
  sourceWeakSpotId,
}: {
  lesson: Lesson;
  zh: boolean;
  sourceWeakSpotId?: string;
}) {
  const [activity, setActivity] = useState<LearningActivity>('comprehension');
  const attempts =
    useLiveQuery(() => db.learningAttempts.where('lessonId').equals(lesson.id).toArray(), [lesson.id]) ?? [];
  const weakSpots = useLiveQuery(() => db.weakSpots.toArray(), [lesson.id]) ?? [];
  const progress = workshopProgress(lesson.id, attempts);
  const weakSpot = weakSpots.find((item) => item.id === sourceWeakSpotId);
  const related = weakSpots.filter(
    (item) =>
      !item.resolved &&
      lesson.exercises.some(
        (source) => source.id === item.sourceId || source.metadata?.lessonSourceId === item.sourceId,
      ),
  );
  const [confirm, setConfirm] = useState(false);
  const [resolveMessage, setResolveMessage] = useState('');
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const canResolve = !!weakSpot && canResolveTransfer(weakSpot.id, weakSpot.lastSeenAt, attempts);
  async function resolve() {
    const database = db;
    const isCurrent = () => mounted.current && database === db;
    if (!weakSpot || !confirm) return;
    try {
      await database.transaction('rw', database.weakSpots, database.learningAttempts, async () => {
        if (!isCurrent()) throw new Error('Account changed');
        const current = await database.weakSpots.get(weakSpot.id);
        const evidence = await database.learningAttempts.where('lessonId').equals(lesson.id).toArray();
        if (!current || !canResolveTransfer(current.id, current.lastSeenAt, evidence)) throw new Error('No evidence');
        if (!isCurrent()) throw new Error('Account changed');
        await database.weakSpots.update(current.id, { resolved: true });
        if (!isCurrent()) throw new Error('Account changed');
      });
      if (!isCurrent()) return;
      setResolveMessage(
        zh
          ? 'Đã đánh dấu giải quyết theo xác nhận của bạn; bằng chứng luyện tập vẫn được giữ lại.'
          : 'Resolved by your confirmation. Practice evidence is retained.',
      );
    } catch {
      if (!isCurrent()) return;
      setResolveMessage(
        zh
          ? 'Chưa thể giải quyết. Hãy thử lại sau khi hoàn thành thêm bài luyện tập mới.'
          : 'Could not resolve. Retry after completing new practice.',
      );
    }
  }
  return (
    <section aria-label={zh ? 'Hiểu và diễn đạt' : 'Understand and express'} className="space-y-4">
      <p className="text-sm text-slate-600">
        {zh
          ? `Vòng học cốt lõi ${progress.completedSteps}/2: đọc hiểu + viết lại sau chỉnh sửa. Các hoạt động khác là tùy chọn.`
          : `Core learning loop ${progress.completedSteps}/2: comprehension + revised writing. Other activities are optional.`}
      </p>
      {related.length > 0 && !weakSpot && (
        <div className="flex flex-wrap gap-2">
          {related.map((item) => (
            <Link
              key={item.id}
              className={`${button} bg-amber-50 text-amber-900`}
              href={`/learn/${encodeURIComponent(lesson.unitId)}?lesson=${encodeURIComponent(lesson.id)}&weakSpot=${encodeURIComponent(item.id)}`}
            >
              {zh ? 'Luyện tập trọng tâm: ' : 'Target practice: '}
              {item.text}
            </Link>
          ))}
        </div>
      )}
      {weakSpot && (
        <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950">
          <h3 className="font-semibold">
            {zh ? 'Điểm yếu trọng tâm' : 'Targeted weak spot'}: {weakSpot.text}
          </h3>
          <p>
            {zh
              ? 'Hãy nộp một bài luyện tập trọng tâm trước, sửa và thử lại, rồi dùng nó trong ngữ cảnh mới ở phần Ví dụ của bạn. Chỉ đánh dấu giải quyết sau khi bạn tự xem lại; đây không phải chứng nhận thành thạo từ AI.'
              : 'Submit targeted practice, revise and retry, then use it in a new context in Your example. Resolve only after your own review; this is not AI-certified mastery.'}
          </p>
          {weakSpot.resolved ? (
            <p>{zh ? 'Đã đánh dấu giải quyết' : 'Marked resolved'}</p>
          ) : (
            <>
              <label className="my-2 flex gap-2">
                <input
                  type="checkbox"
                  checked={confirm}
                  disabled={!canResolve}
                  onChange={(event) => setConfirm(event.target.checked)}
                />
                {zh
                  ? 'Tôi đã đối chiếu lần thử lại và ví dụ mới, xác nhận vấn đề này đã được cải thiện'
                  : 'I reviewed my retry and new example and confirm improvement'}
              </label>
              <button
                type="button"
                disabled={!canResolve || !confirm}
                onClick={() => void resolve()}
                className={`${button} bg-white text-amber-950`}
              >
                {zh ? 'Xác nhận giải quyết' : 'Confirm resolved'}
              </button>
            </>
          )}
          {resolveMessage && <p role="status">{resolveMessage}</p>}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {LEARNING_ACTIVITIES.map((value, i) => (
          <button
            type="button"
            key={value}
            aria-pressed={activity === value}
            className={`${button} ${activity === value ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700'}`}
            onClick={() => setActivity(value)}
          >
            {i + 1}.{' '}
            {
              {
                comprehension: zh ? 'Đọc hiểu' : 'Comprehension',
                writing: zh ? 'Viết tự do' : 'Writing',
                retelling: zh ? 'Kể lại' : 'Retelling',
                'personal-example': zh ? 'Ví dụ của bạn' : 'Your example',
                'sentence-pronunciation': zh ? 'Luyện phát âm câu' : 'Sentence practice',
              }[value]
            }
          </button>
        ))}
      </div>
      <WorkshopActivity
        key={`${lesson.id}:${activity}:${weakSpot?.id ?? ''}`}
        lesson={lesson}
        activity={activity}
        zh={zh}
        sourceWeakSpotId={weakSpot?.id}
      />
    </section>
  );
}

function WorkshopActivity({
  lesson,
  activity,
  zh,
  sourceWeakSpotId,
}: {
  lesson: Lesson;
  activity: LearningActivity;
  zh: boolean;
  sourceWeakSpotId?: string;
}) {
  const t = (en: string, cn: string) => (zh ? cn : en);
  const source = lesson.exercises.map((item) => item.text).join('\n\n');
  const showTranslation = usePracticeTranslationStore((state) => state.visibility.read);
  const targetLang = useTTSStore((state) => state.targetLang);
  const translations = useTranslation(source, targetLang, { visible: showTranslation, shouldPrefetch: false });
  const usedTranslation = useRef(false);
  useEffect(() => {
    if (showTranslation) usedTranslation.current = true;
  }, [showTranslation]);
  const attempts = useLiveQuery(() => db.learningAttempts.where('lessonId').equals(lesson.id).toArray(), [lesson.id]);
  const history = (attempts ?? [])
    .filter((item) => item.activity === activity)
    .sort((a, b) => b.createdAt - a.createdAt);
  const [answer, setAnswer] = useState('');
  const [quote, setQuote] = useState('');
  const [notes, setNotes] = useState('');
  const [parent, setParent] = useState<string>();
  const [feedback, setFeedback] = useState<LearningAttempt['feedback']>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [blob, setBlob] = useState<Blob>();
  const [audioUrl, setAudioUrl] = useState('');
  const [recording, setRecording] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const draftKey = `workshop-draft:${db.name}:${lesson.id}:${activity}:${sourceWeakSpotId ?? ''}`;
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const recordingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const abort = useRef<AbortController | null>(null);
  const oral = activity === 'retelling' || activity === 'sentence-pronunciation';
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(draftKey);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft.source === source) {
          setAnswer(typeof draft.answer === 'string' ? draft.answer : '');
          setQuote(typeof draft.quote === 'string' ? draft.quote : '');
          setNotes(typeof draft.notes === 'string' ? draft.notes : '');
          setParent(typeof draft.parent === 'string' ? draft.parent : undefined);
        }
      }
    } catch {
      /* Storage may be unavailable; the visible response remains usable. */
    }
    setDraftReady(true);
  }, [draftKey, source]);
  useEffect(() => {
    if (!draftReady) return;
    try {
      sessionStorage.setItem(draftKey, JSON.stringify({ source, answer, quote, notes, parent }));
    } catch {
      /* Saving submitted work uses IndexedDB with explicit errors. */
    }
  }, [draftReady, draftKey, source, answer, quote, notes, parent]);
  useEffect(() => {
    mounted.current = true;
    const interruptRecording = () => {
      if (document.hidden && recorder.current?.state === 'recording') recorder.current.stop();
    };
    document.addEventListener('visibilitychange', interruptRecording);
    return () => {
      mounted.current = false;
      document.removeEventListener('visibilitychange', interruptRecording);
      if (recordingTimer.current) clearTimeout(recordingTimer.current);
      abort.current?.abort();
      if (recorder.current?.state === 'recording') recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);
  useEffect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  async function startRecording() {
    setMessage('');
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('unsupported');
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      const rec = new MediaRecorder(media);
      recorder.current = rec;
      const chunks: Blob[] = [];
      rec.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      rec.onstop = () => {
        if (recordingTimer.current) clearTimeout(recordingTimer.current);
        media.getTracks().forEach((track) => track.stop());
        if (mounted.current) {
          setRecording(false);
          setBlob(new Blob(chunks, { type: rec.mimeType }));
        }
      };
      rec.start();
      recordingTimer.current = setTimeout(() => {
        if (rec.state === 'recording') rec.stop();
      }, 120000);
      setRecording(true);
    } catch {
      stream.current?.getTracks().forEach((track) => track.stop());
      setMessage(
        t(
          'Microphone unavailable. Allow permission or attach an audio recording below.',
          'Không dùng được micro. Hãy cấp quyền hoặc đính kèm một bản ghi âm bên dưới.',
        ),
      );
    }
  }
  async function save() {
    const database = db;
    const isCurrent = () => mounted.current && db === database;
    const valid = validateLearningResponse(activity, source, answer, quote, blob?.size ? 'pending' : undefined);
    if (valid) {
      setMessage(
        valid === 'quote'
          ? t('Quote a passage exactly as it appears above.', 'Trích dẫn chính xác một đoạn có thật ở trên.')
          : valid === 'recording'
            ? t('Record or attach audio first.', 'Hãy ghi âm hoặc đính kèm âm thanh trước.')
            : t('Write your response first.', 'Hãy viết câu trả lời trước.'),
      );
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const attempt = createLearningAttempt({
        lessonId: lesson.id,
        unitId: lesson.unitId,
        activity,
        sourceText: source,
        sourceContentIds: lesson.exercises.map((item) => item.metadata?.lessonSourceId ?? item.id),
        sourceWeakSpotId,
        answer,
        evidenceQuote: quote,
        parentAttemptId: parent,
        notes,
        feedback,
      });
      attempt.usedTranslation = usedTranslation.current;
      await persistLearningAttempt(database, attempt, blob, isCurrent);
      if (isCurrent()) {
        setParent(attempt.id);
        setMessage(
          t(
            'Saved. Review your feedback, make one change, then submit a revision. Every version is retained.',
            'Đã lưu. Xem lại phản hồi, chỉnh sửa một điểm, rồi nộp bản sửa; mọi phiên bản đều được giữ lại.',
          ),
        );
      }
    } catch {
      if (isCurrent())
        setMessage(
          t(
            'Save failed. Your response is still here; retry.',
            'Lưu thất bại. Câu trả lời của bạn vẫn còn đây; hãy thử lại.',
          ),
        );
    } finally {
      if (isCurrent()) setBusy(false);
    }
  }
  async function review() {
    const database = db;
    const isCurrent = () => mounted.current && db === database;
    if (!answer.trim()) return;
    setBusy(true);
    setMessage('');
    const controller = new AbortController();
    abort.current = controller;
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      const config = useProviderStore.getState();
      const response = await fetch('/api/learning/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          source,
          answer,
          activity,
          quote,
          language: zh ? 'zh' : 'en',
          provider: config.activeProviderId,
          providerConfigs: config.providers,
        }),
      });
      if (!response.ok) throw new Error('feedback unavailable');
      const result = await response.json();
      if (isCurrent()) setFeedback({ source: 'ai', notes: result.feedback, checklist: [], provider: result.provider });
    } catch {
      if (isCurrent())
        setMessage(
          t(
            'AI feedback unavailable. Your work is preserved. Retry or use the self-review checklist.',
            'Phản hồi AI hiện chưa khả dụng. Nội dung của bạn vẫn được giữ nguyên. Hãy thử lại hoặc dùng danh sách tự đánh giá.',
          ),
        );
    } finally {
      clearTimeout(timeout);
      if (isCurrent()) setBusy(false);
    }
  }
  const updateAnswer = (value: string) => {
    setAnswer(value);
    setFeedback(undefined);
  };
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
      <h3 className="text-lg font-semibold text-slate-900">{activityPrompt(activity, zh)}</h3>
      {lesson.exercises
        .filter((item) => item.metadata?.importJobId && item.metadata?.sourceBlockId)
        .map((item) => (
          <Link
            key={item.id}
            href={`/library/import?job=${encodeURIComponent(item.metadata!.importJobId!)}&block=${encodeURIComponent(item.metadata!.sourceBlockId!)}`}
            className="inline-flex min-h-11 items-center text-sm text-indigo-700"
          >
            {t('Locate source passage', 'Định vị đoạn văn gốc')}
          </Link>
        ))}
      <details open={activity !== 'retelling'} className="my-4 rounded-xl bg-slate-50 p-4">
        <summary className="min-h-10 cursor-pointer text-sm font-medium text-indigo-700">
          {t('Source material · show / hide', 'Tài liệu gốc · hiện / ẩn')}
        </summary>
        <TranslationBar module="read" />
        <div className="max-h-64 overflow-y-auto text-base leading-7 text-slate-800">
          <ReadAloudContent
            text={source}
            showTranslation={showTranslation}
            sentenceTranslations={alignPracticeTranslations(source, translations.sentenceTranslations)}
          />
          {showTranslation && translations.isLoading && <p className="text-sm">{t('Translating…', 'Đang dịch…')}</p>}
          {showTranslation && translations.error && (
            <button type="button" className={button} onClick={translations.retry}>
              {t('Translation unavailable. Retry', 'Bản dịch chưa khả dụng. Thử lại')}
            </button>
          )}
        </div>
      </details>
      <label className="block text-sm font-medium text-slate-700">
        {oral
          ? t('Summary / sentence and stress notes', 'Tóm tắt kể lại / câu luyện tập và ghi chú trọng âm')
          : t('Your response', 'Câu trả lời của bạn')}
        <textarea
          value={answer}
          disabled={busy}
          onChange={(event) => updateAnswer(event.target.value)}
          className="mt-2 min-h-36 w-full rounded-xl bg-slate-50 p-3 text-base text-slate-900 focus-visible:ring-2 focus-visible:ring-indigo-500"
        />
      </label>
      {activity === 'comprehension' && (
        <label className="mt-3 block text-sm font-medium text-slate-700">
          {t('Exact supporting quote from the source', 'Trích dẫn nguyên văn hỗ trợ câu trả lời')}
          <textarea
            value={quote}
            disabled={busy}
            onChange={(event) => {
              setQuote(event.target.value);
              setFeedback(undefined);
            }}
            className="mt-2 min-h-20 w-full rounded-xl bg-slate-50 p-3 text-base"
          />
        </label>
      )}
      {oral && (
        <div className="my-4 space-y-3">
          <button
            type="button"
            className={`${button} bg-indigo-50 text-indigo-700`}
            onClick={() => (recording ? recorder.current?.stop() : void startRecording())}
          >
            {recording ? t('Stop recording', 'Dừng ghi âm') : t('Record / retry', 'Ghi âm / Ghi lại')}
          </button>
          <label className="block text-sm text-slate-700">
            {t('Or attach a recording (up to 25 MB)', 'Hoặc đính kèm bản ghi âm (tối đa 25 MB)')}
            <input
              type="file"
              accept="audio/*"
              disabled={recording}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                if (file.size > 25 * 1024 * 1024 || !file.type.startsWith('audio/')) {
                  setMessage(t('Choose an audio file up to 25 MB.', 'Hãy chọn tệp âm thanh không quá 25 MB.'));
                  return;
                }
                setBlob(file);
              }}
              className="mt-2 block max-w-full text-sm"
            />
          </label>
          {audioUrl && <audio controls src={audioUrl} className="max-w-full" />}
          <p className="text-xs text-slate-600">
            {t(
              'Up to 2 minutes; stops when backgrounded. Save before switching activities. Listen back and compare; no acoustic score is inferred from recording or text.',
              'Tối đa 2 phút; dừng khi chuyển sang nền. Hãy lưu trước khi đổi hoạt động. Nghe lại và đối chiếu; không có điểm âm học nào được suy ra từ bản ghi hay văn bản.',
            )}
          </p>
        </div>
      )}
      <fieldset className="my-4 space-y-2 rounded-xl bg-slate-50 p-4">
        <legend className="text-sm font-medium">
          {t('Self-review (not an automatic score)', 'Tự đánh giá (không phải điểm tự động)')}
        </legend>
        <p className="text-sm text-slate-600">
          {t(
            'Did I cover the main point? Is my evidence or new context clear? What is one change for my next attempt?',
            'Bạn đã nêu được ý chính chưa? Bằng chứng hoặc ngữ cảnh mới có rõ ràng không? Điều gì cần thay đổi cho lần thử tiếp theo?',
          )}
        </p>
        <label className="block text-sm">
          {t('My next improvement', 'Điểm cần cải thiện tiếp theo')}
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="mt-2 min-h-20 w-full rounded-lg bg-white p-3 text-base"
          />
        </label>
      </fieldset>
      {feedback && (
        <div className="my-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">
          <h4 className="font-semibold text-indigo-700">
            {t('AI suggestions — verify against your intent', 'Gợi ý từ AI — hãy đối chiếu với ý định của bạn')}
          </h4>
          {feedback.notes}
        </div>
      )}
      <p className="mb-2 text-xs text-slate-500">
        {t(
          'AI review sends this source and response to your configured provider. Audio stays local. Optional; may use provider credits.',
          'Phản hồi AI sẽ gửi tài liệu gốc và câu trả lời này đến nhà cung cấp bạn đã cấu hình. Âm thanh vẫn ở lại máy. Đây là tính năng tùy chọn và có thể tiêu tốn hạn mức nhà cung cấp.',
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`${button} bg-slate-100 text-slate-700`}
          disabled={busy || !answer.trim() || recording}
          onClick={() => void review()}
        >
          {t('Get AI feedback', 'Nhận phản hồi từ AI')}
        </button>
        <button
          type="button"
          className={`${button} bg-indigo-600 text-white`}
          disabled={busy || recording}
          onClick={() => void save()}
        >
          {busy
            ? t('Working…', 'Đang xử lý…')
            : parent
              ? t('Save revision', 'Lưu bản sửa')
              : t('Save response', 'Lưu câu trả lời')}
        </button>
      </div>
      {message && (
        <p role="status" className="mt-3 text-sm text-indigo-700">
          {message}
        </p>
      )}
      <details className="mt-6">
        <summary className="min-h-11 cursor-pointer text-sm font-medium text-slate-700">
          {t('Submission history', 'Lịch sử nộp bài')} ({history.length})
        </summary>
        <ol className="space-y-4">
          {history.map((item) => (
            <li key={item.id} className="border-t border-slate-100 py-3 text-sm">
              <p className="text-xs text-slate-500">
                {new Date(item.createdAt).toLocaleString()} ·{' '}
                {item.feedback.source === 'ai' ? 'AI' : t('Self-review', 'Tự đánh giá')}
              </p>
              {item.usedTranslation && (
                <p className="text-xs text-slate-500">
                  {t('Translation assistance used', 'Đã dùng hỗ trợ dịch thuật')}
                </p>
              )}
              <p className="my-2 whitespace-pre-wrap text-slate-800">{item.answer}</p>
              <p className="whitespace-pre-wrap text-slate-600">{item.feedback.notes}</p>
              {item.recordingId && <SavedRecording id={item.recordingId} zh={zh} />}
              <button
                type="button"
                className={`${button} text-indigo-700`}
                disabled={busy || recording}
                onClick={() => {
                  setAnswer(item.answer);
                  setQuote(item.evidenceQuote ?? '');
                  setParent(item.id);
                  setNotes('');
                  setFeedback(undefined);
                  setBlob(undefined);
                  setAudioUrl('');
                }}
              >
                {t('Revise this version', 'Sửa lại phiên bản này')}
              </button>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}

function SavedRecording({ id, zh }: { id: string; zh: boolean }) {
  const record = useLiveQuery(() => db.mediaBlobs.get(id), [id]);
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!record) return;
    const next = URL.createObjectURL(record.blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [record]);
  return url ? (
    <audio controls src={url} className="my-2 max-w-full" />
  ) : (
    <p className="text-xs text-slate-500">
      {zh
        ? 'Bản ghi âm đang ở thiết bị khác hoặc chưa được khôi phục.'
        : 'Recording is on another device or not restored yet.'}
    </p>
  );
}

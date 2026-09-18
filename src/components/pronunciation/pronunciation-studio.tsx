'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRight, Headphones, Mic, Square, Volume2 } from 'lucide-react';
import { nanoid } from 'nanoid';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePronunciationStudio } from '@/hooks/use-pronunciation-studio';
import { db, LOCAL_DATABASE_CHANGED_EVENT } from '@/lib/db';
import { PRONUNCIATION_SOUNDS } from '@/lib/pronunciation-practice';
import {
  getPronunciationProgression,
  getSoundPairIndex,
  type SoundEvidenceStatus,
} from '@/lib/pronunciation-progression';
import { legacyPracticedIds, MINIMAL_PAIRS, recognitionMatches, STUDIO_SOUNDS } from '@/lib/pronunciation-training';
import { resolveWeakSpot, upsertWeakSpot } from '@/lib/weak-spots';
import { useLanguageStore } from '@/stores/language-store';
import { usePronunciationStore } from '@/stores/pronunciation-store';

const button =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:border-indigo-300 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50';

export function PronunciationStudio() {
  const [scope, setScope] = useState(0);
  useEffect(() => {
    const change = () => setScope((value) => value + 1);
    window.addEventListener(LOCAL_DATABASE_CHANGED_EVENT, change);
    return () => window.removeEventListener(LOCAL_DATABASE_CHANGED_EVENT, change);
  }, []);
  return <StudioWorkspace key={scope} />;
}

function StudioWorkspace() {
  const [database] = useState(() => db);
  const zh = useLanguageStore((s) => s.interfaceLanguage === 'zh');
  const t = (en: string, cn: string) => (zh ? cn : en);
  const [soundId, setSoundId] = useState('ih');
  const [wordIndex, setWordIndex] = useState(0);
  const [pairIndex, setPairIndex] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const [choice, setChoice] = useState<number | null>(null);
  const [audioReady, setAudioReady] = useState(false);
  const [notice, setNotice] = useState('');
  const [persistError, setPersistError] = useState(false);
  const sound = STUDIO_SOUNDS.find((s) => s.id === soundId) ?? STUDIO_SOUNDS[0];
  const word = sound.examples[wordIndex] ?? sound.examples[0];
  const studio = usePronunciationStudio(word);
  const pair = MINIMAL_PAIRS[pairIndex];
  const settings = usePronunciationStore();
  const progress = useLiveQuery(() => database.pronunciationProgress.toArray(), [database]) ?? [];
  const progression = getPronunciationProgression(progress, soundId);
  const evidence = progression.bySound[sound.id];
  const statusLabel = (status: SoundEvidenceStatus) =>
    ({
      new: t('Not started', 'Chưa bắt đầu'),
      legacy: t('Legacy history', 'Lịch sử cũ'),
      listening: t('Listening only', 'Chỉ nghe'),
      recognition: t('Recognition only', 'Chỉ nhận dạng'),
      recorded: t('Recorded', 'Đã ghi âm'),
      assessed: t('Assessed', 'Đã đánh giá'),
    })[status];
  const savedAudio = useRef<string | null>(null);
  const savedAssessment = useRef<unknown>(null);
  const playback = useRef(0);

  useEffect(() => {
    usePronunciationStore.getState().hydrate();
    const id = new URLSearchParams(window.location.search).get('sound');
    if (id && STUDIO_SOUNDS.some((s) => s.id === id)) {
      setSoundId(id);
      const index = getSoundPairIndex(id);
      if (index >= 0) setPairIndex(index);
    }
    try {
      const ids =
        database.name === 'echotype:anonymous'
          ? legacyPracticedIds(localStorage.getItem('echotype:pronunciation-practice:v1'))
          : [];
      void database
        .transaction('rw', database.pronunciationProgress, async () => {
          for (const soundId of ids) {
            const id = `legacy:${soundId}`;
            if (!(await database.pronunciationProgress.get(id)))
              await database.pronunciationProgress.add({ id, soundId, kind: 'legacy', updatedAt: Date.now() });
          }
        })
        .catch(() => setPersistError(true));
    } catch {
      setPersistError(true);
    }
    return () => {
      playback.current++;
      window.speechSynthesis?.cancel();
    };
  }, [database]);

  useEffect(() => {
    if (!studio.audioUrl || savedAudio.current === studio.audioUrl) return;
    savedAudio.current = studio.audioUrl;
    void database.pronunciationProgress
      .add({ id: nanoid(), soundId, kind: 'recording', updatedAt: Date.now() })
      .catch(() => setPersistError(true));
  }, [studio.audioUrl, soundId, database]);

  useEffect(() => {
    if (!studio.assessment || savedAssessment.current === studio.assessment) return;
    savedAssessment.current = studio.assessment;
    const assessment = studio.assessment;
    void (async () => {
      await database.pronunciationProgress.add({
        id: nanoid(),
        soundId,
        kind: 'speechsuper',
        assessment,
        updatedAt: Date.now(),
      });
      for (const phoneme of assessment.phonemes.filter((p) => p.score < 60)) {
        if (db !== database) return;
        await upsertWeakSpot({
          module: 'speak',
          weakSpotType: 'pronunciation-phrase',
          sourceId: soundId,
          sourceType: 'session',
          text: `${word} /${phoneme.phoneme}/`,
          reason: `SpeechSuper phoneme score: ${phoneme.score}`,
          targetHref: `/pronunciation?sound=${encodeURIComponent(soundId)}`,
          accuracy: phoneme.score,
        });
      }
    })().catch(() => setPersistError(true));
  }, [studio.assessment, soundId, word, database]);

  function speak(text: string, ready?: () => void) {
    if (!window.speechSynthesis) {
      setNotice(t('Speech playback is unsupported in this browser.', 'Trình duyệt này không hỗ trợ phát giọng nói.'));
      return;
    }
    const token = ++playback.current;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-GB';
    utterance.rate = 0.85;
    const british = window.speechSynthesis.getVoices().find((v) => v.lang === 'en-GB');
    if (british) utterance.voice = british;
    utterance.onend = () => {
      if (token === playback.current) ready?.();
    };
    utterance.onerror = () => {
      if (token === playback.current)
        setNotice(
          t(
            'Audio could not play. Try again or choose another browser.',
            'Không thể phát âm thanh. Hãy thử lại hoặc đổi trình duyệt khác.',
          ),
        );
    };
    setNotice('');
    window.speechSynthesis.speak(utterance);
  }

  function chooseSound(id: string) {
    playback.current++;
    window.speechSynthesis?.cancel();
    setSoundId(id);
    setWordIndex(0);
    const index = getSoundPairIndex(id);
    setPairIndex(index >= 0 ? index : 0);
    setAnswer(null);
    setChoice(null);
    setAudioReady(false);
    window.history.replaceState(null, '', `/pronunciation?sound=${encodeURIComponent(id)}`);
  }

  function playQuiz() {
    if (choice !== null) return;
    const next = answer ?? (Math.random() < 0.5 ? 0 : 1);
    setAnswer(next);
    setAudioReady(false);
    speak(pair.words[next], () => setAudioReady(true));
  }

  async function submitChoice(selected: number) {
    if (choice !== null || answer === null || !audioReady) return;
    setChoice(selected);
    const correct = selected === answer;
    try {
      await database.pronunciationProgress.add({
        id: nanoid(),
        soundId: pair.soundId,
        kind: 'listening',
        correct,
        updatedAt: Date.now(),
      });
      if (db !== database) return;
      if (!correct)
        await upsertWeakSpot({
          module: 'listen',
          weakSpotType: 'listening-segment',
          sourceId: pair.soundId,
          sourceType: 'session',
          text: pair.words.join(' / '),
          reason: 'Minimal-pair listening needs practice',
          targetHref: `/pronunciation?sound=${pair.soundId}`,
        });
      else
        await resolveWeakSpot({
          module: 'listen',
          weakSpotType: 'listening-segment',
          text: pair.words.join(' / '),
        });
    } catch {
      setPersistError(true);
    }
  }

  const practiced = progression.practicedCount;
  const busy = studio.recording || studio.starting || studio.assessing;
  return (
    <main className="mx-auto w-full max-w-6xl space-y-7 px-4 py-7 text-slate-800 sm:px-8">
      <header className="space-y-3">
        <p className="font-mono text-xs font-semibold uppercase tracking-widest text-indigo-600">
          {t('Pronunciation studio', 'Phòng luyện phát âm')}
        </p>
        <h1 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
          {t('Hear the difference. Find your voice.', 'Nghe rõ sự khác biệt. Tìm ra giọng nói của bạn.')}
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-slate-600">
          {t(
            'Listen, compare, record, and replay. Recognition checks words; only acoustic assessment can report pronunciation metrics.',
            'Nghe, so sánh, ghi âm và nghe lại. Nhận dạng chỉ kiểm tra từ ngữ; chỉ đánh giá âm học mới có thể báo cáo chỉ số phát âm.',
          )}
        </p>
        <p className="text-xs text-slate-500">
          {t(
            `${practiced} / 48 sounds practiced on this device · Recording or professional evidence; practice is not mastery.`,
            `Đã luyện ${practiced} / 48 âm trên thiết bị này · Dựa trên bản ghi âm hoặc đánh giá chuyên nghiệp; luyện tập không đồng nghĩa với thành thạo.`,
          )}
        </p>
        <button type="button" className={button} disabled={busy} onClick={() => chooseSound(progression.nextSound.id)}>
          {t(`Next sound: /${progression.nextSound.ipa}/`, `Âm tiếp theo: /${progression.nextSound.ipa}/`)}
          <ArrowRight size={16} />
        </button>
        <p className="text-xs text-slate-500">
          {t(
            'Next unpracticed sound in chart order; then revisit the oldest practice.',
            'Đề xuất âm chưa luyện theo thứ tự bảng âm; sau khi luyện hết, quay lại ôn âm đã luyện lâu nhất.',
          )}
        </p>
      </header>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7" aria-labelledby="listen-heading">
        <div className="flex items-center gap-2 text-indigo-600">
          <Headphones size={20} />
          <h2 id="listen-heading" className="text-lg font-semibold">
            {t('1. Hear the difference', '1. Nghe sự khác biệt')}
          </h2>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          {getSoundPairIndex(soundId) === pairIndex
            ? t('Play the word, then choose what you heard.', 'Phát từ, sau đó chọn từ bạn nghe được.')
            : t(
                `General listening practice · No minimal pair for /${sound.ipa}/ yet. Recording below stays on /${sound.ipa}/.`,
                `Luyện nghe tổng quát · Chưa có cặp từ tối thiểu cho /${sound.ipa}/. Phần ghi âm bên dưới vẫn dùng /${sound.ipa}/.`,
              )}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {MINIMAL_PAIRS.map((p, i) => (
            <button
              type="button"
              key={p.soundId}
              disabled={busy}
              aria-pressed={pairIndex === i}
              className={`${button} ${pairIndex === i ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : ''}`}
              onClick={() => chooseSound(p.soundId)}
            >
              {p.words.join(' / ')}
            </button>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            className={`${button} border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700`}
            disabled={busy || choice !== null}
            onClick={playQuiz}
          >
            <Volume2 size={18} />
            {t('Play question', 'Phát câu hỏi')}
          </button>
          {pair.words.map((value, i) => (
            <button
              type="button"
              key={value}
              className={button}
              disabled={!audioReady || choice !== null || busy}
              onClick={() => void submitChoice(i)}
            >
              {value}
            </button>
          ))}
        </div>
        {choice !== null && (
          <div className="mt-4 space-y-3" role="status">
            <p className="text-sm">
              {choice === answer
                ? t('Correct listening choice.', 'Chọn đúng.')
                : t(
                    `You heard “${pair.words[answer!]}”. Compare both words and try again.`,
                    `Từ vừa phát là "${pair.words[answer!]}". Hãy so sánh hai từ rồi thử lại.`,
                  )}
            </p>
            <div className="flex flex-wrap gap-2">
              {pair.words.map((value) => (
                <button type="button" className={button} key={value} disabled={busy} onClick={() => speak(value)}>
                  <Volume2 size={16} />
                  {value}
                </button>
              ))}
              <button
                type="button"
                className={button}
                onClick={() => {
                  setChoice(null);
                  setAnswer(null);
                  setAudioReady(false);
                }}
              >
                {t('Next question', 'Câu tiếp theo')}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.15fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6" aria-labelledby="chart-heading">
          <h2 id="chart-heading" className="text-lg font-semibold">
            {t('48-entry teaching chart', 'Bảng âm giảng dạy 48 mục')}
          </h2>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            {t(
              '20 vowels + 24 consonants + 4 consonant clusters. This is a common teaching convention, not 48 distinct phonemes. British reference; accents and device voices vary.',
              '20 nguyên âm + 24 phụ âm + 4 cụm phụ âm. Đây là quy ước giảng dạy phổ biến, không phải 48 âm vị riêng biệt. Tham chiếu theo giọng Anh-Anh; giọng vùng và giọng thiết bị có thể khác nhau.',
            )}
          </p>
          {(['vowel', 'consonant', 'cluster'] as const).map((group) => (
            <div key={group} className="mt-5">
              <h3 className="mb-2 text-xs font-semibold text-slate-500">
                {group === 'vowel'
                  ? t('Vowels', 'Nguyên âm')
                  : group === 'consonant'
                    ? t('Consonants', 'Phụ âm')
                    : t('Consonant clusters', 'Cụm phụ âm')}
              </h3>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                {STUDIO_SOUNDS.filter((s) => s.group === group).map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    aria-label={`/${s.ipa}/ ${s.examples[0]}`}
                    aria-pressed={sound.id === s.id}
                    disabled={busy}
                    onClick={() => chooseSound(s.id)}
                    className={`min-h-14 rounded-xl border px-1 py-2 text-lg focus-visible:outline-2 focus-visible:outline-indigo-500 ${sound.id === s.id ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 hover:bg-indigo-50'} disabled:opacity-60`}
                  >
                    /{s.ipa}/
                    <span className="mt-1 block text-[10px] leading-3">
                      {statusLabel(progression.bySound[s.id].status)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section
          className="space-y-5 rounded-3xl border border-indigo-100 bg-indigo-50/50 p-5 sm:p-7"
          aria-labelledby="record-heading"
        >
          <h2 id="record-heading" className="text-lg font-semibold">
            {t('2. Shape the sound', '2. Luyện phát âm')}
          </h2>
          <div className="text-5xl font-medium text-indigo-700">/{sound.ipa}/</div>
          <div
            data-testid="sound-evidence"
            className="space-y-2 rounded-xl bg-white p-4 text-xs text-slate-600"
            aria-live="polite"
          >
            <p className="font-medium text-indigo-700">
              {statusLabel(evidence.status)} · {t('Recent evidence', 'Ghi nhận gần đây')}
            </p>
            {!evidence.recent.length && (
              <p>
                {t(
                  'No evidence yet. Listen, then record this sound.',
                  'Chưa có ghi nhận nào. Hãy nghe mẫu rồi ghi âm âm này.',
                )}
              </p>
            )}
            {evidence.recent.map((entry) => (
              <div key={entry.id}>
                <p>
                  <time dateTime={new Date(entry.updatedAt).toISOString()}>
                    {new Date(entry.updatedAt).toLocaleString(zh ? 'zh-CN' : 'en-GB')}
                  </time>{' '}
                  ·{' '}
                  {entry.kind === 'recording'
                    ? t('Recording saved (audio is temporary)', 'Đã lưu bản ghi âm (âm thanh chỉ tạm thời)')
                    : entry.kind === 'speechsuper'
                      ? 'SpeechSuper'
                      : entry.kind === 'listening'
                        ? entry.correct
                          ? t('Correct listening choice', 'Chọn đúng khi nghe')
                          : t('Listening needs practice', 'Cần luyện thêm phần nghe')
                        : entry.kind === 'legacy'
                          ? t('Unverified legacy history', 'Lịch sử cũ chưa xác minh')
                          : t('Word recognition only', 'Chỉ nhận dạng từ')}
                </p>
                {entry.kind === 'speechsuper' && entry.assessment && (
                  <p className="mt-1">
                    {[
                      entry.assessment.overall !== undefined
                        ? `${t('Overall', 'Tổng thể')} ${entry.assessment.overall}/100`
                        : null,
                      entry.assessment.fluency !== undefined
                        ? `${t('Fluency', 'Độ trôi chảy')} ${entry.assessment.fluency}/100`
                        : null,
                      entry.assessment.completeness !== undefined
                        ? `${t('Completeness', 'Độ hoàn chỉnh')} ${entry.assessment.completeness}/100`
                        : null,
                      ...entry.assessment.phonemes.map((p) => `/${p.phoneme}/ ${p.score}/100`),
                    ]
                      .filter(Boolean)
                      .join(' · ') || t('No acoustic metrics saved.', 'Chưa lưu chỉ số âm học nào.')}
                  </p>
                )}
              </div>
            ))}
          </div>
          <p className="text-sm leading-6">{zh ? sound.tipZh : sound.tip}</p>
          <div className="flex flex-wrap gap-2">
            {sound.examples.map((example, i) => (
              <button
                type="button"
                key={example}
                className={`${button} ${word === example ? 'border-indigo-400 text-indigo-700' : ''}`}
                disabled={busy}
                aria-pressed={word === example}
                onClick={() => {
                  setWordIndex(i);
                  speak(example);
                }}
              >
                <Volume2 size={16} />
                {example}
              </button>
            ))}
          </div>
          <p className="text-xs leading-5 text-slate-500">
            {t(
              'Examples use your device’s synthesized voice, not a recording of an isolated phoneme.',
              'Các ví dụ dùng giọng tổng hợp của thiết bị, không phải bản ghi âm thật của một âm vị riêng lẻ.',
            )}
          </p>
          <div className="border-t border-indigo-100 pt-5">
            <h3 className="font-semibold">{t(`3. Record “${word}”`, `3. Ghi âm "${word}"`)}</h3>
            <p className="mt-2 text-xs text-slate-500">
              {t(
                'Up to 20 seconds. Recording stays in memory for replay.',
                'Tối đa 20 giây. Bản ghi âm chỉ lưu tạm trong bộ nhớ để nghe lại.',
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`${button} border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700`}
              disabled={studio.starting || studio.assessing}
              onClick={() => {
                window.speechSynthesis?.cancel();
                if (studio.recording) studio.stop();
                else void studio.start();
              }}
            >
              {studio.recording ? <Square size={18} /> : <Mic size={18} />}
              {studio.recording
                ? t('Stop recording', 'Dừng ghi âm')
                : studio.starting
                  ? t('Opening microphone…', 'Đang mở micro…')
                  : t('Record word', 'Ghi âm từ')}
            </button>
          </div>
          {studio.audioUrl && (
            <audio
              className="w-full"
              controls
              src={studio.audioUrl}
              aria-label={t('Replay your recording', 'Nghe lại bản ghi âm của bạn')}
            />
          )}
          <div className="rounded-xl bg-white p-4 text-sm" aria-live="polite">
            <p className="font-medium">{t('Browser word recognition', 'Nhận dạng từ của trình duyệt')}</p>
            <p className="mt-2 text-slate-600">
              {studio.transcript
                ? `"${studio.transcript}" — ${recognitionMatches(word, studio.transcript) ? t('Target word recognized', 'Đã nhận dạng đúng từ mục tiêu') : t('Target word not recognized', 'Chưa nhận dạng được từ mục tiêu')}`
                : t('No recognized words yet.', 'Chưa nhận dạng được từ nào.')}
            </p>
            {studio.recognitionStatus && <p className="mt-2 text-xs">{studio.recognitionStatus}</p>}
            <p className="mt-2 text-xs text-slate-500">
              {t(
                'Recognition is not a pronunciation score and cannot verify a phoneme.',
                'Nhận dạng không phải điểm phát âm và không thể xác minh một âm vị.',
              )}
            </p>
          </div>
          <div className="space-y-3 border-t border-indigo-100 pt-5">
            <h3 className="font-semibold">{t('Professional acoustic assessment', 'Đánh giá âm học chuyên nghiệp')}</h3>
            <p className="text-xs leading-5 text-slate-600">
              {t(
                'SpeechSuper assesses the recorded audio. Running this sends the recording to SpeechSuper using your configured account and may use paid quota.',
                'SpeechSuper đánh giá âm thanh đã ghi. Chạy tính năng này sẽ gửi bản ghi âm đến SpeechSuper bằng tài khoản bạn đã cấu hình và có thể tiêu tốn hạn mức trả phí.',
              )}
            </p>
            {settings.speechSuperAppKey && settings.speechSuperSecretKey ? (
              <button
                type="button"
                className={button}
                disabled={!studio.audioUrl || busy}
                onClick={() => void studio.assess()}
              >
                {studio.assessing
                  ? t('Assessing…', 'Đang đánh giá…')
                  : t('Assess with SpeechSuper', 'Đánh giá bằng SpeechSuper')}
              </button>
            ) : (
              <Link className={button} href="/settings">
                {t('Configure SpeechSuper', 'Cấu hình SpeechSuper')}
                <ArrowRight size={16} />
              </Link>
            )}
            {studio.assessment && (
              <div className="rounded-xl bg-white p-4" aria-live="polite">
                <p className="text-xs font-medium text-indigo-700">
                  SpeechSuper · {t('Acoustic results', 'Kết quả âm học')}
                </p>
                <dl className="mt-3 grid grid-cols-3 gap-2">
                  {(
                    [
                      [t('Overall', 'Tổng thể'), studio.assessment.overall],
                      [t('Fluency', 'Độ trôi chảy'), studio.assessment.fluency],
                      [t('Completeness', 'Độ hoàn chỉnh'), studio.assessment.completeness],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs text-slate-500">{label}</dt>
                      <dd className="mt-1 font-semibold">{value === undefined ? '—' : `${value}/100`}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 text-xs text-slate-500">
                  {t('Provider-reported phonemes', 'Âm vị do nhà cung cấp báo cáo')}
                </p>
                {studio.assessment.phonemes.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {studio.assessment.phonemes.map((p, i) => (
                      <span className="rounded-lg border border-slate-200 px-2 py-1 text-sm" key={`${p.phoneme}-${i}`}>
                        /{p.phoneme}/ {p.score}/100
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm">
                    {t('No phoneme metrics returned.', 'Không có chỉ số âm vị nào được trả về.')}
                  </p>
                )}
              </div>
            )}
          </div>
          {studio.error && (
            <p role="alert" className="text-sm text-red-700">
              {studio.error}
            </p>
          )}
        </section>
      </div>

      {notice && (
        <p role="alert" className="text-sm text-amber-800">
          {notice}
        </p>
      )}
      {persistError && (
        <p role="alert" className="text-sm text-amber-800">
          {t(
            'Practice could not be saved on this device. You can continue practicing.',
            'Không thể lưu tiến trình luyện tập trên thiết bị này. Bạn vẫn có thể tiếp tục luyện tập.',
          )}
        </p>
      )}
      <details className="rounded-3xl border border-slate-200 bg-white p-5">
        <summary className="min-h-11 cursor-pointer text-sm font-medium">
          {t(
            `Original phonics reference (${PRONUNCIATION_SOUNDS.length} entries)`,
            `Bảng ngữ âm tham chiếu gốc (${PRONUNCIATION_SOUNDS.length} mục)`,
          )}
        </summary>
        <p className="mb-4 text-xs leading-5 text-slate-500">
          {t(
            'Preserved separately: 39 sound references and 22 spelling patterns. Repeated vowel spellings are not additional phonemes. Earlier completion records remain unverified practice.',
            'Được giữ riêng: 39 âm tham chiếu và 22 mẫu chính tả. Các cách viết nguyên âm lặp lại không phải là âm vị bổ sung. Các bản ghi hoàn thành trước đây vẫn là luyện tập chưa được xác minh.',
          )}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PRONUNCIATION_SOUNDS.map((s) => (
            <div className="rounded-xl bg-slate-50 p-3 text-sm" key={s.id}>
              <p className="font-medium">
                /{s.ipa}/ {s.pattern ? `· ${s.pattern}` : ''}
              </p>
              <p className="mt-1 text-slate-600">{s.examples.join(', ')}</p>
            </div>
          ))}
        </div>
      </details>
      <p className="pb-4 text-xs leading-5 text-slate-500">
        {t(
          'Practice history is stored on this device and does not currently sync across devices. Listening errors and provider-reported low phoneme scores are added to Weak Spots; browser recognition mismatches are not.',
          'Lịch sử luyện tập được lưu trên thiết bị này và hiện chưa đồng bộ giữa các thiết bị. Lỗi khi nghe và các âm vị điểm thấp do nhà cung cấp báo cáo sẽ được thêm vào Điểm yếu; các trường hợp trình duyệt nhận dạng sai thì không.',
        )}
      </p>
    </main>
  );
}

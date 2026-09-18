import { PRONUNCIATION_SOUNDS } from './pronunciation-practice';

export interface StudioSound {
  id: string;
  ipa: string;
  group: 'vowel' | 'consonant' | 'cluster';
  examples: string[];
  tip: string;
  tipZh: string;
}

const vowels = [
  [
    'iy',
    'iː',
    'sheep,see,team',
    'Raise the front of your tongue; spread your lips gently.',
    'Nâng phần trước lưỡi lên cao; hơi dang môi ra.',
  ],
  [
    'ih',
    'ɪ',
    'ship,sit,busy',
    'Relax your tongue slightly lower than /iː/.',
    'Thả lỏng lưỡi, vị trí thấp hơn /iː/ một chút.',
  ],
  ['eh', 'e', 'bed,red,head', 'Keep the tongue forward and the jaw partly open.', 'Giữ lưỡi phía trước, hàm hơi mở.'],
  [
    'ae',
    'æ',
    'cat,bag,map',
    'Lower the jaw with your tongue forward.',
    'Hạ hàm xuống, lưỡi ở phía trước, hàm mở rộng hơn /e/.',
  ],
  [
    'aa',
    'ɑː',
    'father,calm,palm',
    'Open your jaw and keep the tongue low and back.',
    'Mở hàm, giữ lưỡi thấp và lùi về sau.',
  ],
  [
    'lot',
    'ɒ',
    'hot,not,lot',
    'Round the lips with a low back tongue (British English).',
    'Lưỡi thấp và lùi sau, môi hơi tròn (giọng Anh-Anh).',
  ],
  [
    'thought',
    'ɔː',
    'thought,saw,law',
    'Round the lips and raise the back of the tongue slightly.',
    'Tròn môi, nâng nhẹ phần sau lưỡi.',
  ],
  [
    'uu',
    'ʊ',
    'foot,book,good',
    'Round your lips loosely; keep the tongue relaxed.',
    'Tròn môi nhẹ, giữ lưỡi thả lỏng.',
  ],
  ['uw', 'uː', 'food,blue,too', 'Raise the back of the tongue and round the lips.', 'Nâng phần sau lưỡi và tròn môi.'],
  [
    'uh',
    'ʌ',
    'cup,but,sun',
    'Use a relaxed central tongue with the jaw partly open.',
    'Lưỡi ở vị trí trung tâm, thả lỏng, hàm hơi mở.',
  ],
  [
    'er',
    'ɜː',
    'bird,her,word',
    'Hold a central vowel; this British model has no final R curl.',
    'Giữ nguyên âm trung tâm; mẫu giọng Anh-Anh này không cong lưỡi ở âm R cuối.',
  ],
  [
    'schwa',
    'ə',
    'about,sofa,again',
    'Relax the mouth for a weak unstressed vowel.',
    'Thả lỏng miệng cho nguyên âm yếu, không trọng âm.',
  ],
  ['ei', 'eɪ', 'say,rain,cake', 'Glide from /e/ toward /ɪ/.', 'Trượt từ /e/ sang /ɪ/.'],
  ['ai', 'aɪ', 'time,my,light', 'Start open and glide toward /ɪ/.', 'Bắt đầu mở miệng rồi trượt sang /ɪ/.'],
  ['oi', 'ɔɪ', 'boy,voice,choice', 'Start rounded and glide toward /ɪ/.', 'Bắt đầu tròn môi rồi trượt sang /ɪ/.'],
  [
    'ou',
    'əʊ',
    'boat,home,snow',
    'Start central and glide toward rounded lips.',
    'Bắt đầu từ vị trí trung tâm rồi trượt sang môi tròn.',
  ],
  [
    'au',
    'aʊ',
    'cow,now,out',
    'Start open and finish with rounded lips.',
    'Bắt đầu mở miệng và kết thúc bằng môi tròn.',
  ],
  [
    'near',
    'ɪə',
    'near,ear,here',
    'Glide from /ɪ/ toward schwa; British reference.',
    'Trượt từ /ɪ/ sang schwa /ə/; theo giọng Anh-Anh.',
  ],
  [
    'square',
    'eə',
    'care,hair,pair',
    'Glide toward schwa; many British speakers use a long vowel.',
    'Trượt sang schwa /ə/; nhiều người nói giọng Anh-Anh phát âm thành nguyên âm dài.',
  ],
  [
    'cure',
    'ʊə',
    'cure,pure,tour',
    'Glide toward schwa; this sound varies across accents.',
    'Trượt sang schwa /ə/; âm này thay đổi tùy theo giọng vùng.',
  ],
] as const;

const consonantZh: Record<string, string> = {
  b: 'Khép hai môi lại, rung dây thanh rồi bật hơi ra.',
  p: 'Khép hai môi lại, không rung dây thanh, bật hơi ra.',
  ch: 'Chặn luồng hơi trước, rồi bật ra theo kiểu /ʃ/.',
  d: 'Đầu lưỡi chạm phía sau răng trên, rung dây thanh rồi bật ra.',
  t: 'Đầu lưỡi chạm phía sau răng trên, không rung dây thanh, bật ra.',
  f: 'Răng trên chạm nhẹ vào môi dưới, không rung dây thanh.',
  v: 'Răng trên chạm nhẹ vào môi dưới, rung dây thanh.',
  g: 'Phần sau lưỡi chạm ngạc mềm, rung dây thanh rồi bật ra.',
  k: 'Phần sau lưỡi chạm ngạc mềm, không rung dây thanh, bật ra.',
  h: 'Thả lỏng cổ họng, để luồng hơi đi qua.',
  j: 'Dùng khẩu hình như /tʃ/, đồng thời rung dây thanh.',
  m: 'Khép hai môi lại, luồng hơi đi qua mũi.',
  n: 'Đầu lưỡi chạm phía sau răng trên, luồng hơi đi qua mũi.',
  ng: 'Phần sau lưỡi nâng lên, luồng hơi đi qua mũi.',
  l: 'Đầu lưỡi chạm phía sau răng trên, luồng hơi đi qua hai bên lưỡi.',
  r: 'Lưỡi cong về phía sau, không chạm ngạc trên; không rung lưỡi.',
  s: 'Đầu lưỡi gần phía sau răng trên, tạo luồng hơi hẹp, không rung dây thanh.',
  z: 'Giữ khẩu hình như /s/, rung dây thanh.',
  sh: 'Hơi tròn môi, phần trước lưỡi gần ngạc trên, để luồng hơi đi qua.',
  zh: 'Giữ khẩu hình như /ʃ/, rung dây thanh.',
  'th-voiceless': 'Đặt nhẹ đầu lưỡi giữa hai hàm răng, bật hơi ra, không rung dây thanh.',
  'th-voiced': 'Đặt nhẹ đầu lưỡi giữa hai hàm răng, rung dây thanh.',
  w: 'Tròn môi lại, nhanh chóng trượt sang nguyên âm phía sau.',
  y: 'Lưỡi nâng cao và ra phía trước, trượt sang nguyên âm phía sau.',
};

/** A teaching chart: 44 conventional British phonemes plus four consonant clusters. */
export const STUDIO_SOUNDS: StudioSound[] = [
  ...vowels.map(([id, ipa, examples, tip, tipZh]) => ({
    id,
    ipa,
    examples: examples.split(','),
    tip,
    tipZh,
    group: 'vowel' as const,
  })),
  ...PRONUNCIATION_SOUNDS.filter((s) => s.group === 'consonants').map((s) => ({
    id: s.id,
    ipa: s.id === 'r' ? 'ɹ' : s.ipa,
    examples: s.examples,
    tip: s.tip,
    tipZh: consonantZh[s.id],
    group: 'consonant' as const,
  })),
  ...(['tr', 'dr', 'ts', 'dz'] as const).map((id, i) => ({
    id,
    ipa: id === 'tr' ? 'tɹ' : id === 'dr' ? 'dɹ' : id,
    examples: [
      ['tree', 'train'],
      ['dream', 'dress'],
      ['cats', 'hats'],
      ['beds', 'words'],
    ][i],
    tip: 'Join the two consonants without adding a vowel between them.',
    tipZh: 'Phát liên tiếp hai phụ âm mà không thêm nguyên âm giữa chúng.',
    group: 'cluster' as const,
  })),
];

export const MINIMAL_PAIRS = [
  { soundId: 'ih', words: ['ship', 'sheep'] },
  { soundId: 'th-voiceless', words: ['thin', 'sin'] },
  { soundId: 'v', words: ['vest', 'west'] },
  { soundId: 'l', words: ['light', 'right'] },
  { soundId: 'ae', words: ['bad', 'bed'] },
  { soundId: 'uu', words: ['full', 'fool'] },
] as const;

export function recognitionMatches(target: string, transcript: string): boolean {
  const normalize = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z\s']/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  return normalize(target).length > 0 && normalize(target) === normalize(transcript);
}

export function actualMetric(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? value : undefined;
}

export interface AcousticAssessment {
  overall?: number;
  fluency?: number;
  completeness?: number;
  phonemes: { phoneme: string; score: number }[];
}

export function parseAcousticAssessment(data: unknown): AcousticAssessment {
  const payload = data as { status?: string; result?: Record<string, unknown> } | null;
  if (payload?.status !== 'success' || !payload.result) throw new Error('SpeechSuper returned no acoustic assessment.');
  const r = payload.result;
  const phonemes: AcousticAssessment['phonemes'] = [];
  if (Array.isArray(r.words))
    for (const word of r.words) {
      if (!word || !Array.isArray(word.phonemes)) continue;
      for (const p of word.phonemes) {
        const score = actualMetric(p?.pronunciation ?? p?.quality_score ?? p?.scores?.overall);
        if (typeof p?.phoneme === 'string' && p.phoneme.trim() && score !== undefined)
          phonemes.push({ phoneme: p.phoneme, score });
      }
    }
  const assessment = {
    overall: actualMetric(r.overall),
    fluency: actualMetric(r.fluency),
    completeness: actualMetric(r.integrity),
    phonemes,
  };
  if (
    assessment.overall === undefined &&
    assessment.fluency === undefined &&
    assessment.completeness === undefined &&
    !phonemes.length
  )
    throw new Error('SpeechSuper returned no supported acoustic metrics.');
  return assessment;
}

export function legacyPracticedIds(raw: string | null): string[] {
  try {
    const data = JSON.parse(raw ?? '{}');
    const known = new Set([...STUDIO_SOUNDS, ...PRONUNCIATION_SOUNDS].map((s) => s.id));
    return Array.isArray(data?.completed)
      ? [
          ...new Set<string>(
            data.completed.filter((id: unknown): id is string => typeof id === 'string' && known.has(id)),
          ),
        ]
      : [];
  } catch {
    return [];
  }
}

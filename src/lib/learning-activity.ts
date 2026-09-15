import { nanoid } from 'nanoid';
import type { LearningActivity, LearningAttempt } from '@/types/learning-activity';

export const LEARNING_ACTIVITIES: LearningActivity[] = [
  'comprehension',
  'writing',
  'retelling',
  'personal-example',
  'sentence-pronunciation',
];
const prompts: Record<LearningActivity, [string, string]> = {
  comprehension: [
    'Explain the main idea in your own words. Identify one important detail and quote the exact evidence supporting it.',
    'Giải thích ý chính bằng lời của riêng bạn. Xác định một chi tiết quan trọng và trích dẫn nguyên văn bằng chứng hỗ trợ nó.',
  ],
  writing: [
    'Write your own short update or summary inspired by this material. Include a clear main point, supporting detail and conclusion. Do not copy the source.',
    'Viết một đoạn cập nhật hoặc tóm tắt ngắn của riêng bạn lấy cảm hứng từ tài liệu này. Bao gồm ý chính rõ ràng, chi tiết hỗ trợ và kết luận. Không sao chép từ nguồn.',
  ],
  retelling: [
    'Hide the source, then retell its main idea and two details aloud. Record yourself and add a short summary of what you said.',
    'Ẩn tài liệu gốc, sau đó kể lại ý chính và hai chi tiết bằng lời nói. Ghi âm lại và thêm một tóm tắt ngắn về những gì bạn đã nói.',
  ],
  'personal-example': [
    'Choose an expression from the source and use it in your own new situation. Explain the context.',
    'Chọn một cách diễn đạt từ tài liệu gốc và sử dụng nó trong tình huống mới của riêng bạn. Giải thích ngữ cảnh.',
  ],
  'sentence-pronunciation': [
    'Choose one sentence. Mark stressed words and thought groups, record it, then listen for stress, rhythm and linking. Retry after noting one change.',
    'Chọn một câu. Đánh dấu từ trọng âm và nhóm ý, ghi âm lại, rồi nghe để kiểm tra trọng âm, nhịp điệu và nối âm. Ghi lại một điểm cần cải thiện rồi thử lại.',
  ],
};
export function activityPrompt(activity: LearningActivity, zh = false) {
  return prompts[activity][zh ? 1 : 0];
}
export function validateLearningResponse(
  activity: LearningActivity,
  source: string,
  answer: string,
  quote = '',
  recordingId?: string,
): 'answer' | 'quote' | 'recording' | null {
  if (!answer.trim()) return 'answer';
  if (activity === 'comprehension' && (!quote.trim() || !source.includes(quote.trim()))) return 'quote';
  if ((activity === 'retelling' || activity === 'sentence-pronunciation') && !recordingId) return 'recording';
  return null;
}
type AttemptInput = Pick<
  LearningAttempt,
  'lessonId' | 'unitId' | 'activity' | 'sourceText' | 'sourceContentIds' | 'answer'
> &
  Partial<
    Pick<LearningAttempt, 'evidenceQuote' | 'parentAttemptId' | 'recordingId' | 'feedback' | 'sourceWeakSpotId'>
  > & { notes?: string };
export function createLearningAttempt(input: AttemptInput, now = Date.now()): LearningAttempt {
  return {
    id: nanoid(),
    lessonId: input.lessonId,
    unitId: input.unitId,
    activity: input.activity,
    sourceText: input.sourceText,
    sourceContentIds: [...input.sourceContentIds],
    prompt: activityPrompt(input.activity),
    answer: input.answer.trim(),
    evidenceQuote: input.evidenceQuote?.trim(),
    parentAttemptId: input.parentAttemptId,
    recordingId: input.recordingId,
    sourceWeakSpotId: input.sourceWeakSpotId,
    status: input.parentAttemptId ? 'revised' : 'submitted',
    feedback: input.feedback
      ? structuredClone(input.feedback)
      : {
          source: 'self',
          notes: input.notes?.trim() ?? '',
          checklist: ['Meaning and task coverage', 'Supporting evidence or personal context', 'One change to try next'],
        },
    createdAt: now,
    updatedAt: now,
  };
}

function isGenuineRevision(attempt: LearningAttempt, attempts: LearningAttempt[]): boolean {
  const parent = attempts.find((item) => item.id === attempt.parentAttemptId);
  const changed =
    attempt.activity === 'retelling' || attempt.activity === 'sentence-pronunciation'
      ? !!parent?.recordingId && !!attempt.recordingId && parent.recordingId !== attempt.recordingId
      : parent?.answer !== attempt.answer;
  return (
    !!parent &&
    parent.lessonId === attempt.lessonId &&
    parent.activity === attempt.activity &&
    parent.createdAt <= attempt.createdAt &&
    changed
  );
}

/** Content address prevents a repeated Save/upload of identical audio inventing retry evidence. */
export async function recordingIdentity(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return `recording:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

/** Completion means work submitted and revised, never a claim of mastery. */
export function workshopProgress(lessonId: string, attempts: LearningAttempt[]) {
  const own = attempts.filter((item) => item.lessonId === lessonId);
  const comprehension = own.some(
    (item) =>
      item.activity === 'comprehension' &&
      !validateLearningResponse(item.activity, item.sourceText, item.answer, item.evidenceQuote),
  );
  const writing = own.some((item) => item.activity === 'writing' && isGenuineRevision(item, own));
  return {
    comprehension,
    writing,
    completed: comprehension && writing,
    completedSteps: Number(comprehension) + Number(writing),
    total: 2,
  };
}

export function canResolveTransfer(weakSpotId: string, lastSeenAt: number, attempts: LearningAttempt[]): boolean {
  const own = attempts.filter((item) => item.sourceWeakSpotId === weakSpotId && item.createdAt > lastSeenAt);
  return own.some(
    (retry) =>
      retry.activity !== 'personal-example' &&
      isGenuineRevision(retry, own) &&
      own.some(
        (example) =>
          example.activity === 'personal-example' &&
          example.answer.trim().length > 0 &&
          example.createdAt >= retry.createdAt,
      ),
  );
}

export function normalizeExamAnswer(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[“”"']/g, '')
    .replace(/\s+/g, ' ');
}

export function isExamAnswerCorrect(answer: string, acceptedAnswers: string[]): boolean {
  const normalized = normalizeExamAnswer(answer);
  return acceptedAnswers.some((candidate) => normalizeExamAnswer(candidate) === normalized);
}

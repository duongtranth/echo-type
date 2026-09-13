'use client';

import { AlertCircle, FileText, Loader2, Sparkles, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createExamFromParsedDraft } from '@/lib/exams/import';
import { createExamFromExtractedText } from '@/lib/exams/repository';
import { PROVIDER_REGISTRY } from '@/lib/providers';
import { useProviderStore } from '@/stores/provider-store';
import type { ExamType, ParsedExamDraft } from '@/types/exam';

interface ExtractedPdf {
  text: string;
  pageCount: number;
  metadata: {
    title: string | null;
    author: string | null;
  };
}

interface ParsedExamResponse {
  draft: ParsedExamDraft;
  truncated?: boolean;
  error?: string;
}

const MAX_PDF_SIZE = 10 * 1024 * 1024;

export default function ImportExamPage() {
  const router = useRouter();
  const activeProviderId = useProviderStore((state) => state.activeProviderId);
  const activeConfig = useProviderStore((state) => state.getActiveConfig());
  const providers = useProviderStore((state) => state.providers);
  const [examType, setExamType] = useState<ExamType>('IELTS');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<ExtractedPdf | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleFile = (nextFile: File | null) => {
    setData(null);
    setError('');
    setFile(null);

    if (!nextFile) return;
    const isPdf = nextFile.type === 'application/pdf' || nextFile.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setError('Please choose a PDF file.');
      return;
    }
    if (nextFile.size > MAX_PDF_SIZE) {
      setError('PDF must be smaller than 10 MB.');
      return;
    }

    setFile(nextFile);
    setTitle(nextFile.name.replace(/\.pdf$/i, ''));
  };

  const extractPdf = async () => {
    if (!file) return;
    setExtracting(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/import/pdf', { method: 'POST', body: formData });
      const json = (await response.json()) as ExtractedPdf & { error?: string };

      if (!response.ok) {
        throw new Error(json.error || 'Could not extract this PDF.');
      }

      setData(json);
      if (json.metadata?.title) setTitle(json.metadata.title);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not extract this PDF.');
    } finally {
      setExtracting(false);
    }
  };

  const saveManualDraft = async () => {
    if (!data) return;
    setSaving(true);
    setError('');

    try {
      const testId = await createExamFromExtractedText({
        title,
        examType,
        sourceFilename: file?.name,
        text: data.text,
      });
      router.push(`/exams/${testId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the exam draft.');
      setSaving(false);
    }
  };

  const parseWithAI = async () => {
    if (!data) return;
    setParsing(true);
    setError('');

    try {
      const apiKey = activeConfig.auth.apiKey || activeConfig.auth.accessToken || '';
      const headerKey = PROVIDER_REGISTRY[activeProviderId].headerKey;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) headers[headerKey] = apiKey;

      const response = await fetch('/api/exams/parse', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          examType,
          text: data.text,
          provider: activeProviderId,
          providerConfigs: providers,
        }),
      });
      const json = (await response.json()) as ParsedExamResponse;
      if (!response.ok || !json.draft) {
        throw new Error(json.error || 'AI could not parse this exam.');
      }

      const imported = await createExamFromParsedDraft({
        title,
        examType,
        sourceFilename: file?.name,
        rawText: data.text,
        draft: json.draft,
      });
      router.push(`/exams/${imported.testId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'AI could not parse this exam.');
      setParsing(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-8">
      <div>
        <p className="text-sm font-medium text-indigo-600">Import exam</p>
        <h1 className="text-2xl font-semibold text-slate-900">Create an IELTS or TOEIC draft from PDF</h1>
        <p className="mt-1 text-sm text-slate-500">
          Extract the PDF first, then let your configured EchoType AI provider structure explicit sections, questions, and answer keys.
        </p>
      </div>

      <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Exam
            <select
              value={examType}
              onChange={(event) => setExamType(event.target.value as ExamType)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-normal text-slate-800 outline-none focus:border-indigo-400"
            >
              <option value="IELTS">IELTS</option>
              <option value="TOEIC">TOEIC</option>
            </select>
          </label>

          <label className="space-y-1 text-sm font-medium text-slate-700">
            Title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Cambridge IELTS 19 - Test 1"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 font-normal text-slate-800 outline-none focus:border-indigo-400"
            />
          </label>
        </div>

        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 px-4 py-8 text-center hover:border-indigo-300 hover:bg-indigo-50/30">
          <Upload className="h-8 w-8 text-indigo-400" />
          <span className="mt-2 text-sm font-medium text-slate-700">Choose test PDF</span>
          <span className="mt-1 text-xs text-slate-400">PDF, maximum 10 MB</span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
          />
        </label>

        {file && (
          <div className="flex flex-col gap-3 rounded-lg bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-indigo-500" />
              <span className="truncate text-sm text-slate-700">{file.name}</span>
            </div>
            <button
              type="button"
              onClick={() => void extractPdf()}
              disabled={extracting}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {extracting && <Loader2 className="h-4 w-4 animate-spin" />}
              {extracting ? 'Extracting…' : data ? 'Extract again' : 'Extract PDF'}
            </button>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {data && (
          <div className="space-y-4 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap gap-2 text-xs text-slate-600">
              <span className="rounded-full bg-slate-100 px-2 py-1">{data.pageCount} pages</span>
              <span className="rounded-full bg-slate-100 px-2 py-1">
                {data.text.split(/\s+/).filter(Boolean).length.toLocaleString()} words
              </span>
              {data.metadata.author && <span className="rounded-full bg-slate-100 px-2 py-1">{data.metadata.author}</span>}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">Extraction preview</p>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-6 text-slate-700">
                {data.text.slice(0, 5000)}
                {data.text.length > 5000 ? '\n\n…' : ''}
              </pre>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void parseWithAI()}
                disabled={parsing || saving || data.text.trim().length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {parsing ? 'Parsing exam…' : 'AI parse & save'}
              </button>
              <button
                type="button"
                onClick={() => void saveManualDraft()}
                disabled={saving || parsing || data.text.trim().length === 0}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {saving ? 'Saving draft…' : 'Save without AI'}
              </button>
            </div>

            <p className="text-xs leading-5 text-slate-500">
              AI only imports questions when an explicit answer can be matched from the source. Unanswered questions are skipped instead of hallucinating an answer; you can add them manually in the editor.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

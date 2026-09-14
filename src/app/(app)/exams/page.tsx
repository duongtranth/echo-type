'use client';

import { BookOpenCheck, FileUp, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { deleteExamTest, listExamTests } from '@/lib/exams/repository';
import type { ExamTest } from '@/types/exam';

export default function ExamsPage() {
  const [tests, setTests] = useState<ExamTest[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTests = useCallback(async () => {
    setLoading(true);
    try {
      setTests(await listExamTests());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTests();
  }, [loadTests]);

  const handleDelete = async (test: ExamTest) => {
    if (!window.confirm(`Delete “${test.title}”?`)) return;
    await deleteExamTest(test.id);
    await loadTests();
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-primary">Exam practice</p>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-foreground">
            IELTS & TOEIC Test Library
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Import a test, add or review its questions, then practise and send mistakes to Weak Spots.
          </p>
        </div>
        <Button asChild>
          <Link href="/exams/import">
            <FileUp className="h-4 w-4" />
            Import exam
          </Link>
        </Button>
      </div>

      {loading ? (
        <Card className="p-8 text-sm text-muted-foreground">Loading exams…</Card>
      ) : tests.length === 0 ? (
        <Card className="border-dashed p-10 text-center">
          <BookOpenCheck className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <h2 className="mt-3 font-medium text-foreground">No imported exams yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">Start with an IELTS or TOEIC PDF.</p>
          <Button asChild className="mt-4">
            <Link href="/exams/import">Import your first exam</Link>
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tests.map((test) => (
            <Card
              key={test.id}
              className="p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-primary/10 font-mono text-[10px] uppercase tracking-wide text-primary">
                      {test.examType}
                    </Badge>
                    <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-wide">
                      {test.status}
                    </Badge>
                  </div>
                  <h2 className="mt-3 truncate font-heading font-bold text-foreground">{test.title}</h2>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {test.sourceFilename || 'Manual import'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => void handleDelete(test)}
                  className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label={`Delete ${test.title}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-5 flex items-center justify-between">
                <span className="font-mono text-[10px] text-muted-foreground">
                  Updated {new Date(test.updatedAt).toLocaleDateString()}
                </span>
                <Link href={`/exams/${test.id}`} className="text-sm font-medium text-primary hover:text-primary/80">
                  Open →
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

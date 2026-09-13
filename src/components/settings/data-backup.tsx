'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { Download, Loader2, Upload } from 'lucide-react';
import { useRef, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BACKUP_TABLES, type BackupTables, createBackupArchive, readBackupArchive, restoreBackup } from '@/lib/backup';
import { db, LOCAL_DATABASE_CHANGED_EVENT } from '@/lib/db';
import { useI18n } from '@/lib/i18n/use-i18n';
import type { SyncConflict } from '@/lib/sync/conflict';
import { resolveSyncConflict } from '@/lib/sync/resolution';
import { IS_IOS_NATIVE_HOST, nativeShareFile, pickNativeFiles } from '@/lib/tauri';

function subscribeDatabase(listener: () => void) {
  window.addEventListener(LOCAL_DATABASE_CHANGED_EVENT, listener);
  return () => window.removeEventListener(LOCAL_DATABASE_CHANGED_EVENT, listener);
}
const getDatabase = () => db;
export function DataBackup() {
  const { messages, interfaceLanguage } = useI18n('settings');
  const zh = interfaceLanguage === 'zh';
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const activeDatabase = useSyncExternalStore(subscribeDatabase, getDatabase, getDatabase);
  const query = useLiveQuery(
    async () => ({
      database: activeDatabase,
      rows: await activeDatabase.syncConflicts.filter((row) => !row.resolvedAt).toArray(),
    }),
    [activeDatabase],
  );
  const conflicts = query?.database === activeDatabase ? query.rows : [];
  async function resolveConflict(conflict: SyncConflict, version: 'local' | 'remote') {
    await run(async () => {
      const database = db;
      if (database !== activeDatabase) throw new Error('Account changed. Review the current account again.');
      if ((await resolveSyncConflict(database, conflict, version)) === 'stale')
        throw new Error(
          zh
            ? 'Bản ghi này đã có thay đổi mới. Chỉnh sửa mới nhất của bạn đã được giữ lại; vui lòng kiểm tra lại các phiên bản đã cập nhật.'
            : 'This record changed. Your newer edit was preserved; review the refreshed versions again.',
        );
      setStatus(
        zh
          ? 'Đã chọn phiên bản; cả hai bản sao lịch sử vẫn được giữ trong bản sao lưu đầy đủ của bạn.'
          : 'Version selected. Both historical copies remain in your full backup.',
      );
    });
  }
  async function download(blob: Blob, filename: string) {
    if (await nativeShareFile(blob, filename)) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function exportData(full: boolean) {
    await run(async () => {
      const database = db;
      const date = new Date().toISOString().slice(0, 10);
      if (!full) {
        await download(
          new Blob([JSON.stringify(await database.contents.toArray())], { type: 'application/json' }),
          `echotype-library-${date}.json`,
        );
      } else {
        const tables: BackupTables = {};
        await database.transaction(
          'r',
          BACKUP_TABLES.map((name) => database.table(name)),
          async () => {
            for (const name of BACKUP_TABLES) tables[name] = await database.table(name).toArray();
          },
        );
        const bytes = await createBackupArchive(tables, database.name);
        await download(
          new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/zip' }),
          `echotype-full-backup-${date}.zip`,
        );
      }
      setStatus(zh ? 'Đã xuất bản sao lưu. Hãy lưu giữ cẩn thận.' : 'Backup exported. Keep it in a safe place.');
    });
  }
  async function exportLearning() {
    await run(async () => {
      const database = db;
      const data: BackupTables = {};
      await database.transaction('r', [database.records, database.sessions, database.learningAttempts], async () => {
        for (const name of ['records', 'sessions', 'learningAttempts'])
          data[name] = await database.table(name).toArray();
      });
      await download(
        new Blob([JSON.stringify(data)], { type: 'application/json' }),
        `echotype-learning-${new Date().toISOString().slice(0, 10)}.json`,
      );
      setStatus(zh ? 'Đã xuất dữ liệu học tập.' : 'Learning records exported.');
    });
  }
  async function importFile(file: File) {
    await run(async () => {
      const database = db;
      const tables = await readBackupArchive(new Uint8Array(await file.arrayBuffer()), database.name);
      if (database !== db) throw new Error('Account changed. Select the backup again.');
      const result = await restoreBackup(database, tables);
      setStatus(
        zh
          ? `Đã khôi phục ${result.total} mục; giữ lại ${result.skipped} mục cục bộ mới hơn hoặc giống hệt. Tải lại trang để cập nhật dữ liệu.`
          : `Restored ${result.total} items; kept ${result.skipped} newer or identical local items. Reload to refresh your data.`,
      );
    });
  }
  async function chooseFile() {
    if (IS_IOS_NATIVE_HOST) {
      const files = await pickNativeFiles({ accept: '.zip,.json' });
      if (files?.[0]) {
        await importFile(files[0]);
        return;
      }
    }
    input.current?.click();
  }
  return (
    <div className="space-y-4">
      {!!conflicts?.length && (
        <Card className="border-amber-200">
          <CardContent className="space-y-3 pt-5">
            <h3 className="font-semibold">
              {zh ? 'Phiên bản đồng bộ cần xem xét' : 'Sync versions to review'} ({conflicts.length})
            </h3>
            <p className="text-sm text-slate-600">
              {zh
                ? 'Đã phát hiện chỉnh sửa từ thiết bị khác. Cả hai phiên bản đều được giữ lại. Hãy xem xét và chọn phiên bản để tiếp tục sử dụng.'
                : 'Different device edits were detected. Both versions are preserved. Review and choose the version to continue using.'}
            </p>
            {conflicts.map((conflict) => (
              <details key={conflict.id} className="rounded-lg border border-slate-200 p-3">
                <summary className="cursor-pointer text-sm">
                  {String(conflict.local.title ?? conflict.entityId)}
                </summary>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {(['local', 'remote'] as const).map((version) => (
                    <div key={version}>
                      <pre className="mb-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs">
                        {JSON.stringify(conflict[version], null, 2)}
                      </pre>
                      <Button
                        disabled={busy}
                        size="sm"
                        variant="outline"
                        onClick={() => void resolveConflict(conflict, version)}
                      >
                        {version === 'local'
                          ? zh
                            ? 'Dùng phiên bản trên thiết bị'
                            : 'Use local version'
                          : zh
                            ? 'Dùng phiên bản đám mây'
                            : 'Use cloud version'}
                      </Button>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </CardContent>
        </Card>
      )}
      <Card className="border-slate-100 bg-white">
        <CardContent className="space-y-4 pt-5">
          <h3 className="font-semibold text-indigo-900">{messages.dataBackup.exportFullBackup}</h3>
          <p className="text-sm leading-relaxed text-slate-600">
            {zh
              ? 'Tệp ZIP bao gồm tài liệu học tập, tiến độ, khóa học, nhiệm vụ hằng ngày, tác vụ nhập và media cục bộ, kèm kiểm tra tính toàn vẹn. Tối đa 512 MB. Không bao gồm khóa API hay thông tin đăng nhập.'
              : 'ZIP includes materials, progress, courses, daily tasks, import jobs and local media with integrity checks. Maximum 512 MB. API keys and login credentials are excluded.'}
          </p>
          <p className="text-sm text-slate-600">
            {zh
              ? 'Đồng bộ đám mây chỉ đồng bộ văn bản và dữ liệu học tập; media hiện chỉ lưu trên thiết bị này — hãy dùng bản sao lưu ZIP để chuyển.'
              : 'Cloud sync covers text and learning records. Media remains on this device; transfer it with a ZIP backup.'}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button disabled={busy} onClick={() => void exportData(true)}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {zh ? 'Xuất ZIP đầy đủ' : 'Export full ZIP'}
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => void exportData(false)}>
              {messages.dataBackup.exportLibrary}
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => void exportLearning()}>
              {messages.dataBackup.exportLearningData}
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card className="border-slate-100 bg-white">
        <CardContent className="space-y-4 pt-5">
          <h3 className="font-semibold text-indigo-900">{messages.dataBackup.importFromBackup}</h3>
          <p className="text-sm leading-relaxed text-slate-600">
            {zh
              ? 'Hỗ trợ ZIP và JSON phiên bản cũ. Kiểm tra trước khi khôi phục toàn bộ; luôn gộp và giữ lại bản ghi cục bộ mới hơn, không xóa dữ liệu, cũng không khôi phục khóa từ bản sao lưu cũ.'
              : 'Accepts ZIP and legacy JSON. Validates before atomic restoration; merges without clearing data or overwriting newer local records. Old backed-up keys are not restored.'}
          </p>
          <Button variant="outline" disabled={busy} onClick={() => void chooseFile()}>
            <Upload className="mr-2 h-4 w-4" />
            {zh ? 'Chọn bản sao lưu ZIP / JSON' : 'Choose ZIP / JSON backup'}
          </Button>
          <input
            ref={input}
            type="file"
            accept=".zip,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importFile(file);
              event.target.value = '';
            }}
          />
        </CardContent>
      </Card>
      {status && <output className="block text-sm text-green-700">{status}</output>}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

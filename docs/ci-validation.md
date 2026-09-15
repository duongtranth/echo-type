# CI validation

The fork uses the upstream GitHub Actions workflow on pull requests targeting `main`.

For local validation, run:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The IELTS/TOEIC exam work is expected to pass the same lint, typecheck, test, and build gates as the rest of EchoType.

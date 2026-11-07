# Project Change Metrics

This file is a point-in-time snapshot of the repository, not a live counter.
Update it when a release or project handoff needs a new baseline.

## Repository snapshot

| Metric | Value |
|---|---:|
| Snapshot commit | `9ac8d5a` |
| Branch | `main` |
| Commits on `main` at snapshot | 80 |
| Git-tracked files | 222 |
| Files under `src/` | 150 |
| TypeScript / TSX files under `src/` | 148 |
| Python source files (excluding bytecode caches) | 15 |
| Test files | 6 |
| TypeScript acceptance tests passing | 15 |
| Python research tests passing | 55 |

## Recent change totals

The totals below come from Git commit statistics. They describe the changes in
those individual commits, not the total size of the application.

| Commit | Files changed | Insertions | Deletions |
|---|---:|---:|---:|
| `de41ca3` — GoldPrism research analytics platform | 33 | 5,616 | 16,802 |
| `9ac8d5a` — mobile layout and Prisma build fixes | 5 | 53 | 51 |

The large deletion count in `de41ca3` includes removed dependency lockfiles; it
does not mean that 16,802 lines of application features were removed.

## Refreshing the snapshot

From the repository root, use PowerShell:

```powershell
$files = @(git ls-files)
$src = @($files | Where-Object { $_ -match '^src/' })
$tsSrc = @($src | Where-Object { $_ -match '\.(ts|tsx)$' })
$pySrc = @($files | Where-Object { $_ -match '\.py$' -and $_ -notmatch '(^|/)__pycache__/' })
$tests = @($files | Where-Object { $_ -match '(^tests/.*\.(ts|tsx)$|^research/test_.*\.py$)' })
"tracked=$($files.Count) src=$($src.Count) ts=$($tsSrc.Count) python=$($pySrc.Count) tests=$($tests.Count) commits=$((git rev-list --count HEAD))"
git show --format= --shortstat HEAD
```

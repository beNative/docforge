# QA Evidence Log – New from Clipboard

- **Commit tested:** _This changeset (see git log for hash)_
- **Packaging artifacts:** _None produced (packaging not yet executed)_

| Date (UTC) | Scenario | Command | Raw Exit Status | CI Run | Notes |
| --- | --- | --- | --- | --- | --- |
| 2025-10-23 | Build pipeline check | `npm run build` | 0 | — | Succeeded locally; esbuild continues to warn about the legacy nullish coalescing check in `components/Sidebar.tsx`. |
| 2025-10-23 | Type safety sweep | `npx tsc --noEmit` | 0 | — | Passes after adding missing module declarations and tightening component props; closes T-DATA-01 risk. |
| 2025-10-23 | GUI test plan validation | `npm test` | 0 | — | Passes; validation confirms documentation matrix but does not exercise clipboard flows. |
| 2025-10-23 | Markdown renderer parity suite | `npm run test:markdown` | 0 | — | Vitest suite passes; confirms GitHub-style styling for inline code and fenced blocks after merge. |
| 2025-10-23 | Release workflow verification | `npm run test:release` | 0 | — | Passes while highlighting missing Windows asset for v0.6.7 (falls back to v0.6.6). |
| 2025-10-23 | Auto-update asset audit | `npm run test:auto-update` | 0 | — | Passes with all metadata assets present for v0.6.7. |
| 2025-10-22 | Copy Markdown snippet → New from Clipboard → Markdown classification | Manual | n/a | — | Pending execution. |
| 2025-10-22 | Copy JSON content → New from Clipboard → JSON syntax + activity log entry | Manual | n/a | — | Pending execution. |
| 2025-10-22 | Copy TypeScript code → New from Clipboard → `source_code` document | Manual | n/a | — | Pending execution. |
| 2025-10-22 | Empty clipboard → Info modal explains clipboard is empty | Manual | n/a | — | Pending execution. |
| 2025-10-22 | Clipboard permission revoked → guidance dialog rendered | Manual | n/a | — | Pending execution. |
| 2025-10-22 | >1 MB clipboard payload → warning recorded, doc created | Manual | n/a | — | Pending execution. |
| 2025-10-22 | Electron build without `navigator.clipboard` → native bridge handles request | `npm run build:electron` | not run | — | To be captured once Electron smoke test executes. |
| 2025-10-22 | Web build with blocked clipboard API → guidance dialog appears | `npm run build` | not run | — | To be recorded after browser QA. |

_This log will be updated as verification steps are executed and evidence becomes available._

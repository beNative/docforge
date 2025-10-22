# QA Evidence Log – New from Clipboard

- **Commit tested:** `d4634fce9cd3190cfc0e895f87b802e9d2e0c3b9`
- **Packaging artifacts:** _None produced (packaging not yet executed)_

| Date (UTC) | Scenario | Command | Raw Exit Status | CI Run | Notes |
| --- | --- | --- | --- | --- | --- |
| 2025-10-22 | Copy Markdown snippet → New from Clipboard → Markdown classification | Manual | n/a | — | Pending execution. |
| 2025-10-22 | Copy JSON content → New from Clipboard → JSON syntax + activity log entry | Manual | n/a | — | Pending execution. |
| 2025-10-22 | Copy TypeScript code → New from Clipboard → `source_code` document | Manual | n/a | — | Pending execution. |
| 2025-10-22 | Empty clipboard → Info modal explains clipboard is empty | Manual | n/a | — | Pending execution. |
| 2025-10-22 | Clipboard permission revoked → guidance dialog rendered | Manual | n/a | — | Pending execution. |
| 2025-10-22 | >1 MB clipboard payload → warning recorded, doc created | Manual | n/a | — | Pending execution. |
| 2025-10-22 | Electron build without `navigator.clipboard` → native bridge handles request | `npm run build:electron` | not run | — | To be captured once Electron smoke test executes. |
| 2025-10-22 | Web build with blocked clipboard API → guidance dialog appears | `npm run build` | not run | — | To be recorded after browser QA. |

_This log will be updated as verification steps are executed and evidence becomes available._

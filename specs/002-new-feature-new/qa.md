# QA Checklist – New from Clipboard

Use the scenarios below to verify the end-to-end "New from Clipboard" workflow.

## Happy path
- [ ] Copy a Markdown snippet and run **New from Clipboard** from the command palette. Confirm the new document opens with the copied content and Markdown classification.
- [ ] Copy JSON content, trigger **New from Clipboard**, and verify the node is created with JSON syntax highlighting and the detection summary appears in the activity log.
- [ ] Copy TypeScript code, invoke **New from Clipboard**, and ensure the resulting document defaults to the editor view with a `source_code` doc type.

## Clipboard edge cases
- [ ] Clear the clipboard (or copy whitespace only), run **New from Clipboard**, and confirm an informational dialog explains that the clipboard is empty.
- [ ] Revoke clipboard permissions in the OS/browser, attempt the command, and verify the permission dialog opens with guidance on restoring access.
- [ ] Copy a large (>1 MB) text sample and ensure the activity log records a warning about the clipboard size while still creating the document.

## Environment-specific checks
- [ ] On Electron builds, confirm the action works even when `navigator.clipboard` is unavailable by relying on the native clipboard bridge.
- [ ] On web builds, confirm the dialog advises enabling clipboard APIs when run in environments that block access.

Document the results (pass/fail, notes, screenshots) in the release test report.

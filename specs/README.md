# Specification Workspace

The `specs/` directory stores the canonical record of DocForge feature work. Each feature receives a numbered folder (`NNN-slug`) created by the Spec Kit helper scripts and populated by the `/speckit.*` commands.

## Creating a New Feature Package

1. Run the shell helper to scaffold a folder and branch slug:
   ```bash
   .specify/scripts/bash/create-new-feature.sh "<feature summary>"
   ```
   - The script increments the numeric prefix, generates a git-friendly slug, and prints the branch name suggestion.
   - Use `--short-name` to override the slug when needed.
2. Open the generated folder and fill the artifacts by working with your AI assistant:
   - `/speckit.specify` → `spec.md`
   - `/speckit.plan` → `plan.md`
   - `/speckit.tasks` → `tasks.md`
   - Optional supplements such as `research.md` or `contracts/` may be added as required.
3. Commit the spec folder before starting implementation so reviewers can confirm scope, risks, and acceptance criteria.

## Maintaining Specs

- Keep specs synchronized with the project documentation. If README or manuals change, update relevant specs or note deviations.
- Link the spec folder in pull requests implementing the feature. The constitution requires reviewers to verify the spec, plan, and tasks are satisfied.
- Archive superseded specs by updating their status in the header and describing successor work.

## Agent Context Refresh

Run `.specify/scripts/bash/update-agent-context.sh` after major refactors or doc updates to keep the AI command context current. This regenerates cached summaries consumed by the agent prompts.

---
name: project
description: Create a new Kosmos project file from the project template. Use when the user wants to start a project, create a project file, scaffold a project plan, or runs /project.
---

# Create a project file

Create a new project file from `projects/project-template.md`.

1. **Project name**: Use the name from the user's message. If they didn't give one, ask.
2. **Visibility**: Ask whether to save under `projects/public/` (shared, committed) or `projects/personal/` (private, gitignored). Default to `projects/public/` if unsure.
3. **Save location**: Write only under `projects/public/` or `projects/personal/` — never into todos, memories, or elsewhere.
4. **Filename**: `YYYY-MM-DD-project-name.project.md`
   - `YYYY-MM-DD` is today's date
   - `project-name` is a slugified version of the project name
5. **Fill the template**. Interview briefly for anything not already in the user's message, then replace placeholders:
   - `{{PROJECT_TITLE}}`: the project name
   - `{{Brief description}}`: ask for a one-line description
   - `status`: ask for initial status (`planning` | `active` | `paused` | `completed`); default `planning`
   - `{{high|medium|low}}`: ask for priority; default `medium`
   - `{{PROJECT_OWNER}}`: ask for owner; default to the current user if known
   - `{{YYYY-MM-DD}}`: today's date for `created`; ask about `due` (optional — omit the field if none)
   - Remaining body placeholders (`{{Brief summary...}}`, requirements, phases, related links): ask, or leave a short sensible starter the user can edit
6. **Confirm**: After writing the file, report the path and suggest next steps for planning.

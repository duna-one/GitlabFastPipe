# Gitlab Fast Pipe Chrome extension specification

Status: draft, September 23, 2026.

## Purpose

Gitlab Fast Pipe adds presets to GitLab's standard **Run pipeline** page. A
user selects a branch or tag, selects a preset, and starts the pipeline with
GitLab's normal button. Presets are JSON in the same repository and selected
ref. The universal extension contains no corporate GitLab address, project
name, or corporate-variable list. It supports GitLab.com and compatible
self-managed GitLab after the user grants the specific HTTPS origin access.

## User flow and UI

1. The user opens a project's pipeline creation page.
2. On first use for a GitLab site, the extension asks for access only to that
   site. Its panel appears automatically on later visits.
3. The user selects a ref in GitLab's normal field. The extension reads
   `.gitlab-fast-pipe/presets.json` **from that ref** and displays each preset's
   name, short description, and exact variables.
4. A selected preset fills GitLab's normal **Variables** fields. The user may
   inspect and edit values.
5. The user starts the pipeline with GitLab's normal **Run pipeline** button.

Place the panel between ref selection and **Variables**. Each button shows its
name, a one- or two-line description, and all variable values; expand or show a
multi-variable list before launch. Provide distinct loading, loaded, file
missing, access denied, and format-error states without covering GitLab's form.
Provide **Clear selection**, which removes only extension-added fields and
preserves manual fields. Add no separate start button.

Changing project or ref clears the old selection and reloads the file. State
which project and ref supplied the current presets, and never leave variables
from an old choice in the form.

## Preset file

The fixed path is `.gitlab-fast-pipe/presets.json`. It is not included by
`.gitlab-ci.yml`; it describes the extension UI only and does not change CI.

```json
{
  "schemaVersion": 1,
  "presets": [
    {
      "id": "server",
      "title": "Server",
      "description": "Standard platform build",
      "variables": [{ "key": "SERVER", "value": "1" }]
    },
    {
      "id": "server-android",
      "title": "Server and Android",
      "description": "One pipeline for two job groups",
      "variables": [
        { "key": "SERVER", "value": "1" },
        { "key": "ANDROID", "value": "1" }
      ]
    }
  ]
}
```

`schemaVersion` and a non-empty `presets` array are required. A preset requires
a unique `id`, non-empty `title` and `description`, and a non-empty `variables`
array. Every variable requires a non-empty string `key` and a string `value`.
Keep source order. Duplicate IDs or duplicate keys inside a preset are
configuration errors. Reject an unknown schema version with a clear error.

Names and descriptions are text only. JSON must contain no JavaScript, HTML,
commands, launch URLs, or secrets. The extension does not derive variables from
`.gitlab-ci.yml`: the JSON file fully defines the buttons.

## Form behavior

- Change Variables only after the user selects a preset; loading and rendering
  presets never fills fields.
- Replacing a preset changes only extension-created fields. Manual fields stay.
- A preset key matching a manual field is a displayed conflict; do not add a
  duplicate. The user resolves it before launching.
- Values remain visible and editable in GitLab fields; do not hide or mask them.
- A load or validation failure never applies a partial set, and manual launch
  remains available.
- Cancel or ignore old-ref requests so a late response cannot replace current
  presets.
- SPA navigation, re-entry, and page re-rendering must not duplicate panels or
  variable rows.

## Access and security

- Implement as a Manifest V3 extension and inject UI only into the approved
  origin's pipeline creation page.
- Read JSON using the current authenticated session on that origin. Never ask
  for or store a password, personal access token, or cookie.
- GitLab controls read and launch rights. On a denied read, show an error and
  leave the native form usable.
- The user selects an address; do not grant arbitrary sites access in advance.
  Version one supports HTTPS only.
- Treat JSON and GitLab responses as untrusted: validate the schema strictly,
  limit size, render as text, and never load or execute remote code.
- Do not transmit project data, presets, variables, or addresses to the
  developer or third parties. Version one has no telemetry.
- Do not bypass protected branches, permissions, GitLab CI rules, or GitLab's
  normal launch confirmation.

## Distribution and version-one scope

Publish the first working version as a universal Chrome Web Store extension.
Employees install it once and receive later code releases through Store updates;
Google Workspace is unnecessary for a public extension. Preset changes become
visible on next file load independently of extension releases. GitLab supplies
JSON data only; a new extension version is for logic, UI, or schema changes.

Source is hosted in the public GitHub repository. Store publication is a
separate release process. Do not distribute the first version unpacked when
seamless Store updates are expected.

Version one includes one fixed JSON path, selected-ref loading, descriptions,
standard Variables filling, error handling, approved HTTPS instances, and Store
publication/updates. It excludes GitLab-API launch, token storage, automatic
start, `.gitlab-ci.yml` parsing, preset editing, user-settings sync, job
management after launch, and command execution from JSON.

## Acceptance criteria

1. The panel appears once on supported **Run pipeline** pages and does not alter
   other pages.
2. Only presets from the selected ref are shown; a ref change refreshes and
   clears the old selection.
3. Title, description, and every `key=value` pair appear before launch. A
   multi-variable preset creates one set for one pipeline.
4. Preset changes modify only extension rows; manual rows remain, and conflicts
   do not create duplicates.
5. Missing file, invalid JSON, unsupported schema, access denial, and network
   failure have distinct clear states while manual launch remains possible.
6. The extension neither presses **Run pipeline** nor calls a launch API.
7. Private-project reads use the current session without token entry and data
   never leaves the GitLab site.
8. SPA navigation, repeated form entry, and slow responses cause neither panel
   duplication nor presets from an old ref.
9. Verify compatibility with the current corporate GitLab and GitLab.com;
   document exact supported versions after live checks.
10. Verify Store update of an installed test version without reinstallation.

## Live verification before release

Complete the local project and its automated checks before opening live GitLab.
Then verify raw-file loading for the selected ref in a browser session, the
current Variables form structure, and SPA navigation on the supported GitLab
instances. This verification is required before the first release. It does not
use GitLab MCP.

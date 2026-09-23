# Gitlab Fast Pipe Chrome extension specification

Status: draft, September 23, 2026.

## Purpose

Gitlab Fast Pipe adds presets to GitLab's standard **Run pipeline** page. A
user selects a branch or tag, selects one or more presets, and starts the
pipeline with GitLab's normal button. Presets are JSON in the same repository
and selected ref. The universal extension contains no corporate GitLab address,
project name, or corporate-variable list. It supports GitLab.com and compatible
self-managed GitLab after the user grants the specific HTTPS origin access.

## User flow and UI

1. The user opens a project's pipeline creation page.
2. On first use for a GitLab site, the extension asks for access only to that
   site. Its panel appears automatically on later visits.
3. The user selects a ref in GitLab's normal field. The extension reads
   `.gitlab-fast-pipe/presets.json` **from that ref** and displays each preset's
   names in a compact grid. A preset file can mix standalone tiles with titled
   groups of tiles. The description and exact variables for the most recently
   clicked selected preset appear below the grid.
4. Selected presets fill GitLab's normal **Variables** fields. The user may
   inspect and edit values.
5. The user starts the pipeline with GitLab's normal **Run pipeline** button.

Place the panel between ref selection and **Variables**. Show preset names in a
responsive grid, with group titles above grouped tiles; preserve source order
for standalone tiles, groups, and their children. Show the description and
variable values below the grid for the most recently clicked selected preset.
Each tile toggles independently, so clicking it again deselects it. If the
most recently clicked preset is deselected, show details for the most recently
clicked preset that remains selected. When the selection becomes empty, show no
selected-preset details.
Provide distinct loading, loaded, file missing, access denied, and format-error
states without covering GitLab's form. Add no separate start button.

Changing project or ref clears the old selection and reloads the file. Never
leave variables from an old choice in the form.

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
      "group": "Mobile",
      "presets": [
        {
          "id": "android",
          "title": "Android",
          "description": "Build the Android app",
          "variables": [{ "key": "ANDROID", "value": "1" }]
        }
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
The top-level array may mix flat presets with group objects. A group has exactly
the non-empty `group` title and a non-empty `presets` array of flat presets;
groups cannot nest. Top-level entries and flattened presets are each limited to
100, each preset has at most 50 variables, and the complete JSON file is limited
to 256 KiB. IDs are unique across all flattened presets. Preserve top-level,
group, and child order.

Names and descriptions are text only. JSON must contain no JavaScript, HTML,
commands, launch URLs, or secrets. The extension does not derive variables from
`.gitlab-ci.yml`: the JSON file fully defines the buttons.

## Form behavior

- Change Variables only after the user selects a preset; loading and rendering
  presets never fills fields.
- Toggling a preset changes only extension-created fields. Manual fields stay.
- Combine variables from all selected presets. Identical key/value pairs create
  one field. A key with differing values across presets is a displayed conflict.
- A preset key matching a manual field is a displayed conflict. Conflicts keep
  the prior selection and fields unchanged; do not add a duplicate or partial
  set. The user resolves the conflict before launching.
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
3. The most recently clicked selected preset's title, description, and
   `key=value` pairs appear below the grid. Multiple presets combine into one
   set for one pipeline, with all applied values visible in GitLab's native
   Variables form.
4. Toggling a tile changes only extension rows; manual rows remain. Duplicate
   key/value pairs create one row, while conflicts cause no partial change.
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

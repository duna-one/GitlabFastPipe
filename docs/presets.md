# Preset format

Gitlab Fast Pipe reads `.gitlab-fast-pipe/presets.json` from the ref selected
on GitLab's **Run pipeline** page.

```json
{
  "schemaVersion": 1,
  "presets": [
    {
      "id": "server-android",
      "title": "Server and Android",
      "description": "Run both build groups in one pipeline.",
      "variables": [
        { "key": "SERVER", "value": "1" },
        { "key": "ANDROID", "value": "1" }
      ]
    },
    {
      "group": "Mobile",
      "presets": [
        {
          "id": "android",
          "title": "Android",
          "description": "Build the Android app.",
          "variables": [{ "key": "ANDROID", "value": "1" }]
        },
        {
          "id": "ios",
          "title": "iOS",
          "description": "Build the iOS app.",
          "variables": [{ "key": "IOS", "value": "1" }]
        }
      ]
    }
  ]
}
```

## Validation rules

| Field | Requirement |
| --- | --- |
| `schemaVersion` | Supported value is `1`. |
| `presets` | Non-empty array of flat presets and groups. Its order is shown to the user. |
| `presets[].group` | For a group entry, a non-empty title. Group entries also require a non-empty `presets` array of flat presets. Groups cannot nest. |
| `id` | Non-empty string, unique across presets. |
| `title` and `description` | Non-empty strings displayed as text. |
| `variables` | Non-empty array. Its order is preserved. |
| `variables[].key` | Non-empty string, unique within its preset. |
| `variables[].value` | String; an empty value is valid. |

The file is data only. Do not put JavaScript, HTML, shell commands, credentials,
or tokens in it. The extension rejects incompatible schema versions and invalid
files without applying a partial preset.

The whole JSON file is limited to 256 KiB. The top-level list can contain at
most 100 entries, and the total number of flat presets across the top level and
all groups is at most 100. A preset can contain at most 50 variables. IDs must
be unique across all presets, including presets in groups. Group titles and
tiles follow source order; groups cannot contain other groups.

Select multiple preset tiles to combine their variables. Click a selected tile
again to remove its variables. If selected presets use the same key and value,
the extension adds one field. If they use the same key with different values,
the extension reports a conflict and leaves the existing selection unchanged.
The same happens when a key already exists in a manually-added GitLab field.
Only fields previously added by the extension are changed.

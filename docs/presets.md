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
    }
  ]
}
```

## Validation rules

| Field | Requirement |
| --- | --- |
| `schemaVersion` | Supported value is `1`. |
| `presets` | Non-empty array. Its order is shown to the user. |
| `id` | Non-empty string, unique across presets. |
| `title` and `description` | Non-empty strings displayed as text. |
| `variables` | Non-empty array. Its order is preserved. |
| `variables[].key` | Non-empty string, unique within its preset. |
| `variables[].value` | String; an empty value is valid. |

The file is data only. Do not put JavaScript, HTML, shell commands, credentials,
or tokens in it. The extension rejects incompatible schema versions and invalid
files without applying a partial preset.

When a preset variable key already exists in a manually-added GitLab field, the
extension reports the conflict and does not create a duplicate. Selecting a
different preset or clearing the selection removes only fields previously added
by the extension.

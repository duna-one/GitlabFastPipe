# Chrome Web Store listing material

Use this text when creating the first Chrome Web Store item. The public
[privacy policy](https://github.com/duna-one/GitlabFastPipe/blob/main/docs/privacy.md)
and [support page](https://github.com/duna-one/GitlabFastPipe/issues) are
maintained in the project repository.

## Store name

Gitlab Fast Pipe

## Summary

Add reusable variable presets to GitLab's Run pipeline page.

## Detailed description

Gitlab Fast Pipe adds a preset panel to GitLab's standard Run pipeline page.
Choose a branch or tag, select one or more presets, and review the variables
in GitLab's existing form before starting the pipeline with GitLab's normal
button.

Presets are stored as JSON in the same GitLab repository and are read from the
currently selected ref. This lets teams keep their pipeline choices alongside
their code without embedding a GitLab address, project name, or corporate
variables in the extension. Presets can be arranged in named groups and selected
together; the extension preserves the order defined in the repository.

Gitlab Fast Pipe does not start pipelines by itself. It does not require a
personal access token and does not collect, transmit, or sell project data,
preset values, or browsing activity. It uses the browser's existing GitLab
session only to read the preset file from the GitLab origin that the user has
approved.

## Privacy disclosure draft

### Single purpose

The extension displays repository-defined pipeline variable presets on GitLab's
Run pipeline page and copies selected presets into GitLab's standard Variables
fields for the user to review.

### Data handling

Gitlab Fast Pipe reads the selected ref, preset JSON, and the Variables fields
on the GitLab page where the user enabled the extension. This data stays in the
browser and is used only to render presets and populate the current form.

The extension does not collect, sell, transfer, or transmit user data to the
developer or third parties. It does not use analytics, telemetry, advertising,
or remote code. It does not store passwords, cookies, or personal access tokens.

### Permissions justification

`activeTab` lets the user enable the extension on the current Run pipeline tab.
`scripting` adds the preset panel to that page after the user acts.
`https://*/*` is an optional host permission because self-managed GitLab can
run on any HTTPS origin. The extension requests only the current origin after
the user enables it there. That access lets the extension read the preset file
with the user's existing GitLab session and show the panel on later visits.

## Submission assets and fields

- Set the support URL to https://github.com/duna-one/GitlabFastPipe/issues.
- Set the privacy-policy URL to
  https://github.com/duna-one/GitlabFastPipe/blob/main/docs/privacy.md.
- Upload the 128x128 icon, 440x280 small promotional tile, and at least one
  1280x800 screenshot from `store-assets/`.
- Select only the Store data-use declarations that match the final manifest and
  implementation. Recheck them after every permission or telemetry change.

# Chrome Web Store listing material

Use this text when creating the first Chrome Web Store item. Replace the
support URL with the maintained project URL before submission. Use the stable
public URL for [the privacy policy](privacy.md) in the Store privacy-policy
field.

## Store name

Gitlab Fast Pipe

## Summary

Add reusable variable presets to GitLab's Run pipeline page.

## Detailed description

Gitlab Fast Pipe adds a preset panel to GitLab's standard Run pipeline page.
Choose a branch or tag, select a preset, and review the variables in GitLab's
existing form before starting the pipeline with GitLab's normal button.

Presets are stored as JSON in the same GitLab repository and are read from the
currently selected ref. This lets teams keep their pipeline choices alongside
their code without embedding a GitLab address, project name, or corporate
variables in the extension.

Gitlab Fast Pipe does not start pipelines by itself. It does not require a
personal access token and does not collect, transmit, or sell project data,
preset values, or browsing activity. It uses the browser's existing GitLab
session only to read the preset file from the GitLab origin that the user has
approved.

## Privacy disclosure draft

### Single purpose

The extension displays repository-defined pipeline variable presets on GitLab's
Run pipeline page and copies a selected preset into GitLab's standard Variables
fields for the user to review.

### Data handling

Gitlab Fast Pipe reads the selected ref, preset JSON, and the Variables fields
on the GitLab page where the user enabled the extension. This data stays in the
browser and is used only to render presets and populate the current form.

The extension does not collect, sell, transfer, or transmit user data to the
developer or third parties. It does not use analytics, telemetry, advertising,
or remote code. It does not store passwords, cookies, or personal access tokens.

### Permissions justification

The extension requests access only to HTTPS GitLab origins explicitly approved
by the user. That access is required to read the preset file using the user's
current GitLab session and to add the preset panel to the Run pipeline page.

## Submission assets and fields

- Supply the requested icon and screenshot assets from the release design.
- Set the support URL to the repository's issue tracker or support page.
- Set the privacy-policy URL to the stable public rendering of
  [`docs/privacy.md`](privacy.md).
- Select only the Store data-use declarations that match the final manifest and
  implementation. Recheck them after every permission or telemetry change.

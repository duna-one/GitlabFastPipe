# GitLab compatibility checks

## Corporate GitLab

Manually checked on GitLab Community Edition **13.12.2** at
`gitlab.cleverence.ru` on 2026-09-23. The test page was the Run pipeline form
for `ms/smarts`; the `gitlab-fast-pipe-extension` ref contained a preset file.

The check covered authenticated same-origin file loading, the selected ref in
GitLab's dropdown, the native auto-growing Variables form, preset application
and replacement, manual-key conflicts, removal of extension-owned rows,
retention of manual rows, and a ref change to a branch without the file and
back. The form was left empty. No pipeline was started.

The tested form uses `data-testid="ref-select"` for the ref dropdown,
`data-testid="ci-variable-row"` for variable rows, and a blank trailing row
instead of an Add variable button. Browser fixtures also cover GitLab forms
with an explicit Add variable control, delayed file responses, and SPA
reinjection.

## GitLab.com

Live GitLab.com verification remains pending until a test project is
available. The browser fixtures exercise the same-origin and form behavior
without depending on a particular GitLab host.

## Scope

These checks verify the Run pipeline page and extension behavior; they do not
verify pipeline execution or Chrome Web Store distribution. Recheck the form
when GitLab changes its Run pipeline interface.

import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const contentScript = fileURLToPath(new URL('../../dist/content.js', import.meta.url));

const fixture = `<!doctype html><html><body>
  <form id="pipeline-form">
    <label>Ref <input name="ref" value="main"></label>
    <section data-testid="ci-variables-section">
      <h2>Variables</h2>
      <div data-testid="ci-variable-list"></div>
      <button type="button" data-testid="ci-variable-add-button">Add variable</button>
    </section>
    <button type="submit">Run pipeline</button>
  </form>
  <script>
    window.pipelineSubmissions = 0;
    document.querySelector('form').addEventListener('submit', event => { event.preventDefault(); window.pipelineSubmissions++; });
    document.querySelector('[data-testid="ci-variable-add-button"]').addEventListener('click', () => {
      const row = document.createElement('div');
      row.dataset.testid = 'ci-variable-row';
      row.innerHTML = '<input name="variables[key]" aria-label="Variable key"><input name="variables[value]" aria-label="Variable value"><button type="button" data-testid="ci-variable-remove-button">Remove variable</button>';
      row.querySelector('button').addEventListener('click', () => row.remove());
      document.querySelector('[data-testid="ci-variable-list"]').append(row);
    });
  </script>
</body></html>`;

const mainPresets = JSON.stringify({ schemaVersion: 1, presets: [
  { id: 'server', title: 'Server', description: 'Build server', variables: [{ key: 'SERVER', value: '1' }, { key: 'REGION', value: 'GL' }] },
  { id: 'android', title: 'Android', description: 'Build Android', variables: [{ key: 'ANDROID', value: '1' }] }
] });

/** <summary>Serves an isolated GitLab-like form and same-origin preset files.</summary> */
async function openFixture(page: Page, rawByRef: Record<string, string> = { main: mainPresets }): Promise<void> {
  await page.route('https://gitlab.example/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.includes('/-/raw/')) {
      const ref = url.pathname.split('/-/raw/')[1]?.split('/')[0] ?? '';
      const body = rawByRef[decodeURIComponent(ref)];
      await route.fulfill(body === undefined
        ? { status: 404, body: 'Not found' }
        : { status: 200, contentType: 'application/json', body });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'text/html', body: fixture });
  });
  await page.goto('https://gitlab.example/team/project/-/pipelines/new?ref=main');
  await page.addScriptTag({ path: contentScript });
  await expect(page.locator('#gfp-root')).toBeVisible();
  await expect(page.getByRole('button', { name: /Server/ })).toBeVisible();
}

test('applies native variable rows and clears only extension-owned rows', async ({ page }) => {
  await openFixture(page);
  await page.getByTestId('ci-variable-add-button').click();
  const manual = page.getByTestId('ci-variable-row').first();
  await manual.getByLabel('Variable key').fill('MANUAL');
  await manual.getByLabel('Variable value').fill('keep');
  await page.getByRole('button', { name: /Server/ }).click();
  await expect(page.getByTestId('ci-variable-row')).toHaveCount(3);
  await expect(page.locator('[data-gitlab-fast-pipe-owned="true"]')).toHaveCount(2);
  await expect(page.locator('[data-gitlab-fast-pipe-owned="true"] input[name*="key"]').first()).toHaveValue('SERVER');
  await page.getByRole('button', { name: 'Clear selection' }).click();
  await expect(page.getByTestId('ci-variable-row')).toHaveCount(1);
  await expect(manual.getByLabel('Variable value')).toHaveValue('keep');
  expect(await page.evaluate(() => (window as typeof window & { pipelineSubmissions: number }).pipelineSubmissions)).toBe(0);
});

test('reports manual-key conflicts without creating a partial preset', async ({ page }) => {
  await openFixture(page);
  await page.getByTestId('ci-variable-add-button').click();
  await page.getByTestId('ci-variable-row').getByLabel('Variable key').fill('SERVER');
  await page.getByRole('button', { name: /Server/ }).click();
  await expect(page.locator('.gfp-conflict')).toContainText('SERVER');
  await expect(page.getByTestId('ci-variable-row')).toHaveCount(1);
});

test('changes ref, ignores old selection, and avoids a duplicate panel on reinjection', async ({ page }) => {
  await openFixture(page, {
    main: mainPresets,
    feature: JSON.stringify({ schemaVersion: 1, presets: [{ id: 'feature', title: 'Feature', description: 'Feature build', variables: [{ key: 'FEATURE', value: 'yes' }] }] })
  });
  await page.getByRole('button', { name: /Server/ }).click();
  await expect(page.locator('[data-gitlab-fast-pipe-owned="true"]')).toHaveCount(2);
  await page.locator('input[name="ref"]').fill('feature');
  await page.locator('input[name="ref"]').dispatchEvent('change');
  await expect(page.getByRole('button', { name: /Feature/ })).toBeVisible();
  await expect(page.locator('[data-gitlab-fast-pipe-owned="true"]')).toHaveCount(0);
  await page.addScriptTag({ path: contentScript });
  await expect(page.locator('#gfp-root')).toHaveCount(1);
});

test('ignores a delayed response from the previous ref', async ({ page }) => {
  await page.route('https://gitlab.example/**', async (route) => {
    const url = new URL(route.request().url());
    if (!url.pathname.includes('/-/raw/')) {
      await route.fulfill({ status: 200, contentType: 'text/html', body: fixture });
      return;
    }
    if (url.pathname.includes('/-/raw/main/')) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.fulfill({ status: 200, contentType: 'application/json', body: mainPresets }).catch(() => undefined);
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ schemaVersion: 1, presets: [
      { id: 'feature', title: 'Feature', description: 'New ref', variables: [{ key: 'FEATURE', value: 'yes' }] }
    ] }) });
  });
  await page.goto('https://gitlab.example/team/project/-/pipelines/new?ref=main');
  await page.addScriptTag({ path: contentScript });
  await page.locator('input[name="ref"]').fill('feature');
  await expect(page.getByRole('button', { name: /Feature/ })).toBeVisible();
  await page.waitForTimeout(400);
  await expect(page.getByRole('button', { name: /Feature/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Server/ })).toHaveCount(0);
});

test('keeps the native form available when the preset file is missing', async ({ page }) => {
  await page.route('https://gitlab.example/**', async (route) => {
    const url = new URL(route.request().url());
    if (!url.pathname.includes('/-/raw/')) {
      await route.fulfill({ status: 200, contentType: 'text/html', body: fixture });
      return;
    }
    await route.fulfill({ status: 404, body: 'Not found' });
  });
  await page.goto('https://gitlab.example/team/project/-/pipelines/new?ref=main');
  await page.addScriptTag({ path: contentScript });
  await expect(page.locator('.gfp-status')).toContainText('not found');
  await expect(page.getByRole('button', { name: 'Run pipeline' })).toBeEnabled();
  await expect(page.getByTestId('ci-variable-row')).toHaveCount(0);
});

test('shows an incompatible schema separately from an invalid file', async ({ page }) => {
  await page.route('https://gitlab.example/**', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill(url.pathname.includes('/-/raw/')
      ? { status: 200, contentType: 'application/json', body: JSON.stringify({ schemaVersion: 99, presets: [] }) }
      : { status: 200, contentType: 'text/html', body: fixture });
  });
  await page.goto('https://gitlab.example/team/project/-/pipelines/new?ref=main');
  await page.addScriptTag({ path: contentScript });
  await expect(page.locator('.gfp-status')).toContainText('schema version this extension does not support');
  await expect(page.getByRole('button', { name: 'Run pipeline' })).toBeEnabled();
});

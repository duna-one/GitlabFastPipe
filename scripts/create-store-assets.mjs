import { copyFile, mkdir } from "node:fs/promises";
import { Buffer } from "node:buffer";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import sharp from "sharp";

const assets = new URL("../store-assets/", import.meta.url);
const screenshot = new URL("pipeline-presets.png", assets);
const promo = new URL("promo-tile.png", assets);
const listingIcon = new URL("icon-128.png", assets);
const contentScript = fileURLToPath(new URL("../dist/content.js", import.meta.url));
const contentCss = fileURLToPath(new URL("../dist/content.css", import.meta.url));
const browserPath = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const presets = JSON.stringify({ schemaVersion: 1, presets: [
  { group: "Pipeline choices", presets: [
    { id: "web", title: "Web app", description: "Build the browser application", variables: [{ key: "TARGET", value: "web" }, { key: "MODE", value: "preview" }] },
    { id: "mobile", title: "Mobile app", description: "Build the mobile application", variables: [{ key: "TARGET", value: "mobile" }, { key: "MODE", value: "preview" }] },
    { id: "tests", title: "Run tests", description: "Run the automated test suite", variables: [{ key: "CHECKS", value: "tests" }] },
    { id: "analysis", title: "Code analysis", description: "Run static analysis", variables: [{ key: "CHECKS", value: "analysis" }] }
  ] }
] });

const fixture = `<!doctype html>
<html><head><style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #f6f7f9; color: #303030; font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  .topbar { height: 52px; display: flex; align-items: center; padding: 0 44px; background: #2f2a6b; color: #fff; }
  .mark { width: 24px; height: 24px; margin-right: 12px; border-radius: 7px; background: linear-gradient(135deg, #fc6d26 0 48%, #fff 49% 53%, #e24329 54%); }
  .topbar strong { font-size: 16px; } .topbar span { margin-left: auto; color: #d9d6ff; font-size: 13px; }
  .layout { display: grid; grid-template-columns: 208px minmax(0, 1fr); min-height: 748px; }
  aside { padding: 15px 22px; border-right: 1px solid #e1e3e8; background: #fff; color: #666; }
  aside p { margin: 0 0 8px; padding: 9px 10px; border-radius: 6px; } aside p.active { color: #1f75cb; background: #e5f2ff; font-weight: 600; }
  main { padding: 12px 52px; } .crumb { color: #747678; font-size: 13px; } h1 { margin: 4px 0 10px; font-size: 24px; font-weight: 600; }
  .card { max-width: 960px; padding: 14px 28px 16px; border: 1px solid #dcdcde; border-radius: 8px; background: #fff; box-shadow: 0 1px 2px #00000009; }
  .label { display: block; margin-bottom: 6px; color: #454545; font-weight: 600; } .ref { display: flex; align-items: center; width: 278px; height: 36px; padding: 0 12px; border: 1px solid #a8a8a8; border-radius: 6px; background: #fff; }
  .ref b { margin-left: auto; color: #666; font-size: 15px; } .hint { margin: 4px 0 9px; color: #747678; font-size: 12px; }
  #variables { margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e5e5; } #variables h2 { margin: 0 0 3px; font-size: 18px; } .subtitle { margin: 0 0 7px; color: #707070; }
  .variable-row { display: grid; grid-template-columns: 1fr 1fr 36px; gap: 10px; margin: 8px 0; } input { width: 100%; height: 36px; padding: 7px 10px; border: 1px solid #b8b8b8; border-radius: 5px; background: #fff; color: #333; font: inherit; } .remove { border: 0; background: transparent; color: #707070; font-size: 20px; }
  .add { margin-top: 9px; padding: 7px 10px; border: 1px solid #a7a7a7; border-radius: 5px; background: #fff; color: #1f75cb; font: inherit; font-weight: 600; }
  .actions { display: flex; align-items: center; margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e5e5; } .run { padding: 9px 15px; border: 0; border-radius: 6px; color: #fff; background: #1f75cb; font: inherit; font-weight: 600; } .actions span { margin-left: 12px; color: #707070; font-size: 12px; }
</style></head><body>
<header class="topbar"><div class="mark"></div><strong>Code workspace</strong><span>Demo project</span></header>
<div class="layout"><aside><p>Project overview</p><p>Repository</p><p class="active">Build &amp; deploy</p><p>Jobs</p><p>Settings</p></aside><main>
<div class="crumb">Demo project / Build &amp; deploy / Pipelines</div><h1>Run pipeline</h1>
<form class="card"><label class="label">Branch or tag</label><div class="ref">main <b>v</b></div><p class="hint">Choose the version to build.</p>
<section id="variables" data-testid="ci-variables-section"><h2>Variables</h2><p class="subtitle">Add values for this pipeline run.</p><div data-testid="ci-variable-list"></div><button class="add" type="button" data-testid="ci-variable-add-button">Add variable</button></section>
<div class="actions"><button class="run" type="submit">Run pipeline</button><span>Review values before starting.</span></div></form>
</main></div>
<script>
  document.querySelector('form').addEventListener('submit', event => event.preventDefault());
  document.querySelector('[data-testid="ci-variable-add-button"]').addEventListener('click', () => {
    const row = document.createElement('div'); row.className = 'variable-row'; row.dataset.testid = 'ci-variable-row';
    row.innerHTML = '<input name="variables[key]" aria-label="Variable key" placeholder="Key"><input name="variables[value]" aria-label="Variable value" placeholder="Value"><button class="remove" type="button" data-testid="ci-variable-remove-button" aria-label="Remove variable">-</button>';
    row.querySelector('button').addEventListener('click', () => row.remove()); document.querySelector('[data-testid="ci-variable-list"]').append(row);
  });
</script></body></html>`;

/** <summary>Renders sanitized listing images using the compiled extension and a local fixture.</summary> */
async function createAssets() {
  await mkdir(assets, { recursive: true });
  const browser = await chromium.launch({ executablePath: browserPath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await page.route('https://local.demo/**', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill(url.pathname.includes('/-/raw/')
      ? { status: 200, contentType: 'application/json', body: presets }
      : { status: 200, contentType: 'text/html', body: fixture });
  });
  await page.goto('https://local.demo/demo/project/-/pipelines/new?ref=main');
  await page.addStyleTag({ path: contentCss });
  await page.addScriptTag({ path: contentScript });
  await page.getByRole('button', { name: 'Web app', exact: true }).click();
  await page.screenshot({ path: fileURLToPath(screenshot) });
  await browser.close();

  const icon = await sharp(fileURLToPath(new URL('../extension/icon.svg', import.meta.url))).resize(96, 96).png().toBuffer();
  const tile = `<svg width="440" height="280" viewBox="0 0 440 280" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f7fbff"/><stop offset="1" stop-color="#e5f2ff"/></linearGradient></defs>
    <rect width="440" height="280" rx="18" fill="url(#g)"/><path d="M0 218C84 172 143 276 244 214S388 167 440 130V280H0Z" fill="#cfe8ff" opacity=".7"/>
    <text x="130" y="54" fill="#1f2937" font-family="Segoe UI, sans-serif" font-size="23" font-weight="700">Pipeline presets</text><text x="130" y="76" fill="#5f6b7a" font-family="Segoe UI, sans-serif" font-size="13">Choose variables with a click</text>
    <rect x="45" y="104" width="350" height="122" rx="12" fill="#fff" stroke="#c9d6e4"/><rect x="45" y="104" width="350" height="30" rx="12" fill="#f6f8fa"/><circle cx="66" cy="119" r="5" fill="#1f75cb"/><rect x="82" y="114" width="100" height="10" rx="5" fill="#b8c3ce"/>
    <rect x="67" y="148" width="142" height="33" rx="7" fill="#e5f2ff" stroke="#1f75cb"/><rect x="224" y="148" width="142" height="33" rx="7" fill="#f8fafc" stroke="#d1d5db"/><rect x="67" y="190" width="299" height="24" rx="6" fill="#f8fafc" stroke="#d1d5db"/>
    <text x="80" y="169" fill="#1f75cb" font-family="Segoe UI, sans-serif" font-size="13" font-weight="600">Web app</text><text x="238" y="169" fill="#344054" font-family="Segoe UI, sans-serif" font-size="13" font-weight="600">Run tests</text>
    <text x="80" y="206" fill="#667085" font-family="Consolas, monospace" font-size="10">TARGET=web   MODE=preview</text>
  </svg>`;
  await sharp({ create: { width: 440, height: 280, channels: 4, background: '#e5f2ff' } }).composite([{ input: Buffer.from(tile) }, { input: icon, left: 21, top: 18 }]).png().toFile(fileURLToPath(promo));
  await copyFile(new URL('../dist/icons/128.png', import.meta.url), listingIcon);
  for (const [name, expected] of [[screenshot, [1280, 800]], [promo, [440, 280]], [listingIcon, [128, 128]]]) {
    const info = await sharp(fileURLToPath(name)).metadata();
    if (info.width !== expected[0] || info.height !== expected[1]) throw new Error(`Unexpected size for ${fileURLToPath(name)}.`);
  }
}

await createAssets();

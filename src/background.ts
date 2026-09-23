/** <summary>Returns whether the tab is on a GitLab pipeline creation route.</summary> */
export function isPipelinePage(url: URL): boolean {
  return url.protocol === 'https:' && /\/-\/pipelines\/new\/?$/.test(url.pathname);
}

/** <summary>Builds a stable registration identifier for one HTTPS origin.</summary> */
function registrationId(origin: string): string {
  return `gfp-${Array.from(new TextEncoder().encode(origin), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

/** <summary>Registers the content script for future navigations on an approved origin.</summary> */
async function registerOrigin(origin: string): Promise<void> {
  const id = registrationId(origin);
  const registered = await chrome.scripting.getRegisteredContentScripts({ ids: [id] });
  if (registered.length > 0) return;
  await chrome.scripting.registerContentScripts([{
    id,
    matches: [`${origin}/*`],
    js: ['content.js'],
    css: ['content.css'],
    runAt: 'document_idle',
    persistAcrossSessions: true
  }]);
}

/** <summary>Requests permission for the current GitLab site and activates the page.</summary> */
async function enableForTab(tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.id || !tab.url) return;
  let url: URL;
  try {
    url = new URL(tab.url);
  } catch {
    return;
  }
  if (!isPipelinePage(url)) {
    await chrome.action.setBadgeText({ tabId: tab.id, text: '?' });
    await chrome.action.setTitle({ tabId: tab.id, title: 'Open a GitLab Run pipeline page first' });
    return;
  }
  const granted = await chrome.permissions.request({ origins: [`${url.origin}/*`] });
  if (!granted) return;
  await registerOrigin(url.origin);
  await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['content.css'] });
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  await chrome.action.setBadgeText({ tabId: tab.id, text: '' });
}

chrome.action.onClicked.addListener((tab) => {
  void enableForTab(tab).catch((error: unknown) => {
    console.error('Gitlab Fast Pipe could not enable this site.', error);
    if (tab.id) void chrome.action.setBadgeText({ tabId: tab.id, text: '!' });
  });
});

chrome.permissions.onRemoved.addListener((permissions) => {
  const origins = permissions.origins ?? [];
  void chrome.scripting.unregisterContentScripts({ ids: origins.map((origin) => registrationId(new URL(origin).origin)) }).catch(() => undefined);
});

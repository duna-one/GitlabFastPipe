import { beforeEach, describe, expect, it, vi } from 'vitest';

type ActionHandler = (tab: chrome.tabs.Tab) => void;

/** <summary>Builds an isolated Chrome API mock for the action permission flow.</summary> */
function createChromeMock() {
  let actionHandler: ActionHandler | undefined;
  const request = vi.fn().mockResolvedValue(true);
  const registerContentScripts = vi.fn().mockResolvedValue(undefined);
  const executeScript = vi.fn().mockResolvedValue([]);
  const insertCSS = vi.fn().mockResolvedValue(undefined);
  const api = {
    action: {
      onClicked: { addListener: (handler: ActionHandler) => { actionHandler = handler; } },
      setBadgeText: vi.fn().mockResolvedValue(undefined),
      setTitle: vi.fn().mockResolvedValue(undefined)
    },
    permissions: {
      request,
      onRemoved: { addListener: vi.fn() }
    },
    scripting: {
      getRegisteredContentScripts: vi.fn().mockResolvedValue([]),
      registerContentScripts,
      executeScript,
      insertCSS,
      unregisterContentScripts: vi.fn().mockResolvedValue(undefined)
    }
  };
  return { api, request, registerContentScripts, executeScript, action: (tab: chrome.tabs.Tab) => actionHandler?.(tab) };
}

describe('action permission flow', () => {
  beforeEach(() => vi.resetModules());

  it('requests only the current HTTPS origin and activates the current pipeline tab', async () => {
    const mock = createChromeMock();
    vi.stubGlobal('chrome', mock.api);
    await import('../../src/background');
    mock.action({ id: 7, url: 'https://gitlab.example/team/app/-/pipelines/new?ref=main' } as chrome.tabs.Tab);
    await vi.waitFor(() => expect(mock.executeScript).toHaveBeenCalledTimes(1));
    expect(mock.request).toHaveBeenCalledWith({ origins: ['https://gitlab.example/*'] });
    expect(mock.registerContentScripts).toHaveBeenCalledWith([expect.objectContaining({ matches: ['https://gitlab.example/*'] })]);
  });

  it('does not request host access from unrelated pages', async () => {
    const mock = createChromeMock();
    vi.stubGlobal('chrome', mock.api);
    await import('../../src/background');
    mock.action({ id: 7, url: 'https://gitlab.example/team/app/-/pipelines' } as chrome.tabs.Tab);
    await vi.waitFor(() => expect(mock.api.action.setBadgeText).toHaveBeenCalled());
    expect(mock.request).not.toHaveBeenCalled();
  });
});

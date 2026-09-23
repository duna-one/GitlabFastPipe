import { fetchPresets, detectGitLabProjectContext, type GitLabProjectContext } from "../core/gitlab";
import { PresetError, type PipelinePreset } from "../core/presets";
import { VariableForm } from "./form";
import { ensurePanel, findVariablesSection, removePanel, renderPanel, type PanelState } from "./ui";

/**
 * <summary>Coordinates the extension panel with GitLab's SPA page and Variables form.</summary>
 */
class ContentController {
  private abortController: AbortController | undefined;
  private selectionAbortController: AbortController | undefined;
  private form: VariableForm | undefined;
  private currentKey: string | undefined;
  private selectedPresetIds: readonly string[] = [];
  private requestedPresetIds: readonly string[] = [];
  private variablesSection: HTMLElement | undefined;
  private observer: MutationObserver | undefined;
  private refreshQueued = false;
  private refreshEpoch = 0;
  private pendingClear: Promise<void> = Promise.resolve();
  private selectionQueue: Promise<void> = Promise.resolve();
  private selectionEpoch = 0;
  private replayingRefChoice = false;

  /**
   * <summary>Starts SPA navigation and DOM observers, then renders the current form once.</summary>
   */
  public start(): void {
    this.installHistoryListener();
    window.addEventListener("popstate", this.scheduleRefresh);
    window.addEventListener("gfp:navigation", this.scheduleRefresh);
    document.addEventListener("turbo:load", this.scheduleRefresh);
    document.addEventListener("turbo:render", this.scheduleRefresh);
    document.addEventListener("pjax:end", this.scheduleRefresh);
    document.addEventListener("input", this.handleRefEvent, true);
    document.addEventListener("change", this.handleRefEvent, true);
    document.addEventListener("click", this.handleRefChoice, true);
    this.observer = new MutationObserver(this.scheduleRefresh);
    this.observer.observe(document.documentElement, { childList: true, subtree: true });
    window.setInterval(this.scheduleRefresh, 1000);
    void this.refresh();
  }

  /**
   * <summary>Refreshes the UI after a ref, project, page, or Variables container change.</summary>
   */
  private async refresh(): Promise<void> {
    this.refreshQueued = false;
    const variablesSection = this.isRunPipelineRoute() ? findVariablesSection() : null;
    const context = variablesSection ? detectGitLabProjectContext(location.href, document) : null;
    if (!variablesSection || !context) {
      this.reset();
      return;
    }

    const key = `${context.origin}/${context.projectPath}@${context.ref}`;
    const panel = ensurePanel(variablesSection);
    if (key === this.currentKey && variablesSection === this.variablesSection && panel.isConnected) {
      return;
    }

    this.abortController?.abort();
    this.selectionAbortController?.abort();
    ++this.selectionEpoch;
    const previousForm = this.form;
    const epoch = ++this.refreshEpoch;
    this.form = undefined;
    this.currentKey = key;
    this.selectedPresetIds = [];
    this.requestedPresetIds = [];
    this.variablesSection = variablesSection;
    this.pendingClear = this.pendingClear.then(() => previousForm?.clearOwned());
    await this.pendingClear;
    if (epoch !== this.refreshEpoch) return;
    this.form = new VariableForm(variablesSection);
    const abortController = new AbortController();
    this.abortController = abortController;
    this.render({ kind: "loading", projectPath: context.projectPath, ref: context.ref });
    void this.load(context, key, abortController);
  }

  /**
   * <summary>Loads presets and ignores responses that are stale or have been aborted.</summary>
   */
  private async load(
    context: GitLabProjectContext,
    key: string,
    abortController: AbortController,
  ): Promise<void> {
    try {
      const document = await fetchPresets(context, { signal: abortController.signal });
      if (!this.isCurrent(key, abortController)) {
        return;
      }
      this.render({ kind: "loaded", projectPath: context.projectPath, ref: context.ref, presets: document.presets });
    } catch (error) {
      if (!this.isCurrent(key, abortController)) {
        return;
      }
      this.render({
        kind: this.errorKind(error),
        projectPath: context.projectPath,
        ref: context.ref,
      });
    }
  }

  /** <summary>Queues every preset toggle so rapid clicks leave rows and selected state synchronized.</summary> */
  private togglePreset = (preset: PipelinePreset): void => {
    const wasRequested = this.requestedPresetIds.includes(preset.id);
    const requestedPresetIds = wasRequested
      ? this.requestedPresetIds.filter((id) => id !== preset.id)
      : [...this.requestedPresetIds, preset.id];
    this.requestedPresetIds = requestedPresetIds;
    const epoch = this.selectionEpoch;
    this.selectionQueue = this.selectionQueue.then(() => this.applyRequestedSelection(requestedPresetIds, epoch));
  };

  /** <summary>Applies one queued selection unless its form was replaced by navigation.</summary> */
  private async applyRequestedSelection(requestedPresetIds: readonly string[], epoch: number): Promise<void> {
    if (epoch !== this.selectionEpoch) {
      return;
    }
    const abortController = new AbortController();
    this.selectionAbortController = abortController;
    const form = this.form;
    let result: Awaited<ReturnType<VariableForm["applyPresets"]>> | undefined;
    try {
      result = form ? await form.applyPresets(this.selectedPresets(requestedPresetIds), abortController.signal) : undefined;
    } catch {
      result = { applied: false, conflictKeys: [], presetConflictKeys: [], unsupported: true };
    }
    if (!result || !this.currentKey || this.form !== form || this.selectionAbortController !== abortController || epoch !== this.selectionEpoch) {
      return;
    }
    const context = detectGitLabProjectContext(location.href, document);
    if (!context) {
      return;
    }
    if (result.applied) {
      this.selectedPresetIds = requestedPresetIds;
      this.requestedPresetIds = requestedPresetIds;
    } else {
      this.requestedPresetIds = this.selectedPresetIds;
    }
    this.render({
      kind: "loaded",
      projectPath: context.projectPath,
      ref: context.ref,
      presets: this.loadedPresets(),
      selectedPresetIds: this.selectedPresetIds,
      conflictKeys: result.conflictKeys,
      presetConflictKeys: result.presetConflictKeys,
      unsupported: result.unsupported,
    });
  }

  /**
   * <summary>Renders one state and connects the preset toggle action.</summary>
   */
  private render(state: PanelState): void {
    const variablesSection = this.variablesSection;
    if (!variablesSection) {
      return;
    }
    renderPanel(ensurePanel(variablesSection), state, { onToggle: this.togglePreset });
    this.lastState = state;
  }

  private lastState: PanelState | undefined;

  /**
   * <summary>Returns the currently rendered presets when a button redraw is required.</summary>
   */
  private loadedPresets(): readonly PipelinePreset[] {
    return this.lastState?.kind === "loaded" ? this.lastState.presets : [];
  }

  /** <summary>Returns requested presets in document order for deterministic variable aggregation.</summary> */
  private selectedPresets(selectedPresetIds: readonly string[]): readonly PipelinePreset[] {
    const ids = new Set(selectedPresetIds);
    return this.loadedPresets().filter((preset) => ids.has(preset.id));
  }

  /**
   * <summary>Checks whether an asynchronous result still belongs to the active page state.</summary>
   */
  private isCurrent(key: string, abortController: AbortController): boolean {
    return this.currentKey === key && this.abortController === abortController && !abortController.signal.aborted;
  }

  /**
   * <summary>Converts a core fetch error into the UI state understood by the panel.</summary>
   */
  private errorKind(error: unknown): Extract<PanelState, { kind: "missing" | "forbidden" | "format" | "version" | "network" }>["kind"] {
    if (!(error instanceof PresetError)) {
      return "network";
    }
    return error.category === "missing" || error.category === "forbidden" || error.category === "network" || error.category === "version"
      ? error.category
      : "format";
  }

  /**
   * <summary>Removes UI and owned rows when the current page is no longer a Run pipeline form.</summary>
   */
  private reset(): void {
    if (!this.currentKey && !this.form && !this.variablesSection && !this.abortController) return;
    this.abortController?.abort();
    this.selectionAbortController?.abort();
    ++this.selectionEpoch;
    this.selectionAbortController = undefined;
    this.abortController = undefined;
    const previousForm = this.form;
    ++this.refreshEpoch;
    this.pendingClear = this.pendingClear.then(() => previousForm?.clearOwned());
    this.form = undefined;
    this.currentKey = undefined;
    this.selectedPresetIds = [];
    this.requestedPresetIds = [];
    this.variablesSection = undefined;
    this.lastState = undefined;
    removePanel();
  }

  /**
   * <summary>Queues one refresh after batches of GitLab SPA mutations.</summary>
   */
  private scheduleRefresh = (): void => {
    if (this.refreshQueued) {
      return;
    }
    this.refreshQueued = true;
    queueMicrotask(() => void this.refresh());
  };

  /**
   * <summary>Refreshes when GitLab changes the selected ref without replacing its form DOM.</summary>
   */
  private handleRefEvent = (event: Event): void => {
    const target = event.target;
    if (target instanceof HTMLInputElement && (target.name === "ref" || target.name === "ref_name" || target.closest("[data-testid='ref-selector']"))) {
      this.scheduleRefresh();
    }
  };

  /** <summary>Clears owned rows before GitLab replaces the form after a dropdown ref choice.</summary> */
  private handleRefChoice = (event: MouseEvent): void => {
    if (this.replayingRefChoice) return;
    const target = event.target;
    const choice = target instanceof Element
      ? target.closest<HTMLButtonElement>("[data-testid='ref-select'] button[role='menuitem']")
      : null;
    const form = this.form;
    if (!choice || !form?.hasOwnedRows()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void form.clearOwned().then(() => {
      if (!choice.isConnected) return;
      this.replayingRefChoice = true;
      try { choice.click(); } finally { this.replayingRefChoice = false; }
    });
  };

  /**
   * <summary>Limits injection to the GitLab Run pipeline route.</summary>
   */
  private isRunPipelineRoute(): boolean {
    return /\/-\/pipelines\/new\/?$/.test(location.pathname);
  }

  /**
   * <summary>Publishes a navigation event when GitLab changes history without a full page load.</summary>
   */
  private installHistoryListener(): void {
    for (const methodName of ["pushState", "replaceState"] as const) {
      const original = history[methodName];
      history[methodName] = function patchedHistory(...args: Parameters<typeof original>): ReturnType<typeof original> {
        const result = original.apply(this, args);
        window.dispatchEvent(new Event("gfp:navigation"));
        return result;
      };
    }
  }
}

/**
 * <summary>Starts the content controller once for this document.</summary>
 */
function startContentScript(): void {
  const startFlag = "__gfpContentControllerStarted";
  const extensionWindow = window as unknown as Record<string, boolean>;
  if (extensionWindow[startFlag]) {
    return;
  }
  extensionWindow[startFlag] = true;
  new ContentController().start();
}

startContentScript();

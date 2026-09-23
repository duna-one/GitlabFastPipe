/** A variable supplied by a pipeline preset. */
export interface PresetVariable { key: string; value: string; }

/** The part of a preset that is needed to populate GitLab variables. */
export interface VariablePreset { id: string; variables: readonly PresetVariable[]; }

/** The result of an attempt to apply a preset selection. */
export interface ApplyResult {
  applied: boolean;
  conflictKeys: readonly string[];
  presetConflictKeys: readonly string[];
  unsupported: boolean;
}

/** The maximum time given to a GitLab DOM update after clicking Add variable. */
const NATIVE_ROW_TIMEOUT_MS = 500;

/**
 * <summary>Owns rows inserted through GitLab's native Variables controls.</summary>
 */
export class VariableForm {
  private readonly ownedRows = new Set<HTMLElement>();

  /** <summary>Creates a variable form controller for one GitLab Variables container.</summary> */
  public constructor(private readonly container: HTMLElement) { this.restoreOwnedRows(); }

  /** <summary>Applies one preset through native GitLab rows after checking all manual keys.</summary> */
  public async applyPreset(preset: VariablePreset, signal?: AbortSignal): Promise<ApplyResult> {
    return this.applyPresets([preset], signal);
  }

  /** <summary>Atomically applies a deduplicated selection of presets or keeps the current rows on conflict.</summary> */
  public async applyPresets(presets: readonly VariablePreset[], signal?: AbortSignal): Promise<ApplyResult> {
    const aggregate = this.aggregateVariables(presets);
    const conflictKeys = this.findConflictKeys(aggregate.variables);
    if (conflictKeys.length > 0 || aggregate.presetConflictKeys.length > 0) {
      return { applied: false, conflictKeys, presetConflictKeys: aggregate.presetConflictKeys, unsupported: false };
    }
    if (aggregate.variables.length === 0) {
      await this.clearOwned();
      return { applied: true, conflictKeys: [], presetConflictKeys: [], unsupported: false };
    }
    const pendingRows = await this.createAndFillNativeRows(aggregate.variables, signal);
    if (!pendingRows) {
      return { applied: false, conflictKeys: [], presetConflictKeys: [], unsupported: true };
    }
    if (signal?.aborted) {
      await this.removeRows(pendingRows);
      return { applied: false, conflictKeys: [], presetConflictKeys: [], unsupported: true };
    }
    await this.clearOwned();
    if (signal?.aborted) {
      await this.removeRows(pendingRows);
      return { applied: false, conflictKeys: [], presetConflictKeys: [], unsupported: true };
    }
    for (const row of pendingRows) {
      row.dataset.gitlabFastPipeOwned = "true";
      this.ownedRows.add(row);
    }
    return { applied: true, conflictKeys: [], presetConflictKeys: [], unsupported: false };
  }

  /** <summary>Removes only rows previously added through GitLab controls.</summary> */
  public async clearOwned(): Promise<void> {
    await this.removeRows([...this.ownedRows, ...this.getOwnedRowsFromDom()]);
    this.ownedRows.clear();
  }

  /** <summary>Reports whether extension-created Variables rows remain in this form.</summary> */
  public hasOwnedRows(): boolean { return this.ownedRows.size > 0 || this.getOwnedRowsFromDom().length > 0; }

  /** <summary>Finds manual variable keys that would collide with a preset.</summary> */
  private findConflictKeys(variables: readonly PresetVariable[]): string[] {
    const manualKeys = new Set<string>();
    for (const row of this.getVariableRows()) {
      if (!this.isOwned(row)) {
        const key = this.readKey(row);
        if (key) manualKeys.add(key);
      }
    }
    return variables.map((variable) => variable.key).filter((key) => manualKeys.has(key));
  }

  /** <summary>Combines preset variables in caller order and reports keys assigned different values.</summary> */
  private aggregateVariables(presets: readonly VariablePreset[]): { variables: readonly PresetVariable[]; presetConflictKeys: readonly string[] } {
    const valuesByKey = new Map<string, string>();
    const variables: PresetVariable[] = [];
    const presetConflictKeys: string[] = [];
    for (const preset of presets) {
      for (const variable of preset.variables) {
        const currentValue = valuesByKey.get(variable.key);
        if (currentValue === undefined) {
          valuesByKey.set(variable.key, variable.value);
          variables.push(variable);
        } else if (currentValue !== variable.value && !presetConflictKeys.includes(variable.key)) {
          presetConflictKeys.push(variable.key);
        }
      }
    }
    return { variables, presetConflictKeys };
  }

  /** <summary>Creates and fills rows through the supported native GitLab form pattern.</summary> */
  private async createAndFillNativeRows(variables: readonly PresetVariable[], signal?: AbortSignal): Promise<HTMLElement[] | undefined> {
    return this.findAddButton()
      ? this.createRowsWithButton(variables, signal)
      : this.createRowsFromPlaceholders(variables, signal);
  }

  /** <summary>Creates and fills rows through GitLab versions that expose an Add variable button.</summary> */
  private async createRowsWithButton(variables: readonly PresetVariable[], signal?: AbortSignal): Promise<HTMLElement[] | undefined> {
    const addButton = this.findAddButton();
    if (!addButton) return undefined;
    const pendingRows: HTMLElement[] = [];
    for (const variable of variables) {
      const before = new Set(this.getVariableRows());
      addButton.click();
      const row = await this.waitForNativeRow(before, signal);
      if (!row || !this.fillNativeRow(row, variable)) {
        await this.removeRows(pendingRows);
        return undefined;
      }
      pendingRows.push(row);
    }
    return pendingRows;
  }

  /** <summary>Fills GitLab's trailing blank row and waits for the next native placeholder row.</summary> */
  private async createRowsFromPlaceholders(variables: readonly PresetVariable[], signal?: AbortSignal): Promise<HTMLElement[] | undefined> {
    const pendingRows: HTMLElement[] = [];
    for (const variable of variables) {
      const row = this.findBlankPlaceholder();
      const before = new Set(this.getVariableRows());
      if (!row || !this.fillNativeRow(row, variable)) {
        await this.removeRows(pendingRows);
        return undefined;
      }
      pendingRows.push(row);
      const nextPlaceholder = await this.waitForNativeRow(before, signal);
      if (!nextPlaceholder || !this.isBlankRow(nextPlaceholder)) {
        await this.removeRows(pendingRows);
        return undefined;
      }
    }
    return pendingRows;
  }

  /** <summary>Waits briefly for GitLab to render one new Variables row after a native click.</summary> */
  private waitForNativeRow(before: ReadonlySet<HTMLElement>, signal?: AbortSignal): Promise<HTMLElement | undefined> {
    const immediate = this.getVariableRows().find((candidate) => !before.has(candidate));
    if (immediate) return Promise.resolve(immediate);
    if (signal?.aborted) return Promise.resolve(undefined);
    return new Promise((resolve) => {
      const finish = (row: HTMLElement | undefined): void => {
        observer.disconnect();
        window.clearTimeout(timeoutId);
        signal?.removeEventListener("abort", abort);
        resolve(row);
      };
      const observer = new MutationObserver(() => {
        const row = this.getVariableRows().find((candidate) => !before.has(candidate));
        if (row) finish(row);
      });
      const abort = (): void => finish(undefined);
      const timeoutId = window.setTimeout(() => finish(undefined), NATIVE_ROW_TIMEOUT_MS);
      observer.observe(this.container, { childList: true, subtree: true });
      signal?.addEventListener("abort", abort, { once: true });
    });
  }

  /** <summary>Fills one GitLab key and value row using native setters and events.</summary> */
  private fillNativeRow(row: HTMLElement, variable: PresetVariable): boolean {
    const keyInput = this.findKeyInput(row);
    const valueInput = this.findValueInput(row);
    if (!keyInput || !valueInput) return false;
    this.setNativeValue(keyInput, variable.key);
    this.setNativeValue(valueInput, variable.value);
    return true;
  }

  /** <summary>Sets a controlled input through its prototype setter and emits GitLab-facing events.</summary> */
  private setNativeValue(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
    const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  /** <summary>Removes extension rows through GitLab's native remove controls.</summary> */
  private async removeRows(rows: readonly HTMLElement[]): Promise<void> {
    const connectedRows = [...new Set(rows)].filter((row) => this.container.contains(row));
    // Clear the native form model before a removal can make GitLab reuse a row.
    for (const row of connectedRows) {
      const key = this.findKeyInput(row);
      const value = this.findValueInput(row);
      if (key) this.setNativeValue(key, "");
      if (value) this.setNativeValue(value, "");
    }
    for (const row of connectedRows.reverse()) {
      if (!this.container.contains(row)) continue;
      const remove = row.querySelector<HTMLButtonElement>("[data-testid='remove-ci-variable-row'], [data-testid='ci-variable-remove-button'], .js-ci-variable-remove, button[aria-label*='Remove'], button[aria-label*='Delete']");
      if (remove) {
        remove.click();
        // Vue updates row indices after the event loop; the next click must use the updated form.
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      }
      // GitLab keeps its sole Variables row and hides its remove button.
      if (this.container.contains(row)) delete row.dataset.gitlabFastPipeOwned;
    }
  }

  /** <summary>Restores references when GitLab keeps extension rows across a DOM redraw.</summary> */
  private restoreOwnedRows(): void { for (const row of this.getOwnedRowsFromDom()) this.ownedRows.add(row); }

  /** <summary>Returns GitLab rows that contain both a key and a value input.</summary> */
  private getVariableRows(): HTMLElement[] {
    return Array.from(this.container.querySelectorAll<HTMLElement>("[data-testid='ci-variable-row'], .js-ci-variable-row, .ci-variable-row"))
      .filter((row) => Boolean(this.findKeyInput(row) && this.findValueInput(row)));
  }

  /** <summary>Finds GitLab's unfilled trailing row that can be used as a native placeholder.</summary> */
  private findBlankPlaceholder(): HTMLElement | undefined {
    return this.getVariableRows().find((row) => !this.isOwned(row) && this.isBlankRow(row));
  }

  /** <summary>Checks whether a GitLab row contains no key or value entered by the user.</summary> */
  private isBlankRow(row: HTMLElement): boolean {
    return !this.readKey(row) && !this.findValueInput(row)?.value.trim();
  }

  /** <summary>Finds GitLab's native control for adding one Variables row.</summary> */
  private findAddButton(): HTMLButtonElement | null {
    return this.container.querySelector<HTMLButtonElement>("[data-testid='ci-variable-add-button'], .js-ci-variable-add, button[aria-label='Add variable']");
  }

  /** <summary>Returns rows marked as created by this extension.</summary> */
  private getOwnedRowsFromDom(): HTMLElement[] { return Array.from(this.container.querySelectorAll<HTMLElement>("[data-gitlab-fast-pipe-owned='true']")); }

  /** <summary>Reads the key from a row using GitLab input conventions.</summary> */
  private readKey(row: Element): string | undefined { return this.findKeyInput(row)?.value.trim() || undefined; }

  /** <summary>Locates a GitLab variable key input without relying on one release's markup.</summary> */
  private findKeyInput(row: Element): HTMLInputElement | null {
    return row.querySelector<HTMLInputElement>("[data-testid='pipeline-form-ci-variable-key'], [data-testid='ci-variable-key'] input, input[name*='key'], input[placeholder='Key'], input[aria-label='Variable key']");
  }

  /** <summary>Locates a GitLab variable value input without relying on one release's markup.</summary> */
  private findValueInput(row: Element): HTMLInputElement | HTMLTextAreaElement | null {
    return row.querySelector<HTMLInputElement | HTMLTextAreaElement>("[data-testid='pipeline-form-ci-variable-value'], [data-testid='ci-variable-value'] input, input[name*='value'], textarea[name*='value'], input[placeholder='Value'], textarea[placeholder='Value'], input[aria-label='Variable value'], textarea[aria-label='Variable value']");
  }

  /** <summary>Checks the durable DOM marker used for extension-owned rows.</summary> */
  private isOwned(row: Element): boolean { return row.getAttribute("data-gitlab-fast-pipe-owned") === "true"; }
}

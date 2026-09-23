/** A variable supplied by a pipeline preset. */
export interface PresetVariable { key: string; value: string; }

/** The part of a preset that is needed to populate GitLab variables. */
export interface VariablePreset { id: string; variables: readonly PresetVariable[]; }

/** The result of an attempt to apply a preset. */
export interface ApplyResult { applied: boolean; conflictKeys: readonly string[]; unsupported: boolean; }

/** The maximum time given to a GitLab DOM update after clicking Add variable. */
const NATIVE_ROW_TIMEOUT_MS = 500;

/**
 * <summary>Owns rows inserted through GitLab's native Variables controls.</summary>
 */
export class VariableForm {
  private readonly ownedRows = new Set<HTMLElement>();

  /** <summary>Creates a variable form controller for one GitLab Variables container.</summary> */
  public constructor(private readonly container: HTMLElement) { this.restoreOwnedRows(); }

  /** <summary>Applies a preset through native GitLab rows after checking all manual keys.</summary> */
  public async applyPreset(preset: VariablePreset, signal?: AbortSignal): Promise<ApplyResult> {
    const conflictKeys = this.findConflictKeys(preset.variables);
    if (conflictKeys.length > 0) return { applied: false, conflictKeys, unsupported: false };
    const pendingRows = await this.createNativeRows(preset.variables.length, signal);
    if (!pendingRows || !this.fillNativeRows(pendingRows, preset.variables)) {
      this.removeRows(pendingRows ?? []);
      return { applied: false, conflictKeys: [], unsupported: true };
    }
    if (signal?.aborted) {
      this.removeRows(pendingRows);
      return { applied: false, conflictKeys: [], unsupported: true };
    }
    this.clearOwned();
    for (const row of pendingRows) {
      row.dataset.gitlabFastPipeOwned = "true";
      this.ownedRows.add(row);
    }
    return { applied: true, conflictKeys: [], unsupported: false };
  }

  /** <summary>Removes only rows previously added through GitLab controls.</summary> */
  public clearOwned(): void {
    this.removeRows([...this.ownedRows, ...this.getOwnedRowsFromDom()]);
    this.ownedRows.clear();
  }

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

  /** <summary>Creates native rows and rolls back all rows if GitLab cannot create every one.</summary> */
  private async createNativeRows(count: number, signal?: AbortSignal): Promise<HTMLElement[] | undefined> {
    const addButton = this.findAddButton();
    if (!addButton) return undefined;
    const pendingRows: HTMLElement[] = [];
    for (let index = 0; index < count; index += 1) {
      const before = new Set(this.getVariableRows());
      addButton.click();
      const row = await this.waitForNativeRow(before, signal);
      if (!row) {
        this.removeRows(pendingRows);
        return undefined;
      }
      pendingRows.push(row);
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

  /** <summary>Fills GitLab key and value inputs using native setters and events.</summary> */
  private fillNativeRows(rows: readonly HTMLElement[], variables: readonly PresetVariable[]): boolean {
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const variable = variables[index];
      if (!row || !variable) return false;
      const keyInput = this.findKeyInput(row);
      const valueInput = this.findValueInput(row);
      if (!keyInput || !valueInput) return false;
      this.setNativeValue(keyInput, variable.key);
      this.setNativeValue(valueInput, variable.value);
    }
    return true;
  }

  /** <summary>Sets a controlled input through its prototype setter and emits GitLab-facing events.</summary> */
  private setNativeValue(input: HTMLInputElement, value: string): void {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  /** <summary>Removes extension rows through GitLab's native remove controls.</summary> */
  private removeRows(rows: readonly HTMLElement[]): void {
    for (const row of new Set(rows)) {
      row.querySelector<HTMLButtonElement>("[data-testid='ci-variable-remove-button'], .js-ci-variable-remove, button[aria-label*='Remove'], button[aria-label*='Delete']")?.click();
    }
  }

  /** <summary>Restores references when GitLab keeps extension rows across a DOM redraw.</summary> */
  private restoreOwnedRows(): void { for (const row of this.getOwnedRowsFromDom()) this.ownedRows.add(row); }

  /** <summary>Returns GitLab rows that contain both a key and a value input.</summary> */
  private getVariableRows(): HTMLElement[] {
    return Array.from(this.container.querySelectorAll<HTMLElement>("[data-testid='ci-variable-row'], .js-ci-variable-row, .ci-variable-row"))
      .filter((row) => Boolean(this.findKeyInput(row) && this.findValueInput(row)));
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
    return row.querySelector<HTMLInputElement>("[data-testid='ci-variable-key'] input, input[name*='key'], input[placeholder='Key'], input[aria-label='Variable key']");
  }

  /** <summary>Locates a GitLab variable value input without relying on one release's markup.</summary> */
  private findValueInput(row: Element): HTMLInputElement | null {
    return row.querySelector<HTMLInputElement>("[data-testid='ci-variable-value'] input, input[name*='value'], input[placeholder='Value'], input[aria-label='Variable value']");
  }

  /** <summary>Checks the durable DOM marker used for extension-owned rows.</summary> */
  private isOwned(row: Element): boolean { return row.getAttribute("data-gitlab-fast-pipe-owned") === "true"; }
}

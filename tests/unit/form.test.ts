import { beforeEach, describe, expect, it } from "vitest";
import { VariableForm, type VariablePreset } from "../../src/content/form";

const serverPreset: VariablePreset = { id: "server", variables: [{ key: "SERVER", value: "1" }] };
const androidPreset: VariablePreset = { id: "server-android", variables: [{ key: "SERVER", value: "1" }, { key: "ANDROID", value: "1" }] };

/** <summary>Appends one native GitLab-compatible row and its remove control.</summary> */
function appendNativeRow(container: HTMLElement, key = "", value = ""): HTMLElement {
  const row = document.createElement("div");
  row.dataset.testid = "ci-variable-row";
  const keyInput = document.createElement("input");
  keyInput.name = "variables[key]";
  keyInput.value = key;
  const valueInput = document.createElement("input");
  valueInput.name = "variables[value]";
  valueInput.value = value;
  const remove = document.createElement("button");
  remove.type = "button";
  remove.dataset.testid = "ci-variable-remove-button";
  remove.addEventListener("click", () => row.remove());
  row.append(keyInput, valueInput, remove);
  container.append(row);
  return row;
}

/** <summary>Appends a current-GitLab placeholder row that grows after a value is entered.</summary> */
function appendAutoAddRow(container: HTMLElement): HTMLElement {
  const row = document.createElement("div");
  row.dataset.testid = "ci-variable-row";
  const key = document.createElement("input");
  key.dataset.testid = "pipeline-form-ci-variable-key";
  const value = document.createElement("textarea");
  value.dataset.testid = "pipeline-form-ci-variable-value";
  const remove = document.createElement("button");
  remove.type = "button";
  remove.dataset.testid = "remove-ci-variable-row";
  remove.setAttribute("aria-label", "Remove variable");
  remove.addEventListener("click", () => row.remove());
  value.addEventListener("input", () => {
    if (!row.dataset.expanded && key.value && value.value) {
      row.dataset.expanded = "true";
      queueMicrotask(() => appendAutoAddRow(container));
    }
  });
  row.append(key, value, remove);
  container.append(row);
  return row;
}

/** <summary>Creates a Variables fixture whose add button behaves like GitLab's row control.</summary> */
function variablesFixture(manualKeys: readonly string[] = []): HTMLElement {
  document.body.innerHTML = `<section data-testid="ci-variables-section"><h2>Variables</h2><button type="button" data-testid="ci-variable-add-button">Add variable</button></section>`;
  const container = document.querySelector<HTMLElement>("[data-testid='ci-variables-section']");
  if (!container) throw new Error("Variables fixture was not created.");
  for (const key of manualKeys) appendNativeRow(container, key, "manual-value");
  container.querySelector<HTMLButtonElement>("[data-testid='ci-variable-add-button']")?.addEventListener("click", () => appendNativeRow(container));
  return container;
}

/** <summary>Creates the current GitLab form where filling a placeholder produces the next one.</summary> */
function autoAddVariablesFixture(manualKeys: readonly string[] = []): HTMLElement {
  document.body.innerHTML = `<section data-testid="ci-variables-section"><h2>Variables</h2></section>`;
  const container = document.querySelector<HTMLElement>("[data-testid='ci-variables-section']");
  if (!container) throw new Error("Variables fixture was not created.");
  for (const key of manualKeys) {
    const row = appendAutoAddRow(container);
    const keyInput = row.querySelector<HTMLInputElement>("[data-testid='pipeline-form-ci-variable-key']");
    const valueInput = row.querySelector<HTMLTextAreaElement>("[data-testid='pipeline-form-ci-variable-value']");
    if (!keyInput || !valueInput) throw new Error("Auto-add fixture row was not created.");
    keyInput.value = key;
    valueInput.value = "manual-value";
    row.dataset.expanded = "true";
  }
  appendAutoAddRow(container);
  return container;
}

/** <summary>Returns keys from rows marked as extension-owned.</summary> */
function ownedKeys(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll<HTMLElement>("[data-gitlab-fast-pipe-owned='true']"))
    .map((row) => row.querySelector<HTMLInputElement>("[data-testid='pipeline-form-ci-variable-key'], input[name*='key']")?.value ?? "");
}

describe("VariableForm", () => {
  beforeEach(() => { document.body.replaceChildren(); });

  it("adds real GitLab rows only after an explicit preset application", async () => {
    const container = variablesFixture(["MANUAL"]);
    const form = new VariableForm(container);

    await expect(form.applyPreset(serverPreset)).resolves.toEqual({ applied: true, conflictKeys: [], unsupported: false });
    expect(ownedKeys(container)).toEqual(["SERVER"]);
    expect(container.querySelectorAll("[data-testid='ci-variable-row']")).toHaveLength(2);
    expect(container.querySelector<HTMLInputElement>("[data-gitlab-fast-pipe-owned='true'] input[name*='value']")?.value).toBe("1");
  });

  it("uses GitLab's blank placeholder rows when no Add variable button exists", async () => {
    const container = autoAddVariablesFixture(["MANUAL"]);
    const form = new VariableForm(container);

    await expect(form.applyPreset(androidPreset)).resolves.toEqual({ applied: true, conflictKeys: [], unsupported: false });
    expect(ownedKeys(container)).toEqual(["SERVER", "ANDROID"]);
    expect(container.querySelectorAll("[data-testid='ci-variable-row']")).toHaveLength(4);
    expect(container.querySelector<HTMLTextAreaElement>("[data-gitlab-fast-pipe-owned='true'] textarea")?.value).toBe("1");
  });

  it("clears both auto-added rows and keeps the native blank row", async () => {
    const container = autoAddVariablesFixture();
    const form = new VariableForm(container);
    await form.applyPreset(androidPreset);

    await form.clearOwned();

    expect(ownedKeys(container)).toEqual([]);
    expect(container.querySelectorAll("[data-testid='ci-variable-row']")).toHaveLength(1);
    expect(container.querySelector<HTMLInputElement>("[data-testid='pipeline-form-ci-variable-key']")?.value).toBe("");
    expect(container.querySelector<HTMLTextAreaElement>("[data-testid='pipeline-form-ci-variable-value']")?.value).toBe("");
  });

  it("clears an owned sole row when GitLab hides its remove button", async () => {
    const container = autoAddVariablesFixture();
    const row = container.querySelector<HTMLElement>("[data-testid='ci-variable-row']");
    if (!row) throw new Error("Placeholder row was not created.");
    row.querySelector("[data-testid='remove-ci-variable-row']")?.remove();
    row.dataset.gitlabFastPipeOwned = "true";
    row.querySelector<HTMLInputElement>("[data-testid='pipeline-form-ci-variable-key']")!.value = "ANDROID";
    row.querySelector<HTMLTextAreaElement>("[data-testid='pipeline-form-ci-variable-value']")!.value = "1";

    await new VariableForm(container).clearOwned();

    expect(ownedKeys(container)).toEqual([]);
    expect(row.querySelector<HTMLInputElement>("[data-testid='pipeline-form-ci-variable-key']")?.value).toBe("");
    expect(row.querySelector<HTMLTextAreaElement>("[data-testid='pipeline-form-ci-variable-value']")?.value).toBe("");
  });

  it("rolls back a filled placeholder when GitLab does not add the next placeholder", async () => {
    const container = autoAddVariablesFixture();
    const placeholder = container.querySelector<HTMLElement>("[data-testid='ci-variable-row']");
    if (!placeholder) throw new Error("Placeholder row was not created.");
    placeholder.dataset.expanded = "true";
    const form = new VariableForm(container);

    await expect(form.applyPreset(serverPreset)).resolves.toEqual({ applied: false, conflictKeys: [], unsupported: true });
    expect(container.querySelectorAll("[data-testid='ci-variable-row']")).toHaveLength(0);
  });

  it("does not partially change owned rows when any manual key conflicts", async () => {
    const container = variablesFixture(["ANDROID"]);
    const form = new VariableForm(container);
    await form.applyPreset(serverPreset);

    await expect(form.applyPreset(androidPreset)).resolves.toEqual({ applied: false, conflictKeys: ["ANDROID"], unsupported: false });
    expect(ownedKeys(container)).toEqual(["SERVER"]);
  });

  it("replaces only extension rows when choosing another preset", async () => {
    const container = variablesFixture(["MANUAL"]);
    const form = new VariableForm(container);
    await form.applyPreset(serverPreset);

    await expect(form.applyPreset(androidPreset)).resolves.toEqual({ applied: true, conflictKeys: [], unsupported: false });
    expect(ownedKeys(container)).toEqual(["SERVER", "ANDROID"]);
    expect(container.querySelectorAll("[data-testid='ci-variable-row']")).toHaveLength(3);
  });

  it("does not insert a synthetic row if GitLab's native add control is unavailable", async () => {
    const container = variablesFixture();
    container.querySelector("[data-testid='ci-variable-add-button']")?.remove();
    const form = new VariableForm(container);

    await expect(form.applyPreset(serverPreset)).resolves.toEqual({ applied: false, conflictKeys: [], unsupported: true });
    expect(container.querySelectorAll("[data-testid='ci-variable-row']")).toHaveLength(0);
  });

  it("clears owned rows while retaining rows the user entered", async () => {
    const container = variablesFixture(["MANUAL"]);
    const form = new VariableForm(container);
    await form.applyPreset(androidPreset);
    await form.clearOwned();

    expect(ownedKeys(container)).toEqual([]);
    expect(container.querySelectorAll("[data-testid='ci-variable-row']")).toHaveLength(1);
  });

  it("rolls back rows already added when a later native add does not create a row", async () => {
    const container = variablesFixture();
    const add = container.querySelector<HTMLButtonElement>("[data-testid='ci-variable-add-button']");
    let clicks = 0;
    add?.replaceWith(add.cloneNode(true));
    const replacement = container.querySelector<HTMLButtonElement>("[data-testid='ci-variable-add-button']");
    replacement?.addEventListener("click", () => {
      clicks += 1;
      if (clicks === 1) appendNativeRow(container);
    });
    const form = new VariableForm(container);

    await expect(form.applyPreset(androidPreset)).resolves.toEqual({ applied: false, conflictKeys: [], unsupported: true });
    expect(container.querySelectorAll("[data-testid='ci-variable-row']")).toHaveLength(0);
  });
});

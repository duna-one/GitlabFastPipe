import type { PipelinePreset } from "../core/presets";

/** The UI state shown while presets are being obtained for a ref. */
export type PanelState =
  | { kind: "loading"; projectPath: string; ref: string }
  | { kind: "loaded"; projectPath: string; ref: string; presets: readonly PipelinePreset[]; selectedPresetId?: string; conflictKeys?: readonly string[]; unsupported?: boolean }
  | { kind: "missing"; projectPath: string; ref: string }
  | { kind: "forbidden"; projectPath: string; ref: string }
  | { kind: "format"; projectPath: string; ref: string }
  | { kind: "version"; projectPath: string; ref: string }
  | { kind: "network"; projectPath: string; ref: string };

/** Callbacks for user actions within the extension panel. */
export interface PanelActions {
  onSelect(preset: PipelinePreset): void;
  onClear(): void;
}

/** The durable id used to make injection idempotent. */
export const PANEL_ID = "gfp-root";

/**
 * <summary>Creates or reuses the panel directly before GitLab's Variables section.</summary>
 */
export function ensurePanel(variablesSection: HTMLElement): HTMLElement {
  const existing = document.getElementById(PANEL_ID);
  if (existing) {
    if (existing.nextElementSibling !== variablesSection) {
      variablesSection.before(existing);
    }
    return existing;
  }

  const panel = document.createElement("section");
  panel.id = PANEL_ID;
  panel.className = "gfp-panel gl-mt-5 gl-mb-5";
  panel.setAttribute("aria-live", "polite");
  variablesSection.before(panel);
  return panel;
}

/**
 * <summary>Renders a safe text-only preset panel for the current loading state.</summary>
 */
export function renderPanel(panel: HTMLElement, state: PanelState, actions: PanelActions): void {
  panel.replaceChildren();
  panel.append(createHeading(state));

  if (state.kind === "loaded") {
    panel.append(createLoadedContent(state, actions));
    return;
  }

  panel.append(createStatusMessage(state));
}

/**
 * <summary>Removes a previously injected panel when leaving the Run pipeline form.</summary>
 */
export function removePanel(): void {
  document.getElementById(PANEL_ID)?.remove();
}

/**
 * <summary>Finds the Variables container across supported GitLab form layouts.</summary>
 */
export function findVariablesSection(page: ParentNode = document): HTMLElement | null {
  const explicit = page.querySelector<HTMLElement>(
    "[data-testid='ci-variables-section'], [data-testid='variables-section'], #variables",
  );
  if (explicit) {
    return explicit;
  }

  for (const heading of page.querySelectorAll<HTMLElement>("h2, h3, legend, label")) {
    if (heading.textContent?.trim().toLowerCase() === "variables") {
      return heading.closest<HTMLElement>("section, fieldset, .form-group, .gl-form-group, div") ?? null;
    }
  }
  return null;
}

/**
 * <summary>Builds the panel title and identifies the ref whose presets are displayed.</summary>
 */
function createHeading(state: PanelState): HTMLElement {
  const header = document.createElement("header");
  const title = document.createElement("h2");
  title.textContent = "GitLab Fast Pipe";
  const context = document.createElement("p");
  context.className = "gfp-context";
  context.textContent = `${state.projectPath} · ${state.ref}`;
  header.append(title, context);
  return header;
}

/**
 * <summary>Builds preset buttons, conflict feedback, and the clear-selection action.</summary>
 */
function createLoadedContent(state: Extract<PanelState, { kind: "loaded" }>, actions: PanelActions): HTMLElement {
  const content = document.createElement("div");
  content.className = "gfp-list";

  if (state.conflictKeys && state.conflictKeys.length > 0) {
    const conflict = document.createElement("p");
    conflict.className = "gfp-conflict gfp-error gl-text-danger";
    conflict.textContent = `Variables already entered manually: ${state.conflictKeys.join(", ")}. Remove or rename them before choosing this preset.`;
    content.append(conflict);
  }
  if (state.unsupported) {
    const unsupported = document.createElement("p");
    unsupported.className = "gfp-error";
    unsupported.textContent = "This GitLab Variables form is not supported. You can still enter variables manually.";
    content.append(unsupported);
  }

  for (const preset of state.presets) {
    content.append(createPresetButton(preset, preset.id === state.selectedPresetId, actions));
  }

  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "gfp-clear btn btn-default gl-mt-3";
  clear.textContent = "Clear selection";
  clear.disabled = !state.selectedPresetId;
  clear.addEventListener("click", actions.onClear);
  content.append(clear);
  return content;
}

/**
 * <summary>Creates one preset control using text nodes for all remote configuration.</summary>
 */
function createPresetButton(preset: PipelinePreset, selected: boolean, actions: PanelActions): HTMLElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "gfp-preset btn btn-default gl-display-block gl-text-left gl-mb-3";
  button.dataset.gitlabFastPipePresetId = preset.id;
  button.setAttribute("aria-pressed", String(selected));

  const title = document.createElement("strong");
  title.textContent = preset.title;
  const description = document.createElement("span");
  description.className = "gfp-description gl-display-block";
  description.textContent = preset.description;
  const variables = document.createElement("span");
  variables.className = "gfp-variable gl-display-block gl-text-subtle";
  variables.textContent = preset.variables.map((variable) => `${variable.key}=${variable.value}`).join("; ");

  button.append(title, description, variables);
  button.addEventListener("click", () => actions.onSelect(preset));
  return button;
}

/**
 * <summary>Creates a distinct user-facing message for each non-loaded state.</summary>
 */
function createStatusMessage(state: Exclude<PanelState, { kind: "loaded" }>): HTMLElement {
  const message = document.createElement("p");
  message.className = state.kind === "loading" ? "gfp-status" : "gfp-status gfp-error";
  message.textContent = getStatusText(state.kind);
  return message;
}

/**
 * <summary>Maps internal errors to short messages that leave GitLab's form usable.</summary>
 */
function getStatusText(kind: Exclude<PanelState["kind"], "loaded">): string {
  switch (kind) {
    case "loading":
      return "Loading presets…";
    case "missing":
      return "Preset file .gitlab-fast-pipe/presets.json was not found for this ref.";
    case "forbidden":
      return "You do not have access to read presets for this ref.";
    case "format":
      return "The preset file has an unsupported or invalid format.";
    case "version":
      return "The preset file uses a schema version this extension does not support.";
    case "network":
      return "Could not load presets because of a network error. You can still run the pipeline manually.";
  }
}

import type { PipelinePreset } from "../core/presets";

/** The UI state shown while presets are being obtained for a ref. */
export type PanelState =
  | { kind: "loading"; projectPath: string; ref: string }
  | { kind: "loaded"; projectPath: string; ref: string; presets: readonly PipelinePreset[]; selectedPresetIds?: readonly string[]; conflictKeys?: readonly string[]; presetConflictKeys?: readonly string[]; unsupported?: boolean }
  | { kind: "missing"; projectPath: string; ref: string }
  | { kind: "forbidden"; projectPath: string; ref: string }
  | { kind: "format"; projectPath: string; ref: string }
  | { kind: "version"; projectPath: string; ref: string }
  | { kind: "network"; projectPath: string; ref: string };

/** Callbacks for user actions within the extension panel. */
export interface PanelActions {
  /** <summary>Toggles one preset while preserving the other selected presets.</summary> */
  onToggle(preset: PipelinePreset): void;
}

/** The durable id used to make injection idempotent. */
export const PANEL_ID = "gfp-root";
const PANEL_TITLE_ID = `${PANEL_ID}-title`;

/**
 * <summary>Creates or reuses the panel directly before GitLab's Variables section.</summary>
 */
export function ensurePanel(variablesSection: HTMLElement): HTMLElement {
  const existing = document.getElementById(PANEL_ID);
  if (existing) {
    existing.removeAttribute("aria-live");
    existing.setAttribute("aria-labelledby", PANEL_TITLE_ID);
    existing.dataset.gfpTheme = detectHostTheme(variablesSection);
    if (existing.nextElementSibling !== variablesSection) {
      variablesSection.before(existing);
    }
    return existing;
  }

  const panel = document.createElement("section");
  panel.id = PANEL_ID;
  panel.className = "gfp-panel gl-mt-5 gl-mb-5";
  panel.dataset.gfpRuntime = "async-removal";
  panel.dataset.gfpTheme = detectHostTheme(variablesSection);
  panel.setAttribute("aria-labelledby", PANEL_TITLE_ID);
  variablesSection.before(panel);
  return panel;
}

/** <summary>Matches the panel palette to GitLab's visible page background.</summary> */
function detectHostTheme(anchor: Element): "light" | "dark" {
  for (let element: Element | null = anchor; element; element = element.parentElement) {
    const color = getComputedStyle(element).backgroundColor;
    const components = color.match(/[\d.]+/g)?.map(Number);
    const [red, green, blue, alpha] = components ?? [];
    if (red === undefined || green === undefined || blue === undefined || (alpha !== undefined && alpha < 0.95)) continue;
    const brightness = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    return brightness < 128 ? "dark" : "light";
  }
  return "light";
}

/**
 * <summary>Renders a safe text-only preset panel for the current loading state.</summary>
 */
export function renderPanel(panel: HTMLElement, state: PanelState, actions: PanelActions): void {
  const focusedElement = document.activeElement;
  const focusWasInsidePanel = focusedElement instanceof HTMLElement && panel.contains(focusedElement);
  const focusedPresetId = focusWasInsidePanel ? focusedElement?.getAttribute("data-gitlab-fast-pipe-preset-id") : null;

  panel.replaceChildren();
  panel.append(createHeading());

  if (state.kind === "loaded") {
    panel.append(createLoadedContent(state, actions));
  } else {
    panel.append(createStatusMessage(state));
  }

  if (focusWasInsidePanel) {
    const focusedControl = focusedPresetId
      ? Array.from(panel.querySelectorAll<HTMLElement>("[data-gitlab-fast-pipe-preset-id]"))
        .find((candidate) => candidate.getAttribute("data-gitlab-fast-pipe-preset-id") === focusedPresetId)
      : null;
    (focusedControl ?? panel.querySelector<HTMLElement>(`#${PANEL_TITLE_ID}`))?.focus();
  }
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

/** <summary>Builds the panel title.</summary> */
function createHeading(): HTMLElement {
  const header = document.createElement("header");
  const title = document.createElement("h2");
  title.id = PANEL_TITLE_ID;
  title.tabIndex = -1;
  title.textContent = "GitLab Fast Pipe";
  header.append(title);
  return header;
}

/**
 * <summary>Builds preset buttons, selection details, and conflict feedback.</summary>
 */
function createLoadedContent(state: Extract<PanelState, { kind: "loaded" }>, actions: PanelActions): HTMLElement {
  const content = document.createElement("div");
  content.className = "gfp-list";

  if (state.conflictKeys && state.conflictKeys.length > 0) {
    const conflict = document.createElement("p");
    conflict.className = "gfp-conflict gfp-error gl-text-danger";
    conflict.setAttribute("role", "alert");
    conflict.textContent = `Variables already entered manually: ${state.conflictKeys.join(", ")}. Remove or rename them before choosing this preset.`;
    content.append(conflict);
  }
  if (state.presetConflictKeys && state.presetConflictKeys.length > 0) {
    const conflict = document.createElement("p");
    conflict.className = "gfp-conflict gfp-error gl-text-danger";
    conflict.setAttribute("role", "alert");
    conflict.textContent = `The selected presets use different values for: ${state.presetConflictKeys.join(", ")}.`;
    content.append(conflict);
  }
  if (state.unsupported) {
    const unsupported = document.createElement("p");
    unsupported.className = "gfp-error";
    unsupported.setAttribute("role", "status");
    unsupported.textContent = "This GitLab Variables form is not supported. You can still enter variables manually.";
    content.append(unsupported);
  }

  const presets = document.createElement("div");
  presets.className = "gfp-presets";
  const selectedPresetIds = new Set(state.selectedPresetIds);
  for (const preset of state.presets) {
    presets.append(createPresetButton(preset, selectedPresetIds.has(preset.id), actions));
  }
  content.append(presets);

  const selectedPresets = state.presets.filter((preset) => selectedPresetIds.has(preset.id));
  if (selectedPresets.length > 0) {
    content.append(createSelectedPresetDetails(selectedPresets));
  }

  if (selectedPresets.length > 0) {
    const status = document.createElement("p");
    status.className = "gfp-selection-status";
    status.setAttribute("role", "status");
    status.textContent = `${selectedPresets.length} preset${selectedPresets.length === 1 ? "" : "s"} selected: ${selectedPresets.map((preset) => preset.title).join(", ")}.`;
    content.append(status);
  }
  return content;
}

/**
 * <summary>Creates one preset control using text nodes for all remote configuration.</summary>
 */
function createPresetButton(preset: PipelinePreset, selected: boolean, actions: PanelActions): HTMLElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "gfp-preset btn btn-default";
  button.dataset.gitlabFastPipePresetId = preset.id;
  button.setAttribute("aria-pressed", String(selected));
  button.setAttribute("aria-label", preset.title);

  const title = document.createElement("strong");
  title.textContent = preset.title;
  button.append(title);
  button.addEventListener("click", () => actions.onToggle(preset));
  return button;
}

/**
 * <summary>Creates safe text details for every selected preset.</summary>
 */
function createSelectedPresetDetails(presets: readonly PipelinePreset[]): HTMLElement {
  const details = document.createElement("div");
  details.className = "gfp-selected-details";

  for (const preset of presets) {
    const presetDetails = document.createElement("article");
    presetDetails.className = "gfp-selected-preset";

    const title = document.createElement("h3");
    title.textContent = preset.title;
    const description = document.createElement("p");
    description.className = "gfp-description";
    description.textContent = preset.description;
    const variables = document.createElement("p");
    variables.className = "gfp-variable gl-text-subtle";
    variables.textContent = preset.variables.map((variable) => `${variable.key}=${variable.value}`).join("; ");

    presetDetails.append(title, description, variables);
    details.append(presetDetails);
  }
  return details;
}

/**
 * <summary>Creates a distinct user-facing message for each non-loaded state.</summary>
 */
function createStatusMessage(state: Exclude<PanelState, { kind: "loaded" }>): HTMLElement {
  const message = document.createElement("p");
  message.className = state.kind === "loading" ? "gfp-status" : "gfp-status gfp-error";
  message.setAttribute("role", state.kind === "loading" ? "status" : "alert");
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

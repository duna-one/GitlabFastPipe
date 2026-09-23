import { MAX_PRESETS_JSON_BYTES, parsePresetsJson, PresetError, type PresetsDocument } from "./presets";

export const PRESETS_FILE_PATH = ".gitlab-fast-pipe/presets.json";

export interface GitLabProjectContext {
  origin: string;
  projectPath: string;
  ref: string;
}

export interface PresetsFetchOptions {
  fetch?: typeof fetch;
  signal?: AbortSignal;
}

interface MinimalDocument {
  querySelector(selector: string): Element | null;
}

/** <summary>Builds the same-origin GitLab raw-file URL for a project ref.</summary> */
export function buildPresetsRawUrl(context: Pick<GitLabProjectContext, "origin" | "projectPath" | "ref">): string {
  const origin = new URL(context.origin).origin;
  const projectPath = normalizeProjectPath(context.projectPath);
  const ref = requireRef(context.ref);
  const encodedPath = projectPath.split("/").map(encodeURIComponent).join("/");
  const encodedRef = encodeURIComponent(ref);
  const encodedFile = PRESETS_FILE_PATH.split("/").map(encodeURIComponent).join("/");
  return `${origin}/${encodedPath}/-/raw/${encodedRef}/${encodedFile}`;
}

/** <summary>Loads, bounds-checks, and validates presets through the current GitLab session.</summary> */
export async function fetchPresets(
  context: Pick<GitLabProjectContext, "origin" | "projectPath" | "ref">,
  options: PresetsFetchOptions = {},
): Promise<PresetsDocument> {
  const url = buildPresetsRawUrl(context);
  const fetcher = options.fetch ?? globalThis.fetch;
  let response: Response;
  try {
    response = await fetcher(url, { credentials: "same-origin", signal: options.signal });
  } catch (error) {
    if (error instanceof PresetError) {
      throw error;
    }
    throw new PresetError("network", "Could not load preset file from GitLab.");
  }

  if (response.status === 404) {
    throw new PresetError("missing", "Preset file was not found in this ref.");
  }
  if (response.status === 401 || response.status === 403) {
    throw new PresetError("forbidden", "You do not have access to the preset file.");
  }
  if (!response.ok) {
    throw new PresetError("network", `GitLab returned HTTP ${response.status}.`);
  }
  if (isSignInRedirect(response)) {
    throw new PresetError("forbidden", "GitLab redirected to its sign-in page.");
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength !== null && Number(contentLength) > MAX_PRESETS_JSON_BYTES) {
    throw new PresetError("format", "Preset file exceeds the allowed size.");
  }
  try {
    return parsePresetsJson(await readBoundedResponseText(response));
  } catch (error) {
    if (error instanceof PresetError) {
      throw error;
    }
    throw new PresetError("format", "Preset file could not be read.");
  }
}

/** <summary>Identifies an authentication redirect returned as a successful HTML response.</summary> */
function isSignInRedirect(response: Response): boolean {
  if (!response.redirected || !response.url) {
    return false;
  }
  try {
    return new URL(response.url).pathname.endsWith("/users/sign_in");
  } catch {
    return false;
  }
}

/** <summary>Reads a response stream while enforcing the preset file size limit.</summary> */
async function readBoundedResponseText(response: Response): Promise<string> {
  if (response.body === null) {
    return "";
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) {
        return text + decoder.decode();
      }
      size += chunk.value.byteLength;
      if (size > MAX_PRESETS_JSON_BYTES) {
        await reader.cancel();
        throw new PresetError("format", "Preset file exceeds the allowed size.");
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}

/** <summary>Finds the current project and ref from a GitLab page URL and its form DOM.</summary> */
export function detectGitLabProjectContext(pageUrl: string, document: MinimalDocument): GitLabProjectContext | null {
  let url: URL;
  try {
    url = new URL(pageUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") {
    return null;
  }

  const projectPath = projectPathFromUrl(url) ?? projectPathFromDom(document);
  const ref = refFromDom(document) ?? refFromUrl(url);
  if (!projectPath || !ref) {
    return null;
  }
  return { origin: url.origin, projectPath, ref };
}

/** <summary>Extracts a GitLab namespace and project path before the /-/ route marker.</summary> */
function projectPathFromUrl(url: URL): string | null {
  const marker = "/-/";
  const index = url.pathname.indexOf(marker);
  if (index <= 1) {
    return null;
  }
  const path = url.pathname.slice(1, index);
  try {
    return normalizeProjectPath(decodeURIComponent(path));
  } catch {
    return null;
  }
}

/** <summary>Reads GitLab project metadata exposed by the current page DOM.</summary> */
function projectPathFromDom(document: MinimalDocument): string | null {
  const element = document.querySelector("[data-project-full-path]")
    ?? document.querySelector("meta[name='gitlab-project-full-path']");
  const value = element?.getAttribute("data-project-full-path") ?? element?.getAttribute("content");
  try {
    return value ? normalizeProjectPath(value) : null;
  } catch {
    return null;
  }
}

/** <summary>Reads a ref explicitly represented in the page URL.</summary> */
function refFromUrl(url: URL): string | null {
  const ref = url.searchParams.get("ref");
  return ref && ref.trim().length > 0 ? ref : null;
}

/** <summary>Reads the selected ref from common GitLab form controls.</summary> */
function refFromDom(document: MinimalDocument): string | null {
  const element = document.querySelector("input[name='ref']")
    ?? document.querySelector("input[name='ref_name']")
    ?? document.querySelector("[data-testid='ref-selector'] input");
  const inputValue = element instanceof HTMLInputElement ? element.value : null;
  const value = inputValue ?? element?.getAttribute("value") ?? element?.getAttribute("data-ref");
  return value && value.trim().length > 0 ? value : null;
}

/** <summary>Validates a repository-relative GitLab project path.</summary> */
function normalizeProjectPath(value: string): string {
  const path = value.replace(/^\/+|\/+$/g, "");
  if (!path || path.split("/").some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    throw new TypeError("Project path must contain non-empty path segments.");
  }
  return path;
}

/** <summary>Validates the selected ref before it is added to a URL.</summary> */
function requireRef(value: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError("Ref must be a non-empty string.");
  }
  return value;
}

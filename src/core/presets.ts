/** Preset JSON validation and data types. */

export const PRESETS_SCHEMA_VERSION = 1;
export const MAX_PRESETS_JSON_BYTES = 256 * 1024;
export const MAX_PRESETS_COUNT = 100;
export const MAX_VARIABLES_PER_PRESET = 50;

export type PresetErrorCategory = "missing" | "forbidden" | "network" | "format" | "version";

export interface PresetVariable {
  key: string;
  value: string;
}

export interface PipelinePreset {
  id: string;
  title: string;
  description: string;
  variables: readonly PresetVariable[];
}

export interface PresetGroup {
  group: string;
  presets: readonly PipelinePreset[];
}

export type PresetEntry = PipelinePreset | PresetGroup;

export interface PresetsDocument {
  schemaVersion: typeof PRESETS_SCHEMA_VERSION;
  presets: readonly PresetEntry[];
}

/** Describes a safe, user-displayable preset loading failure. */
export class PresetError extends Error {
  public readonly category: PresetErrorCategory;

  /** <summary>Creates a categorized preset error.</summary> */
  public constructor(category: PresetErrorCategory, message: string) {
    super(message);
    this.name = "PresetError";
    this.category = category;
  }
}

/** <summary>Parses and strictly validates the presets JSON document.</summary> */
export function parsePresetsJson(json: string): PresetsDocument {
  if (utf8Length(json) > MAX_PRESETS_JSON_BYTES) {
    throw formatError(`Preset file exceeds ${MAX_PRESETS_JSON_BYTES} bytes.`);
  }

  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw formatError("Preset file is not valid JSON.");
  }

  if (!isPlainRecord(value)) {
    throw formatError("Preset file must contain an object.");
  }
  if (value.schemaVersion !== PRESETS_SCHEMA_VERSION) {
    throw new PresetError("version", `Unsupported presets schema version: ${String(value.schemaVersion)}.`);
  }
  assertExactKeys(value, ["schemaVersion", "presets"], "preset file");
  if (!Array.isArray(value.presets) || value.presets.length === 0) {
    throw formatError("Preset file must contain a non-empty presets array.");
  }
  if (value.presets.length > MAX_PRESETS_COUNT) {
    throw formatError(`Preset file contains more than ${MAX_PRESETS_COUNT} presets.`);
  }

  const presetIds = new Set<string>();
  let flatPresetCount = 0;
  const presets = value.presets.map((entry, entryIndex) => {
    const entryNumber = entryIndex + 1;
    if (!isPlainRecord(entry)) {
      throw formatError(`Preset entry ${entryNumber} must be an object.`);
    }
    if ("group" in entry) {
      assertExactKeys(entry, ["group", "presets"], `preset group ${entryNumber}`);
      const group = requireNonEmptyString(entry.group, `Preset group ${entryNumber} name`);
      if (!Array.isArray(entry.presets) || entry.presets.length === 0) {
        throw formatError(`Preset group ${group} must contain a non-empty presets array.`);
      }
      const groupPresets = entry.presets.map((preset, presetIndex) => {
        flatPresetCount = assertFlatPresetLimit(flatPresetCount + 1);
        return parseFlatPreset(preset, `preset ${presetIndex + 1} in group ${group}`, presetIds);
      });
      return Object.freeze({ group, presets: Object.freeze(groupPresets) });
    }

    flatPresetCount = assertFlatPresetLimit(flatPresetCount + 1);
    return parseFlatPreset(entry, `preset ${entryNumber}`, presetIds);
  });

  return Object.freeze({ schemaVersion: PRESETS_SCHEMA_VERSION, presets: Object.freeze(presets) });
}

/** <summary>Validates and freezes a flat preset entry.</summary> */
function parseFlatPreset(value: unknown, subject: string, presetIds: Set<string>): PipelinePreset {
  if (!isPlainRecord(value)) {
    throw formatError(`${capitalize(subject)} must be an object.`);
  }
  assertExactKeys(value, ["id", "title", "description", "variables"], subject);
  const id = requireNonEmptyString(value.id, `${capitalize(subject)} id`);
  if (presetIds.has(id)) {
    throw formatError(`Duplicate preset id: ${id}.`);
  }
  presetIds.add(id);

  if (!Array.isArray(value.variables) || value.variables.length === 0) {
    throw formatError(`Preset ${id} must contain a non-empty variables array.`);
  }
  if (value.variables.length > MAX_VARIABLES_PER_PRESET) {
    throw formatError(`Preset ${id} contains more than ${MAX_VARIABLES_PER_PRESET} variables.`);
  }

  const keys = new Set<string>();
  const variables = value.variables.map((variable, variableIndex) => {
    if (!isPlainRecord(variable)) {
      throw formatError(`Variable ${variableIndex + 1} in preset ${id} must be an object.`);
    }
    assertExactKeys(variable, ["key", "value"], `variable ${variableIndex + 1} in preset ${id}`);
    const key = requireNonEmptyString(variable.key, `Variable ${variableIndex + 1} key in preset ${id}`);
    if (keys.has(key)) {
      throw formatError(`Duplicate variable key ${key} in preset ${id}.`);
    }
    keys.add(key);
    if (typeof variable.value !== "string") {
      throw formatError(`Variable ${key} value in preset ${id} must be a string.`);
    }
    return Object.freeze({ key, value: variable.value });
  });

  return Object.freeze({
    id,
    title: requireNonEmptyString(value.title, `Preset ${id} title`),
    description: requireNonEmptyString(value.description, `Preset ${id} description`),
    variables: Object.freeze(variables),
  });
}

/** <summary>Enforces the document-wide number of flat preset tiles.</summary> */
function assertFlatPresetLimit(count: number): number {
  if (count > MAX_PRESETS_COUNT) {
    throw formatError(`Preset file contains more than ${MAX_PRESETS_COUNT} presets.`);
  }
  return count;
}

/** <summary>Capitalizes the beginning of an error-message subject.</summary> */
function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

/** <summary>Creates a format error with a stable category.</summary> */
function formatError(message: string): PresetError {
  return new PresetError("format", message);
}

/** <summary>Checks whether a value is a non-array object.</summary> */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** <summary>Rejects unknown or missing fields from a schema object.</summary> */
function assertExactKeys(value: Record<string, unknown>, expected: readonly string[], subject: string): void {
  const actual = Object.keys(value);
  if (actual.length !== expected.length || actual.some((key) => !expected.includes(key))) {
    throw formatError(`Unexpected or missing fields in ${subject}.`);
  }
}

/** <summary>Validates a required non-blank string field.</summary> */
function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw formatError(`${field} must be a non-empty string.`);
  }
  return value;
}

/** <summary>Returns the UTF-8 byte count without relying on Node APIs.</summary> */
function utf8Length(value: string): number {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value).byteLength;
  }
  return unescape(encodeURIComponent(value)).length;
}

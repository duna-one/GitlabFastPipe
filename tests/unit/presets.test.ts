import { describe, expect, it } from "vitest";
import { MAX_PRESETS_JSON_BYTES, MAX_PRESETS_COUNT, MAX_VARIABLES_PER_PRESET, parsePresetsJson, PresetError } from "../../src/core/presets";

/** <summary>Builds a minimal valid preset JSON document for parser tests.</summary> */
function validDocument(): string {
  return JSON.stringify({ schemaVersion: 1, presets: [{ id: "server", title: "Server", description: "Build server", variables: [{ key: "SERVER", value: "1" }] }] });
}

describe("parsePresetsJson", () => {
  it("preserves preset and variable order", () => {
    const result = parsePresetsJson(validDocument());
    expect(result.presets.at(0)?.variables.at(0)).toEqual({ key: "SERVER", value: "1" });
  });

  it.each(["{}", JSON.stringify({ schemaVersion: 2, presets: [] })])("reports unsupported versions", (json) => {
    expect(() => parsePresetsJson(json)).toThrow(expect.objectContaining({ category: "version" }));
  });

  it.each([
    JSON.stringify({ schemaVersion: 1, presets: [] }),
    JSON.stringify({ schemaVersion: 1, presets: [{ id: "x", title: "x", description: "x", variables: [] }] }),
    JSON.stringify({ schemaVersion: 1, presets: [{ id: "x", title: "x", description: "x", variables: [{ key: "", value: "1" }] }] }),
    JSON.stringify({ schemaVersion: 1, presets: [{ id: "x", title: "x", description: "x", variables: [{ key: "A", value: 1 }] }] }),
  ])("rejects invalid required fields", (json) => {
    expect(() => parsePresetsJson(json)).toThrow(expect.objectContaining({ category: "format" }));
  });

  it("rejects duplicate ids and duplicate variable keys", () => {
    const duplicateId = JSON.stringify({ schemaVersion: 1, presets: [JSON.parse(validDocument()).presets[0], JSON.parse(validDocument()).presets[0]] });
    const duplicateKey = JSON.stringify({ schemaVersion: 1, presets: [{ id: "x", title: "x", description: "x", variables: [{ key: "A", value: "1" }, { key: "A", value: "2" }] }] });
    for (const json of [duplicateId, duplicateKey]) {
      expect(() => parsePresetsJson(json)).toThrow(PresetError);
    }
  });

  it("enforces preset and variable limits", () => {
    const preset = JSON.parse(validDocument()).presets[0];
    expect(() => parsePresetsJson(JSON.stringify({ schemaVersion: 1, presets: Array(MAX_PRESETS_COUNT + 1).fill(preset) }))).toThrow(PresetError);
    preset.variables = Array(MAX_VARIABLES_PER_PRESET + 1).fill({ key: "A", value: "1" });
    expect(() => parsePresetsJson(JSON.stringify({ schemaVersion: 1, presets: [preset] }))).toThrow(PresetError);
  });

  it("rejects files beyond the UTF-8 size limit", () => {
    expect(() => parsePresetsJson(`${validDocument()}${" ".repeat(MAX_PRESETS_JSON_BYTES)}`))
      .toThrow(expect.objectContaining({ category: "format" }));
  });
});

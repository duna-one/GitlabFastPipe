import { describe, expect, it } from "vitest";
import { MAX_PRESETS_JSON_BYTES, MAX_PRESETS_COUNT, MAX_VARIABLES_PER_PRESET, parsePresetsJson, PresetError } from "../../src/core/presets";

/** <summary>Builds a minimal valid preset JSON document for parser tests.</summary> */
function validDocument(): string {
  return JSON.stringify({ schemaVersion: 1, presets: [{ id: "server", title: "Server", description: "Build server", variables: [{ key: "SERVER", value: "1" }] }] });
}

/** <summary>Builds a valid flat preset with a distinct identifier.</summary> */
function validPreset(id: string): object {
  return { id, title: id, description: `${id} description`, variables: [{ key: "SERVER", value: id }] };
}

describe("parsePresetsJson", () => {
  it("preserves preset and variable order", () => {
    const result = parsePresetsJson(validDocument());
    const entry = result.presets.at(0);
    expect(entry && !("group" in entry) && entry.variables.at(0)).toEqual({ key: "SERVER", value: "1" });
  });

  it("accepts flat presets and groups in their original order", () => {
    const result = parsePresetsJson(JSON.stringify({
      schemaVersion: 1,
      presets: [validPreset("first"), { group: "Deploy", presets: [validPreset("second"), validPreset("third")] }, validPreset("fourth")],
    }));

    expect(result.presets.map((entry) => "group" in entry ? entry.group : entry.id)).toEqual(["first", "Deploy", "fourth"]);
    expect("group" in result.presets[1]! && result.presets[1].presets.map((preset) => preset.id)).toEqual(["second", "third"]);
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

  it.each([
    { group: " ", presets: [validPreset("one")] },
    { group: "Deploy", presets: [] },
    { group: "Deploy", presets: [validPreset("one")], extra: true },
    { group: "Outer", presets: [{ group: "Inner", presets: [validPreset("one")] }] },
  ])("rejects invalid preset groups", (entry) => {
    expect(() => parsePresetsJson(JSON.stringify({ schemaVersion: 1, presets: [entry] }))).toThrow(expect.objectContaining({ category: "format" }));
  });

  it("rejects duplicate ids across flat presets and groups", () => {
    expect(() => parsePresetsJson(JSON.stringify({
      schemaVersion: 1,
      presets: [validPreset("same"), { group: "Deploy", presets: [validPreset("same")] }],
    }))).toThrow(expect.objectContaining({ category: "format" }));
  });

  it("enforces preset and variable limits", () => {
    const preset = JSON.parse(validDocument()).presets[0];
    expect(() => parsePresetsJson(JSON.stringify({ schemaVersion: 1, presets: Array(MAX_PRESETS_COUNT + 1).fill(preset) }))).toThrow(PresetError);
    preset.variables = Array(MAX_VARIABLES_PER_PRESET + 1).fill({ key: "A", value: "1" });
    expect(() => parsePresetsJson(JSON.stringify({ schemaVersion: 1, presets: [preset] }))).toThrow(PresetError);
  });

  it("enforces top-level entry and document-wide flat preset limits", () => {
    expect(() => parsePresetsJson(JSON.stringify({
      schemaVersion: 1,
      presets: Array.from({ length: MAX_PRESETS_COUNT + 1 }, (_, index) => validPreset(`entry-${index}`)),
    }))).toThrow(PresetError);
    expect(() => parsePresetsJson(JSON.stringify({
      schemaVersion: 1,
      presets: [{ group: "All", presets: Array.from({ length: MAX_PRESETS_COUNT + 1 }, (_, index) => validPreset(`tile-${index}`)) }],
    }))).toThrow(PresetError);
  });

  it("rejects files beyond the UTF-8 size limit", () => {
    expect(() => parsePresetsJson(`${validDocument()}${" ".repeat(MAX_PRESETS_JSON_BYTES)}`))
      .toThrow(expect.objectContaining({ category: "format" }));
  });
});

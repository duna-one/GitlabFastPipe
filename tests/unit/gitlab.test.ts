import { describe, expect, it, vi } from "vitest";
import { buildPresetsRawUrl, detectGitLabProjectContext, fetchPresets } from "../../src/core/gitlab";

/** <summary>Returns a valid raw response body for fetch tests.</summary> */
function validBody(): string {
  return JSON.stringify({ schemaVersion: 1, presets: [{ id: "server", title: "Server", description: "Build", variables: [{ key: "SERVER", value: "1" }] }] });
}

describe("GitLab preset loading", () => {
  it("encodes a nested project path and slash-containing ref", () => {
    expect(buildPresetsRawUrl({ origin: "https://gitlab.example.test", projectPath: "team/tools/project", ref: "feature/foo" }))
      .toBe("https://gitlab.example.test/team/tools/project/-/raw/feature%2Ffoo/.gitlab-fast-pipe/presets.json");
  });

  it("uses session credentials and the supplied abort signal", async () => {
    const signal = new AbortController().signal;
    const fetcher = vi.fn().mockResolvedValue(new Response(validBody(), { status: 200 }));
    await fetchPresets({ origin: "https://gitlab.example.test", projectPath: "group/project", ref: "main" }, { fetch: fetcher, signal });
    expect(fetcher).toHaveBeenCalledWith(
      "https://gitlab.example.test/group/project/-/raw/main/.gitlab-fast-pipe/presets.json",
      { credentials: "same-origin", signal },
    );
  });

  it.each([[404, "missing"], [401, "forbidden"], [403, "forbidden"], [500, "network"]] as const)("maps HTTP %s to %s", async (status, category) => {
    await expect(fetchPresets({ origin: "https://gitlab.example.test", projectPath: "group/project", ref: "main" }, {
      fetch: vi.fn().mockResolvedValue(new Response("", { status })),
    })).rejects.toMatchObject({ category });
  });

  it("stops reading a body that exceeds the size limit", async () => {
    const chunk = new Uint8Array(256 * 1024 + 1);
    const response = new Response(new ReadableStream({ start(controller) { controller.enqueue(chunk); controller.close(); } }));
    await expect(fetchPresets({ origin: "https://gitlab.example.test", projectPath: "group/project", ref: "main" }, {
      fetch: vi.fn().mockResolvedValue(response),
    })).rejects.toMatchObject({ category: "format" });
  });

  it("treats a successful redirect to sign-in as forbidden", async () => {
    const response = new Response(validBody());
    Object.defineProperties(response, {
      redirected: { value: true },
      url: { value: "https://gitlab.example.test/users/sign_in" },
    });
    await expect(fetchPresets({ origin: "https://gitlab.example.test", projectPath: "group/project", ref: "main" }, {
      fetch: vi.fn().mockResolvedValue(response),
    })).rejects.toMatchObject({ category: "forbidden" });
  });

  it("uses the URL project path and DOM ref without a fixed GitLab host", () => {
    const document = { querySelector: vi.fn((selector: string) => selector === "input[name='ref']" ? { getAttribute: () => "release/1.0" } : null) } as unknown as Document;
    expect(detectGitLabProjectContext("https://code.example.test/team/tools/project/-/pipelines/new", document))
      .toEqual({ origin: "https://code.example.test", projectPath: "team/tools/project", ref: "release/1.0" });
  });
});

import test from "node:test";
import assert from "node:assert/strict";
import { YoucomProvider, buildYoucomSearchUrl } from "../src/host/providers/youcom.ts";

test("YoucomProvider search sends no API key and uses the keyless GET endpoint", async () => {
  let capturedUrl = "";
  let capturedHeaders: Record<string, string> = {};

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    capturedUrl = typeof url === "string" ? url : (url as URL).href;
    capturedHeaders = (init?.headers as Record<string, string>) || {};
    return {
      status: 200,
      ok: true,
      json: async () => ({
        results: {
          web: [
            { url: "https://example.com/a", title: "A", snippets: ["snippet a"], page_age: "2026-10-01" },
            { url: "https://example.com/b", title: "B", description: "desc b" },
          ],
        },
      }),
    } as unknown as Response;
  }) as typeof globalThis.fetch;

  try {
    const outcome = await YoucomProvider.search("rust async", 10, "", undefined);

    // Keyless endpoint with query + max_results as query-string params
    const u = new URL(capturedUrl);
    assert.equal(u.origin + u.pathname, "https://api.you.com/v1/agents/search");
    assert.equal(u.searchParams.get("query"), "rust async");
    assert.equal(u.searchParams.get("max_results"), "10");

    // No auth header — this is a keyless provider
    assert.equal(capturedHeaders["x-api-key"], undefined);
    // User-Agent carries the integration slug for You.com attribution
    assert.ok(capturedHeaders["user-agent"]?.includes("youdotcom-integration/a3boy-dsh-web-tools"));

    // Parsed from results.web[]
    assert.equal(outcome.sources.length, 2);
    assert.equal(outcome.sources[0].url, "https://example.com/a");
    assert.equal(outcome.sources[0].snippet, "snippet a");
    assert.equal(outcome.sources[0].publishedAt, "2026-10-01");
    assert.equal(outcome.sources[1].snippet, "desc b");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("YoucomProvider search caps results at maxResults and drops items without a URL", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    return {
      status: 200,
      ok: true,
      json: async () => ({
        results: {
          web: [
            { url: "https://example.com/1", title: "1" },
            { url: "https://example.com/2", title: "2" },
            { url: "https://example.com/3", title: "3" },
            { title: "no url — must be dropped" },
            { url: "https://example.com/4", title: "4" },
          ],
        },
      }),
    } as unknown as Response;
  }) as typeof globalThis.fetch;

  try {
    const outcome = await YoucomProvider.search("test", 3, "", undefined);
    assert.equal(outcome.sources.length, 3);
    assert.equal(outcome.sources[0].url, "https://example.com/1");
    assert.equal(outcome.sources[2].url, "https://example.com/3");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("YoucomProvider search throws on non-OK response", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    return { status: 429, ok: false, headers: new Headers(), json: async () => ({}) } as unknown as Response;
  }) as typeof globalThis.fetch;

  try {
    await assert.rejects(
      () => YoucomProvider.search("test", 10, "", undefined),
      /You.com \(Free\) failed/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("YoucomProvider fetch is not supported on the free tier", async () => {
  await assert.rejects(
    () => YoucomProvider.fetch("https://example.com", "", undefined),
    /does not provide native fetch/,
  );
});

test("buildYoucomSearchUrl caps max_results at 20 and floors at 1", () => {
  const url = buildYoucomSearchUrl("q", 100, undefined);
  assert.equal(new URL(url).searchParams.get("max_results"), "20");

  const urlLow = buildYoucomSearchUrl("q", 0, undefined);
  assert.equal(new URL(urlLow).searchParams.get("max_results"), "1");
});
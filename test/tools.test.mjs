// Unit tests against a local fake of the API (node:http). No network.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, beforeEach, test } from "node:test";

import { Agent } from "@mastra/core/agent";
import { MockLanguageModelV4, mockValues } from "ai/test";

import { createContextFetchContentsTool, createContextFetchSearchTool, createContextFetchTools } from "../dist/index.js";

let server, baseUrl, requests, reply;

before(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      requests.push({ path: req.url, headers: req.headers, body: raw ? JSON.parse(raw) : null });
      res.writeHead(reply[0], { "content-type": "application/json" });
      res.end(JSON.stringify(reply[1]));
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

const RESULT = { url: "https://example.com/", title: "Example", publishedDate: null, prunedContext: "chunk" };

beforeEach(() => {
  requests = [];
  reply = [200, { results: [{ ...RESULT, score: 0.5 }], costDollars: { total: 0.001 } }];
});

test("createContextFetchTools returns both tools", () => {
  const tools = createContextFetchTools({ apiKey: "cf_test", baseUrl });
  assert.equal(tools.contextfetchSearch.id, "contextfetch-search");
  assert.equal(tools.contextfetchContents.id, "contextfetch-contents");
  for (const t of Object.values(tools)) {
    assert.ok(t.description);
    assert.ok(t.inputSchema);
    assert.ok(t.outputSchema);
  }
});

test("search sends the query, filters and default content", async () => {
  const out = await createContextFetchSearchTool({ apiKey: "cf_test", baseUrl }).execute({
    query: "pgvector hnsw",
    includeDomains: ["github.com"],
  });
  assert.deepEqual(out, { results: [RESULT] });
  const [r] = requests;
  assert.equal(r.path, "/v1/search");
  assert.equal(r.headers.authorization, "Bearer cf_test");
  assert.deepEqual(r.body, {
    query: "pgvector hnsw",
    numResults: 5,
    includeDomains: ["github.com"],
    contents: { pruned_context: true },
  });
});

test("search options: numResults and content type", async () => {
  await createContextFetchSearchTool({ apiKey: "cf_test", baseUrl, numResults: 2, content: "highlights" }).execute({ query: "q" });
  assert.equal(requests[0].body.numResults, 2);
  assert.deepEqual(requests[0].body.contents, { highlights: true });
});

test("invalid input is rejected before any request", async () => {
  const out = await createContextFetchContentsTool({ baseUrl }).execute({ urls: [] });
  assert.equal(out.error, true);
  assert.equal(requests.length, 0);
});

test("contents without a query asks for the whole page", async () => {
  reply = [200, { results: [{ url: "https://example.com/", text: "# Example" }], statuses: [{ id: "https://example.com/", status: "success" }] }];
  const out = await createContextFetchContentsTool({ apiKey: "cf_test", baseUrl }).execute({ urls: ["https://example.com/"] });
  assert.equal(out.results[0].text, "# Example");
  assert.equal(out.statuses[0].status, "success");
  assert.equal(requests[0].path, "/v1/contents");
  assert.deepEqual(requests[0].body, { urls: ["https://example.com/"], text: true });
});

test("contents with a query asks for the relevant parts only", async () => {
  await createContextFetchContentsTool({ apiKey: "cf_test", baseUrl }).execute({ urls: ["https://example.com/"], query: "pricing" });
  assert.deepEqual(requests[0].body, { urls: ["https://example.com/"], text: false, pruned_context: { query: "pricing" } });
});

test("API errors reach the caller", async () => {
  reply = [401, { error: "invalid_api_key", message: "Unknown key." }];
  await assert.rejects(createContextFetchSearchTool({ apiKey: "bad", baseUrl }).execute({ query: "q" }), /HTTP 401/);
});

test("works as a Mastra agent tool", async () => {
  const usage = {
    inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 1, text: 1, reasoning: 0 },
  };
  const model = new MockLanguageModelV4({
    doGenerate: mockValues(
      {
        content: [{ type: "tool-call", toolCallId: "c1", toolName: "webSearch", input: JSON.stringify({ query: "pgvector" }) }],
        finishReason: { unified: "tool-calls", raw: undefined },
        usage,
        warnings: [],
      },
      { content: [{ type: "text", text: "done" }], finishReason: { unified: "stop", raw: undefined }, usage, warnings: [] },
    ),
  });
  const agent = new Agent({
    id: "research",
    name: "research",
    instructions: "Search the web.",
    model,
    tools: { webSearch: createContextFetchSearchTool({ apiKey: "cf_test", baseUrl }) },
  });
  const out = await agent.generate("search", { maxSteps: 3 });
  assert.equal(out.text, "done");
  assert.equal(requests[0].body.query, "pgvector");
  assert.deepEqual(out.toolResults[0].payload.result, { results: [RESULT] });
});

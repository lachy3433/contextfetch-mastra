// Live smoke test against the real API. Runs only when CONTEXTFETCH_API_KEY is set; uses about 2 credits.
import assert from "node:assert/strict";
import { test } from "node:test";

import { createContextFetchTools } from "../dist/index.js";

const skip = !process.env.CONTEXTFETCH_API_KEY && "CONTEXTFETCH_API_KEY not set";
const { contextfetchSearch, contextfetchContents } = createContextFetchTools({ numResults: 3 });

test("live: search", { skip }, async () => {
  const { results } = await contextfetchSearch.execute({ query: "python asyncio timeout" });
  assert.ok(results.length > 0);
  assert.ok(results[0].prunedContext);
});

test("live: contents", { skip }, async () => {
  const { results } = await contextfetchContents.execute({ urls: ["https://peps.python.org/pep-0020/"] });
  assert.match(results[0].text, /Beautiful is better than ugly/);
});

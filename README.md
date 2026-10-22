# @contextfetch/mastra

[ContextFetch](https://contextfetch.dev) web search and page contents tools for [Mastra](https://mastra.ai) agents.

- `createContextFetchSearchTool()` (id `contextfetch-search`): web search; each result carries its title, URL,
  published date and page content as Markdown (by default only the parts relevant to the query).
- `createContextFetchContentsTool()` (id `contextfetch-contents`): reads web pages as Markdown; with a `query`, only
  the parts of each page relevant to it.
- `createContextFetchTools()`: both, with shared options.

## Install

```bash
npm install @contextfetch/mastra @mastra/core zod
```

Set `CONTEXTFETCH_API_KEY` ([get a key](https://contextfetch.dev)). Without a key, requests use the keyless tier
(a small daily allowance per IP).

## Usage

```ts
import { Agent } from "@mastra/core/agent";
import { createContextFetchTools } from "@contextfetch/mastra";

export const researchAgent = new Agent({
  id: "research-agent",
  name: "Research Agent",
  model: "openai/gpt-5-mini",
  instructions: "Search the web, read the best sources, then answer with their URLs.",
  tools: createContextFetchTools(),
});
```

## Options

All factories take `apiKey` (default: the `CONTEXTFETCH_API_KEY` env var), `baseUrl` and `timeoutMs`. The search
tool also takes:

- `numResults`: results per search, 1 to 25 (default 5).
- `content`: `"prunedContext"` (default, the parts of each page relevant to the query), `"text"` (the whole page)
  or `"highlights"` (a few key sentences).

The agent can set `query`, `includeDomains`, `excludeDomains` and `startPublishedDate` on each search, and `urls`
(up to 10) and `query` on each read. Both tools have Zod input and output schemas. API errors are thrown as
`ContextFetchError` from [`@contextfetch/sdk`](https://www.npmjs.com/package/@contextfetch/sdk).

## Development

```bash
npm install
npm test                                   # unit tests against a local fake API, including a Mastra agent run
CONTEXTFETCH_API_KEY=... npm test          # plus the live smoke test (about 2 credits)
```

## License

MIT

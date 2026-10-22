// ContextFetch tools for Mastra agents: web search and web pages as Markdown.
// API reference: https://contextfetch.dev/docs/reference
import { ContextFetch } from "@contextfetch/sdk";
import type { ClientOptions } from "@contextfetch/sdk";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export interface ContextFetchToolOptions extends ClientOptions {
  /** Defaults to the CONTEXTFETCH_API_KEY env var; with no key, requests use the keyless tier. */
  apiKey?: string;
}

export interface ContextFetchSearchOptions extends ContextFetchToolOptions {
  /** Results per search, 1 to 25. Default 5. */
  numResults?: number;
  /**
   * Page content returned with each result: "prunedContext" (only the parts relevant to the query, the default),
   * "text" (the whole page as Markdown) or "highlights" (a few key sentences).
   */
  content?: "prunedContext" | "text" | "highlights";
}

const result = z.object({
  url: z.string(),
  title: z.string().nullish(),
  publishedDate: z.string().nullish(),
  author: z.string().nullish(),
  text: z.string().nullish(),
  highlights: z.array(z.string()).nullish(),
  prunedContext: z.string().nullish(),
});

/** Web search. Each result carries its title, URL, published date and page content. */
export function createContextFetchSearchTool(options: ContextFetchSearchOptions = {}) {
  const { apiKey, numResults = 5, content = "prunedContext", ...clientOptions } = options;
  const client = new ContextFetch(apiKey, clientOptions);
  return createTool({
    id: "contextfetch-search",
    description:
      "Search the web. Returns the top results, each with its title, URL, published date and page content as Markdown.",
    inputSchema: z.object({
      query: z.string().describe("The web search query."),
      includeDomains: z.array(z.string()).optional().describe("Only return results from these domains."),
      excludeDomains: z.array(z.string()).optional().describe("Never return results from these domains."),
      startPublishedDate: z
        .string()
        .optional()
        .describe("Only return pages published on or after this date (YYYY-MM-DD)."),
    }),
    outputSchema: z.object({ results: z.array(result) }),
    execute: async ({ query, ...filters }) => {
      const { results } = await client.search(query, { numResults, ...filters, [content]: true });
      return { results };
    },
  });
}

/** Read web pages as Markdown, optionally only the parts relevant to a question. */
export function createContextFetchContentsTool(options: ContextFetchToolOptions = {}) {
  const { apiKey, ...clientOptions } = options;
  const client = new ContextFetch(apiKey, clientOptions);
  return createTool({
    id: "contextfetch-contents",
    description: "Read web pages as Markdown. With a query, returns only the parts of each page relevant to it.",
    inputSchema: z.object({
      urls: z.array(z.string()).min(1).max(10).describe("The URLs of the pages to read."),
      query: z.string().optional().describe("Optional question: return only the parts of each page relevant to it."),
    }),
    outputSchema: z.object({
      results: z.array(result),
      statuses: z
        .array(z.object({ id: z.string(), status: z.string(), error: z.object({ message: z.string().optional() }).optional() }))
        .optional(),
    }),
    execute: async ({ urls, query }) => {
      const { results, statuses } = await client.contents(
        urls,
        query ? { text: false, prunedContext: { query } } : { text: true },
      );
      return { results, statuses };
    },
  });
}

/** Both tools with shared options. */
export function createContextFetchTools(options: ContextFetchSearchOptions = {}) {
  const { numResults, content, ...shared } = options;
  return {
    contextfetchSearch: createContextFetchSearchTool(options),
    contextfetchContents: createContextFetchContentsTool(shared),
  };
}

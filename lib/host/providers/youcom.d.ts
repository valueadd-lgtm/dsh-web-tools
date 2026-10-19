/**
 * dsh-web-tools — You.com keyless provider adapter (free Agents API).
 *
 * Uses You.com's keyless search endpoint (GET https://api.you.com/v1/agents/search),
 * which is rate-limited to 100 searches/day per IP and requires no API key.
 * This is a zero-config complement to the keyed `you` adapter (ydc-index.io +
 * X-API-Key): pick `youcom` when you want You.com results without signing up
 * for a key, and `you` when you have a paid key and want search + fetch + balance.
 *
 * Auth: none — the free Agents API is IP-based, so no `X-API-Key` is sent.
 * The `User-Agent` header carries the integration slug so You.com can attribute
 * the traffic from this plugin.
 * @module
 */
import { type ProviderAdapter } from "./types.ts";
import type { SearchHints } from "../search-hints.ts";
export declare const YOUCOM_META: {
    readonly name: "youcom";
    readonly label: "You.com (Free)";
    readonly description: "Keyless You.com web search (100/day per IP, no API key)";
    readonly credSuffix: "YOUCOM";
    readonly fetchCapable: false;
    readonly needsBaseUrl: false;
};
/**
 * Build the keyless search URL with query + max_results.
 * The free Agents API is GET with query-string params (not a POST body), and
 * accepts only `query` and `max_results` — no domain/freshness/geo controls.
 */
export declare function buildYoucomSearchUrl(query: string, maxResults: number, baseUrl: string | undefined, hints?: Readonly<SearchHints>): URL;
export declare const YoucomProvider: ProviderAdapter;

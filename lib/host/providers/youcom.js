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
import { providerError, throwIfHttp, resolveContext } from "./types.js";
import { fetchWithProxy } from "../fetch-proxy.js";
import { endpointViewOf } from "../endpoints.js";
/** Official keyless endpoint (no key, 100 searches/day per IP). */
const YOUCOM_SEARCH_URL = "https://api.you.com/v1/agents/search";
/** Integration slug — You.com attributes free-tier traffic by User-Agent. */
const YOUCOM_USER_AGENT = "youdotcom-integration/a3boy-dsh-web-tools";
export const YOUCOM_META = {
    name: "youcom",
    label: "You.com (Free)",
    description: "Keyless You.com web search (100/day per IP, no API key)",
    credSuffix: "YOUCOM",
    fetchCapable: false,
    needsBaseUrl: false,
};
/**
 * Build the keyless search URL with query + max_results.
 * The free Agents API is GET with query-string params (not a POST body), and
 * accepts only `query` and `max_results` — no domain/freshness/geo controls.
 */
export function buildYoucomSearchUrl(query, maxResults, baseUrl, hints) {
    const searchUrl = endpointViewOf("youcom", { youcom: baseUrl })?.url ?? YOUCOM_SEARCH_URL;
    const url = new URL(searchUrl);
    const cleanQ = hints?.cleanQuery ? hints.cleanQuery : query;
    url.searchParams.set("query", cleanQ);
    url.searchParams.set("max_results", String(Math.min(Math.max(maxResults, 1), 20)));
    return url;
}
/**
 * Map a raw You.com result item (web or flat-array shape) to a normalized Source.
 * Returns null when the item has no usable URL (trust-boundary validation).
 */
function toSource(r) {
    const u = typeof r?.url === "string" ? r.url : "";
    if (!u)
        return null;
    const s = { url: u };
    if (typeof r.title === "string" && r.title)
        s.title = r.title;
    // Keyless Agents API returns `snippets` (array); keyed variant uses `snippet` (string).
    let snippet;
    if (Array.isArray(r.snippets) && typeof r.snippets[0] === "string") {
        snippet = r.snippets[0];
    }
    else if (typeof r.snippet === "string") {
        snippet = r.snippet;
    }
    else if (typeof r.description === "string") {
        snippet = r.description;
    }
    if (snippet)
        s.snippet = snippet;
    if (typeof r.page_age === "string" && r.page_age)
        s.publishedAt = r.page_age;
    return s;
}
export const YoucomProvider = {
    ...YOUCOM_META,
    async search(query, maxResults, _apiKey, baseUrl, contextOrSignal) {
        const { signal, hints } = resolveContext(contextOrSignal);
        const url = buildYoucomSearchUrl(query, maxResults, baseUrl, hints);
        let res;
        try {
            res = await fetchWithProxy(url.href, { signal, headers: { "user-agent": YOUCOM_USER_AGENT } }, { provider: "youcom" });
        }
        catch (e) {
            throw providerError("network", `You.com (Free) unreachable: ${String(e)}`);
        }
        if (!res.ok)
            throwIfHttp("You.com (Free)", res);
        const raw = await res.json();
        // Handle both response shapes: keyless GET → { results: { web: [...] } };
        // keyed/legacy POST → flat { results: [...] }. Array.isArray detects which.
        const resultsField = raw?.results;
        const flat = Array.isArray(resultsField) ? resultsField : [];
        const web = Array.isArray(resultsField?.web) ? resultsField.web : [];
        const news = Array.isArray(resultsField?.news) ? resultsField.news : [];
        const all = [...web, ...news, ...flat];
        const sources = all
            .slice(0, Math.min(Math.max(maxResults, 1), 20))
            .map((r) => toSource(r))
            .filter((x) => x !== null);
        const outcome = { sources };
        return outcome;
    },
    async fetch(_url, _apiKey, _baseUrl, _signal) {
        throw providerError("config", "You.com (Free) does not provide native fetch; use the generic path");
    },
};

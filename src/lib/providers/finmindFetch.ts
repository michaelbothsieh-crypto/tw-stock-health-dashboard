import { getCache, setCache } from "./redisCache";

export type FinmindAuthUsed = "anon" | "env";

export interface FinmindFetchMeta {
  authUsed: FinmindAuthUsed;
  fallbackUsed: boolean;
  statusAnon?: number;
  statusEnv?: number;
  errorCode?: string;
  message?: string;
}

interface FinmindFetchArgs {
  url: string;
  params: Record<string, string | number | boolean | undefined | null>;
  revalidateSeconds: number;
  cacheKeyBase: string;
}

interface FinmindFetchSuccess {
  ok: true;
  body: any;
  meta: FinmindFetchMeta;
}

interface FinmindFetchFailure {
  ok: false;
  body: any;
  meta: FinmindFetchMeta;
}

export type FinmindFetchResult = FinmindFetchSuccess | FinmindFetchFailure;

function buildQueryString(
  params: FinmindFetchArgs["params"],
  authType: FinmindAuthUsed,
  token?: string,
): URLSearchParams {
  const search = new URLSearchParams();
  const dataset = String(params.dataset ?? "");

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (authType === "anon" && dataset === "TaiwanStockNews" && key === "end_date") return;
    search.set(key, String(value));
  });

  search.set("auth_type", authType);
  if (authType === "env" && token) {
    search.set("token", token);
  }

  return search;
}

function inferErrorCode(status: number, message: string): string {
  const msg = message.toLowerCase();

  if (status === 401 || msg.includes("unauthorized")) return "auth_required";
  if (status === 403 || msg.includes("forbidden") || msg.includes("permission")) return "permission_denied";
  if (
    status === 429 ||
    msg.includes("quota") ||
    msg.includes("limit") ||
    msg.includes("rate") ||
    msg.includes("too many") ||
    msg.includes("only send one day data") ||
    msg.includes("end_date parameter need be none")
  ) {
    return "quota_limited";
  }
  if (msg.includes("token")) return "auth_required";
  return "finmind_request_failed";
}

function shouldRetryWithEnvToken(status: number, message: string): boolean {
  const code = inferErrorCode(status, message);
  return code === "auth_required" || code === "permission_denied" || code === "quota_limited";
}

async function doRequest(
  url: string,
  search: URLSearchParams,
  revalidateSeconds: number,
  cacheKey: string,
): Promise<{ status: number; body: any; ok: boolean; message: string }> {
  const requestUrl = `${url}?${search.toString()}`;

  const res = await fetch(requestUrl, {
    next: {
      revalidate: revalidateSeconds,
      tags: [cacheKey],
    },
    headers: {
      "Content-Type": "application/json",
      "X-Finmind-Cache-Key": cacheKey,
    },
  });

  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  const message =
    (typeof body?.msg === "string" && body.msg) ||
    (typeof body?.message === "string" && body.message) ||
    res.statusText ||
    "FinMind request failed";

  const ok = res.ok && body?.status === 200;
  return { status: res.status, body, ok, message };
}

export async function finmindFetch(args: FinmindFetchArgs): Promise<FinmindFetchResult> {
  const token = process.env.FINMIND_API_TOKEN?.trim();
  const anonSearch = buildQueryString(args.params, "anon");
  const anonCacheKey = `v2:finmind:${args.cacheKeyBase}:auth=anon`;

  // 1. Generate unique Redis key
  // Sort params to ensure consistent key generation regardless of key order
  const sortedParams = Object.keys(args.params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = args.params[key];
      return acc;
    }, {} as Record<string, any>);
    
  const redisKey = `finmind:${args.cacheKeyBase}:${JSON.stringify(sortedParams)}`;

  try {
    // 2. Check Redis Cache
    const cachedBody = await getCache<any>(redisKey);
    if (cachedBody) {
      console.log(`[Cache Hit] ${redisKey}`);
      return {
        ok: true,
        body: cachedBody,
        meta: {
          authUsed: "anon", // Not actually hitting the API
          fallbackUsed: false,
          message: "From Redis Cache"
        },
      };
    }
  } catch (error) {
    // Ignore cache error, proceed to fetch
  }

  try {
    const anon = await doRequest(args.url, anonSearch, args.revalidateSeconds, anonCacheKey);

    if (anon.ok) {
      // 3. Set Cache on success
      await setCache(redisKey, anon.body, 43200); // 12 hours
      return {
        ok: true,
        body: anon.body,
        meta: {
          authUsed: "anon",
          fallbackUsed: false,
          statusAnon: anon.status,
        },
      };
    }

    const authRelated = shouldRetryWithEnvToken(anon.status, anon.message);
    if (!authRelated || !token) {
      return {
        ok: false,
        body: anon.body || [], // Fallback to empty array
        meta: {
          authUsed: "anon",
          fallbackUsed: false,
          statusAnon: anon.status,
          errorCode: inferErrorCode(anon.status, anon.message),
          message: anon.message,
        },
      };
    }

    const envSearch = buildQueryString(args.params, "env", token);
    const envCacheKey = `v2:finmind:${args.cacheKeyBase}:auth=env`;
    const env = await doRequest(args.url, envSearch, args.revalidateSeconds, envCacheKey);

    if (env.ok) {
      // 3. Set Cache on success
      await setCache(redisKey, env.body, 43200); // 12 hours
      return {
        ok: true,
        body: env.body,
        meta: {
          authUsed: "env",
          fallbackUsed: true,
          statusAnon: anon.status,
          statusEnv: env.status,
        },
      };
    }

    return {
      ok: false,
      body: env.body || [], // Fallback to empty array
      meta: {
        authUsed: "env",
        fallbackUsed: true,
        statusAnon: anon.status,
        statusEnv: env.status,
        errorCode: inferErrorCode(env.status, env.message),
        message: env.message,
      },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Network error";
    return {
      ok: false,
      body: [], // Fallback to empty array
      meta: {
        authUsed: token ? "env" : "anon",
        fallbackUsed: false,
        errorCode: "network_error",
        message,
      },
    };
  }
}

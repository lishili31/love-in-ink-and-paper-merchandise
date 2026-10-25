interface RequestConfig extends RequestInit {
  baseUrl?: string;
  params?: Record<string, string | number>;
  timeout?: number;
}

export class HttpClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseURL: string, opts?: { headers?: Record<string, string> }) {
    this.baseUrl = baseURL;
    this.defaultHeaders = {
      "Content-Type": "application/json",
      ...opts?.headers,
    };
  }

  async request<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
    const {
      method = "GET",
      params,
      body,
      headers,
      timeout = 30000,
      ...rest
    } = config;

    const url = new URL(`${this.baseUrl}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) =>
        url.searchParams.append(key, value.toString()),
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url.toString(), {
        ...rest,
        method,
        headers: { ...this.defaultHeaders, ...headers },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = (await response
          .json()
          .catch(() => ({}))) as Record<string, string>;
        throw new Error(errorData.message || `HTTP Error: ${response.status}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      // Narrow without `any`: an AbortError from our own controller means the
      // timeout fired, which is worth a clearer message than the raw DOMException.
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Request timeout");
      }
      throw error;
    }
  }

  get<T>(
    url: string,
    params?: RequestConfig["params"],
    config?: RequestConfig,
  ) {
    // Spread `config` FIRST: the helper's own method/params must win over
    // anything in the caller's config, but its `timeout`/`headers`/`signal`
    // must still reach request() — passing config as a second positional
    // argument used to be silent: the timeout the caller set was dropped and
    // the request ran on the 30s default.
    return this.request<T>(url, { ...config, method: "GET", params });
  }

  post<T>(url: string, body?: unknown, config?: RequestConfig) {
    // Cast at this boundary: request()'s `body` is BodyInit|undefined. Don't
    // spell it `BodyInit` — tsconfig.server.json is lib:[ES2022] + @types/node,
    // where that name does not exist (TS2304); read it off RequestInit instead.
    return this.request<T>(url, {
      ...config,
      method: "POST",
      body: body as RequestInit["body"],
    });
  }
}

declare global {
  interface D1Result<T = unknown> {
    results?: T[];
    success: boolean;
    meta: unknown;
    error?: string;
  }

  interface D1PreparedStatement {
    bind(...values: unknown[]): D1PreparedStatement;
    first<T = unknown>(): Promise<T | null>;
    all<T = unknown>(): Promise<D1Result<T>>;
    run<T = unknown>(): Promise<D1Result<T>>;
  }

  interface D1Database {
    prepare(query: string): D1PreparedStatement;
  }

  interface R2ObjectBody {
    body: ReadableStream;
    httpEtag: string;
    httpMetadata?: {
      contentType?: string;
      cacheControl?: string;
      contentDisposition?: string;
    };
    writeHttpMetadata(headers: Headers): void;
  }

  interface R2Bucket {
    get(key: string): Promise<R2ObjectBody | null>;
    put(
      key: string,
      value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null,
      options?: {
        httpMetadata?: {
          contentType?: string;
          cacheControl?: string;
          contentDisposition?: string;
        };
      }
    ): Promise<unknown>;
    delete(key: string | string[]): Promise<void>;
  }

  interface ExecutionContext {
    waitUntil(promise: Promise<unknown>): void;
  }

  interface CloudflareEnv {
    DB?: D1Database;
    MEDIA?: R2Bucket;
    USE_CLOUDFLARE_AUTH?: string;
    NEXT_PUBLIC_APP_URL?: string;
    KAIS_AUTH_SECRET?: string;
  }

  interface CloudflareContext<CfProperties extends Record<string, unknown> = Record<string, unknown>, Context = ExecutionContext> {
    env: CloudflareEnv;
    cf: CfProperties | undefined;
    ctx: Context;
  }
}

export {};

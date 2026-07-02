import { getCloudflareContext } from "@opennextjs/cloudflare";

const PUBLIC_MEDIA_PREFIX = "/r2/";

export async function getR2MediaBucket() {
  try {
    const context = await getCloudflareContext({ async: true });
    return context.env.MEDIA ?? null;
  } catch {
    return null;
  }
}

export async function uploadFileToR2Media({
  file,
  prefix,
  contentType,
  baseUrl
}: {
  file: File;
  prefix: string;
  contentType: string;
  baseUrl?: string | null;
}) {
  const result = await uploadFileToR2MediaWithKey({ file, prefix, contentType, baseUrl });
  return result.url;
}

export async function uploadFileToR2MediaWithKey({
  file,
  prefix,
  contentType,
  baseUrl
}: {
  file: File;
  prefix: string;
  contentType: string;
  baseUrl?: string | null;
}) {
  const bucket = await getR2MediaBucket();
  if (!bucket) throw new Error("R2 MEDIA no esta disponible.");

  const key = buildR2MediaKey(prefix, file.name);
  await bucket.put(key, await file.arrayBuffer(), {
    httpMetadata: {
      contentType,
      cacheControl: "public, max-age=31536000, immutable",
      contentDisposition: "inline"
    }
  });

  return { key, url: getR2PublicUrl(key, baseUrl) };
}

export async function deleteR2MediaKey(key: string) {
  const bucket = await getR2MediaBucket();
  if (!bucket) throw new Error("R2 MEDIA no esta disponible.");
  await bucket.delete(key);
}

export function getR2PublicUrl(key: string, baseUrl?: string | null) {
  const appUrl = (baseUrl || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  return `${appUrl}${PUBLIC_MEDIA_PREFIX}${key.split("/").map(encodeURIComponent).join("/")}`;
}

function buildR2MediaKey(prefix: string, fileName: string) {
  const safePrefix = prefix
    .split("/")
    .map((part) => part.replace(/[^a-zA-Z0-9._-]/g, "-"))
    .filter(Boolean)
    .join("/");
  const extension = fileName.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? "";
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 90) || `asset${extension}`;
  return `${safePrefix}/${crypto.randomUUID()}-${safeName}`;
}

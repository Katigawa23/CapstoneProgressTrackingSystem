const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "");

export function buildApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (!backendUrl) {
    throw new Error(
      "NEXT_PUBLIC_BACKEND_URL is not set. Add it to my-app/.env.local."
    );
  }

  return `${backendUrl}${normalizedPath}`;
}

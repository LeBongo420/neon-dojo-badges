const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function publicPath(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

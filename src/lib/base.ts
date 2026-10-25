const rawBase = import.meta.env.BASE_URL;

export const basePath = rawBase.endsWith("/") ? rawBase.slice(0, -1) : rawBase;

export function withBase(path: string): string {
  if (!path.startsWith("/")) path = `/${path}`;
  return `${basePath}${path}`;
}

const rawAssetVersion = process.env.NEXT_PUBLIC_ASSET_VERSION ?? "badge-opt-0823";

export const ASSET_VERSION = rawAssetVersion.slice(0, 12);

export function assetUrl(path: string) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const separator = path.includes("?") ? "&" : "?";
  return `${basePath}${path}${separator}v=${encodeURIComponent(ASSET_VERSION)}`;
}

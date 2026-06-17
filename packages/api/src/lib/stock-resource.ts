const STORAGE_PUBLIC_BASE_URL = "https://storage.googleapis.com";
const LEADING_SLASHES = /^\/+/;

export const STOCK_ICON_RESOURCE_TYPE = "icon" as const;
export const STOCK_RESOURCE_READY_STATUS = "ready" as const;

export function buildStockResourceUrl({
  storageBucket,
  storageKey,
}: {
  storageBucket: null | string;
  storageKey: null | string;
}): null | string {
  if (!(storageBucket && storageKey)) {
    return null;
  }

  return `${STORAGE_PUBLIC_BASE_URL}/${storageBucket}/${storageKey.replace(
    LEADING_SLASHES,
    ""
  )}`;
}

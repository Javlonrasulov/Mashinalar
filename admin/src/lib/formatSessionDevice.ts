/** Eski APK faqat okhttp User-Agent yuboradi. */
export function isGenericOkHttpUa(ua: string | null | undefined): boolean {
  if (!ua) return true;
  return /^okhttp\//i.test(ua.trim());
}

export function formatSessionDevice(
  ua: string | null | undefined,
  unknownLabel: string,
): string {
  const raw = (ua ?? '').trim();
  if (!raw) return unknownLabel;
  if (isGenericOkHttpUa(raw)) return unknownLabel;
  return raw;
}

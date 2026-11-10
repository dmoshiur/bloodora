/** Normalize a Bangladesh mobile number to +8801XXXXXXXXX, or return null. */
export function normalizeBangladeshPhone(input: unknown): string | null {
  if (input === undefined || input === null) return null;
  let value = String(input).trim();
  // Normalize common written forms but never silently accept arbitrary countries.
  value = value.replace(/[\s().-]/g, "");
  if (value.startsWith("+")) value = value.slice(1);
  if (value.startsWith("00880")) value = value.slice(2);
  if (!/^\d+$/.test(value)) return null;
  if (value.startsWith("880")) value = value.slice(3);
  if (value.startsWith("0")) value = value.slice(1);
  if (!/^1[3-9]\d{8}$/.test(value)) return null;
  return `+880${value}`;
}

/** Provider APIs commonly expect digits without the leading plus. */
export function bangladeshPhoneDigits(input: unknown): string | null {
  return normalizeBangladeshPhone(input)?.slice(1) ?? null;
}

/** Local 01XXXXXXXXX form documented by GreenWeb. */
export function bangladeshPhoneLocal(input: unknown): string | null {
  const normalized = normalizeBangladeshPhone(input);
  return normalized ? `0${normalized.slice(4)}` : null;
}

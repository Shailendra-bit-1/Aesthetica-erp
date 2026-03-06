/**
 * Normalize an Indian mobile number to a 10-digit string.
 * "9876543210", "+919876543210", "91 9876543210" → "9876543210"
 */
export function normalizePhone(raw: string): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) return digits.slice(2);
  return digits;
}

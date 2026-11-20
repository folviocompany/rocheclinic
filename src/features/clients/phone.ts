export function normalizePhone(value: string) {
  return value.replace(/\D/g, '');
}

export function formatPhone(value: string) {
  const digits = normalizePhone(value);
  const local = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return value;
}

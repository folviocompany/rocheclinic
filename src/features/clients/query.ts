const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function first(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

export type ClientListQuery = {
  query: string;
  professionalId: string;
  page: number;
};

export function clientListQuery(input: Record<string, unknown>): ClientListQuery {
  const rawQuery = String(first(input.q) ?? '')
    .slice(0, 80)
    .replace(/[,%_()."'\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const rawProfessional = String(first(input.professional) ?? '');
  const rawPage = Number.parseInt(String(first(input.page) ?? '1'), 10);

  return {
    query: rawQuery,
    professionalId: uuidPattern.test(rawProfessional) ? rawProfessional : '',
    page: Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1,
  };
}

export function clientPageCount(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(Math.max(0, total) / pageSize));
}

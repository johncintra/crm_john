export function cn(...parts: Array<string | null | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function formatCurrency(value?: number | null, currency = 'BRL'): string {
  if (typeof value !== 'number') {
    return '--';
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency
  }).format(value / 100);
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(date));
}

export function normalizePhone(value: string): string {
  return value.replace(/\D/g, '');
}

export function extractPhoneFromText(value: string): string | null {
  const matches = value.match(/\+?\d[\d\s\-().]{7,}\d/g);
  if (!matches?.length) {
    return null;
  }

  const candidate = normalizePhone(matches[0]);
  return candidate.length >= 10 ? candidate : null;
}

export function firstString(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

export async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

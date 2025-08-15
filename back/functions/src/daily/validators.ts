export const validateDateString = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date);
export const validateMonthString = (m: string) => /^\d{4}-\d{2}$/.test(m);

export function nextMonthStart(monthYYYYMM: string) {
  const [y, m] = monthYYYYMM.split('-').map(Number);
  const year = y + Math.floor(m / 12);
  const month = (m % 12) + 1; // 1..12
  const mm = month.toString().padStart(2, '0');
  return `${year}-${mm}-01`;
}
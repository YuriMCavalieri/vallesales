const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isValidDate = (value: Date) => !Number.isNaN(value.getTime());

export const isDateOnlyString = (value: string) => DATE_ONLY_PATTERN.test(value.trim());

export const parseDateValue = (value: string | Date | null | undefined) => {
  if (!value) return null;

  if (value instanceof Date) {
    return isValidDate(value) ? new Date(value.getTime()) : null;
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (isDateOnlyString(trimmed)) {
    const [year, month, day] = trimmed.split("-").map(Number);
    const parsed = new Date(year, month - 1, day);
    return isValidDate(parsed) ? parsed : null;
  }

  const parsed = new Date(trimmed);
  return isValidDate(parsed) ? parsed : null;
};

export const startOfLocalDay = (value: string | Date | null | undefined) => {
  const parsed = parseDateValue(value);
  if (!parsed) return null;

  parsed.setHours(0, 0, 0, 0);
  return parsed;
};

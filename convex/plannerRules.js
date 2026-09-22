const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export function isValidDateKey(value) {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export function isValidTime(value) {
  return value === "" || (typeof value === "string" && TIME_RE.test(value));
}

export function dateFromKey(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function dayDifference(from, to) {
  const [fromYear, fromMonth, fromDay] = from.split("-").map(Number);
  const [toYear, toMonth, toDay] = to.split("-").map(Number);
  return Math.round(
    (Date.UTC(toYear, toMonth - 1, toDay) - Date.UTC(fromYear, fromMonth - 1, fromDay)) / DAY_MS,
  );
}

export function isOccurrenceDate(task, occurrenceDate) {
  if (!task || !isValidDateKey(occurrenceDate) || !isValidDateKey(task.date)) return false;
  if (!task.recurring) return task.date === occurrenceDate;
  const difference = dayDifference(task.date, occurrenceDate);
  return difference >= 0 && difference % 7 === 0;
}

export function occurrenceFor(task, occurrenceDate) {
  if (!isOccurrenceDate(task, occurrenceDate)) return null;
  const deletedDates = Array.isArray(task.deletedDates) ? task.deletedDates : [];
  if (deletedDates.includes(occurrenceDate)) return null;
  const completedDates = Array.isArray(task.completedDates) ? task.completedDates : [];
  return {
    task,
    date: occurrenceDate,
    done: completedDates.includes(occurrenceDate),
  };
}

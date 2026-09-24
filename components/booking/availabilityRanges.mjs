export function copyRanges(ranges) {
  return (Array.isArray(ranges) ? ranges : []).map((range) => ({
    start: range.start,
    end: range.end,
  }));
}

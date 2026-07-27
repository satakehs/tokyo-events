function toISODate(year, month, day) {
  const y = String(year).padStart(4, "0");
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// テキストから「年月日」の日付をできるだけ拾い、開始日・終了日を返す。
// 例: "［8月15日（土）］11:30～16:00 / ［8月16日（日）］11:00～16:00"
//     → 複数の日付が見つかった場合は、一番早い日を開始日、一番遅い日を終了日とする。
// 年が書かれていない(月日だけ)場合は fallbackYear で補う。
// 日が書かれていない(年月だけ、例:「2026年10月」)場合は1日とみなす。
export function extractDateRange(text, fallbackYear) {
  if (!text) return null;

  const fullDateMatches = [...text.matchAll(/(\d{4})年(\d{1,2})月(\d{1,2})日/g)];
  if (fullDateMatches.length > 0) {
    const dates = fullDateMatches
      .map(([, y, m, d]) => toISODate(y, m, d))
      .sort();
    return { startDate: dates[0], endDate: dates[dates.length - 1] };
  }

  const yearMonthMatch = text.match(/(\d{4})年(\d{1,2})月/);
  if (yearMonthMatch) {
    const [, y, m] = yearMonthMatch;
    return { startDate: toISODate(y, m, 1), endDate: null };
  }

  if (fallbackYear) {
    const monthDayMatches = [...text.matchAll(/(\d{1,2})月(\d{1,2})日/g)];
    if (monthDayMatches.length > 0) {
      const dates = monthDayMatches
        .map(([, m, d]) => toISODate(fallbackYear, m, d))
        .sort();
      return { startDate: dates[0], endDate: dates[dates.length - 1] };
    }
  }

  return null;
}

// タイトルなどから、日付の年を補うための手がかりを探す。
export function extractYearHint(text) {
  const match = text?.match(/(\d{4})年/);
  return match ? Number(match[1]) : null;
}

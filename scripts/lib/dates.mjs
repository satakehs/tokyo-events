function toISODate(year, month, day) {
  const y = String(year).padStart(4, "0");
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// テキストから「年月日」の日付をできるだけ拾い、開始日・終了日を返す。
// 例1: "［8月15日（土）］11:30～16:00 / ［8月16日（日）］11:00～16:00"
//      → 年が無いのでfallbackYearを補う
// 例2: "2026年7月18日（土）～8月16日（日）"
//      → 最初の日付にしか年が書かれていないので、以降の日付にも
//        直前に出てきた年を引き継いで補う(左から順番に読んでいく)
// 見つかった日付のうち、一番早い日を開始日、一番遅い日を終了日とする。
export function extractDateRange(text, fallbackYear) {
  if (!text) return null;

  const regex = /(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日/g;
  let currentYear = fallbackYear ?? null;
  const dates = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    const [, year, month, day] = match;
    if (year) {
      currentYear = Number(year);
    }
    if (currentYear) {
      dates.push(toISODate(currentYear, month, day));
    }
  }

  if (dates.length > 0) {
    dates.sort();
    return { startDate: dates[0], endDate: dates[dates.length - 1] };
  }

  // 日が書かれておらず年月だけの場合(例:「2026年10月」)は1日とみなす
  const yearMonthMatch = text.match(/(\d{4})年(\d{1,2})月/);
  if (yearMonthMatch) {
    const [, y, m] = yearMonthMatch;
    return { startDate: toISODate(y, m, 1), endDate: null };
  }

  return null;
}

// タイトルなどから、日付の年を補うための手がかりを探す。
export function extractYearHint(text) {
  const match = text?.match(/(\d{4})年/);
  return match ? Number(match[1]) : null;
}

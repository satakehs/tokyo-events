import * as cheerio from "cheerio";
import {
  GEOCODE_INTERVAL_MS,
  sleep,
  extractLocationHints,
  geocode,
  geocodeAddress,
} from "./geocode.mjs";
import { extractDateRange, extractYearHint } from "./dates.mjs";

export async function fetchArticleHtml(url) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "tokyo-events-app/0.1 (personal project; contact: capsuleperfume@gmail.com)",
      },
    });

    if (!response.ok) {
      return null;
    }

    return await response.text();
  } catch (error) {
    // タイムアウトやDNSエラーなど、一時的な通信不良で処理全体を
    // 止めたくないため、失敗時はnullを返すだけにする。
    console.warn(`記事の取得に失敗しました(${url}): ${error.message}`);
    return null;
  }
}

function cellAfterLabel($, tableSelector, labels) {
  const th = $(`${tableSelector} th`)
    .filter((_, el) => labels.includes($(el).text().trim()))
    .first();

  if (th.length === 0) {
    return null;
  }

  return th.next("td");
}

function textOf(cell) {
  return cell ? cell.text().replace(/\s+/g, " ").trim() : null;
}

// 表に日付欄が無い記事でも、本文中に「オープンしたのは2026年7月10日。」
// のような一文があることが多いので、そこから拾う。
// ページ下部の「関連記事」欄には別記事の同じ言い回しが混ざっているため、
// 本文エリア(.article__body)だけに絞って探す。
function extractBodyDateHint($) {
  const bodyText = $(".article__body").text();
  const match = bodyText.match(
    /(?:オープン|リニューアル|移転|閉店)(?:したの)?は\s*(\d{4}年\d{1,2}月\d{1,2}日)/
  );
  return match ? match[1] : null;
}

// いたばしTIMESの記事は、末尾に構造化された表で
// 「店舗情報」(店舗名・住所・オープン予定日)または
// 「イベント情報」(イベント名・日時・場所)が書かれていることが多い。
// そこから正確な住所と開催日/オープン日を抜き出す。
// 「場所」欄は「施設名(住所)」という書き方が多いので、括弧の中身を住所として扱う。
export function extractVenueFromArticleHtml(html) {
  const $ = cheerio.load(html);
  const bodyDateHint = extractBodyDateHint($);

  const eventPlaceCell = cellAfterLabel($, "table.articleEventInfo", ["場所"]);
  if (eventPlaceCell) {
    const text = textOf(eventPlaceCell);
    const tableDateText = textOf(
      cellAfterLabel($, "table.articleEventInfo", ["日時", "日にち", "開催日"])
    );
    const dateText = tableDateText || bodyDateHint;
    const match = text.match(/^(.*?)[(（]([^)）]+)[)）]/);
    if (match) {
      return {
        venueName: match[1].trim(),
        address: match[2].trim(),
        dateText,
      };
    }
    if (text) {
      return { venueName: null, address: text, dateText };
    }
  }

  const storeAddressCell = cellAfterLabel($, "table.articleStoreInfo", ["住所"]);
  if (storeAddressCell) {
    const address = textOf(storeAddressCell);
    const storeNameCell = cellAfterLabel($, "table.articleStoreInfo", [
      "店舗名",
    ]);
    const openDateCell = $("table.articleStoreInfo th")
      .filter((_, el) => $(el).text().trim().includes("オープン"))
      .first()
      .next("td");
    const tableDateText = openDateCell.length ? textOf(openDateCell) : null;
    const dateText = tableDateText || bodyDateHint;

    if (address) {
      return {
        venueName: textOf(storeNameCell),
        address,
        dateText,
      };
    }
  }

  if (bodyDateHint) {
    return { venueName: null, address: null, dateText: bodyDateHint };
  }

  return null;
}

// 1件分の位置情報+開催日の解決処理。
// 位置: まず記事本文の構造化された住所を試し(高精度)、
//       それが無ければタイトルからの推測にフォールバックする(低精度)。
// 日付: 記事本文の日時欄 → タイトル、の順に探し、どちらにも無ければnull
//       (呼び出し側で記事の公開日にフォールバックする想定)。
export async function resolveEventDetails({ title, url, pubDate, wardContext }) {
  let location = null;
  let dateRange = null;
  const yearHint =
    extractYearHint(title) ??
    (pubDate ? new Date(pubDate).getFullYear() : null);

  if (url) {
    const html = await fetchArticleHtml(url);
    if (html) {
      const extracted = extractVenueFromArticleHtml(html);

      if (extracted?.address) {
        const fullAddress = extracted.address.startsWith("東京都")
          ? extracted.address
          : `東京都${extracted.address}`;
        const geocoded = await geocodeAddress(fullAddress);
        await sleep(300);
        if (geocoded) {
          location = {
            venueName: extracted.venueName,
            address: extracted.address,
            latitude: geocoded.lat,
            longitude: geocoded.lon,
          };
        }
      }

      if (extracted?.dateText) {
        dateRange = extractDateRange(extracted.dateText, yearHint);
      }
    }
  }

  if (!dateRange) {
    dateRange = extractDateRange(title, yearHint);
  }

  if (!location) {
    for (const hint of extractLocationHints(title)) {
      const geocoded = await geocode(`${wardContext}${hint}`);
      await sleep(GEOCODE_INTERVAL_MS);
      if (geocoded) {
        location = {
          venueName: hint,
          address: null,
          latitude: geocoded.lat,
          longitude: geocoded.lon,
        };
        break;
      }
    }
  }

  return { location, dateRange };
}

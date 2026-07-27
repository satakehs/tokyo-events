import * as cheerio from "cheerio";
import {
  GEOCODE_INTERVAL_MS,
  sleep,
  extractLocationHints,
  geocode,
  geocodeAddress,
} from "./geocode.mjs";

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

function cellAfterLabel($, tableSelector, label) {
  const th = $(`${tableSelector} th`)
    .filter((_, el) => $(el).text().trim() === label)
    .first();

  if (th.length === 0) {
    return null;
  }

  return th.next("td");
}

// いたばしTIMESの記事は、末尾に構造化された表で
// 「店舗情報」(店舗名・住所)または「イベント情報」(イベント名・日時・場所)が
// 書かれていることが多い。そこから正確な住所を抜き出す。
// 「場所」欄は「施設名(住所)」という書き方が多いので、括弧の中身を住所として扱う。
export function extractVenueFromArticleHtml(html) {
  const $ = cheerio.load(html);

  const eventPlaceCell = cellAfterLabel($, "table.articleEventInfo", "場所");
  if (eventPlaceCell) {
    const text = eventPlaceCell.text().replace(/\s+/g, " ").trim();
    const match = text.match(/^(.*?)[(（]([^)）]+)[)）]/);
    if (match) {
      return { venueName: match[1].trim(), address: match[2].trim() };
    }
    if (text) {
      return { venueName: null, address: text };
    }
  }

  const storeAddressCell = cellAfterLabel($, "table.articleStoreInfo", "住所");
  if (storeAddressCell) {
    const address = storeAddressCell.text().replace(/\s+/g, " ").trim();
    const storeNameCell = cellAfterLabel($, "table.articleStoreInfo", "店舗名");
    const venueName = storeNameCell
      ? storeNameCell.text().replace(/\s+/g, " ").trim()
      : null;
    if (address) {
      return { venueName, address };
    }
  }

  return null;
}

// 1件分の位置情報解決のメイン処理。
// まず記事本文の構造化された住所を試し(高精度)、
// それが無ければタイトルからの推測にフォールバックする(低精度)。
export async function resolveEventLocation({ title, url, wardContext }) {
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
          return {
            venueName: extracted.venueName,
            address: extracted.address,
            latitude: geocoded.lat,
            longitude: geocoded.lon,
          };
        }
      }
    }
  }

  for (const hint of extractLocationHints(title)) {
    const geocoded = await geocode(`${wardContext}${hint}`);
    await sleep(GEOCODE_INTERVAL_MS);
    if (geocoded) {
      return {
        venueName: hint,
        address: null,
        latitude: geocoded.lat,
        longitude: geocoded.lon,
      };
    }
  }

  return null;
}

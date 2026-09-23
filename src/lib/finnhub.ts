import { loadObject, saveObject } from "./entryStore";

const API_KEY_STORAGE_KEY = "btc-app-finnhub-api-key-v1";
const PRICE_CACHE_KEY = "btc-app-finnhub-price-cache-v1";
// 무료 티어 한도는 분당 60회. 여유 있게 60초 캐시.
const PRICE_CACHE_TTL_MS = 60 * 1000;

interface PriceCache {
  fetchedAt: number;
  symbol: string;
  price: number;
  change24h: number;
}

/**
 * Finnhub 키는 사용자가 설정 화면에 직접 입력해 브라우저 localStorage에만 저장한다.
 * 이 저장소는 퍼블릭이라, 코드에 박아넣으면 GitHub에서 누구나 가져다 쓸 수 있어
 * 무료 티어 호출 한도가 금방 소진되거나 키가 정지될 수 있다.
 */
export function loadFinnhubApiKey(): string {
  return loadObject<string>(API_KEY_STORAGE_KEY, "");
}

export function saveFinnhubApiKey(key: string): void {
  saveObject(API_KEY_STORAGE_KEY, key.trim());
}

/** Finnhub 무료 티어는 미국 상장 종목만 지원한다 — 한국거래소 등은 403으로 거부된다. */
export async function fetchFinnhubQuote(symbol: string): Promise<{ price: number; change24h: number }> {
  const apiKey = loadFinnhubApiKey();
  if (!apiKey) throw new Error("Finnhub API 키가 설정되지 않았습니다. 우측 상단 '설정'에서 입력해주세요.");

  const cacheKey = `${PRICE_CACHE_KEY}:${symbol}`;
  const cached = loadObject<PriceCache | null>(cacheKey, null);
  if (cached && cached.symbol === symbol && Date.now() - cached.fetchedAt < PRICE_CACHE_TTL_MS) {
    return { price: cached.price, change24h: cached.change24h };
  }

  const res = await fetch(
    `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(apiKey)}`,
  );
  if (!res.ok) {
    if (res.status === 401) throw new Error("Finnhub API 키가 유효하지 않습니다.");
    if (res.status === 403) throw new Error("Finnhub 무료 티어가 이 종목/시장을 지원하지 않습니다.");
    throw new Error(`Finnhub 요청 실패: ${res.status}`);
  }
  const data = (await res.json()) as { c: number; dp: number | null };
  if (!data.c || data.c <= 0) throw new Error("Finnhub에서 유효한 가격을 받지 못했습니다.");

  const result = { price: data.c, change24h: data.dp ?? 0 };
  saveObject(cacheKey, { fetchedAt: Date.now(), symbol, ...result } satisfies PriceCache);
  return result;
}

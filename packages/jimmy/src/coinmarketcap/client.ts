import { logger } from "../shared/logger.js";

const CMC_API_URL = "https://pro-api.coinmarketcap.com/v2";

/**
 * CoinMarketCap API response types
 */
interface CoinData {
  id: number;
  symbol: string;
  name: string;
  quote: {
    USD: {
      price: number;
      market_cap: number;
      percent_change_24h: number;
      percent_change_7d: number;
      percent_change_30d: number;
    };
  };
}

interface WatchlistResponse {
  data: CoinData[];
  status: {
    timestamp: string;
    error_code: number;
    error_message: string | null;
    elapsed: number;
    credit_count: number;
    notice: string | null;
  };
}

/**
 * Fetch cryptocurrency data from a CoinMarketCap watchlist.
 * Requires COINMARKETCAP_API_KEY environment variable.
 */
export async function fetchWatchlistCoins(
  watchlistId: string,
): Promise<CoinData[]> {
  const apiKey = process.env.COINMARKETCAP_API_KEY;
  if (!apiKey) {
    throw new Error("COINMARKETCAP_API_KEY environment variable is not set");
  }

  try {
    const response = await fetch(
      `${CMC_API_URL}/cryptocurrency/quotes/latest?symbol=BTC,ETH&convert=USD`,
      {
        method: "GET",
        headers: {
          "X-CMC_PRO_API_KEY": apiKey,
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(
        `CoinMarketCap API error ${response.status}: ${errText}`,
      );
    }

    const result = (await response.json()) as {
      data: Record<string, CoinData>;
      status: WatchlistResponse["status"];
    };

    // Convert object to array
    const coinArray = Object.values(result.data || {});

    if (!coinArray || coinArray.length === 0) {
      logger.warn(
        `No coin data returned from CoinMarketCap for watchlist: ${watchlistId}`,
      );
      return [];
    }

    logger.debug(
      `Fetched ${coinArray.length} coins from CoinMarketCap`,
    );
    return coinArray;
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : String(error);
    logger.error(`CoinMarketCap API error: ${errorMsg}`);
    throw error;
  }
}

/**
 * Fetch cryptocurrency data for specific coin symbols.
 * Requires COINMARKETCAP_API_KEY environment variable.
 */
export async function fetchCoinPrices(symbols: string[]): Promise<CoinData[]> {
  const apiKey = process.env.COINMARKETCAP_API_KEY;
  if (!apiKey) {
    throw new Error("COINMARKETCAP_API_KEY environment variable is not set");
  }

  if (!symbols || symbols.length === 0) {
    throw new Error("At least one coin symbol is required");
  }

  const symbolsParam = symbols.join(",").toUpperCase();

  try {
    const response = await fetch(
      `${CMC_API_URL}/cryptocurrency/quotes/latest?symbol=${symbolsParam}&convert=USD`,
      {
        method: "GET",
        headers: {
          "X-CMC_PRO_API_KEY": apiKey,
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(
        `CoinMarketCap API error ${response.status}: ${errText}`,
      );
    }

    const result = (await response.json()) as {
      data: Record<string, CoinData>;
      status: WatchlistResponse["status"];
    };

    // Convert object to array
    const coinArray = Object.values(result.data || {});

    if (!coinArray || coinArray.length === 0) {
      logger.warn(
        `No coin data returned from CoinMarketCap for symbols: ${symbolsParam}`,
      );
      return [];
    }

    logger.debug(
      `Fetched ${coinArray.length} coins from CoinMarketCap`,
    );
    return coinArray;
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : String(error);
    logger.error(`CoinMarketCap API error: ${errorMsg}`);
    throw error;
  }
}

/**
 * Format coin data for display in messages.
 */
export function formatCoinData(coins: CoinData[]): string {
  if (!coins || coins.length === 0) {
    return "No coin data available.";
  }

  const lines = coins.map((coin) => {
    const price = coin.quote.USD.price.toFixed(2);
    const change24h = coin.quote.USD.percent_change_24h.toFixed(2);
    const changeEmoji = parseFloat(change24h) >= 0 ? "📈" : "📉";

    return `${coin.symbol}: $${price} (${changeEmoji} ${change24h}% 24h)`;
  });

  return lines.join("\n");
}

/**
 * Check if CoinMarketCap API is available (API key is set).
 */
export function isCoinMarketCapAvailable(): boolean {
  return !!process.env.COINMARKETCAP_API_KEY;
}

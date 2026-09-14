/**
 * Maps corporate names, ISIN codes, and broker tickers to standard Yahoo Finance symbols (.NS for NSE).
 */
export class SymbolResolver {
  private static readonly KNOWN_ISIN_MAP: Record<string, string> = {
    INE002A01018: "RELIANCE.NS",
    INE009A01021: "INFY.NS",
    INE090A01021: "ICICIBANK.NS",
    INE467B01029: "TCS.NS",
    INE040A01034: "HDFCBANK.NS",
    INE062A01020: "SBIN.NS",
    INE018A01030: "LT.NS",
    INE154A01025: "ITC.NS",
    INE397D01024: "BHARTIARTL.NS",
    INE081A01012: "TATAMOTORS.NS",
    INE081A01020: "TATAMOTORS.NS",
    INE075A01022: "WIPRO.NS",
    INE351F01018: "JPPOWER.NS",
    INE019A01038: "JSWSTEEL.NS",
    INE081A01038: "TATASTEEL.NS",
  };

  private static readonly KNOWN_NAME_MAP: Record<string, string> = {
    "JAIPRAKASH POWER": "JPPOWER.NS",
    "JAIPRAKASH POWER VEN. LTD": "JPPOWER.NS",
    "JAIPRAKASH POWER VENTURES": "JPPOWER.NS",
    JPPOWER: "JPPOWER.NS",
    WIPRO: "WIPRO.NS",
    "WIPRO LTD": "WIPRO.NS",
    "WIPRO LIMITED": "WIPRO.NS",
    "BILLIONBRAINS GARAGE VN L": "^NSEI",
    "BILLIONBRAINS GARAGE": "^NSEI",
    BILLIONBRAINS: "^NSEI",
    "TATAAML-TATAGOLD": "GOLDBEES.NS",
    TATAGOLD: "GOLDBEES.NS",
    "TATAAML-TATSILV": "SILVERBEES.NS",
    TATSILV: "SILVERBEES.NS",
    GOLDBEES: "GOLDBEES.NS",
    SILVERBEES: "SILVERBEES.NS",
    NIFTY: "^NSEI",
    "NIFTY 50": "^NSEI",
    NIFTY50: "^NSEI",
    "NSE:NIFTY": "^NSEI",
    SENSEX: "^BSESN",
    "BSE:SENSEX": "^BSESN",
    RELIANCE: "RELIANCE.NS",
    "RELIANCE INDUSTRIES": "RELIANCE.NS",
    "RELIANCE INDUSTRIES LTD": "RELIANCE.NS",
    INFOSYS: "INFY.NS",
    "INFOSYS LTD": "INFY.NS",
    "INFOSYS LIMITED": "INFY.NS",
    INFY: "INFY.NS",
    "TCS LTD": "TCS.NS",
    "TATA CONSULTANCY SERVICES": "TCS.NS",
    TCS: "TCS.NS",
    "ICICI BANK": "ICICIBANK.NS",
    "ICICI BANK LTD": "ICICIBANK.NS",
    ICICIBANK: "ICICIBANK.NS",
    "HDFC BANK": "HDFCBANK.NS",
    "HDFC BANK LTD": "HDFCBANK.NS",
    HDFCBANK: "HDFCBANK.NS",
    "STATE BANK OF INDIA": "SBIN.NS",
    SBIN: "SBIN.NS",
    "TATA STEEL": "TATASTEEL.NS",
    TATASTEEL: "TATASTEEL.NS",
    "TATA MOTORS": "TATAMOTORS.NS",
    TATAMOTORS: "TATAMOTORS.NS",
    "LARSEN & TOUBRO": "LT.NS",
    "L&T": "LT.NS",
    LT: "LT.NS",
    ITC: "ITC.NS",
    "ITC LTD": "ITC.NS",
    "BHARTI AIRTEL": "BHARTIARTL.NS",
    BHARTIARTL: "BHARTIARTL.NS",
  };

  /**
   * Resolves a raw symbol, ISIN, or asset name into a valid Yahoo Finance ticker symbol (e.g. 'WIPRO.NS').
   */
  public static resolve(rawSymbolOrName: string): string {
    if (!rawSymbolOrName) return "";

    const cleaned = rawSymbolOrName.trim().toUpperCase();

    // 1. Check ISIN code
    if (this.KNOWN_ISIN_MAP[cleaned]) {
      return this.KNOWN_ISIN_MAP[cleaned];
    }

    // 2. Check exact known name/ticker mapping
    if (this.KNOWN_NAME_MAP[cleaned]) {
      return this.KNOWN_NAME_MAP[cleaned];
    }

    // 3. Check partial matching for known names
    for (const [key, ticker] of Object.entries(this.KNOWN_NAME_MAP)) {
      if (cleaned.includes(key.toUpperCase())) {
        return ticker;
      }
    }

    // 4. If symbol already has exchange suffix (e.g. 'WIPRO.NS' or 'BTC-USD')
    if (cleaned.includes(".") || cleaned.includes("-")) {
      return cleaned;
    }

    // 5. Sanitize: take first word if it looks like a ticker, strip corporate suffixes
    let symbolOnly = cleaned
      .replace(/\s+(LTD|LIMITED|PVT|CORP|INC|PLC|LLC|CORPORATION|SERVICES)$/i, "")
      .trim();

    if (symbolOnly.includes(" ")) {
      symbolOnly = symbolOnly.split(" ")[0];
    }

    // Default to NSE (.NS)
    return `${symbolOnly}.NS`;
  }
}

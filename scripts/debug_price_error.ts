
import { fetchFugleQuote } from '../src/infrastructure/providers/fugleQuote';
import { yf as yahooFinance } from '../src/infrastructure/providers/yahooFinanceClient';

async function debug2337() {
  console.log('--- Debugging 2337 (旺宏) ---');
  
  // 1. Test Fugle
  const fugle = await fetchFugleQuote('2337');
  console.log('Fugle Result:', JSON.stringify(fugle, null, 2));

  // 2. Test Yahoo TW
  const yahooTW = await yahooFinance.quote('2337.TW').catch(e => e.message);
  console.log('Yahoo 2337.TW:', Array.isArray(yahooTW) ? yahooTW[0]?.regularMarketPrice : (yahooTW as any)?.regularMarketPrice || yahooTW);

  // 3. Test Yahoo Pure 2337 (Potential Risk)
  const yahooPure = await yahooFinance.quote('2337').catch(e => e.message);
  console.log('Yahoo 2337 (Pure):', Array.isArray(yahooPure) ? yahooPure[0]?.regularMarketPrice : (yahooPure as any)?.regularMarketPrice || yahooPure);
}

debug2337();

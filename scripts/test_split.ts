
import { fetchFugleQuote } from '../src/lib/providers/fugleQuote';

async function test00631L() {
  console.log('Fetching 00631L real-time quote...');
  const quote = await fetchFugleQuote('00631L');
  console.log('Result:', JSON.stringify(quote, null, 2));
}

test00631L();

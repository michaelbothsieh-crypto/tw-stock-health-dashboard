
async function debugSnapshot() {
  const ticker = '2337';
  const baseUrl = process.env.BOT_BASE_URL || 'http://localhost:3000';
  const url = `${baseUrl}/api/stock/${ticker}/snapshot?mode=lite`;
  
  console.log(`--- Fetching Snapshot for ${ticker} ---`);
  try {
    const res = await fetch(url);
    if (!res.ok) {
        console.error('Fetch failed:', res.status);
        return;
    }
    const data = await res.json();
    console.log('--- Path Inspection ---');
    console.log('globalLinkage.profile:', !!data.globalLinkage?.profile);
    if (data.globalLinkage?.profile) {
        console.log('SectorZh:', data.globalLinkage.profile.sectorZh);
    }
    console.log('news structure:', Array.isArray(data.news) ? 'Array' : typeof data.news);
    if (data.news && !Array.isArray(data.news)) {
        console.log('news keys:', Object.keys(data.news));
    }
  } catch (err: any) {
    console.error('Error:', err.message);
  }
}

debugSnapshot();

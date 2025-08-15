// Simple smoke test for public availability endpoint and service-worker fetch
import https from 'https';
const url = process.argv[2] || 'https://myreflection.pl/api/public/availability?date=2025-08-14';

function fetchUrl(u) {
  return new Promise((resolve, reject) => {
    https.get(u, (res) => {
      let body = '';
      res.on('data', (d) => body += d);
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    }).on('error', reject);
  });
}

(async () => {
  try {
    console.log('Fetching:', url);
    const r = await fetchUrl(url);
    console.log('Status:', r.statusCode);
    try { console.log('Body:', JSON.parse(r.body)); } catch (e) { void e; console.log('Body:', r.body); }
  } catch (err) {
    console.error('Smoke test failed:', err && err.message ? err.message : err);
    if (typeof process !== 'undefined' && process.exit) process.exit(2);
  }
})();

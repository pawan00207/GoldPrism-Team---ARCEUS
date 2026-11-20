/** Build a local research corpus from the same date-wise GET used by the MCX Bhavcopy page. */
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { gzipSync, gunzipSync } from 'node:zlib';

const folder = fileURLToPath(new URL('./data/verified/', import.meta.url));
const symbols = new Set(['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL']);
const months = 'JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC'.split(' ');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const endpoint = 'https://www.mcxindia.com/market-data/bhavcopy/GetDateWiseBhavCopy';

function date(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value) {
    throw new Error('Expected a valid date in YYYY-MM-DD format: ' + value);
  }
  return value;
}

function parseExpiry(value) {
  const match = /^(\d{2})([A-Z]{3})(\d{4})$/.exec(value);
  if (!match) throw new Error('Invalid MCX expiry code: ' + value);
  const month = months.indexOf(match[2]) + 1;
  return date([match[3], String(month).padStart(2, '0'), match[1]].join('-'));
}

function numeric(value, integral = false) {
  if (value === null || value === undefined || String(value).trim() === '') throw new Error('Missing numeric observation');
  const result = Number(value);
  if (!Number.isFinite(result) || result < 0 || (integral && !Number.isSafeInteger(result))) throw new Error('Invalid numeric observation');
  return result;
}

export function parseSession(payload, requested) {
  if (payload.IsSuccess === false && payload.Data === null && payload.Message === 'No data found.') {
    return { status: 'NO_RECORDS', rows: [] };
  }
  if (payload.IsSuccess !== true || !Array.isArray(payload.Data)) throw new Error('Unexpected MCX API response');
  const dates = new Set(payload.Data.map((row) => {
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(row.Date).trim());
    if (!match) throw new Error('Malformed MCX trade date');
    return date([match[3], match[1].padStart(2, '0'), match[2].padStart(2, '0')].join('-'));
  }));
  if (!dates.size) return { status: 'NO_RECORDS', rows: [] };
  if (dates.size > 1) throw new Error('Mixed trade dates in MCX response for ' + requested);
  if (!dates.has(requested)) return { status: 'RETURNED_DIFFERENT_DATE', returned: [...dates][0], rows: [] };
  const keys = new Set();
  const rows = [];
  let unavailable = 0;
  for (const raw of payload.Data) {
    const symbol = String(raw.Symbol).trim();
    if (!symbols.has(symbol) || String(raw.InstrumentName).trim() !== 'FUTCOM') continue;
    const expiryCode = String(raw.ExpiryDate).trim();
    const expiryDate = parseExpiry(expiryCode);
    const key = symbol + ':' + expiryDate;
    if (keys.has(key)) throw new Error('Duplicate contract on ' + requested + ': ' + key);
    keys.add(key);
    const mark = numeric(raw.Close);
    if (mark === 0 || expiryDate < requested) { unavailable++; continue; }
    const open = numeric(raw.Open), high = numeric(raw.High), low = numeric(raw.Low);
    const volume = numeric(raw.Volume, true), openInterest = numeric(raw.OpenInterest, true);
    if (high < low || (volume > 0 && (low <= 0 || open < low || open > high))) throw new Error('Invalid trading range: ' + key);
    rows.push({ tradeDate: requested, symbol, expiryDate, expiryCode, open, high, low, close: mark, mark, volume, openInterest });
  }
  return { status: rows.length ? 'ACCEPTED' : 'NO_ELIGIBLE_MARKS', unavailable,
    rows: rows.sort((a, b) => a.symbol.localeCompare(b.symbol) || a.expiryDate.localeCompare(b.expiryDate)) };
}

function atomicWrite(target, bytes) {
  const temp = target + '.' + randomUUID() + '.tmp';
  writeFileSync(temp, bytes);
  renameSync(temp, target);
}

async function archiveSession(day) {
  const url = new URL(endpoint);
  url.searchParams.set('InstrumentName', 'FUTCOM');
  url.searchParams.set('fromDate', day.split('-').reverse().join('/'));
  const rawFile = path.join(folder, 'raw', day + '.json.gz');
  let bytes;
  if (existsSync(rawFile)) {
    bytes = gunzipSync(readFileSync(rawFile));
  } else {
    const res = await fetch(url, { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error('MCX ' + res.status + ' on ' + day + '. Prior corpus retained.');
    bytes = Buffer.from(await res.arrayBuffer());
    await delay(800);
  }
  const { rows, ...status } = parseSession(JSON.parse(bytes.toString('utf8')), day);
  if (!existsSync(rawFile)) atomicWrite(rawFile, gzipSync(bytes));
  return { rows, record: { requested: day, ...status, count: rows.length, url: url.href, rawSHA256: sha(bytes) } };
}

export async function build(start, end, split) {
  [start, end, split].forEach(date);
  if (!(start < split && split <= end)) throw new Error('Evaluation cutoff must be inside the historical range.');
  if (end >= new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' })) throw new Error('Use completed exchange dates only.');
  mkdirSync(path.join(folder, 'raw'), { recursive: true });
  const rows = [], sessions = [];
  for (let cursor = new Date(start + 'T00:00:00Z'); cursor.toISOString().slice(0, 10) <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const day = cursor.toISOString().slice(0, 10);
    const session = await archiveSession(day);
    rows.push(...session.rows);
    sessions.push(session.record);
    if (sessions.length % 10 === 0) console.log(day, sessions.length + ' dates checked,', rows.length + ' contract rows');
  }
  if (!rows.some((r) => r.tradeDate < split) || !rows.some((r) => r.tradeDate >= split)) throw new Error('Neither partition may be empty');
  const content = Buffer.from(JSON.stringify(rows));
  const sha256 = sha(content);
  const manifest = { version: 1, datasetName: 'MCX daily Bhavcopy • closing prices', priceBasis: 'CLOSE',
    provenanceStatus: 'MCX_BHAVCOPY_CLOSE', start, end, holdoutStartDate: split,
    configHash: sha(JSON.stringify({ parser: 1, endpoint, split, start, end })),
    sha256, totalRecords: rows.length, sessions, createdAt: new Date().toISOString() };
  atomicWrite(path.join(folder, sha256 + '.json'), content);
  atomicWrite(path.join(folder, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log('Published', sha256, rows.length + ' contract rows,', sessions.filter((s) => s.status === 'ACCEPTED').length + ' sessions');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [start, end, split] = process.argv.slice(2);
  if (!start || !end || !split) throw new Error('Usage: node research/build_mcx_history.mjs START END EVALUATION_START (YYYY-MM-DD)');
  await build(start, end, split);
}

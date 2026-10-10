import records from './dictionary.json' with { type: 'json' };

const fields = ['coptic', 'greek', 'pronunciation', 'english', 'phonetic', 'translation_en', 'translation_fr', 'translation_de', 'meaning'];
const fold = { أ:'ا', إ:'ا', آ:'ا', ٱ:'ا', ى:'ي', ة:'ه', '`':'' };
export function normalize(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase()
    .replace(/[\u0300-\u036f\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06edـ]/gu, '')
    .replace(/[أإآٱىة`]/gu, c => fold[c] ?? c)
    .replace(/\s+/gu, ' ').trim();
}
export function search(query, limit = 5) {
  const needle = normalize(query);
  if (!needle) return [];
  const exact = [], prefix = [], contains = [];
  for (const row of records) {
    const vals = fields.flatMap(k => String(row[k] ?? '').split(/[،,]/u)).map(normalize).filter(Boolean);
    if (vals.some(v => v === needle)) exact.push(row);
    else if (vals.some(v => v.startsWith(needle))) prefix.push(row);
    else if (vals.some(v => v.includes(needle))) contains.push(row);
    if (exact.length >= limit) break;
  }
  return [...exact, ...prefix, ...contains].slice(0, limit);
}
export function formatResult(row) {
  const lines = [`📖 ${row.coptic || '—'}`, `النطق: ${row.pronunciation || row.phonetic || '—'}`, `المعنى: ${row.meaning || row.english || '—'}`];
  if (row.english) lines.push(`English: ${row.english}`);
  if (row.kind) lines.push(`النوع: ${row.kind}`);
  if (row.origin) lines.push(`الأصل: ${row.origin}`);
  return lines.join('\n');
}

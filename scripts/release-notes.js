// CHANGELOG.md'den bir sürümün notlarını çıkarır: node scripts/release-notes.js 0.3.2
// Not yoksa hata koduyla çıkar (sürüm notsuz yayınlanmasın).
const fs = require('fs');
const path = require('path');

const version = (process.argv[2] || '').replace(/^v/, '');
const text = fs.readFileSync(path.join(__dirname, '..', 'CHANGELOG.md'), 'utf8');
const lines = text.split(/\r?\n/);
const start = lines.findIndex(l => new RegExp(`^##\\s+${version.replace(/\./g, '\\.')}(\\s|$)`).test(l));
if (!version || start < 0) {
  console.error(`CHANGELOG.md içinde ${version || '(sürüm yok)'} için not bulunamadı.`);
  process.exit(1);
}
let end = lines.findIndex((l, i) => i > start && /^##\s/.test(l));
if (end < 0) end = lines.length;
const body = lines.slice(start + 1, end).join('\n').trim();
if (!body) { console.error(`${version} notu boş.`); process.exit(1); }

const file = `Phasmo-Helper-Setup-${version}.exe`;
process.stdout.write(`${body}

---
**Kurulum:** \`${file}\` dosyasını indirip çalıştır; uygulama sonraki sürümlere kendiliğinden güncellenir.
**Install:** download and run \`${file}\`; the app updates itself automatically.
`);

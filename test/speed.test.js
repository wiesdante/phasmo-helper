// Hız ölçer testleri: node test/speed.test.js
// Gerçek oyundaki her olası hızı sanal vuruşlarla üretir ve eşleştirmenin doğru çalıştığını doğrular.
const L = require('../src/ghost-logic.js');
const G = require('../data/ghosts.json').ghosts;

let fail = 0, pass = 0;
function check(name, cond, info = '') {
  if (cond) pass++;
  else { fail++; console.log('FAIL', name, info); }
}

// Belirli bir hızda (m/s) ayak sesi zamanları üretir; jitter: her vuruşa ± rastgele hata (sn).
function taps(speed, n = 8, jitter = 0, rnd = Math.random) {
  const interval = 1 / speed - 0.075;
  const out = []; let t = 1000;
  for (let i = 0; i < n; i++) { out.push(t + (jitter ? (rnd() * 2 - 1) * jitter * 1000 : 0)); t += interval * 1000; }
  return out;
}
// Tekrarlanabilir rastgele sayı üreteci
function rng(seed) { return () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296); }

const MODS = [0.5, 0.75, 1, 1.25, 1.5];
const sample = ([a, b], k = 6) => Array.from({ length: k + 1 }, (_, i) => a + (b - a) * i / k);

// 1) Formül: hız → aralık → hız aynı kalmalı
for (const s of [0.4, 1, 1.2, 1.7, 2.5, 3, 3.71]) {
  const m = L.measureTaps(taps(s));
  check('roundtrip ' + s, Math.abs(m.speed - s) < 1e-9, m.speed);
}
check('1.7 m/s = 117 adım/dk', Math.round(L.stepsPerMinute(1.7)) === 117);

// 2) Her hayaletin her sabit hızı, her oyun ayarında ve Kanlı Ay'da 'steady' olmalı
for (const g of G) {
  const p = g.speedProfile;
  const steadyPts = p.steady.concat(...p.steadyRanges.map(r => sample(r)));
  for (const mod of MODS) for (const bloodMoon of [false, true]) {
    const k = mod * (bloodMoon ? L.BLOOD_MOON : 1);
    for (const v of steadyPts) {
      const c = L.classifySpeed(g, L.measureTaps(taps(v * k)), { modifier: mod, bloodMoon });
      check(`steady ${g.id} ${v} x${mod}${bloodMoon ? ' BM' : ''}`, c === 'steady', c);
    }
    // 3) Ulaşılabilir aralıktaki her hız en azından 'reach' olmalı (asla 'none' değil)
    for (const r of p.reach) for (const v of sample(r, 10)) {
      const c = L.classifySpeed(g, L.measureTaps(taps(v * k)), { modifier: mod, bloodMoon });
      check(`reach ${g.id} ${v.toFixed(3)} x${mod}${bloodMoon ? ' BM' : ''}`, c === 'steady' || c === 'reach', c);
    }
  }
}

// 4) Elle vuruş hatası (±50 ms): gerçek hayalet hiçbir zaman 'none' çıkmamalı
const r = rng(42); let jitterTrials = 0, jitterNone = 0, jitterSteady = 0, steadyTrials = 0;
for (const g of G) {
  const p = g.speedProfile;
  for (const v of p.steady) for (let t = 0; t < 40; t++) {
    const c = L.classifySpeed(g, L.measureTaps(taps(v, 8, 0.05, r)), {});
    steadyTrials++; if (c === 'steady') jitterSteady++;
    jitterTrials++; if (c === 'none') jitterNone++;
  }
  for (const rg of p.reach) for (const v of sample(rg, 8)) for (let t = 0; t < 20; t++) {
    const c = L.classifySpeed(g, L.measureTaps(taps(v, 8, 0.05, r)), {});
    jitterTrials++; if (c === 'none') jitterNone++;
  }
}
check('jitter: gerçek hayalet hiç elenmez', jitterNone === 0, `${jitterNone}/${jitterTrials}`);
console.log(`jitter ±50ms: gerçek hayalet elenme ${jitterNone}/${jitterTrials}, sabit hızda ⚡ oranı ${(100 * jitterSteady / steadyTrials).toFixed(1)}%`);

// 5) Kullanıcının gerçek vakaları
const cls = (id, speed, o = {}) => L.classifySpeed(G.find(g => g.id === id), L.measureTaps(taps(speed)), o);
check('Dayan @1.40 elenmemeli', cls('dayan', 1.40) !== 'none', cls('dayan', 1.40));
check('Yurei @2.00 elenmemeli', cls('yurei', 2.00) !== 'none', cls('yurei', 2.00));
const cand = G.filter(g => L.isPossible(g, ['orb', 'dots'], [], 3));
console.log('Orb+DOTS @2.00 m/s:', cand.map(g => `${g.id}=${L.classifySpeed(g, L.measureTaps(taps(2.0)), {})}`).join(' '));
console.log('Dayan-adayları @1.40:', G.filter(g => L.classifySpeed(g, L.measureTaps(taps(1.4)), {}) === 'steady').map(g => g.id).join(','));

// 6) Ayırt edicilik hâlâ var: 1,0 m/s'de standart hayaletler elenmeli, Revenant/Thaye ⚡
check('1.0: Yurei elenir', cls('yurei', 1.0) === 'none');
check('1.0: Revenant steady', cls('revenant', 1.0) === 'steady');
check('1.2: Dayan steady', cls('dayan', 1.2) === 'steady');
check('3.5: Yurei elenir (kovalama tepe hızı 2,8 üstü)', cls('yurei', 3.5) === 'none');
check('1.5: Yurei elenir (1,7 altı)', cls('yurei', 1.5) === 'none');
check('3.0: Revenant steady', cls('revenant', 3.0) === 'steady');

// 7) Değişken ritim (1,2 ↔ 2,25 karışık) uyarısı
const mixed = []; let t = 0;
for (const s of [1.2, 1.2, 1.2, 2.25, 2.25, 2.25, 1.2, 2.25, 1.2]) { mixed.push(t); t += (1 / s - 0.075) * 1000; }
check('karışık ritim → irregular', L.measureTaps(mixed).irregular === true, JSON.stringify(L.measureTaps(mixed)));
check('düzenli ritim → irregular değil', L.measureTaps(taps(1.7)).irregular === false);
check('3 vuruştan az → ölçüm yok', L.measureTaps(taps(1.7, 2)) === null);

console.log(`\n${pass} geçti, ${fail} başarısız`);
process.exit(fail ? 1 : 0);

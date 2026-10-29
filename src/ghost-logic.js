// Kanıt filtreleme mantığı (arayüzden bağımsız, test edilebilir).
// found / ruledOut: kanıt id dizileri. count: zorluğa göre gösterilen kanıt sayısı (0–3).
(function (root) {
  function isPossible(ghost, found, ruledOut, count) {
    const real = ghost.evidence;
    const fake = ghost.fakeEvidence || null;           // Mimic'in sahte orb'u
    const all = fake ? real.concat(fake) : real;

    // Bulunan her kanıt bu hayalette olmalı.
    if (!found.every(e => all.includes(e))) return false;

    // Sahte kanıt her zaman görünür: elenmişse bu hayalet olamaz.
    if (fake && ruledOut.includes(fake)) return false;

    const foundReal = found.filter(e => real.includes(e)).length;
    if (foundReal > count) return false;                // zorluğun izin verdiğinden fazla kanıt

    const ruledReal = ruledOut.filter(e => real.includes(e)).length;
    if (ruledReal > 3 - count) return false;            // gizlenebilecekten fazla kanıt elendi

    // Zorunlu kanıt: azaltılmış kanıtta bile her zaman gösterilir.
    if (ghost.forced && count > 0) {
      if (ruledOut.includes(ghost.forced)) return false;
      if (foundReal === count && !found.includes(ghost.forced)) return false;
    }
    return true;
  }

  // Kalan olası hayaletlerde hâlâ çıkabilecek kanıtlar.
  // Bir hayaletin gösterilebilecek kanıt sayısı dolduysa diğer kanıtları artık çıkmaz.
  function remainingEvidence(ghosts, found, count = 3) {
    const set = new Set();
    ghosts.forEach(g => {
      const foundReal = found.filter(e => g.evidence.includes(e)).length;
      if (foundReal < count) g.evidence.forEach(e => set.add(e));
      if (g.fakeEvidence) set.add(g.fakeEvidence);
    });
    found.forEach(e => set.delete(e));
    return set;
  }

  // --- Hız ---
  // Topluluk ölçümü (Zero Network): iki ayak sesi arası süre = 1 / hız − 0,075 sn.
  const STEP_OFFSET = 0.075;
  const MIN_TIMING_ERROR = 0.05;   // elle vuruşta varsayılan en düşük zamanlama hatası (sn); ±50 ms'ye kadar gerçek hayalet elenmez
  const BLOOD_MOON = 1.15;         // Kanlı Ay hava durumu hayaletleri %15 hızlandırır

  function speedFromInterval(sec) { return 1 / (sec + STEP_OFFSET); }
  function stepsPerMinute(speed) { return 60 / (1 / speed - STEP_OFFSET); }

  function median(arr) {
    const a = [...arr].sort((x, y) => x - y);
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  // Vuruş zamanlarından (ms) hız ve belirsizlik aralığı hesaplar. En az 3 vuruş gerekir.
  // Aralık: ortanca aralık ± max(50 ms, aralıkların ortanca mutlak sapması).
  function measureTaps(tapsMs) {
    if (!tapsMs || tapsMs.length < 3) return null;
    const iv = [];
    for (let i = 1; i < tapsMs.length; i++) iv.push((tapsMs[i] - tapsMs[i - 1]) / 1000);
    const med = median(iv);
    const mad = median(iv.map(x => Math.abs(x - med)));
    const err = Math.max(MIN_TIMING_ERROR, mad);
    return {
      interval: med,
      spm: 60 / med,
      speed: speedFromInterval(med),
      lo: speedFromInterval(med + err),
      hi: speedFromInterval(Math.max(0.05, med - err)),
      irregular: mad > 0.08 && mad / med > 0.12   // ritim çok düzensiz: büyük ihtimalle hız değişti
    };
  }

  // Ölçümü hayaletin hız profiliyle karşılaştırır.
  // 'steady' = normal sabit hızlarından biriyle uyuşuyor
  // 'reach'  = sadece kovalama ivmesi / yavaşlama / hal geçişi sırasında bu hıza çıkabilir
  // 'none'   = bu hıza hiç çıkamaz
  // opts.modifier: oyunun hayalet hızı ayarı (1 = %100); opts.bloodMoon: Kanlı Ay hava durumu.
  function classifySpeed(ghost, meas, opts = {}) {
    const sp = ghost.speedProfile;
    if (!sp || !meas) return null;
    const k = (opts.modifier || 1) * (opts.bloodMoon ? BLOOD_MOON : 1);
    const lo = meas.lo, hi = meas.hi;
    const overlaps = (a, b) => hi >= a * k && lo <= b * k;
    if (sp.steady.some(v => overlaps(v, v)) || sp.steadyRanges.some(([a, b]) => overlaps(a, b))) return 'steady';
    if (sp.reach.some(([a, b]) => overlaps(a, b))) return 'reach';
    return 'none';
  }

  const api = { isPossible, remainingEvidence, speedFromInterval, stepsPerMinute, measureTaps, classifySpeed, BLOOD_MOON };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GhostLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);

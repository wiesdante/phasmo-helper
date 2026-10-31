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
  const TAP_SIGMA = 0.035;        // elle vuruşun varsayılan zamanlama hatası (sn, standart sapma)
  const ERR_Z = 3;                // aralık genişliği: ±3 standart hata (gerçek hayalet neredeyse hiç elenmez)
  const BLOOD_MOON = 1.15;         // Kanlı Ay hava durumu hayaletleri %15 hızlandırır

  function speedFromInterval(sec) { return 1 / (sec + STEP_OFFSET); }
  function stepsPerMinute(speed) { return 60 / (1 / speed - STEP_OFFSET); }

  function median(arr) {
    const a = [...arr].sort((x, y) => x - y);
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  // Vuruş zamanlarından (ms) hız ve belirsizlik aralığı hesaplar. En az 3 vuruş gerekir.
  // Adım aralığı, tüm vuruşlara uyan doğrunun eğimidir (en küçük kareler): tek tek aralıklara bakmaktan
  // çok daha az hatalıdır, çünkü her vuruşun hatası bütün ölçüme yayılır. Vuruş arttıkça aralık daralır.
  // Aralık: eğim ± 3 × standart hata; standart hata en az 35 ms'lik vuruş hatasıyla hesaplanır.
  function measureTaps(tapsMs) {
    if (!tapsMs || tapsMs.length < 3) return null;
    const t = tapsMs.map(x => x / 1000), n = t.length, xm = (n - 1) / 2;
    const ym = t.reduce((a, b) => a + b, 0) / n;
    let sxx = 0, sxy = 0;
    for (let i = 0; i < n; i++) { sxx += (i - xm) ** 2; sxy += (i - xm) * (t[i] - ym); }
    const step = sxy / sxx;
    let rss = 0;
    for (let i = 0; i < n; i++) rss += (t[i] - (ym + step * (i - xm))) ** 2;
    const resid = n > 2 ? Math.sqrt(rss / (n - 2)) : 0;
    const err = ERR_Z * Math.max(TAP_SIGMA, resid) / Math.sqrt(sxx);
    // Ritim düzensizliği (hız ölçüm sırasında değişti mi): tek tek aralıkların yayılımına bakılır.
    const iv = [];
    for (let i = 1; i < n; i++) iv.push(t[i] - t[i - 1]);
    const med = median(iv);
    const mad = median(iv.map(x => Math.abs(x - med)));
    return {
      interval: step,
      spm: 60 / step,
      speed: speedFromInterval(step),
      lo: speedFromInterval(step + err),
      hi: speedFromInterval(Math.max(0.05, step - err)),
      irregular: mad > 0.08 && mad / med > 0.12
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

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
  function speedFromInterval(sec) { return 1 / (sec + STEP_OFFSET); }
  function stepsPerMinute(speed) { return 60 / (1 / speed - STEP_OFFSET); }

  // Ölçülen hız hayaletin olası hızlarından birine uyuyor mu?
  // opts.modifier: oyunun hayalet hızı ayarı (1 = %100). opts.los: kovalarken (görüş hattında) ölçüldü mü.
  function speedMatches(ghost, measured, opts = {}) {
    const sc = ghost.speedCheck;
    if (!sc || !measured) return true;
    const m = opts.modifier || 1;
    const losMul = opts.los && sc.los ? 1.65 : 1;
    const tol = Math.max(0.1, measured * 0.07);
    const inRange = (lo, hi) => measured >= lo - tol && measured <= hi + tol;
    return sc.values.some(v => inRange(v * m, v * m * losMul)) ||
           sc.ranges.some(([a, b]) => inRange(a * m, b * m * losMul));
  }

  const api = { isPossible, remainingEvidence, speedFromInterval, stepsPerMinute, speedMatches };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GhostLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);

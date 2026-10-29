// Klavye olayını Electron kısayol biçimine çevirir (ör. "Ctrl+F8", "num1") ve okunur hâle getirir.
(function (root) {
  const SPECIAL = {
    ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
    Insert: 'Insert', Delete: 'Delete', Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
    Space: 'Space', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\',
    Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backquote: '`',
    NumpadAdd: 'numadd', NumpadSubtract: 'numsub', NumpadMultiply: 'nummult',
    NumpadDivide: 'numdiv', NumpadDecimal: 'numdec', Pause: 'Pause', ScrollLock: 'Scrolllock'
  };
  const MODIFIER_CODES = ['ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'ShiftLeft', 'ShiftRight', 'MetaLeft', 'MetaRight'];

  // Ana tuşu çıkar; desteklenmiyorsa null.
  function keyFromCode(code) {
    let m;
    if ((m = /^Key([A-Z])$/.exec(code))) return m[1];
    if ((m = /^Digit(\d)$/.exec(code))) return m[1];
    if ((m = /^Numpad(\d)$/.exec(code))) return 'num' + m[1];
    if ((m = /^F(\d{1,2})$/.exec(code)) && Number(m[1]) >= 1 && Number(m[1]) <= 24) return 'F' + m[1];
    return SPECIAL[code] || null;
  }

  // { accel } | { modifierOnly: true } | { unsupported: true }
  function fromEvent(e) {
    if (MODIFIER_CODES.includes(e.code)) return { modifierOnly: true };
    const key = keyFromCode(e.code);
    if (!key) return { unsupported: true };
    const mods = [];
    if (e.ctrlKey) mods.push('Ctrl');
    if (e.altKey) mods.push('Alt');
    if (e.shiftKey) mods.push('Shift');
    return { accel: mods.concat(key).join('+'), key, hasModifier: mods.length > 0 };
  }

  // Oyunda yazı/hareket tuşlarını engelleyebilecek tek tuşlar (harf, rakam, boşluk, noktalama).
  function isRisky(accel) {
    if (!accel || accel.includes('+')) return false;
    return /^([A-Z0-9]|Space|[-=\[\]\;',./`])$/.test(accel);
  }

  const NICE = { numadd: 'Num +', numsub: 'Num −', nummult: 'Num *', numdiv: 'Num /', numdec: 'Num .', Space: 'Space', Scrolllock: 'ScrollLock' };
  function format(accel) {
    if (!accel) return '';
    return accel.split('+').map(p => {
      const m = /^num(\d)$/.exec(p);
      if (m) return 'Num ' + m[1];
      return NICE[p] || p;
    }).join(' + ');
  }

  const api = { fromEvent, isRisky, format, keyFromCode };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ShortcutKeys = api;
})(typeof window !== 'undefined' ? window : globalThis);

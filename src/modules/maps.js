// Haritalar (Bilgi sekmesinin alt bölümü): büyüklük, katlar, sigorta, notlar ve 7 lanetli eşyanın konumu.
App.registerSection({
  id: 'maps',
  SIZE_INDEX: { s: 0, m: 1, l: 2 },
  STORAGE_KEY: 'mapsOpen',

  async mount(panel, app) {
    this.panel = panel;
    this.app = app;
    const [maps, cursed] = await Promise.all([window.api.getData('maps'), window.api.getData('cursed')]);
    this.data = maps;
    this.items = cursed.items;     // lanetli eşya adları ve sırası
    try { this.expanded = localStorage.getItem(this.STORAGE_KEY); } catch { this.expanded = null; }
    this.render();
  },

  cursedFor(map) {
    if (map.cursed) return { list: map.cursed, unverified: false };
    if (map.cursedSameAs) {
      const base = this.data.maps.find(m => m.id === map.cursedSameAs);
      return { list: base && base.cursed, unverified: !!map.cursedUnverified, sameAs: base && base.name };
    }
    return { list: null };
  },

  render() {
    const app = this.app;
    const e = s => app.esc(s);
    const list = items => items && items.length ? `<ul>${items.map(i => `<li>${e(i)}</li>`).join('')}</ul>` : '';
    const sizeName = s => app.t(`timers.size.${this.SIZE_INDEX[s]}`);

    const card = map => {
      const open = this.expanded === map.id;
      const c = this.cursedFor(map);
      const rows = c.list ? this.items.map(it => c.list[it.id]
        ? `<tr><th>${e(app.pick(it.name))}</th><td>${e(app.pick(c.list[it.id]))}</td></tr>` : '').join('') : '';
      return `<li class="cp ${open ? 'open' : ''}">
        <button class="cp-head map-head" data-expand="${map.id}">
          <span>${open ? '▾' : '▸'} ${e(map.name)}</span>
          <span class="size-badge size-${map.size}">${e(sizeName(map.size))}</span>
        </button>
        ${open ? `<div class="cp-body">
          <dl class="map-facts">
            <dt>${e(app.t('maps.size'))}</dt><dd>${e(sizeName(map.size))}${map.sizeNote ? ` (${e(app.pick(map.sizeNote))})` : ''}
              <button class="link no-push map-use" data-size="${map.size}">${e(app.t('maps.useInTimers'))}</button></dd>
            <dt>${e(app.t('maps.layout'))}</dt><dd>${e(app.pick(map.floors))}</dd>
            <dt>${e(app.t('maps.fuse'))}</dt><dd>${map.fuse ? e(app.pick(map.fuse)) : `<span class="muted">${e(app.t('maps.unknown'))}</span>`}</dd>
          </dl>
          ${list(app.pick(map.notes))}
          <div class="cp-sec">${e(app.t('maps.cursedTitle'))}</div>
          ${c.sameAs ? `<p class="hint">${e(app.t(c.unverified ? 'maps.sameAsUnverified' : 'maps.sameAs', { name: c.sameAs }))}</p>` : ''}
          ${rows ? `<table class="map-cursed">${rows}</table>` : `<p class="muted">${e(app.t('maps.unknown'))}</p>`}
        </div>` : ''}
      </li>`;
    };

    const groups = ['s', 'm', 'l'].map(s => {
      const maps = this.data.maps.filter(m => m.size === s);
      return maps.length ? `<h3>${e(app.t('maps.group.' + s))}</h3><ul class="cp-list">${maps.map(card).join('')}</ul>` : '';
    }).join('');

    this.panel.innerHTML = `
      <details class="cp-general" ${this.generalOpen ? 'open' : ''}>
        <summary>${e(app.t('maps.general'))}</summary>
        ${list(app.pick(this.data.general))}
      </details>
      ${groups}`;

    this.panel.querySelectorAll('[data-expand]').forEach(b => b.onclick = () => {
      this.expanded = this.expanded === b.dataset.expand ? null : b.dataset.expand;
      try { localStorage.setItem(this.STORAGE_KEY, this.expanded || ''); } catch {}
      this.render();
    });
    this.panel.querySelectorAll('.map-use').forEach(b => b.onclick = () => {
      app.emit('timers:setSize', this.SIZE_INDEX[b.dataset.size]);
      app.toast(app.t('maps.usedInTimers', { size: sizeName(b.dataset.size) }));
    });
    const g = this.panel.querySelector('.cp-general');
    g.ontoggle = () => { this.generalOpen = g.open; };
  },

  onLanguageChange() { this.render(); }
});

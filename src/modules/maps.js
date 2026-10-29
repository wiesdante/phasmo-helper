// Haritalar (Bilgi sekmesinin alt bölümü): her haritada 7 lanetli eşyanın konumu.
App.registerSection({
  id: 'maps',
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

    const card = map => {
      const open = this.expanded === map.id;
      const c = this.cursedFor(map);
      const rows = c.list ? this.items.map(it => c.list[it.id]
        ? `<tr><th>${e(app.pick(it.name))}</th><td>${e(app.pick(c.list[it.id]))}</td></tr>` : '').join('') : '';
      return `<li class="cp ${open ? 'open' : ''}">
        <button class="cp-head" data-expand="${map.id}"><span>${open ? '▾' : '▸'} ${e(map.name)}</span></button>
        ${open ? `<div class="cp-body">
          ${c.sameAs ? `<p class="hint">${e(app.t(c.unverified ? 'maps.sameAsUnverified' : 'maps.sameAs', { name: c.sameAs }))}</p>` : ''}
          ${rows ? `<table class="map-cursed">${rows}</table>` : `<p class="muted">${e(app.t('maps.unknown'))}</p>`}
        </div>` : ''}
      </li>`;
    };

    this.panel.innerHTML = `
      <details class="cp-general" ${this.generalOpen ? 'open' : ''}>
        <summary>${e(app.t('maps.general'))}</summary>
        ${list(app.pick(this.data.general))}
      </details>
      <ul class="cp-list">${this.data.maps.map(card).join('')}</ul>`;

    this.panel.querySelectorAll('[data-expand]').forEach(b => b.onclick = () => {
      this.expanded = this.expanded === b.dataset.expand ? null : b.dataset.expand;
      try { localStorage.setItem(this.STORAGE_KEY, this.expanded || ''); } catch {}
      this.render();
    });
    const g = this.panel.querySelector('.cp-general');
    g.ontoggle = () => { this.generalOpen = g.open; };
  },

  onLanguageChange() { this.render(); }
});

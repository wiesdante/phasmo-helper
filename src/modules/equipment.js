// Ekipman (Bilgi sekmesinin alt bölümü): kategorilere ayrılmış açılır kartlar, I/II/III seviye tablosu, ipuçları.
App.registerSection({
  id: 'equipment',
  async mount(panel, app) {
    this.panel = panel;
    this.app = app;
    this.data = await window.api.getData('equipment');
    this.expanded = null;
    this.render();
  },

  render() {
    const app = this.app;
    const e = s => app.esc(s);
    const list = items => items && items.length ? `<ul>${items.map(i => `<li>${e(i)}</li>`).join('')}</ul>` : '';
    const TIERS = ['I', 'II', 'III'];

    const card = it => {
      const open = this.expanded === it.id;
      const tips = app.pick(it.tips) || [];
      return `<li class="cp ${open ? 'open' : ''}">
        <button class="cp-head" data-expand="${it.id}">
          <span>${open ? '▾' : '▸'} ${e(app.pick(it.name))}</span>
          <span class="cp-sum">${e(app.pick(it.summary))}</span>
        </button>
        ${open ? `<div class="cp-body">
          <table class="tier-table">
            ${it.tiers.map((t, i) => `<tr><th>${TIERS[i]}</th><td>${e(app.pick(t))}</td></tr>`).join('')}
          </table>
          ${tips.length ? `<div class="cp-sec">${e(app.t('equipment.tips'))}</div>${list(tips)}` : ''}
        </div>` : ''}
      </li>`;
    };

    const cats = this.data.categories.map(c => {
      const items = this.data.items.filter(i => i.category === c.id);
      return `<h3>${e(app.pick(c.name))}</h3><ul class="cp-list">${items.map(card).join('')}</ul>`;
    }).join('');

    this.panel.innerHTML = `
      <details class="cp-general" ${this.generalOpen ? 'open' : ''}>
        <summary>${e(app.t('equipment.general'))}</summary>
        ${list(app.pick(this.data.general))}
      </details>
      ${cats}`;

    this.panel.querySelectorAll('[data-expand]').forEach(b => b.onclick = () => {
      this.expanded = this.expanded === b.dataset.expand ? null : b.dataset.expand;
      this.render();
    });
    const g = this.panel.querySelector('.cp-general');
    g.ontoggle = () => { this.generalOpen = g.open; };
  },

  onLanguageChange() { this.render(); }
});

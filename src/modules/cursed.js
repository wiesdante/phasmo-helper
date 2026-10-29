// Lanetli eşyalar (Bilgi sekmesinin alt bölümü): genel kurallar + her eşya için açılır kart.
App.registerSection({
  id: 'cursed',
  async mount(panel, app) {
    this.panel = panel;
    this.app = app;
    this.data = await window.api.getData('cursed');
    this.expanded = null;
    this.render();
  },

  render() {
    const app = this.app;
    const e = s => app.esc(s);
    const list = (items, cls = '') => items && items.length
      ? `<ul class="${cls}">${items.map(i => `<li>${e(i)}</li>`).join('')}</ul>` : '';

    const table = tb => {
      if (!tb) return '';
      const cols = app.pick(tb.cols);
      return `<table class="cp-table">
        <tr>${cols.map(c => `<th>${e(c)}</th>`).join('')}</tr>
        ${tb.rows.map(r => `<tr>${app.pick(r).map(c => `<td>${e(c)}</td>`).join('')}</tr>`).join('')}
      </table>`;
    };

    const items = this.data.items.map(it => {
      const open = this.expanded === it.id;
      return `<li class="cp ${open ? 'open' : ''}">
        <button class="cp-head" data-expand="${it.id}">
          <span>${open ? '▾' : '▸'} ${e(app.pick(it.name))}</span>
          <span class="cp-sum">${e(app.pick(it.summary))}</span>
        </button>
        ${open ? `<div class="cp-body">
          <div class="cp-sec">${e(app.t('cursed.use'))}</div>${list(app.pick(it.use))}
          ${table(it.table)}
          <div class="cp-sec danger">${e(app.t('cursed.danger'))}</div>${list(app.pick(it.danger), 'rules-out')}
          ${it.tips ? `<div class="cp-sec">${e(app.t('cursed.tips'))}</div>${list(app.pick(it.tips))}` : ''}
        </div>` : ''}
      </li>`;
    }).join('');

    this.panel.innerHTML = `
      <details class="cp-general" ${this.generalOpen ? 'open' : ''}>
        <summary>${e(app.t('cursed.general'))}</summary>
        ${list(app.pick(this.data.general))}
      </details>
      <ul class="cp-list">${items}</ul>`;

    this.panel.querySelectorAll('[data-expand]').forEach(b => b.onclick = () => {
      this.expanded = this.expanded === b.dataset.expand ? null : b.dataset.expand;
      this.render();
    });
    const g = this.panel.querySelector('.cp-general');
    g.ontoggle = () => { this.generalOpen = g.open; };
  },

  onLanguageChange() { this.render(); }
});

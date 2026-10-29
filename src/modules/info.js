// Bilgi sekmesi: üstte alt sekmeler (Ekipman | Lanetli | ...), her biri ayrı bir bölüm modülü.
App.register({
  id: 'info',
  STORAGE_KEY: 'infoSection',

  async mount(panel, app) {
    this.panel = panel;
    this.app = app;
    let saved = null;
    try { saved = localStorage.getItem(this.STORAGE_KEY); } catch {}
    this.current = app.sections.some(s => s.id === saved) ? saved : app.sections[0].id;

    panel.innerHTML = `<div class="seg seg-wide info-seg"></div><div class="info-body"></div>`;
    const seg = panel.querySelector('.info-seg');
    const body = panel.querySelector('.info-body');
    for (const sec of app.sections) {
      const b = document.createElement('button');
      b.dataset.section = sec.id;
      b.dataset.i18n = `info.${sec.id}`;
      b.onclick = () => this.show(sec.id);
      seg.appendChild(b);
      const div = document.createElement('div');
      div.className = 'info-section';
      div.id = `info-${sec.id}`;
      body.appendChild(div);
      await sec.mount(div, app);
    }
    app.translateDom(panel);
    this.show(this.current);
  },

  show(id) {
    this.current = id;
    try { localStorage.setItem(this.STORAGE_KEY, id); } catch {}
    this.panel.querySelectorAll('[data-section]').forEach(b => b.classList.toggle('active', b.dataset.section === id));
    this.panel.querySelectorAll('.info-section').forEach(d => { d.hidden = d.id !== `info-${id}`; });
  },

  onLanguageChange() {
    this.app.translateDom(this.panel.querySelector('.info-seg'));
    this.app.sections.forEach(s => s.onLanguageChange && s.onLanguageChange());
  }
});

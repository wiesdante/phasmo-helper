// Hayalet ansiklopedisi: arama + açılır detay kartları.
App.register({
  id: 'ghosts',
  async mount(panel, app) {
    this.panel = panel;
    this.app = app;
    const data = await app.loadGameData();
    this.evidence = data.evidence;
    this.ghosts = data.ghosts;
    this.query = '';
    this.expanded = null;
    this.render();
  },

  render() {
    const app = this.app;
    this.panel.innerHTML = `
      <input type="text" id="gh-search" placeholder="${app.esc(app.t('ghosts.search'))}" value="${app.esc(this.query)}">
      <ul class="ghost-list" id="gh-list"></ul>`;
    const input = this.panel.querySelector('#gh-search');
    input.oninput = () => { this.query = input.value; this.renderList(); };
    this.renderList();
  },

  renderList() {
    const app = this.app;
    const q = this.query.trim().toLocaleLowerCase(app.lang());
    const items = this.ghosts
      .filter(g => !q || app.pick(g.name).toLocaleLowerCase(app.lang()).includes(q))
      .sort((a, b) => app.pick(a.name).localeCompare(app.pick(b.name)));
    const list = this.panel.querySelector('#gh-list');
    list.innerHTML = items.map(g => {
      const open = this.expanded === g.id;
      return `<li class="ghost ${open ? 'open' : ''}">
        <div class="ghost-row"><button class="ghost-name" data-expand="${g.id}">${open ? '▾' : '▸'} ${app.esc(app.pick(g.name))}</button></div>
        ${open ? app.renderGhostDetail(g, this.evidence) : ''}
      </li>`;
    }).join('') || `<li class="muted">${app.esc(app.t('evidence.none'))}</li>`;
    list.querySelectorAll('[data-expand]').forEach(b => b.onclick = () => {
      this.expanded = this.expanded === b.dataset.expand ? null : b.dataset.expand;
      this.renderList();
    });
  },

  onLanguageChange() { this.render(); }
});

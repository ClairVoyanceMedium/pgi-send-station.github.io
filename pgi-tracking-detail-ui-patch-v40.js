// PGI Send Station — Patch UI tracking détail v40
// Objectif : afficher dans le Dashboard l'adresse email, le lien cliqué, l'URL exacte et l'heure du clic.
// Installation : coller ce bloc dans index.html juste avant : document.addEventListener('DOMContentLoaded',init);
// Sécurité : ne touche pas à l'automatisation, au Worker, au cron, au SMTP, aux campagnes, aux contacts ni aux templates.

(function installPGITrackingDetailPatch(){
  if (window.__PGI_TRACKING_DETAIL_PATCH_V40__) return;
  window.__PGI_TRACKING_DETAIL_PATCH_V40__ = true;

  function pgiEsc(str){
    return String(str || '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  function pgiFmtDate(iso){
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'2-digit'}) + ' ' +
             d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
    } catch {
      return '—';
    }
  }

  function pgiLinkLabel(click){
    if (!click) return '—';
    const label = click.label || click.lastClickedLabel || '';
    if (label) return label;
    const url = click.url || click.lastClickedUrl || '';
    try {
      const u = new URL(url);
      return (u.hostname + u.pathname).replace(/\/$/, '') || url;
    } catch {
      return url || '—';
    }
  }

  function pgiNormalizeClicks(row){
    const out = [];
    if (Array.isArray(row && row.clicks)) out.push(...row.clicks);
    if (row && row.lastClickedUrl && !out.find(c => c.url === row.lastClickedUrl && c.at === row.lastClickedAt)) {
      out.push({
        url: row.lastClickedUrl,
        label: row.lastClickedLabel || row.lastClickedUrl,
        at: row.lastClickedAt || row.date || null
      });
    }
    return out.filter(c => c && (c.url || c.label));
  }

  function pgiLatestClick(row){
    const clicks = pgiNormalizeClicks(row);
    if (!clicks.length) return null;
    return clicks.slice().sort((a,b)=>new Date(b.at || 0)-new Date(a.at || 0))[0];
  }

  function pgiClickCell(row){
    const clicks = pgiNormalizeClicks(row);
    if (!clicks.length) {
      return '<span style="color:var(--text3);font-size:10px">—</span>';
    }
    const latest = pgiLatestClick(row);
    const label = pgiLinkLabel(latest);
    const url = latest.url || latest.lastClickedUrl || '';
    const at = latest.at || latest.lastClickedAt || '';
    const allDetails = clicks
      .slice()
      .sort((a,b)=>new Date(b.at || 0)-new Date(a.at || 0))
      .map((c,i)=>`${i+1}. ${pgiLinkLabel(c)}\n${c.url || ''}\n${pgiFmtDate(c.at)}`)
      .join('\n\n');

    return `
      <div title="${pgiEsc(allDetails)}" style="min-width:210px;max-width:360px;line-height:1.55;">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:3px;">
          <span class="tg tg-open" style="background:rgba(0,232,255,.10);color:var(--cyan);border:1px solid rgba(0,232,255,.25);">🔗 ${clicks.length} clic${clicks.length>1?'s':''}</span>
          <span style="font-family:var(--mono);font-size:8px;color:var(--text3);">${pgiEsc(pgiFmtDate(at))}</span>
        </div>
        <div style="font-size:10px;color:var(--cyan);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${pgiEsc(label)}</div>
        <div style="font-family:var(--mono);font-size:8px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${pgiEsc(url)}</div>
      </div>`;
  }

  function pgiEnsureAnalyticsHeader(){
    const table = document.querySelector('#analytics-body')?.closest('table');
    if (!table) return;
    const headRow = table.querySelector('thead tr');
    if (!headRow) return;
    const target = 'Email</th><th>Campagne</th><th>Date</th><th>Statut</th><th>Lu</th><th>Clics</th><th>Détail clic</th><th>Désabonné</th>';
    if (!/Détail clic|Detail clic/i.test(headRow.textContent || '')) {
      headRow.innerHTML = '<th onclick="sortAnalytics(\'email\')">Email</th><th>Campagne</th><th onclick="sortAnalytics(\'date\')">Date</th><th>Statut</th><th>Lu</th><th>Clics</th><th>Détail clic</th><th>Désabonné</th>';
    }
  }

  function pgiStatusTag(row){
    if (row.status === 'error') return '<span class="tg tg-err">✕ ERR</span>';
    if (row.unsubscribed) return '<span class="tg tg-unsb">🚫 STOP</span>';
    return '<span class="tg tg-sent">✓ ENV</span>';
  }

  window.renderAnalytics = function renderAnalyticsPatched(append=false){
    const tbody = document.getElementById('analytics-body');
    if (!tbody) return;
    pgiEnsureAnalyticsHeader();

    let logs = typeof getAllEmailLogs === 'function' ? getAllEmailLogs() : ((window.S && S.analytics) || []);
    if (window._df && _df.mode !== 'all' && typeof inRange === 'function') logs = logs.filter(x => inRange(x.date));

    if (window._efMode === 'sent') logs = logs.filter(x => !x.opened && !x.unsubscribed && x.status !== 'error');
    else if (window._efMode === 'opened') logs = logs.filter(x => x.opened);
    else if (window._efMode === 'noread') logs = logs.filter(x => !x.opened && !x.unsubscribed && x.status !== 'error');
    else if (window._efMode === 'error') logs = logs.filter(x => x.status === 'error');
    else if (window._efMode === 'unsub') logs = logs.filter(x => x.unsubscribed);

    if (window._analyticsSort) {
      logs.sort((a,b)=>{
        const va = _analyticsSort.f === 'email' ? (a.email || '') : (a.date || '');
        const vb = _analyticsSort.f === 'email' ? (b.email || '') : (b.date || '');
        return _analyticsSort.asc ? (va < vb ? -1 : 1) : (va > vb ? -1 : 1);
      });
    }

    const cnt = document.getElementById('email-count-lbl');
    if (cnt) cnt.textContent = logs.length.toLocaleString() + ' email(s)';

    const pageSize = window.PAGE_SZ || 100;
    const page = window._analyticsPage || 0;
    const end = (page + 1) * pageSize;
    const slice = logs.slice(0, end);
    const more = document.getElementById('analytics-more');
    if (more) more.style.display = logs.length > end ? 'block' : 'none';

    if (!slice.length) {
      tbody.innerHTML = '<tr><td colspan="8"><div class="empty" style="padding:16px"><p>Aucun envoi sur cette période</p></div></td></tr>';
      return;
    }

    const rows = slice.map(x => {
      const clicks = pgiNormalizeClicks(x);
      const openedCell = x.opened
        ? `<span class="tg tg-open">👁 LU</span><span style="font-size:8px;color:var(--text3);margin-left:3px">${pgiEsc(pgiFmtDate(x.openedAt))}</span>`
        : '<span class="tg tg-unrd">⊘ NON LU</span>';

      return `<tr>
        <td class="em">${pgiEsc(x.email || '?')}</td>
        <td style="font-size:10px;color:var(--text2)">${pgiEsc(x.campaign || '—')}</td>
        <td style="font-family:var(--mono);font-size:9px;color:var(--text3)">${pgiEsc(pgiFmtDate(x.date))}</td>
        <td>${pgiStatusTag(x)}</td>
        <td>${openedCell}</td>
        <td style="font-family:var(--mono);font-size:10px;color:${clicks.length ? 'var(--cyan)' : 'var(--text3)'}">${clicks.length}</td>
        <td>${pgiClickCell(x)}</td>
        <td>${x.unsubscribed ? '<span class="tg tg-unsb">🚫</span>' : ''}</td>
      </tr>`;
    }).join('');

    if (append) tbody.innerHTML += rows;
    else tbody.innerHTML = rows;
  };

  const oldRenderDashboard = window.renderDashboard;
  if (typeof oldRenderDashboard === 'function') {
    window.renderDashboard = function renderDashboardWithClickDetails(){
      oldRenderDashboard.apply(this, arguments);
      try { pgiEnsureAnalyticsHeader(); } catch(_) {}
    };
  }
})();

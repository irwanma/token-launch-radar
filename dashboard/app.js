// Token Launch Radar — the interactive board. Renders window.RADAR (data.js, shipped beside
// this page) into the full sortable board and per-protocol detail views. Routes: #p=<slug>
// opens a protocol's detail, #robust shows the ROBUST farms ranked by net per hour at P25.
// No network references: everything renders from the data file the build wrote.

const R = window.RADAR;
const rows = R.rows;
const bySlug = new Map(rows.map((r) => [r.slug, r]));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmt$ = (n) => (n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : `$${Math.round(n)}`);
const fmtFull$ = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
const fmtS$ = (n) => `${n < 0 ? '−' : '+'}$${Math.abs(n).toFixed(2)}`;
const fmtC$ = (n) => `$${n.toFixed(2)}`;
const yrs = (d) => `${(d / 365).toFixed(1)} yrs`;
const verdictOf = (r) => (r.farm.robust ? 'ROBUST' : r.farm.verdict);

const state = { q: '', verdict: 'ALL', cls: 'ALL', watch: false, sortKey: 'rank', sortDir: 1 };
const SORTS = {
  rank: (r) => r.rank, tvl: (r) => r.tvl_usd, value: (r) => r.implied_value_usd,
  net: (r) => r.farm.net, nethr: (r) => r.farm.net_hr, farmrank: (r) => r.farm_rank,
  wait: (r) => r.farm.max_wait_months,
};

function visibleRows() {
  const q = state.q.trim().toLowerCase();
  let out = rows.filter((r) => {
    if (state.verdict !== 'ALL' && verdictOf(r) !== state.verdict) return false;
    if (state.cls !== 'ALL' && r.farm.cls !== state.cls) return false;
    if (state.watch && !r.watchlist) return false;
    if (q && !`${r.name} ${r.category ?? ''} ${r.chains.join(' ')}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const key = SORTS[state.sortKey];
  out = out.sort((a, b) => (key(a) - key(b)) * state.sortDir || a.rank - b.rank);
  return out;
}

function renderBoard() {
  const host = document.getElementById('board');
  const list = visibleRows();
  const arrow = (k) => (state.sortKey === k ? (state.sortDir === 1 ? ' ↑' : ' ↓') : '');
  const th = (k, label, num) => `<th class="sortable${num ? ' num' : ''}" data-sort="${k}">${label}${arrow(k)}</th>`;
  const body = list.map((r) => {
    const v = verdictOf(r);
    return `<tr><td class="num">${r.rank}</td>
<td><a href="#p=${esc(r.slug)}"><strong>${esc(r.name)}</strong></a>${r.watchlist ? ' ★' : ''}<span class="sub">${esc(r.chain)} · ${esc(r.category ?? '')} · ${esc(r.farm.cls)}</span></td>
<td class="num">${fmt$(r.tvl_usd)}</td><td class="num"><strong>${fmt$(r.implied_value_usd)}</strong></td>
<td class="num band">${fmt$(r.band_p25)} – ${fmt$(r.band_p75)}</td>
<td class="num">${fmtS$(r.farm.net)}</td><td class="num">${fmtS$(r.farm.net_hr)}</td>
<td class="num">${r.farm.max_wait_months > 0 ? (r.farm.max_wait_months >= 36 ? '36+' : r.farm.max_wait_months.toFixed(1)) : '—'}</td>
<td><span class="verdict v-${v.toLowerCase()}">${v}</span><span class="sub">tokenless ${yrs(r.days_no_token)} · Farm Rank #${r.farm_rank}</span></td></tr>`;
  }).join('');
  host.innerHTML = `<table class="board"><thead><tr>${th('rank', '#', true)}<th>Protocol (chain · category · class)</th>${th('tvl', 'TVL', true)}${th('value', 'Implied P50', true)}<th>Band P25–P75</th>${th('net', 'Net $1k', true)}${th('nethr', 'Net/hr', true)}${th('wait', 'Max Wait', true)}<th>Verdict</th></tr></thead><tbody>${body}</tbody></table>`;
  document.getElementById('board-count').textContent = `${list.length} of ${rows.length} rows shown · ★ = house watchlist · sorted by ${state.sortKey}.`;
  host.querySelectorAll('th.sortable').forEach((el) => el.addEventListener('click', () => {
    const k = el.getAttribute('data-sort');
    if (state.sortKey === k) state.sortDir *= -1; else { state.sortKey = k; state.sortDir = k === 'rank' || k === 'farmrank' ? 1 : -1; }
    renderBoard();
  }));
}

function renderDetail(slug) {
  const r = bySlug.get(slug);
  const host = document.getElementById('detail');
  if (!r) { host.innerHTML = ''; return; }
  const f = r.farm;
  const v = verdictOf(r);
  const wf = r.waterfall ? `<h3>How the value is built</h3><div class="wf">${r.waterfall.map((w) => `<div class="wfrow"><span>${esc(w.label)}</span><span class="wfval num">${fmtFull$(w.value)}</span></div>`).join('')}</div>
<p class="note">A flat multiple — the comp set's median ${R.model.flat_multiple.toFixed(3)} of market cap per TVL dollar — would print ${fmtFull$(R.model.flat_multiple * r.tvl_usd)} for this row. The fitted exponent is ${R.model.beta.toFixed(3)}, not 1, so the curve refuses that answer.</p>` : '<p class="note">Value decomposition, nearest peers and red flags are computed for the 40 watchlist rows; this row carries the same model with a Tier-2 farm plan.</p>';
  const peers = r.peers ? `<h3>Nearest traded peers</h3><ul class="peers">${r.peers.map((p) => `<li><strong>${esc(p.name)}</strong> — TVL ${fmt$(p.tvl_usd)}, trades at ${fmt$(p.mcap_usd)}</li>`).join('')}</ul>` : '';
  const flags = r.flags ? `<h3>Red flags, from the snapshot only</h3><ul class="flags">${r.flags.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
  host.innerHTML = `<section class="panel detailcard">
<button class="closebtn" id="detail-close">Close ✕</button>
<h2>#${r.rank} — ${esc(r.name)}${r.watchlist ? ' ★ watchlist' : ''}</h2>
<p class="meta">${esc(r.category ?? '')} · family ${esc(r.family)} · ${r.chains.map(esc).join(', ')} · TVL ${fmtFull$(r.tvl_usd)} · tokenless ${yrs(r.days_no_token)} (${r.days_no_token} days) · seven-day TVL ${r.change_7d == null ? 'not reported' : `${r.change_7d.toFixed(1)}%`}</p>
<p class="bigvalue">Implied launch value <strong>${fmtFull$(r.implied_value_usd)}</strong> <span class="band">P25–P75 ${fmtFull$(r.band_p25)} – ${fmtFull$(r.band_p75)} · P10–P90 ${fmtFull$(r.band_p10)} – ${fmtFull$(r.band_p90)}</span></p>
${wf}${peers}${flags}
<h3>The farm, netted — ${esc(f.cls)}-weighted, ${f.hold_days}-day hold, Farm Rank #${r.farm_rank} (value rank #${r.rank}, divergence ${r.divergence >= 0 ? '+' : ''}${r.divergence})</h3>
<table class="costs"><tbody>
<tr><td>Slice at 10% pro-rata on a $1,000 ticket</td><td class="num">${fmtC$(f.slice)}</td></tr>
<tr><td>Gas (${f.cls === 'Capital' ? 4 : f.cls === 'Hybrid' ? 6 : 10} actions on ${esc(f.chain)})</td><td class="num">−${fmtC$(f.costs.gas)}</td></tr>
<tr><td>Protocol fees</td><td class="num">−${fmtC$(f.costs.fees)}</td></tr>
<tr><td>Impermanent-loss drag</td><td class="num">−${fmtC$(f.costs.il)}</td></tr>
<tr><td>Bridge + risk charge</td><td class="num">−${fmtC$(f.costs.bridge)}</td></tr>
<tr><td>Forgone yield on the ticket</td><td class="num">−${fmtC$(f.costs.opportunity)}</td></tr>
<tr><td><strong>Net</strong> (${fmtS$(f.net_hr)}/hr over ${f.hours.toFixed(1)} hands-on hours)</td><td class="num"><strong>${fmtS$(f.net)}</strong></td></tr>
<tr><td>Net at the P25 band end</td><td class="num">${fmtS$(f.net_p25)}</td></tr>
<tr><td>Net at a 5% slice instead of 10%</td><td class="num">${fmtS$(f.net_sensitivity)}</td></tr>
<tr><td>Break-even launch value · Max Wait</td><td class="num">${fmtFull$(f.break_even_value)} · ${f.max_wait_months > 0 ? `${f.max_wait_months.toFixed(1)} months` : '—'}</td></tr>
</tbody></table>
<p>Verdict <span class="verdict v-${v.toLowerCase()}">${v}</span> · setup ${f.setup_minutes} min · upkeep ${f.weekly_minutes} min/week</p>
<h3>The plan</h3>
<ol class="steps">${r.farm_steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
</section>`;
  document.getElementById('detail-close').addEventListener('click', () => { history.pushState(null, '', '#board-panel'); host.innerHTML = ''; document.getElementById('board-panel').scrollIntoView(); });
  host.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function route() {
  const h = location.hash.replace(/^#/, '');
  if (h.startsWith('p=')) { renderDetail(h.slice(2)); return; }
  if (h === 'robust') {
    state.verdict = 'ROBUST'; state.sortKey = 'nethr'; state.sortDir = -1;
    document.getElementById('f-verdict').value = 'ROBUST';
    renderBoard();
    document.getElementById('board-panel').scrollIntoView();
    return;
  }
  if (h === '') document.getElementById('detail').innerHTML = '';
}

document.getElementById('q').addEventListener('input', (e) => { state.q = e.target.value; renderBoard(); });
document.getElementById('f-verdict').addEventListener('change', (e) => { state.verdict = e.target.value; renderBoard(); });
document.getElementById('f-class').addEventListener('change', (e) => { state.cls = e.target.value; renderBoard(); });
document.getElementById('f-watch').addEventListener('change', (e) => { state.watch = e.target.checked; renderBoard(); });
window.addEventListener('hashchange', route);
renderBoard();
route();

/*
  Ask the data, the browser half. Shared by all four demos and kept identical, like shell.js.

  The visitor asks a question. /api/chat (functions/api/chat.js) has Qwen write one SQL query
  for this dashboard's tables; this file checks the query is a single read, runs it right here
  in the page's own DuckDB-WASM engine, and sends the result back so Qwen can phrase the answer.
  The SQL and the rows it returned are shown under every answer, so every number in it can be
  checked. The data never leaves the page except as the result of a query the visitor can see.

  Markup only: each demo's stylesheet decides what the box looks like.
*/

import { q } from './db.js';
import { esc } from './charts.js';

const ENDPOINT = '/api/chat';
const SHOW_ROWS = 20;     // rows shown under an answer
const SEND_ROWS = 50;     // rows sent back to the model to phrase the answer from
const RUN_LIMIT = 200;    // hard cap on rows a query may return in the page

// The same guard the server applies. Anything that is not a single read never runs.
const FORBIDDEN = /\b(attach|detach|copy|export|import|install|load|pragma|set|reset|call|create|alter|drop|insert|update|delete|truncate|vacuum|checkpoint|grant|read_csv|read_csv_auto|read_parquet|read_json|read_json_auto|read_text|read_blob|parquet_scan|glob|getenv)\b/i;

export function safeSql(sql) {
  const s = String(sql || '').trim().replace(/;\s*$/, '');
  if (!/^(select|with)\b/i.test(s) || s.includes(';') || FORBIDDEN.test(s) || s.length > 4000) return null;
  return s;
}

const cell = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') {
    return Number.isInteger(v) ? v.toLocaleString('en-ZA')
      : v.toLocaleString('en-ZA', { maximumFractionDigits: 2 });
  }
  return String(v);
};

// Plain text in, safe HTML out: "- " lines become a list, the rest paragraphs.
function answerHtml(text) {
  const out = [];
  let list = [];
  const flush = () => { if (list.length) { out.push(`<ul>${list.join('')}</ul>`); list = []; } };
  for (const raw of String(text || '').split(/\n+/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^[-*]\s+(.*)$/);
    if (m) list.push(`<li>${esc(m[1])}</li>`);
    else { flush(); out.push(`<p>${esc(line)}</p>`); }
  }
  flush();
  return out.join('');
}

function resultTable(rows) {
  if (!rows.length) return '<p class="ask-empty">The query returned no rows.</p>';
  const cols = Object.keys(rows[0]);
  const head = cols.map((c) => `<th>${esc(c)}</th>`).join('');
  const body = rows.slice(0, SHOW_ROWS).map((r) =>
    `<tr>${cols.map((c) => `<td${typeof r[c] === 'number' ? ' class="num"' : ''}>${esc(cell(r[c]))}</td>`).join('')}</tr>`).join('');
  return `<div class="table-scroll"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

async function call(payload) {
  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    return { type: 'error', message: 'Could not reach the AI. Check your connection and try again.' };
  }
  try { return await res.json(); } catch {
    // A static preview without the function behind it answers with a page, not JSON.
    return { type: 'unavailable', message: 'Ask the data is not switched on on this copy of the site.' };
  }
}

/**
 * Put the question box into root.
 * demo      the dashboard's slug: meridian, kestrel, sable-finch or lumen
 * filter    () => the current filter code, or '' for none
 * examples  starter questions, shown as buttons
 */
export function mountAsk(root, { demo, title = 'Ask the data', intro = '', examples = [], filter = () => '', placeholder = 'Ask a question about this data' }) {
  if (!root) return;
  const id = `ask-${demo}`;
  root.innerHTML = `
    <div class="ask">
      <div class="ask-head">
        <h2 class="ask-title">${esc(title)}</h2>
        ${intro ? `<p class="ask-intro">${esc(intro)}</p>` : ''}
      </div>
      <div class="ask-examples"></div>
      <div class="ask-log" aria-live="polite"></div>
      <form class="ask-form">
        <label class="ask-label" for="${id}">Your question</label>
        <textarea class="ask-input" id="${id}" rows="2" maxlength="500" placeholder="${esc(placeholder)}"></textarea>
        <button class="ask-send" type="submit">Ask</button>
      </form>
      <p class="ask-note">Answers are written by Qwen from SQL that runs in your browser on this
        dashboard's own tables. Every answer shows its query and the rows it returned. Questions
        outside this data are declined.</p>
    </div>`;

  const log = root.querySelector('.ask-log');
  const form = root.querySelector('.ask-form');
  const input = root.querySelector('.ask-input');
  const send = root.querySelector('.ask-send');
  const history = [];
  let busy = false;

  const ask = async (question) => {
    question = question.trim();
    if (!question || busy) return;
    busy = true;
    send.disabled = true;
    input.value = '';

    const turn = document.createElement('div');
    turn.className = 'ask-turn';
    turn.innerHTML = `<div class="ask-q">${esc(question)}</div><div class="ask-a"><p class="ask-status">Writing the query</p></div>`;
    log.appendChild(turn);
    turn.scrollIntoView({ block: 'nearest' });
    const a = turn.querySelector('.ask-a');
    const status = (t) => { const s = a.querySelector('.ask-status'); if (s) s.textContent = t; };
    const msg = (text, cls = '') => { a.innerHTML = `<p class="ask-msg ${cls}">${esc(text)}</p>`; };

    const base = { demo, question, history, filter: { value: filter() || '' } };
    try {
      let plan = await call({ ...base, step: 'plan' });
      let rows = null, sql = null, ms = 0;

      // One retry: a query that fails goes back with its error, once.
      for (let attempt = 0; attempt < 2 && plan.type === 'sql'; attempt++) {
        sql = safeSql(plan.sql);
        if (!sql) { plan = { type: 'refuse', message: 'That question would need something other than reading the data, so I can\'t run it.' }; break; }
        status('Running it on the data');
        const t0 = performance.now();
        try {
          rows = await q(`select * from (${sql}) as ask limit ${RUN_LIMIT}`);
          ms = Math.round(performance.now() - t0);
          break;
        } catch (err) {
          rows = null;
          if (attempt === 1) throw err;
          status('Correcting the query');
          plan = await call({ ...base, step: 'plan', error: String(err.message || err), failedSql: sql });
        }
      }

      if (plan.type !== 'sql' || !rows) {
        const cls = plan.type === 'refuse' ? 'is-refusal' : plan.type === 'clarify' ? 'is-clarify' : 'is-error';
        msg(plan.message || 'Something went wrong. Please try again.', cls);
        if (plan.type === 'clarify') history.push({ q: question, a: plan.message });
        return;
      }

      status('Writing the answer');
      const columns = rows.length ? Object.keys(rows[0]) : [];
      const sent = rows.slice(0, SEND_ROWS).map((r) => columns.map((c) =>
        (typeof r[c] === 'number' && !Number.isInteger(r[c]) ? Math.round(r[c] * 100) / 100 : r[c])));
      const ans = await call({ ...base, step: 'answer', sql, columns, rows: sent, rowCount: rows.length });
      if (ans.type !== 'answer') { msg(ans.message || 'The answer could not be written. Please try again.', 'is-error'); return; }

      a.innerHTML = `
        <div class="ask-answer">${answerHtml(ans.answer)}</div>
        <details class="ask-proof">
          <summary>Show the SQL and the data</summary>
          ${plan.purpose ? `<p class="ask-purpose">${esc(plan.purpose)}</p>` : ''}
          <pre class="ask-sql"><code>${esc(sql)}</code></pre>
          ${resultTable(rows)}
          <p class="ask-meta">${rows.length} ${rows.length === 1 ? 'row' : 'rows'}${rows.length > SHOW_ROWS ? `, first ${SHOW_ROWS} shown` : ''} · ran in your browser in ${ms} ms · ${esc(ans.model || plan.model || 'Qwen')}</p>
        </details>`;
      history.push({ q: question, a: ans.answer });
    } catch (err) {
      msg(`The query could not run: ${String(err.message || err).split('\n')[0]}`, 'is-error');
    } finally {
      busy = false;
      send.disabled = false;
      turn.scrollIntoView({ block: 'nearest' });
    }
  };

  form.addEventListener('submit', (e) => { e.preventDefault(); ask(input.value); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input.value); }
  });

  // The starter questions live in the context pack beside the data, written by
  // scripts/chat_context.py, unless the page passes its own.
  const chips = root.querySelector('.ask-examples');
  const showChips = (list) => {
    chips.innerHTML = list.map((e) => `<button type="button" class="ask-chip">${esc(e)}</button>`).join('');
    chips.querySelectorAll('.ask-chip').forEach((b) => b.addEventListener('click', () => ask(b.textContent)));
  };
  if (examples.length) showChips(examples);
  else {
    fetch(new URL('data/chat-context.json', location.href), { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => { if (c?.examples?.length) showChips(c.examples); })
      .catch(() => { /* no starters, the box still works */ });
  }
}

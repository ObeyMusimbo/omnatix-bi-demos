/*
  The AI pop-up, the browser half. Shared by all five demos and kept identical, like shell.js.

  A small launcher sits in the corner of every dashboard. It opens a window with two tabs:
  Ask, a conversation with an open AI model about this dashboard's data, and the briefing, the
  AI's own written view of it.

  A message goes to /api/chat (functions/api/chat.js), where the model, Qwen first, either
  replies in words, for a greeting or a question about the dashboard itself, or writes one SQL
  query for this dashboard's tables. This file checks the query is a single read, runs it right
  here in the page's own DuckDB-WASM engine, and sends the result back so the model can phrase
  the answer. The SQL and the rows it returned are shown under every answer that has numbers
  in it, so every number can be checked. The data never leaves the page except as the result
  of a query the visitor can see.

  Markup only: each demo's stylesheet decides what the pop-up looks like.
*/

import { q } from './db.js';
import { esc } from './charts.js';

const ENDPOINT = '/api/chat';
const SHOW_ROWS = 20;     // rows shown under an answer
const SEND_ROWS = 50;     // rows sent back to the model to phrase the answer from
const RUN_LIMIT = 200;    // hard cap on rows a query may return in the page

const SPARK = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10 2.5l1.9 5.6 5.6 1.9-5.6 1.9L10 17.5l-1.9-5.6L2.5 10l5.6-1.9z"/><path d="M18 13.5l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z"/></svg>';
const CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const SEND = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h13M12 5l7 7-7 7"/></svg>';
const NEW = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';

// The same guard the server applies. Anything that is not a single read never runs.
const FORBIDDEN = /\b(attach|detach|copy|export|import|install|load|pragma|set|reset|call|create|alter|drop|insert|update|delete|truncate|vacuum|checkpoint|grant|read_csv|read_csv_auto|read_parquet|read_json|read_json_auto|read_text|read_blob|parquet_scan|glob|getenv)\b/i;

export function safeSql(sql) {
  const s = String(sql || '').trim().replace(/;\s*$/, '');
  if (!/^(select|with)\b/i.test(s) || s.includes(';') || FORBIDDEN.test(s) || s.length > 4000) return null;
  return s;
}

// Two ways to answer at the wrong level, both forbidden by the prompt and both seen live from a
// fallback model when the free Qwen was busy, caught here before the query runs. A query that
// trips one goes back to the model to be corrected, once, like a query that failed.
const MEASURE = /(^|_)(pct|percent|percentage|rate|ratio|share|avg|average|mean)(_|$)/i;

const words = (s) => (String(s).toLowerCase().match(/[a-z_][a-z0-9_]*/g) || []);
// clinic_name and clinic_code name the same thing, as do product_id and product_name.
const stem = (c) => c.toLowerCase().replace(/_(id|code|name|key)$/, '');

/**
 * What is wrong with a query, as { message, strict }, or null. A strict flaw never runs; the
 * other is a judgement from the table's shape, so the model's corrected query runs regardless.
 */
export function lint(sql, tables = []) {
  const s = String(sql);

  // Grouping by a percentage, rate or average makes every distinct value its own group, so
  // "the clinic with the lowest recovery rate" comes back as one rejection reason's rate.
  const groupings = /\bgroup\s+by\b([\s\S]*?)(?=\border\s+by\b|\bhaving\b|\blimit\b|\bqualify\b|\bwindow\b|\bunion\b|\)|$)/gi;
  for (const m of s.matchAll(groupings)) {
    const bad = words(m[1]).find((w) => MEASURE.test(w));
    if (bad) {
      return { strict: true, message: `The query groups by ${bad}, which is a percentage, rate or average. `
        + 'Group by the level the question asks for instead, and recompute any rate as '
        + 'SUM(numerator) * 100.0 / SUM(denominator).' };
    }
  }

  // Reading rows straight off a table with one row per clinic and reason, showing only the
  // clinic: each row is one reason's figure passed off as the clinic's. Checked on plain
  // single-table reads only: every column of the table's grain must be selected or filtered on.
  const lower = s.toLowerCase();
  if ((lower.match(/\bselect\b/g) || []).length !== 1 || /\bgroup\s+by\b|\bjoin\b|\bover\s*\(|\bdistinct\b/.test(lower)
    || /\b(sum|count|avg|min|max|median|quantile_cont|any_value|arg_min|arg_max|string_agg|list)\s*\(/.test(lower)) return null;
  const from = lower.match(/\bfrom\s+([a-z_][a-z0-9_]*)/);
  const table = from && tables.find((t) => t.name.toLowerCase() === from[1]);
  if (!table || !Array.isArray(table.grain) || table.grain.length < 2) return null;
  const selected = lower.slice(lower.indexOf('select') + 6, from.index);
  if (/(^|[\s,.])\*/.test(selected)) return null;
  const where = (lower.match(/\bwhere\b([\s\S]*?)(?=\border\s+by\b|\blimit\b|$)/) || [])[1] || '';
  const seen = new Set([...words(selected), ...words(where)].map(stem));
  const missing = table.grain.filter((g) => !seen.has(stem(g)));
  if (!missing.length) return null;
  return { strict: false, message: `${table.name} has one row per ${table.grain.join(' and ')}, but the `
    + `query neither selects nor filters on ${missing.join(' or ')}, so each row it returns is only part `
    + 'of the answer. Use a table whose grain matches the question, or GROUP BY the level asked and '
    + 'recompute any rate as SUM(numerator) * 100.0 / SUM(denominator).' };
}

const cell = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') {
    return Number.isInteger(v) ? v.toLocaleString('en-ZA')
      : v.toLocaleString('en-ZA', { maximumFractionDigits: 2 });
  }
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  return String(v);
};

/** Plain text in, safe HTML out: "- " lines become a list, the rest paragraphs. */
export function answerHtml(text) {
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

/** Rows as a small table, the first SHOW_ROWS of them. */
export function resultTable(rows) {
  if (!rows.length) return '<p class="ask-empty">The query returned no rows.</p>';
  const cols = Object.keys(rows[0]);
  const head = cols.map((c) => `<th>${esc(c)}</th>`).join('');
  const body = rows.slice(0, SHOW_ROWS).map((r) =>
    `<tr>${cols.map((c) => `<td${typeof r[c] === 'number' ? ' class="num"' : ''}>${esc(cell(r[c]))}</td>`).join('')}</tr>`).join('');
  return `<div class="table-scroll"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

/** One call to the server half. Never throws: a failure comes back as a message to show. */
export async function call(payload) {
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
    return { type: 'unavailable', message: 'The AI is not switched on on this copy of the site.' };
  }
}

// The visitor's own date, so "today" and "this month" mean what the page shows. The server
// only accepts it when it is within a day of its own clock.
const localDate = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/**
 * The conversation: suggested questions, the log, and the box to type in.
 * demo      the dashboard's slug, which tells the server which data it is talking about
 * greeting  plain text shown first, as the assistant's opening line
 * filter    () => the current filter code, or '' for none
 * examples  starter questions; when empty they come from data/chat-context.json
 */
export function mountAsk(root, { demo, greeting = '', examples = [], filter = () => '', placeholder = 'Ask a question about this data', onChange = () => {} }) {
  if (!root) return null;
  const id = `ask-${demo}`;
  root.innerHTML = `
    <div class="ask">
      <div class="ask-scroll">
        ${greeting ? `<div class="ask-hello">${answerHtml(greeting)}</div>` : ''}
        <div class="ask-examples" role="group" aria-label="Suggested questions"></div>
        <div class="ask-log" aria-live="polite"></div>
      </div>
      <form class="ask-form">
        <label class="ask-label" for="${id}">Your question</label>
        <textarea class="ask-input" id="${id}" rows="1" maxlength="500" placeholder="${esc(placeholder)}"></textarea>
        <button class="ask-send" type="submit" aria-label="Send">${SEND}</button>
      </form>
    </div>`;

  const scroller = root.querySelector('.ask-scroll');
  const log = root.querySelector('.ask-log');
  const form = root.querySelector('.ask-form');
  const input = root.querySelector('.ask-input');
  const send = root.querySelector('.ask-send');
  const history = [];
  let busy = false;
  const toEnd = () => { scroller.scrollTop = scroller.scrollHeight; };

  // The context pack beside the data: the starter questions, and each table's grain for lint().
  const context = fetch(new URL('data/chat-context.json', location.href), { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);

  // The box grows with what is typed, to a point, then scrolls.
  const fit = () => {
    input.style.height = 'auto';
    if (!input.value) { input.style.overflowY = 'hidden'; return; }
    input.style.height = `${Math.min(input.scrollHeight + 2, 140)}px`;
    input.style.overflowY = input.scrollHeight > 140 ? 'auto' : 'hidden';
  };
  fit();
  input.addEventListener('input', fit);

  const ask = async (question) => {
    question = question.trim();
    if (!question || busy) return;
    busy = true;
    send.disabled = true;
    input.value = '';
    fit();

    const turn = document.createElement('div');
    turn.className = 'ask-turn';
    turn.innerHTML = `<div class="ask-q">${esc(question)}</div><div class="ask-a"><p class="ask-status">Thinking</p></div>`;
    log.appendChild(turn);
    onChange(true);
    toEnd();
    const a = turn.querySelector('.ask-a');
    const status = (t) => { const s = a.querySelector('.ask-status'); if (s) s.textContent = t; };
    const msg = (text, cls = '') => { a.innerHTML = `<p class="ask-msg ${cls}">${esc(text)}</p>`; };

    const base = { demo, question, history, today: localDate(), filter: { value: filter() || '' } };
    try {
      const tables = (await context)?.tables || [];
      let plan = await call({ ...base, step: 'plan' });
      let rows = null, sql = null, ms = 0;

      // One retry: a query that fails, or breaks a rule lint() checks, goes back with its error,
      // once.
      for (let attempt = 0; attempt < 2 && plan.type === 'sql'; attempt++) {
        sql = safeSql(plan.sql);
        if (!sql) { plan = { type: 'refuse', message: 'That question would need something other than reading the data, so I can\'t run it.' }; break; }
        const flaw = lint(sql, tables);
        if (flaw && attempt === 0) {
          status('Correcting the query');
          plan = await call({ ...base, step: 'plan', error: flaw.message, failedSql: sql });
          continue;
        }
        if (flaw?.strict) {
          plan = { type: 'error', message: 'The AI could not write a sound query for that just now. Please try asking it another way.' };
          break;
        }
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

      // A reply in words: a greeting, or a question about the dashboard rather than its data.
      if (plan.type === 'chat' && plan.message) {
        a.innerHTML = `<div class="ask-answer">${answerHtml(plan.message)}</div>`;
        history.push({ q: question, a: plan.message });
        return;
      }

      if (plan.type !== 'sql' || !rows) {
        const cls = plan.type === 'refuse' ? 'is-refusal' : plan.type === 'clarify' ? 'is-clarify' : 'is-error';
        msg(plan.message || 'Something went wrong. Please try again.', cls);
        if (plan.type === 'clarify' || plan.type === 'refuse') history.push({ q: question, a: plan.message });
        return;
      }

      status('Writing the answer');
      const columns = rows.length ? Object.keys(rows[0]) : [];
      const sent = rows.slice(0, SEND_ROWS).map((r) => columns.map((c) =>
        (typeof r[c] === 'number' && !Number.isInteger(r[c]) ? Math.round(r[c] * 100) / 100 : r[c])));
      const ans = await call({ ...base, step: 'answer', sql, purpose: plan.purpose || '', columns, rows: sent, rowCount: rows.length });
      if (ans.type !== 'answer') { msg(ans.message || 'The answer could not be written. Please try again.', 'is-error'); return; }

      a.innerHTML = `
        <div class="ask-answer">${answerHtml(ans.answer)}</div>
        <details class="ask-proof">
          <summary>Show the SQL and the data</summary>
          ${plan.purpose ? `<p class="ask-purpose">${esc(plan.purpose)}</p>` : ''}
          <pre class="ask-sql"><code>${esc(sql)}</code></pre>
          ${resultTable(rows)}
          <p class="ask-meta">${rows.length} ${rows.length === 1 ? 'row' : 'rows'}${rows.length > SHOW_ROWS ? `, first ${SHOW_ROWS} shown` : ''} · ran in your browser in ${ms} ms · written by ${esc(ans.model || plan.model || 'an open model')}</p>
        </details>`;
      history.push({ q: question, a: ans.answer });
    } catch (err) {
      msg(`The query could not run: ${String(err.message || err).split('\n')[0]}`, 'is-error');
    } finally {
      busy = false;
      send.disabled = false;
      toEnd();
    }
  };

  form.addEventListener('submit', (e) => { e.preventDefault(); ask(input.value); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input.value); }
  });

  // The starter questions live in the context pack, unless the page passes its own.
  const chips = root.querySelector('.ask-examples');
  const showChips = (list) => {
    chips.innerHTML = list.map((e) => `<button type="button" class="ask-chip">${esc(e)}</button>`).join('');
    chips.querySelectorAll('.ask-chip').forEach((b) => b.addEventListener('click', () => ask(b.textContent)));
  };
  if (examples.length) showChips(examples);
  else context.then((c) => { if (c?.examples?.length) showChips(c.examples); });

  return {
    ask,
    focus: () => input.focus(),
    get used() { return history.length > 0 || log.children.length > 0; },
    reset() {
      if (busy) return;
      log.innerHTML = '';
      history.length = 0;
      scroller.scrollTop = 0;
      onChange(false);
    },
  };
}

/**
 * The launcher and the window it opens.
 * name      the assistant's name, the window's title
 * sub       one line under the name
 * launch    the launcher's label
 * tabs      the two tab labels: the conversation, then the briefing
 * brief     the briefing: HTML, drawn the first time its tab opens, or async ({ refresh }) =>
 *           HTML, asked again each time the tab opens, so it can say when the data has moved
 *           on. A [data-brief-refresh] button inside it asks for a fresh one.
 * onOpen    called each time the window opens, for example to start a query engine early
 * The rest goes to mountAsk.
 */
export function mountAiPopup({ demo, name, sub = '', launch = 'Ask AI', tabs = ['Ask', 'Briefing'], brief = '', onOpen = () => {}, ...askOpts }) {
  const id = `aipop-${demo}`;

  const launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.className = 'aipop-launch';
  launcher.setAttribute('aria-haspopup', 'dialog');
  launcher.setAttribute('aria-expanded', 'false');
  launcher.setAttribute('aria-controls', id);
  launcher.innerHTML = `<span class="aipop-launch-ico">${SPARK}</span><span class="aipop-launch-text">${esc(launch)}</span>`;

  // Plain divs throughout: the dashboards style section, header and h2 for their own pages,
  // and none of that should reach the window.
  const box = document.createElement('div');
  box.className = 'aipop';
  box.id = id;
  box.hidden = true;
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-labelledby', `${id}-title`);
  box.innerHTML = `
    <div class="aipop-head">
      <span class="aipop-mark">${SPARK}</span>
      <div class="aipop-id">
        <div class="aipop-title" id="${id}-title" role="heading" aria-level="2">${esc(name)}</div>
        ${sub ? `<div class="aipop-sub">${esc(sub)}</div>` : ''}
      </div>
      <button type="button" class="aipop-new aipop-icon" aria-label="New chat" title="New chat" hidden>${NEW}</button>
      <button type="button" class="aipop-close aipop-icon" aria-label="Close" title="Close">${CLOSE}</button>
    </div>
    <div class="aipop-tabs" role="tablist" aria-label="${esc(name)}">
      <button type="button" class="aipop-tab" role="tab" id="${id}-t-ask" aria-controls="${id}-ask" aria-selected="true">${esc(tabs[0])}</button>
      <button type="button" class="aipop-tab" role="tab" id="${id}-t-brief" aria-controls="${id}-brief" aria-selected="false" tabindex="-1">${esc(tabs[1])}</button>
    </div>
    <div class="aipop-pane aipop-ask" id="${id}-ask" role="tabpanel" aria-labelledby="${id}-t-ask"></div>
    <div class="aipop-pane aipop-brief" id="${id}-brief" role="tabpanel" aria-labelledby="${id}-t-brief" tabindex="0" hidden></div>`;
  document.body.append(box, launcher);

  const $ = (s) => box.querySelector(s);
  const newChat = $('.aipop-new');
  const chat = mountAsk($('.aipop-ask'), { demo, ...askOpts, onChange: (used) => { newChat.hidden = !used || current !== 'ask'; } });
  const briefPane = $('.aipop-brief');
  const tabEls = [...box.querySelectorAll('.aipop-tab')];
  const panes = { ask: $('.aipop-ask'), brief: briefPane };
  const narrow = () => matchMedia('(max-width: 640px)').matches;
  let current = 'ask';
  let briefDrawn = false;
  let briefBusy = false;

  const drawBrief = async (refresh = false) => {
    if (typeof brief !== 'function') {
      if (!briefDrawn) briefPane.innerHTML = brief || '<p class="ask-msg">The AI briefing is not available just now.</p>';
      briefDrawn = true;
      return;
    }
    if (briefBusy) return;
    briefBusy = true;
    if (!briefDrawn || refresh) briefPane.innerHTML = '<p class="ask-status aipop-wait">Writing the briefing</p>';
    try {
      briefPane.innerHTML = await brief({ refresh });
      briefDrawn = true;
    } catch (err) {
      briefPane.innerHTML = `<p class="ask-msg is-error">${esc(err.message || 'The briefing could not be written just now.')}</p>
        <button type="button" class="aipop-refresh" data-brief-refresh>Try again</button>`;
    } finally {
      briefBusy = false;
    }
  };

  const show = (which, { focus = false } = {}) => {
    current = which;
    tabEls.forEach((t) => {
      const on = t.id.endsWith(`-t-${which}`);
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    for (const [k, p] of Object.entries(panes)) p.hidden = k !== which;
    newChat.hidden = which !== 'ask' || !chat.used;
    box.dataset.tab = which;
    if (which === 'brief') drawBrief();
  };

  const open = () => {
    box.hidden = false;
    launcher.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('aipop-open');
    onOpen();
    if (current === 'brief') drawBrief();
    // A phone's keyboard would cover the window, so the box is focused only with a mouse.
    if (current === 'ask' && matchMedia('(pointer: fine)').matches) chat.focus();
    else $('.aipop-close').focus();
  };
  const close = () => {
    box.hidden = true;
    launcher.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('aipop-open');
    launcher.focus();
  };

  launcher.addEventListener('click', () => (box.hidden ? open() : close()));
  $('.aipop-close').addEventListener('click', close);
  newChat.addEventListener('click', () => { chat.reset(); chat.focus(); });
  tabEls.forEach((t) => t.addEventListener('click', () => show(t.id.endsWith('-t-brief') ? 'brief' : 'ask')));
  $('.aipop-tabs').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      show(current === 'ask' ? 'brief' : 'ask', { focus: true });
    }
  });
  box.addEventListener('keydown', (e) => {
    // Handled here, so the dashboard's own keys never see them: Escape closing its drawers, or
    // the arrows turning its pages while the visitor moves between tabs.
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    if (/^(Arrow|Page)/.test(e.key)) e.stopPropagation();
  });
  briefPane.addEventListener('click', (e) => {
    if (e.target.closest('[data-brief-refresh]')) { drawBrief(true); return; }
    // A priority links to the section that proves it. On a phone the window covers the page,
    // so it steps aside.
    if (e.target.closest('a[href^="#"]') && narrow()) close();
  });

  return { open, close, show, ask: (text) => { show('ask'); if (box.hidden) open(); chat.ask(text); } };
}

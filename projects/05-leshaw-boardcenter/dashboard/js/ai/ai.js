/*
  Leshaw Business Hub: the AI assistant.

  The same pop-up as the four warehouse demos (ask.js, shared byte for byte), on the hub's own
  live data (db.js). Two tabs:

    Chat              a business conversation. It greets, keeps up with follow ups, explains the
                      products and the hub, and answers every figure with SQL run right here on
                      what the hub shows now, demo changes included.
    Today's briefing  written by the AI from a fixed set of queries on the live data: what is
                      selling, what is owed, what is late, what is about to run out, which quotes
                      are about to lapse. The figures it was given are shown under it.
*/

import { mountAiPopup, call, resultTable } from './ask.js';
import { q, connect, dataKey } from './db.js';
import { esc } from './charts.js';

const PAGES = { overview: 'Overview', orders: 'Orders', quotes: 'Quotes', production: 'Cut & Edge', inventory: 'Inventory', customers: 'Customers' };
const CACHE = 'leshaw-ai-brief';

const p2 = (n) => String(n).padStart(2, '0');
const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };
const nf = new Intl.NumberFormat('en-ZA', { maximumFractionDigits: 0 });
const money = (v) => `R ${nf.format(Math.round(v))}`;
const hello = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

// ---------------------------------------------------------------- the briefing's figures

// Each is one read on the live tables, written with today's date as a literal so "today" is
// the hub's today. Labels are what the reader sees above each table under the briefing.
const FACTS = (T) => [
  ['sales', 'Sales so far (including VAT, cancelled orders excluded)', `
    select
      round(sum(total_incl_vat_zar) filter (where order_date = ${T})) as sales_today,
      count(*) filter (where order_date = ${T}) as orders_today,
      round(sum(total_incl_vat_zar) filter (where order_date >= date_trunc('month', ${T}))) as sales_month_to_date,
      count(*) filter (where order_date >= date_trunc('month', ${T})) as orders_month_to_date,
      round(sum(total_incl_vat_zar) filter (where order_date >= date_trunc('month', ${T} - interval 1 month)
        and order_date <= ${T} - interval 1 month)) as same_days_last_month,
      round(sum(total_incl_vat_zar) filter (where order_date >= date_trunc('month', ${T} - interval 1 year)
        and order_date <= ${T} - interval 1 year)) as same_days_last_year,
      round(sum(total_incl_vat_zar) filter (where order_date > ${T} - 30)) as sales_last_30_days,
      round(sum(total_incl_vat_zar) filter (where order_date > ${T} - 60 and order_date <= ${T} - 30)) as sales_previous_30_days,
      round(avg(total_incl_vat_zar) filter (where order_date > ${T} - 30)) as average_order_last_30_days
    from orders where counts_as_revenue`],
  ['open_orders', 'Open orders by status', `
    select status, count(*) as orders, round(sum(total_incl_vat_zar)) as value, max(${T} - order_date) as oldest_days
    from orders where status in ('Awaiting payment', 'Paid', 'In production', 'Ready for collection')
    group by status order by orders desc`],
  ['awaiting_payment', 'Largest orders awaiting payment', `
    select order_id, customer_name, round(total_incl_vat_zar) as value, ${T} - order_date as days_waiting
    from orders where status = 'Awaiting payment' order by total_incl_vat_zar desc limit 5`],
  ['factory', 'Cut and edge board by stage', `
    select stage, count(*) as jobs, sum(sheets) as sheets, count(*) filter (where is_overdue) as late,
      count(*) filter (where is_rush) as rush, count(*) filter (where due_date <= ${T} and stage <> 'Ready') as due_by_today
    from production_jobs group by stage
    order by case stage when 'Received' then 1 when 'Optimising' then 2 when 'Cutting' then 3 when 'Edge banding' then 4 else 5 end`],
  ['late_jobs', 'Late jobs', `
    select job_id, order_id, customer_name, board, stage, due_date, sheets, is_rush
    from production_jobs where is_overdue order by due_date limit 6`],
  ['low_stock', 'Low stock, with sales in the last 30 days', `
    with sold as (
      select product_id, sum(quantity) as sold from order_lines
      where status <> 'Cancelled' and order_date > ${T} - 30 group by product_id)
    select p.product_name, p.category, p.stock_on_hand, p.reorder_level, p.stock_status,
      coalesce(s.sold, 0) as sold_last_30_days,
      case when coalesce(s.sold, 0) > 0 then round(p.stock_on_hand * 30.0 / s.sold) end as days_of_cover
    from products p left join sold s using (product_id)
    where p.stock_status <> 'OK' order by days_of_cover nulls last, p.stock_on_hand limit 10`],
  ['open_quotes', 'Open quotes, soonest to expire first', `
    select quote_id, customer_name, project, status, round(total_incl_vat_zar) as value, valid_until, days_until_expiry
    from quotes where status in ('Draft', 'Sent') order by days_until_expiry limit 8`],
  ['quotes_30_days', 'Quotes in the last 30 days', `
    select count(*) filter (where status = 'Accepted') as accepted, count(*) filter (where status = 'Declined') as declined,
      count(*) filter (where status = 'Expired') as expired, count(*) filter (where status in ('Draft', 'Sent')) as still_open,
      round(sum(total_incl_vat_zar) filter (where status in ('Draft', 'Sent'))) as open_value
    from quotes where quote_date > ${T} - 30`],
  ['top_customers', 'Top trade customers, last 90 days', `
    select customer_name, count(*) as orders, round(sum(total_incl_vat_zar)) as value
    from orders where counts_as_revenue and customer_type <> 'Retail / DIY' and order_date > ${T} - 90
    group by customer_name order by value desc limit 5`],
  ['quiet_customers', 'Trade customers with no order for 14 days or more', `
    with c as (
      select customer_name, max(order_date) as last_order,
        count(*) filter (where order_date > ${T} - 180) as orders_last_180_days,
        round(sum(total_incl_vat_zar) filter (where order_date > ${T} - 180)) as value_last_180_days
      from orders where counts_as_revenue and customer_type <> 'Retail / DIY' group by customer_name)
    select customer_name, last_order, ${T} - last_order as days_since_last_order, orders_last_180_days, value_last_180_days
    from c where ${T} - last_order >= 14 order by value_last_180_days desc limit 5`],
  ['best_boards', 'Best selling boards, last 30 days', `
    select product_name, category, sum(quantity) as sheets_sold
    from order_lines where status <> 'Cancelled' and is_board_sheet and order_date > ${T} - 30
    group by product_name, category order by sheets_sold desc limit 5`],
];

async function facts(day) {
  const out = {};
  const shown = [];
  for (const [key, label, sql] of FACTS(`DATE '${day}'`)) {
    const rows = await q(sql);
    out[key] = rows;
    shown.push({ label, rows });
  }
  return { today: day, figures: out, shown };
}

// ---------------------------------------------------------------- the briefing

const read = () => { try { return JSON.parse(sessionStorage.getItem(CACHE) || 'null'); } catch { return null; } };
const keep = (v) => { try { sessionStorage.setItem(CACHE, JSON.stringify(v)); } catch { /* private mode */ } };

function render({ brief: b, model, at, shown }, stale) {
  const pris = b.priorities.map((p, i) => `
    <li><a class="ai-pri" href="#/${esc(p.page)}">
      <span class="ai-pri-n">${p2(i + 1)}</span>
      <span class="ai-pri-body">
        <span class="ai-do">${esc(p.action)}</span>
        <span class="ai-meta">${esc([p.why, PAGES[p.page]].filter(Boolean).join(' · '))}</span>
      </span>
      ${p.value_zar ? `<span class="ai-pri-v">${esc(money(p.value_zar))}</span>` : ''}
    </a></li>`).join('');
  const time = new Date(at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
  return `
    ${stale ? `<p class="aipop-stale">The hub's figures have changed since this briefing was written.
      <button type="button" class="aipop-link" data-brief-refresh>Write a fresh one</button></p>` : ''}
    <article class="ai-brief lsw-brief">
      <div class="ai-head">
        <span class="ai-badge">Today's briefing · AI</span>
        <button type="button" class="aipop-refresh" data-brief-refresh>Refresh</button>
      </div>
      <p class="ai-headline">${esc(b.headline)}</p>
      ${b.summary ? `<p class="ai-why">${esc(b.summary)}</p>` : ''}
      ${pris ? `<ol class="ai-pris">${pris}</ol>` : ''}
      <p class="ai-credit">Written at ${esc(time)} by ${esc(model || 'an open AI model')} from the hub's live figures. Amounts include VAT.</p>
      <details class="ask-proof">
        <summary>Show the figures it was given</summary>
        ${shown.map((s) => `<h4>${esc(s.label)}</h4>${resultTable(s.rows)}`).join('')}
      </details>
    </article>`;
}

async function brief({ refresh }) {
  const day = localDate();
  const key = dataKey();
  const cached = read();
  if (!refresh && cached?.day === day) return render(cached, cached.key !== key);

  const f = await facts(day);
  const res = await call({ demo: 'leshaw', step: 'brief', today: day, facts: { today: f.today, ...f.figures } });
  if (res.type !== 'brief' || !res.brief) {
    throw new Error(res.message || 'The briefing could not be written just now. Please try again.');
  }
  const out = { day, key, brief: res.brief, model: res.model, at: Date.now(), shown: f.shown };
  keep(out);
  return render(out, false);
}

// ---------------------------------------------------------------- the pop-up

mountAiPopup({
  demo: 'leshaw',
  name: 'Leshaw Assistant',
  sub: 'AI on the hub\'s live data',
  launch: 'Ask Leshaw AI',
  tabs: ['Chat', 'Today\'s briefing'],
  greeting: `${hello()}, Barnabas. I'm the hub's assistant. Ask me about sales, orders, quotes, the cut and edge board, stock or customers, in your own words. I read the hub's live data, so I see every change as it is made.`,
  placeholder: 'Ask about sales, stock, quotes',
  brief,
  // The query engine is a few megabytes, so it loads when the assistant is first opened rather
  // than with the hub, and is ready by the time the first question is typed.
  onOpen: () => { connect().catch(() => { /* the first question reports it */ }); },
});

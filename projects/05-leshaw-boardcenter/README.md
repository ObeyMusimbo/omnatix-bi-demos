# Leshaw Business Hub: demo dashboard

A clickable operations dashboard for Leshaw (boards and hardware, Spruitview), styled to match
[leshaw-lsw.co.za](https://leshaw-lsw.co.za/): navy `#0B2341`, brand blue `#1A5298`, signal red
`#FA0000`, Raleway headings, Open Sans body, the real LSW logo and catalogue photography.

Listed on the Omnatix demo site with Leshaw's approval, in its own "Built for a client" row,
at `/leshaw/`.

## Run it

No build step. Serve the `dashboard` folder:

```bash
python -m http.server 5173 --directory dashboard
```

Then open http://localhost:5173. Opening `index.html` straight from the disk works for the hub,
but not for the AI assistant, which loads as a module and calls `/api/chat`.

The AI assistant answers only where `functions/api/chat.js` runs: on Cloudflare Pages, or under
a local stand-in for it. On a plain static server the pop-up opens and says it is not switched on.

## What's inside

| Page | What it shows |
|---|---|
| **Overview** | Revenue, orders, AOV, sheets cut, low stock (7D / 30D / 90D / 12M), revenue pace vs previous period, sales by category, cut & edge pipeline, best sellers, stock alerts, busiest days |
| **Orders** | Filter by status, search, sort, paginate, export CSV; order drawer with status stepper, line items, VAT breakdown |
| **Quotes** | Pipeline value, win rate, expiring quotes; quote builder with live cutting/edging and VAT; one click to accept and turn a quote into an order |
| **Cut & Edge** | Drag-and-drop factory board (Received → Optimising → Cutting → Edge banding → Ready), rush and overdue flags |
| **Inventory** | Real Leshaw boards, tops, edging and hardware, with stock levels, reorder alerts, 6-month sales and receive-stock |
| **Customers** | Trade accounts, 12-month sales, spend chart, open quotes, "new quote for this customer" |

Extras: ⌘K / Ctrl K global search, notifications, dark mode, works on phones.

## The AI assistant

The "Ask Leshaw AI" button in the bottom corner opens the assistant, the same pop-up as the four
warehouse demos, in Leshaw's brand. Two tabs:

- **Chat**: a business conversation. It greets, follows up ("and last month?"), explains the
  products, services and how the hub works, and politely declines anything unrelated to the
  business. Every figure comes from a SQL query it writes, run in the browser on the hub's live
  data, with the query and rows shown under the answer.
- **Today's briefing**: fixed queries on the live data (sales against last month, money owed,
  late jobs, low stock with days of cover, expiring quotes, quiet customers, best sellers),
  phrased by the model into a headline and priorities. The figures it was given are shown under
  it, and it says when the hub's data has changed since it was written.

Files, in `dashboard/`:

- `js/ai/ai.js`: the entry; mounts the pop-up and writes the briefing
- `js/ai/db.js`: turns the hub's live data into DuckDB tables (orders, order_lines, products,
  customers, quotes, quote_lines, production_jobs), rebuilt whenever the data changes
- `js/ai/ask.js`: the pop-up, shared byte for byte with the other demos
- `js/ai/charts.js`: the one helper `ask.js` needs from a chart library
- `css/ai.css`: the pop-up's structure, shared, and Leshaw's dress for it
- `data/chat-context.json`: what the model knows: the business, its pages, the tables and the
  rules (prices include 15% VAT). Written by hand; update it when a table or a page changes

`js/app.js` exposes the live data read-only as `window.LeshawHub.state()`.

## Demo data

Customers, orders and quotes are **fictional** sample data, generated from a fixed seed. Products,
sizes and images come from Leshaw's public website, and prices are realistic estimates.
Changes made during a demo are saved in the browser. Use the ↻ button next to the user's
name (bottom left) to reset everything.

## Files

- `dashboard/index.html`: app shell
- `dashboard/css/styles.css`: design tokens (light and dark) and components
- `dashboard/js/data.js`: catalogue and seeded demo-data generator
- `dashboard/js/charts.js`: dependency-free SVG charts with tooltips
- `dashboard/js/app.js`: routing, views, drawers, quote builder, production board
- `dashboard/js/ai/`, `dashboard/css/ai.css`, `dashboard/data/`: the AI assistant, above
- `dashboard/assets/`: logo, hero photo, product images

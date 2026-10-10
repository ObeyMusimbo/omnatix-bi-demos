/* Leshaw Business Hub: demo data
   Catalogue items mirror leshaw-lsw.co.za. Orders, customers and quotes are
   generated from a fixed seed so the demo is identical on every machine. */
(function () {
  const IMG = 'assets/p/';

  const CATEGORIES = ['Melamine', 'High Gloss', 'Counter Tops', 'Textured & Matt', 'Hardware', 'Edging'];

  // id, name, range, category, spec, unit, price, cost, stock, reorder, img, popularity weight
  const PRODUCTS = [
    ['MEL-ARD', 'Arden', 'Melawood', 'Melamine', '16mm · 2750×1830mm', 'sheet', 785, 560, 46, 30, 'melawood-arden.jpg', 9],
    ['MEL-ALG', 'Alegria', 'Melawood', 'Melamine', '16mm · 2750×1830mm', 'sheet', 785, 560, 21, 30, 'melawood-alegria.jpg', 7],
    ['MEL-NOK', 'Natural Oak', 'Melawood', 'Melamine', '16mm · 2750×1830mm', 'sheet', 765, 545, 64, 30, 'melawood-natural-oak.jpg', 10],
    ['MEL-AFW', 'African Wenge', 'Melawood', 'Melamine', '16mm · 2750×1830mm', 'sheet', 795, 570, 33, 25, 'melawood-african-wenge.jpg', 6],
    ['MEL-FGR', 'Folkstone Grey', 'Melawood', 'Melamine', '16mm · 2750×1830mm', 'sheet', 745, 530, 88, 40, 'melawood-folkstone-grey.jpg', 12],
    ['MEL-LZO', 'Lanza Oak', 'Melawood', 'Melamine', '16mm · 2750×1830mm', 'sheet', 799, 575, 12, 25, 'melawood-lanza-oak.jpg', 5],
    ['GLS-AWN', 'American Walnut', 'Supagloss', 'High Gloss', '18mm · 2700×1800mm', 'sheet', 1690, 1210, 18, 12, 'supagloss-american-walnut.jpg', 6],
    ['GLS-CRD', 'Candy Red', 'Supagloss', 'High Gloss', '18mm · 2700×1800mm', 'sheet', 1650, 1180, 7, 8, 'supagloss-candy-red.jpg', 3],
    ['GLS-PTB', 'Petrol Blue', 'Supagloss', 'High Gloss', '18mm · 2700×1800mm', 'sheet', 1650, 1180, 15, 8, 'supagloss-petrol-blue.jpg', 4],
    ['GLS-SBK', 'Super Black', 'Supagloss', 'High Gloss', '18mm · 2700×1800mm', 'sheet', 1620, 1160, 26, 12, 'supagloss-super-black.jpg', 7],
    ['GLS-CAP', 'Cappuccino', 'Supagloss', 'High Gloss', '18mm · 2700×1800mm', 'sheet', 1620, 1160, 19, 10, 'supagloss-cappuccino.jpg', 5],
    ['GLS-ICW', 'Iceberg White', 'Supagloss', 'High Gloss', '18mm · 2700×1800mm', 'sheet', 1590, 1140, 41, 15, 'supagloss-iceberg-white.jpg', 9],
    ['TOP-ANT', 'Antares', 'Formica', 'Counter Tops', '32mm · 3600×600mm', 'top', 1480, 1040, 14, 10, 'formica-antares.jpg', 6],
    ['TOP-AKS', 'Akashi', 'Formica', 'Counter Tops', '32mm · 3600×600mm', 'top', 1480, 1040, 9, 10, 'formica-akashi.jpg', 5],
    ['TOP-CAT', 'Catalan', 'Formica', 'Counter Tops', '32mm · 3600×600mm', 'top', 1520, 1070, 22, 10, 'formica-catalan.jpg', 6],
    ['TOP-BSL', 'Black Slate', 'Formica', 'Counter Tops', '32mm · 3600×600mm', 'top', 1560, 1100, 11, 8, 'formica-black-slate.jpg', 5],
    ['TOP-SXO', 'Saxon Oak', 'Formica', 'Counter Tops', '32mm · 3600×600mm', 'top', 1450, 1020, 17, 8, 'formica-saxon-oak.jpg', 4],
    ['TOP-AQL', 'Aquila', 'Formica', 'Counter Tops', '32mm · 3600×600mm', 'top', 1520, 1070, 4, 8, 'formica-aquila.jpg', 4],
    ['TEX-URB', 'Urbino', 'Supamatt', 'Textured & Matt', '18mm · 2750×1830mm', 'sheet', 1240, 880, 23, 10, 'supamatt-urbino.jpg', 4],
    ['TEX-CAL', 'Caldera', 'Supamatt', 'Textured & Matt', '18mm · 2750×1830mm', 'sheet', 1240, 880, 16, 10, 'supamatt-caldera.jpg', 3],
    ['TEX-KBL', 'Kara Blu', 'Supatexture', 'Textured & Matt', '18mm · 2750×1830mm', 'sheet', 1310, 930, 8, 8, 'supatexture-kara-blu.jpg', 3],
    ['TEX-ERW', 'Earlswood', 'Supatexture', 'Textured & Matt', '18mm · 2750×1830mm', 'sheet', 1310, 930, 20, 8, 'supatexture-earlswood.jpg', 3],
    ['HW-HNG', 'Soft-close Hinge', 'Hardware', 'Hardware', '35mm cup · clip-on', 'pair', 42, 22, 640, 200, 'hw-hinge.webp', 14],
    ['HW-SCR', 'Chipboard Screws', 'Hardware', 'Hardware', '4×30mm · box of 200', 'box', 89, 48, 118, 60, 'hw-screws.jpg', 10],
    ['HW-RLH', 'Rail Handle', 'Hardware', 'Hardware', '128mm · brushed steel', 'each', 38, 17, 410, 150, 'hw-raiel_handles.webp', 11],
    ['HW-MBH', 'Modern Brushed Handle', 'Hardware', 'Hardware', '160mm · matt black', 'each', 54, 26, 96, 120, 'hw-modern-brushed-handel.webp', 8],
    ['HW-ADL', 'Adjustable Legs', 'Hardware', 'Hardware', '100–150mm · set of 4', 'set', 72, 34, 210, 80, 'hw-adjustablelegs.jpg', 7],
    ['HW-CGL', 'Contact Glue', 'Hardware', 'Hardware', '5 litre tin', 'tin', 465, 310, 28, 15, 'hw-contactglue.jpg', 5],
    ['HW-WGL', 'Wood Glue', 'Hardware', 'Hardware', '1 litre', 'bottle', 98, 55, 74, 30, 'hw-woodglue.jpg', 6],
    ['HW-WRK', 'Wine Rack', 'Hardware', 'Hardware', '9 hole · chrome', 'each', 389, 220, 9, 10, 'hw-9-ring-bottle.webp', 2],
    ['HW-SIL', 'Silicone Sealant', 'Hardware', 'Hardware', '280ml · white / clear / black', 'tube', 79, 42, 152, 60, 'hw-alcolinsilicone.png', 7],
    ['HW-CLD', 'Wall Panel Cladding', 'Hardware', 'Hardware', '2400×162×12mm', 'panel', 168, 104, 240, 100, 'hw-cledding1.webp', 5],
    ['HW-PBR', 'Plastic Bracket', 'Hardware', 'Hardware', '50×50mm · pack of 50', 'pack', 115, 58, 38, 40, 'hw-50x50plasticbracket.jpg', 4],
    ['HW-CNB', 'Cane Basket', 'Hardware', 'Hardware', 'Pull-out · 600mm', 'each', 489, 300, 12, 6, 'hw-cane-basket.jpg', 2],
    ['EDG-ALU', 'Aluminium Edging', 'Edging', 'Edging', '22mm · 0.4 / 1 / 2mm · 50m roll', 'roll', 345, 210, 26, 12, 'hw-alluminium.jpg', 4],
    ['EDG-AWN', 'American Walnut Edging', 'Edging', 'Edging', '22mm · 1mm · 50m roll', 'roll', 289, 170, 31, 12, 'hw-american-walnut.jpg', 5],
    ['EDG-AST', 'Astana Edging', 'Edging', 'Edging', '22mm · 1mm · 50m roll', 'roll', 289, 170, 5, 12, 'hw-astana.jpg', 4],
  ].map(([id, name, range, category, spec, unit, price, cost, stock, reorder, img, w]) => ({ id, name, range, category, spec, unit, price, cost, stock, reorder, img: IMG + img, w }));

  const SERVICES = {
    cut: { label: 'Precision cutting', unit: 'sheet', price: 48 },
    edge: { label: 'Edge banding', unit: 'metre', price: 14 },
  };

  // name, contact, type, area, phone, account?
  const CUSTOMERS = [
    ['Mthembu Kitchens', 'Sipho Mthembu', 'Kitchen installer', 'Spruitview', true, 9],
    ['Vosloorus Shopfitters', 'Thandi Nkosi', 'Shopfitter', 'Vosloorus', true, 6],
    ['Ndlovu Interiors', 'Lerato Ndlovu', 'Interior designer', 'Alberton', true, 5],
    ['Alberton Kitchen Co.', 'Pieter van Wyk', 'Kitchen installer', 'Alberton', true, 7],
    ['Katlehong Furniture Works', 'Bongani Dube', 'Furniture maker', 'Katlehong', true, 6],
    ['Thokoza Builders', 'Mpho Mokoena', 'Contractor', 'Thokoza', true, 4],
    ['Germiston Cabinet Makers', 'Rajesh Naidoo', 'Kitchen installer', 'Germiston', true, 6],
    ['Zulu & Sons Carpentry', 'Themba Zulu', 'Furniture maker', 'Spruitview', false, 4],
    ['Boksburg Built-ins', 'Annelie Botha', 'Kitchen installer', 'Boksburg', true, 5],
    ['Mokoena Projects', 'Kagiso Mokoena', 'Contractor', 'Vosloorus', true, 3],
    ['Leratong Cabinets', 'Nomsa Khumalo', 'Kitchen installer', 'Katlehong', false, 3],
    ['Elsburg Joinery', 'Johan Pretorius', 'Furniture maker', 'Germiston', true, 3],
    ['Spruitview Property Group', 'Ayanda Sithole', 'Developer', 'Spruitview', true, 2],
    ['Nkosi Design Studio', 'Zanele Nkosi', 'Interior designer', 'Alberton', false, 2],
    ['Walk-in · Cash sale', 'Counter sales', 'Retail / DIY', 'Spruitview', false, 12],
  ].map(([name, contact, type, area, account, w], i) => ({
    id: 'C' + String(101 + i),
    name, contact, type, area, account, w,
    phone: i === 14 ? '011 866 8873' : '0' + (60 + (i * 7) % 23) + ' ' + String(100 + (i * 37) % 900) + ' ' + String(1000 + (i * 431) % 9000),
    email: i === 14 ? 'info@leshaw-lsw.co.za' : name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '') + '@example.co.za',
  }));

  const ORDER_STATUSES = ['Awaiting payment', 'Paid', 'In production', 'Ready for collection', 'Completed', 'Cancelled'];
  const STAGES = ['Received', 'Optimising', 'Cutting', 'Edge banding', 'Ready'];
  const CHANNELS = ['Walk-in', 'Phone', 'WhatsApp', 'Email'];
  const MACHINES = ['Panel saw 1', 'Panel saw 2', 'Edge bander'];

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function generate(seed = 20261005) {
    const rnd = mulberry32(seed);
    const pick = (arr, wkey = 'w') => {
      const total = arr.reduce((s, x) => s + (x[wkey] || 1), 0);
      let r = rnd() * total;
      for (const x of arr) { r -= x[wkey] || 1; if (r <= 0) return x; }
      return arr[arr.length - 1];
    };
    const int = (a, b) => Math.floor(a + rnd() * (b - a + 1));

    const products = PRODUCTS.map(p => ({ ...p }));
    const customers = CUSTOMERS.map(c => ({ ...c }));
    const boards = products.filter(p => !['Hardware', 'Edging'].includes(p.category));
    const hardware = products.filter(p => p.category === 'Hardware');
    const edging = products.filter(p => p.category === 'Edging');

    const now = new Date();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const DAY = 864e5;
    const orders = [];

    // Seasonality: builders' break in Dec/Jan, strong Feb–Mar and Sep–Nov.
    const season = [0.72, 1.08, 1.12, 1.0, 0.98, 0.92, 0.9, 0.98, 1.05, 1.12, 1.14, 0.62];

    for (let d = 729; d >= 0; d--) {
      const date = new Date(today.getTime() - d * DAY);
      const dow = date.getDay();
      if (dow === 0) continue; // closed Sundays
      const growth = 1 + (729 - d) / 729 * 0.16; // ~16% YoY growth
      let n = (dow === 6 ? 1.8 : 4.3) * season[date.getMonth()] * growth;
      n = Math.max(0, Math.round(n + (rnd() - 0.5) * 2.4));
      for (let k = 0; k < n; k++) {
        const cust = pick(customers);
        const trade = cust.type !== 'Retail / DIY';
        const lines = [];
        const nb = trade ? int(1, 3) : int(0, 1);
        let sheets = 0;
        const used = new Set();
        for (let b = 0; b < nb; b++) {
          const p = pick(boards);
          if (used.has(p.id)) continue; used.add(p.id);
          const qty = p.category === 'Counter Tops' ? int(1, 3) : trade ? int(2, 12) : int(1, 3);
          lines.push({ pid: p.id, qty, price: p.price });
          if (p.category !== 'Counter Tops') sheets += qty;
        }
        const nh = int(trade ? 1 : 1, trade ? 4 : 3);
        for (let h = 0; h < nh; h++) {
          const p = pick(hardware);
          if (used.has(p.id)) continue; used.add(p.id);
          const qty = ['pair', 'each', 'panel', 'set'].includes(p.unit) ? int(trade ? 6 : 2, trade ? 40 : 10) : int(1, trade ? 6 : 2);
          lines.push({ pid: p.id, qty, price: p.price });
        }
        if (rnd() < 0.3) { const p = pick(edging); lines.push({ pid: p.id, qty: int(1, 3), price: p.price }); }

        const services = [];
        if (sheets > 0 && rnd() < (trade ? 0.72 : 0.45)) {
          services.push({ key: 'cut', qty: sheets, price: SERVICES.cut.price });
          if (rnd() < 0.85) services.push({ key: 'edge', qty: Math.round(sheets * (14 + rnd() * 16)), price: SERVICES.edge.price });
        }

        let placed = new Date(date.getTime() + (7.5 + rnd() * 9) * 36e5);
        if (placed > now) {
          const open = new Date(date.getTime() + 7.5 * 36e5);
          if (now <= open) continue; // shop not open yet today
          placed = new Date(open.getTime() + rnd() * (now - open));
        }
        let status = 'Completed';
        const hasProd = services.length > 0;
        if (d <= 1) status = pick([{ s: 'Awaiting payment', w: 3 }, { s: 'Paid', w: 4 }, { s: 'In production', w: hasProd ? 3 : 0 }], 'w').s;
        else if (d <= 4) status = pick([{ s: 'Awaiting payment', w: 1 }, { s: 'Paid', w: 1 }, { s: 'In production', w: hasProd ? 5 : 0 }, { s: 'Ready for collection', w: 3 }, { s: 'Completed', w: 3 }], 'w').s;
        else if (d <= 9) status = pick([{ s: 'In production', w: hasProd ? 1 : 0 }, { s: 'Ready for collection', w: 2 }, { s: 'Completed', w: 12 }], 'w').s;
        if (status === 'Paid' && hasProd && rnd() < 0.5) status = 'In production';
        if (!hasProd && status === 'In production') status = 'Paid';
        if (d > 3 && rnd() < 0.018) status = 'Cancelled';

        orders.push({
          id: '',
          cid: cust.id,
          date: placed.toISOString(),
          lines, services, status,
          channel: cust.type === 'Retail / DIY' ? pick([{ s: 'Walk-in', w: 8 }, { s: 'WhatsApp', w: 2 }], 'w').s : pick([{ s: 'Walk-in', w: 3 }, { s: 'Phone', w: 3 }, { s: 'WhatsApp', w: 4 }, { s: 'Email', w: 2 }], 'w').s,
          delivery: trade && rnd() < 0.35 ? 'Delivery' : 'Collection',
        });
      }
    }

    // Order numbers follow the order they were placed
    orders.sort((a, b) => a.date.localeCompare(b.date));
    orders.forEach((o, i) => { o.id = 'LSW-' + (24001 + i); });

    // Cut & Edge production board, built from live orders that need cutting
    const jobs = [];
    const live = orders.filter(o => o.services.length && ['Paid', 'In production', 'Ready for collection'].includes(o.status));
    live.forEach((o, i) => {
      const board = o.lines.map(l => products.find(p => p.id === l.pid)).find(p => p && !['Hardware', 'Edging'].includes(p.category));
      if (!board) return;
      const cut = o.services.find(s => s.key === 'cut');
      const edge = o.services.find(s => s.key === 'edge');
      let stage = 'Received';
      if (o.status === 'In production') stage = STAGES[1 + Math.floor(rnd() * 3)];
      if (o.status === 'Ready for collection') stage = 'Ready';
      const due = new Date(new Date(o.date).getTime() + (2 + Math.floor(rnd() * 3)) * DAY);
      jobs.push({
        id: 'JC-' + (5100 + i),
        oid: o.id, cid: o.cid, pid: board.id,
        sheets: cut ? cut.qty : 0,
        panels: (cut ? cut.qty : 0) * int(6, 14),
        edgeM: edge ? edge.qty : 0,
        stage, due: due.toISOString(),
        machine: stage === 'Edge banding' ? 'Edge bander' : MACHINES[int(0, 1)],
        priority: rnd() < 0.18,
      });
    });

    // Quotes
    const quotes = [];
    const qStatuses = [{ s: 'Draft', w: 2 }, { s: 'Sent', w: 5 }, { s: 'Accepted', w: 3 }, { s: 'Declined', w: 1 }, { s: 'Expired', w: 1 }];
    for (let i = 0; i < 18; i++) {
      const cust = pick(customers.filter(c => c.type !== 'Retail / DIY'));
      const days = int(0, 24);
      const created = new Date(today.getTime() - days * DAY + 10 * 36e5);
      const lines = [];
      const used = new Set();
      for (let b = 0; b < int(2, 4); b++) {
        const p = pick(boards); if (used.has(p.id)) continue; used.add(p.id);
        lines.push({ pid: p.id, qty: p.category === 'Counter Tops' ? int(1, 4) : int(6, 30), price: p.price });
      }
      for (let h = 0; h < int(1, 3); h++) {
        const p = pick(hardware); if (used.has(p.id)) continue; used.add(p.id);
        lines.push({ pid: p.id, qty: int(10, 60), price: p.price });
      }
      const sheets = lines.filter(l => !products.find(p => p.id === l.pid).category.match(/Counter|Hardware|Edging/)).reduce((s, l) => s + l.qty, 0);
      const services = sheets ? [{ key: 'cut', qty: sheets, price: SERVICES.cut.price }, { key: 'edge', qty: sheets * int(16, 26), price: SERVICES.edge.price }] : [];
      let status = pick(qStatuses, 'w').s;
      if (days > 14 && status === 'Sent') status = 'Expired';
      if (days < 2 && (status === 'Expired' || status === 'Declined')) status = 'Sent';
      quotes.push({
        id: 'Q-' + (3301 + i), cid: cust.id, date: created.toISOString(),
        valid: new Date(created.getTime() + 14 * DAY).toISOString(),
        lines, services, status,
        project: pick([{ s: 'Kitchen renovation', w: 5 }, { s: 'Built-in cupboards', w: 4 }, { s: 'Office fit-out', w: 2 }, { s: 'Bathroom vanity', w: 2 }, { s: 'Shop counters', w: 1 }, { s: 'Wardrobe units', w: 3 }], 'w').s,
      });
    }
    quotes.sort((a, b) => b.date.localeCompare(a.date));
    orders.sort((a, b) => b.date.localeCompare(a.date));

    return { v: 1, generated: today.toISOString(), products, customers, orders, jobs, quotes, readNotifs: [] };
  }

  window.LESHAW = { CATEGORIES, SERVICES, ORDER_STATUSES, STAGES, MACHINES, generate };
})();

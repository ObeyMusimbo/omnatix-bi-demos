# Omnatix investor pitch

Twelve minutes of talk, three minutes of live demo, then questions. Every slide below has what to
show and what to say. Say it in your own words once you know it; the numbers stay exact.

Anything in **[square brackets]** is yours to fill before the meeting: the team, traction, the
raise and the final prices. Never walk in with a bracket still in it.

Live demos: `https://omnatix-bi-demos.pages.dev` (or `demos.omnatix.co.za` once the domain is on).

---

## Before the meeting

- Open the landing page and the demo you will show on your own laptop, not theirs. Let it load
  fully once so the query engine is cached.
- Choose the demo by the investor's portfolio. Logistics or industrial: **Kestrel**. Fintech or
  lending: **Sable & Finch**. Health: **Lumen**. Consumer, retail or generalist: **Meridian**.
  If unsure, use Kestrel: it is the most visual in a room.
- Kestrel opens in dark mode and looks best that way on a projector. Meridian and Sable & Finch
  read best in light.
- Save the Meridian page as a PDF as a backup in case the venue Wi-Fi fails.
- Know five numbers without looking: the market size, the cost of a data analyst, your price,
  your delivery time, and the demo's headline.

---

## 1. The cold open (30 seconds)

**Show:** nothing yet. Laptop closed or on the landing page.

**Say:**

> "A distributor we modelled grew revenue 11.9% last year. Gross profit grew 4.1%. On last year's
> margin that is R12.6 million that should have arrived and did not, and nobody in that business
> could tell you where it went.
>
> We can. In the first meeting. From files they already export."

Stop. Let the silence do the work. Then: "I'm [name], this is Omnatix."

---

## 2. The problem (1 minute)

**Show:** one slide, three lines.

**Say:**

> "South Africa's mid-market, the businesses turning roughly R50 million to R2 billion, runs on
> exports and spreadsheets. The money they lose does not sit in any one report. It sits in the
> join between two systems: freight booked at order level that never reaches a product, a truck
> that comes home empty and is charged to nobody, a rejected medical aid claim in an inbox
> nobody opens.
>
> They cannot fix it by hiring. A data analyst in South Africa costs R300,000 to R570,000 a year,
> and one analyst is not a data team. And buying a dashboard tool does not help either: Microsoft
> put Power BI Pro up 40% last year, and a tool displays numbers. It does not find anything."

---

## 3. What Omnatix does (1 minute)

**Say:**

> "Omnatix is decision intelligence as a service. We take the exports a business already has,
> sales, fleet, loans, claims, and turn them into a tested data warehouse and a dashboard that
> discovers where money is leaking, not one that just charts it.
>
> Every night the pipeline rebuilds, runs its tests, and an AI analyst reads the results and
> writes the recommendations: what happened, why nobody saw it, what to do, who owns it, and
> what it is worth in rand.
>
> First findings in three weeks, not a twelve month BI project."

---

## 4. Live demo (3 minutes)

The script below is for Kestrel. For the other three, use the opening line and the three moments
listed under each demo in [BUYER_DEMO_SCRIPT.md](BUYER_DEMO_SCRIPT.md), and keep the same shape:
the headline, one finding, the AI panel, the total.

**Show:** Kestrel, Network view.

> "This is a freight operator: 124 trucks, R243 million a year. This is their control tower.
> Nearly a quarter of every kilometre their fleet ran last year carried nothing."

Point at the map.

> "Every line is a corridor, coloured by what it earns as a round trip. Their biggest lane by
> revenue, Johannesburg to Cape Town, looks like R8.8 million of contribution on their reports.
> Charge it for the empty truck it sends home and it loses R1.8 million."

Point at the AI recommendation under the view.

> "Every night an AI model reads the same tables and writes this: the insight, the reason, the
> actions with an owner and a deadline, and the rand value. It names the model that wrote it,
> because a CFO will not act on words they cannot trace."

Click **What it is worth** in the sidebar.

> "Four findings. R19.7 million a year, against R27.6 million of contribution. Same fleet, same
> customers, nothing new bought. Half of that inside a year lifts their contribution by 36%."

Close on the architecture, because this is the investor's question:

> "One more thing. None of this runs on a server. The query engine runs in the viewer's browser
> against files we publish, so the cost of serving each client is close to nothing, and the
> client's detailed records never sit on our infrastructure."

---

## 5. Why now (45 seconds)

**Say:**

> "Three things changed. First, AI made the expensive part, the analyst who explains the numbers
> and writes the recommendation, nearly free to run every night. Second, open source tools like
> DuckDB and dbt collapsed the cost of a proper tested warehouse. Third, the market is moving:
> South Africa's advanced analytics market is about USD 1 billion this year and is forecast to
> more than double by 2031, growing faster than the global rate. The demand is there. The
> delivery model has not caught up."

Sources are at the bottom of this file. Quote the numbers, not the adjectives.

---

## 6. Business model (1 minute)

**Say:**

> "Two products. A **Discovery Sprint**: three weeks, fixed fee, on the client's own exports. It
> ends with the findings, the rand values and the dashboard. Then the **Omnatix subscription**:
> the nightly pipeline, the tests, the dashboards, the AI analyst and a monthly review with the
> executive who owns the numbers.
>
> The sprint pays for itself in the first meeting, because the findings are priced in rand. The
> subscription is how they keep the money they found."

| Line | Proposed price | What the client gets |
|---|---|---|
| Discovery Sprint | **[R45,000 to R85,000 once off]** | Three weeks, findings with rand values, the live dashboard |
| Subscription | **[R15,000 to R45,000 a month]** | Nightly refresh and tests, AI insights, monthly review, one change request a month |
| Expansion | **[per added source or business unit]** | New data sources, new sites, the AI chat |

**Unit economics to state, once you have measured them:**

- Cost to serve a client: static hosting and the AI run are cents a night. The real cost is
  delivery hours. **[Measure your first three sprints and quote the hours.]**
- Every client in an industry starts from our model for that industry. The four demos are those
  models, so delivery time falls with every client in the same vertical.
- Compared with the buyer's alternative: one analyst at R300k to R570k a year, plus tools, plus
  the six months it takes to find anything.

---

## 7. Why we win (45 seconds)

**Say:**

> "Four things are hard to copy. One, industry models: we already know where money hides in
> distribution, freight, lending and clinics, and each demo proves it. Two, the pipeline is
> tested: 134 models and 445 tests across the four demos, and every bridge reconciles to the
> rand. Three, the AI shows its working, which is what makes a finance director trust it. Four,
> speed and price: weeks and a monthly fee, against consultancies that take months and bill
> millions."

---

## 8. Go to market (1 minute)

**Say:**

> "We start in four verticals where the leaks are large and the data is already exportable: FMCG
> distribution, road freight, microfinance and private healthcare groups.
>
> We sell direct to the CFO or COO, and the live demo is the opener: a two minute demo on their
> own industry gets the second meeting. Our channel partners are the people already inside these
> businesses: audit and accounting firms, and Sage and Pastel consultants, who see the problem
> every month and have no product to sell against it."

**The specific ask inside this slide:** "The fastest thing you can do for us is five
introductions to CFOs in your portfolio or network. We will show them their industry's demo."

---

## 9. Competition (45 seconds)

| Alternative | What the buyer gets | Why Omnatix wins |
|---|---|---|
| Big consultancy | A report in three to six months, R1m plus | Findings in three weeks, then kept live monthly |
| BI tool reseller | Licences and charts | We deliver findings, not software seats |
| Freelancer | A spreadsheet, no tests | A tested warehouse that rebuilds every night |
| In-house hire | One person, six months to ramp | A team and a method from day one |

**Say:** "Nobody in our segment sells the finding. They sell the tool, the hours, or the report."

---

## 10. Traction (45 seconds)

**Say what is true, and nothing more.**

- Four working demos in four industries, live on the web, rebuilding and testing every night.
- **[Pilots running, letters of intent, pipeline value, meetings booked. If you have none yet,
  say: "We are pre-revenue and this raise buys the first ten clients." Investors forgive early.
  They do not forgive inflated.]**

---

## 11. Team (30 seconds)

**[Name, role, one line each on why this person can win this market. Lead with the operating and
delivery experience a CFO would trust, then the AI and engineering depth.]**

---

## 12. The ask (45 seconds)

**Say:**

> "We are raising **[amount]** to reach **[number]** paying subscription clients in
> **[months]**. It pays for **[two delivery engineers, one sales lead]** and **[18]** months of
> runway. The milestones are: **[first five sprints in six months, ten subscriptions in twelve,
> the AI chat and the second industry model set in eighteen]**."

Then the close:

> "Every business we open finds money it already had. Give us five introductions and we will
> prove it on their own data inside three weeks."

Stop talking.

---

## Questions you will be asked

**"Isn't this just Power BI?"**
Power BI is a place to put charts. We deliver the finding: the warehouse, the tested logic that
joins the systems, the discovery, and the recommendation. A client can view our output in Power
BI if they want to. The value is upstream of the tool.

**"What if the AI is wrong?"**
It only writes from the figures on the page, and every rand value it quotes is checked against
the data before it is published. If it fails the check, it is dropped. Each panel names the
model and the date, and the numbers beside it are the ones it must agree with. The AI explains
and recommends. The warehouse decides the numbers.

**"The demos are synthetic. How do we know this works on real data?"**
They are synthetic on purpose, so we can show them to anyone. They carry the defects real
exports carry: mixed date formats, duplicates, missing costs, broken references, and the
pipeline shows each one it fixed. **[Once you have a pilot, replace this answer with it.]**

**"How do you scale delivery?"**
The industry model does most of the work. A new freight client starts from Kestrel's warehouse,
tests and dashboard, and the sprint is mostly mapping their exports into it. Delivery time per
client falls with each client in the vertical.

**"Why would a CFO pay every month?"**
Because the leaks come back. The discount creeps again, the new lane is priced on the old
assumption, the new clinic stops working its rejections. The subscription is the alarm that
catches it, reviewed monthly with a person.

**"What about POPIA?"**
The dashboard runs in the viewer's browser and publishes aggregated tables, not personal records.
The AI reads the same aggregates, and the model provider can be chosen to fit the client's own
policy. The demos contain no personal identifiers at all.

**"What stops a Big Four firm doing this?"**
Nothing stops them doing it, but their model is hours billed. A three week sprint at our price is
not a project they can staff profitably, and a monthly subscription is not how they sell.

**"What is your customer acquisition cost and payback?"**
**[Answer from your first deals. Until then:]** "Direct founder sales, with a sprint that pays for
itself in findings. We will have measured CAC after the first ten sales, and that is one of the
milestones this round buys."

**"Why these four industries?"**
Each has a large leak that lives in a join between systems, exportable data, and a buyer who
owns the number: a CFO, a COO, a CRO, a group finance director.

**"Can a client leave with their data?"**
Yes. It is their exports, a standard warehouse and open source tools. Lock-in is not the
strategy. Being the people who keep finding money is.

**"What does it cost you to serve a client?"**
Hosting is effectively free and the AI run is cents a night. The cost is people's time, which
the industry models reduce. **[Quote measured hours once you have them.]**

**"Why you?"**
**[Your answer. Make it about the market and the buyer, not the technology.]**

---

## Sources for the market numbers

- South Africa advanced analytics market, USD 1,023.8 million in 2026, USD 2,213.3 million by
  2031, 16.7% CAGR:
  [MarketsandMarkets](https://www.marketsandmarkets.com/Market-Reports/geography/advanced-analytics-market/south-africa)
- South Africa data analytics market, USD 1,016.3 million in 2024, 17.3% CAGR to 2030:
  [Grand View Research](https://www.grandviewresearch.com/horizon/outlook/data-analytics-market/south-africa)
- Data analyst salaries in South Africa, roughly R300,000 to R570,000 a year depending on source
  and seniority: [PayScale](https://www.payscale.com/research/ZA/Job=Data_Analyst/Salary),
  [SalaryExpert](https://www.salaryexpert.com/salary/job/data-analyst/south-africa),
  [Indeed](https://za.indeed.com/career/data-analyst/salaries)
- Power BI Pro from USD 10 to USD 14 per user per month from April 2025:
  [Microsoft](https://powerbi.microsoft.com/en-us/blog/important-update-to-microsoft-power-bi-pricing/)
- Medical aid claim rejections as a leading cause of practice revenue loss:
  [Healthbridge](https://healthbridge.co.za/reducing-medical-claim-rejections/)
- Reckless lending, sections 81 and 83 of the National Credit Act:
  [Cliffe Dekker Hofmeyr](https://www.cliffedekkerhofmeyr.com/en/news/publications/2023/Practice/Dispute/dispute-resolution-alert-21-november-from-promise-to-peril-the-duty-of-credit-providers-to-conduct-proper-affordability-checks)

Check each figure again before a meeting. Forecasts are revised, and quoting a stale one to an
investor who has read the new one is worse than quoting none.

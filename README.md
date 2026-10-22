# SaaS Metrics Dashboard

A responsive, interactive dashboard for exploring SaaS revenue, subscriptions, retention, churn, and customer accounts. The application is a front-end demonstration: it generates representative sample data in the browser and does not connect to a backend or external analytics service.

## Goals

- Bring common SaaS performance indicators into one overview.
- Make it easy to explore trends by date range and customer segment.
- Compare the selected period with the immediately preceding period when data is available.
- Provide searchable, filterable customer account details.
- Let users export the current dashboard report as a CSV file.
- Offer a responsive interface with persistent light and dark themes.

## Features

### Metrics and charts

- **Total revenue** — estimated revenue for the selected period, calculated from daily monthly recurring revenue (MRR).
- **Average subscribers** — average daily subscriber count over the selected period.
- **Net revenue retention (NRR)** — average daily NRR, weighted by segment MRR.
- **Customer churn rate** — average daily churn, weighted by subscriber count.
- KPI cards show trends versus the previous period when a same-length comparison period is available, along with sparklines.
- Revenue performance area chart compares current and previous MRR.
- Billing mix donut chart displays estimated monthly, annual, and usage-based revenue.
- Subscriber activity bar chart compares new subscriptions and cancellations.
- Chart values and tooltips respond to the active date and segment filters.

### Filters and customer accounts

- Choose a preset date range: **Last 30 days**, **Last 90 days**, or **Last 12 months**.
- Select a custom start and end date within the available sample-data range.
- Filter all dashboard metrics and charts by **All segments**, **Startup**, **Growth**, or **Enterprise**.
- Search customer accounts by company, domain, segment, plan, or status.
- Filter accounts by **Active**, **Trialing**, or **At risk** status.
- Sort the account table by company, segment, plan, MRR, status, or join date.
- Browse matching accounts in pages of eight. The table shows a helpful empty state when no results match.

### Navigation, theme, and export

- Sidebar navigation scrolls to the Overview, Revenue, Subscriptions, and Customers sections.
- On smaller screens, navigation uses a slide-in menu that can be closed with Escape.
- Toggle between light and dark themes; the choice is saved in browser `localStorage`.
- Download a CSV report containing the selected period and segment, KPI summary, and all accounts matching the active filters (not just the visible table page).

## Tech stack

| Technology | Purpose |
| --- | --- |
| React 19 | Component-based user interface and interaction state |
| TypeScript 5 | Typed application code and dashboard data models |
| Vite 7 | Local development server and production build |
| Tailwind CSS 4 | Utility-first CSS integration |
| Recharts 3 | Revenue, billing mix, and subscription activity charts |
| Lucide React | Interface icons |
| `clsx` and `tailwind-merge` | Conditional class names and Tailwind class merging helper |

The dashboard is client-side only. It does not currently include a database, authentication, server/API integration, or real billing-provider data.

## Getting started

### Prerequisites

- Node.js with npm

### Install dependencies

```bash
npm install
```

### Run the development server

```bash
npm run dev
```

Vite prints the local URL in the terminal after the server starts.

### Build for production

```bash
npm run build
```

The production build is written to `dist/`. The Vite configuration includes `vite-plugin-singlefile` to package the application as a single HTML file where supported by the build setup.

### Preview the production build

```bash
npm run preview
```

## Data and calculation notes

The dashboard data is defined in `src/dashboardData.ts` and generated deterministically for demonstration:

- Daily metric snapshots cover the most recent **820 days**, for the Startup, Growth, and Enterprise segments.
- The account table uses **155 generated sample accounts**.
- Dates are generated relative to the day the application runs.
- Trend values are illustrative; they are not sourced from real customers or production systems.
- “Total revenue” is an estimate obtained by summing each day's MRR divided by 30.4375. It is not a recognized cumulative invoice total.
- The billing-type breakdown uses illustrative segment-level allocation assumptions. It should not be interpreted as actual billing data.
- Account filtering uses each sample account's join date, in addition to the selected segment, status, and search terms.
- A previous-period comparison is shown only when the available data contains a matching number of days for the preceding period.

## Key functions

### `src/App.tsx`

- `aggregateDay(day, segment)` combines a daily snapshot across all segments or returns values for the selected segment. For NRR and churn, it calculates weighted averages.
- `getPeriodStats(days)` calculates the KPI values for a period.
- `makeBuckets(current, previous)` groups daily data into chart points and aligns current-period values with the previous-period comparison.
- `shortDate(date)` and `longDate(date)` format dates for chart labels and the account table.
- `compactCurrency(value, decimals)` formats large currency values in compact notation.
- `getRangeLabel(range)` creates the text shown for the selected date range.
- `Sparkline` renders the small trend visualization used in KPI cards.
- `KpiCard` renders a metric value and its comparison with the prior period.
- `RevenueTooltip`, `ActivityTooltip`, and `MixTooltip` render chart-specific tooltip content.
- `SortHeading` renders an accessible, clickable table column heading.
- `selectPreset(option)` switches to one of the preset date ranges.
- `applyCustomRange()` applies a valid custom date range.
- `handleSort(column)` changes the account table's sort column or direction.
- `navigateTo(id)` updates the active navigation item and scrolls to its section.
- `exportReport()` creates and downloads a CSV for the current dashboard selection.

### `src/dashboardData.ts`

- `startOfDay(date)` normalizes a date to local midnight.
- `addDays(date, days)` returns a date offset by the given number of days.
- `inputDate(date)` formats a date as `YYYY-MM-DD` for date inputs and CSV values.
- `parseInputDate(value)` converts a date-input string to a `Date`.
- `DAILY_DATA` contains the generated daily metric snapshots.
- `ACCOUNTS` contains the generated sample customer accounts.

## Project structure

```text
.
├── index.html                 # HTML entry point and page metadata
├── public/
│   └── favicon.svg            # Browser favicon
├── src/
│   ├── App.tsx                # Dashboard UI, calculations, and interactions
│   ├── dashboardData.ts       # Types, date helpers, and generated demo data
│   ├── index.css              # Global styles, themes, and responsive layout
│   ├── main.tsx               # React application entry point
│   └── utils/
│       └── cn.ts              # Conditional and merged class-name helper
├── package.json               # Dependencies and npm scripts
├── package-lock.json          # Locked dependency versions
├── tsconfig.json              # TypeScript compiler configuration
└── vite.config.ts             # Vite plugins and path alias
```

## Available npm scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Build production assets with Vite |
| `npm run preview` | Serve the production build locally for preview |
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowDownRight,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  Filter,
  LayoutDashboard,
  Menu,
  Moon,
  Search,
  SlidersHorizontal,
  Sun,
  TrendingUp,
  UserPlus,
  UsersRound,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ACCOUNTS,
  DAILY_DATA,
  SEGMENTS,
  TODAY,
  addDays,
  inputDate,
  parseInputDate,
  type Account,
  type AccountStatus,
  type Segment,
  type SegmentFilter,
} from './dashboardData';

type RangePreset = '30d' | '90d' | '12m' | 'custom';
type OpenFilter = 'date' | 'segment' | null;
type SortColumn = 'company' | 'segment' | 'plan' | 'mrr' | 'status' | 'joinedAt';
type SortDirection = 'asc' | 'desc';

interface DateRange {
  start: Date;
  end: Date;
  preset: RangePreset;
}

interface AggregatedDay {
  date: Date;
  mrr: number;
  subscribers: number;
  nrr: number;
  churn: number;
  newSubscriptions: number;
  cancellations: number;
}

interface PeriodStats {
  revenue: number;
  subscribers: number;
  nrr: number;
  churn: number;
}

interface ChartBucket {
  label: string;
  fullLabel: string;
  revenue: number;
  previous?: number;
  newSubscriptions: number;
  cancellations: number;
}

interface MixSlice {
  name: string;
  value: number;
  share: number;
  color: string;
}

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const integer = new Intl.NumberFormat('en-US');
const PAGE_SIZE = 8;
const BILLING_COLORS = ['#645CF0', '#38B99D', '#F3B66B'];
const BILLING_SHARES: Record<Segment, [number, number, number]> = {
  Startup: [0.57, 0.33, 0.1],
  Growth: [0.34, 0.52, 0.14],
  Enterprise: [0.16, 0.7, 0.14],
};

const navItems: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'revenue', label: 'Revenue', icon: TrendingUp },
  { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
  { id: 'customers', label: 'Customers', icon: UsersRound },
];

const presetOptions: { value: Exclude<RangePreset, 'custom'>; label: string; days: number }[] = [
  { value: '30d', label: 'Last 30 days', days: 30 },
  { value: '90d', label: 'Last 90 days', days: 90 },
  { value: '12m', label: 'Last 12 months', days: 365 },
];

function shortDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function longDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function compactCurrency(value: number, decimals = 0): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(decimals || 1)}m`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(decimals)}k`;
  return currency.format(value);
}

function getRangeLabel(range: DateRange): string {
  if (range.preset !== 'custom') return presetOptions.find((option) => option.value === range.preset)?.label ?? 'Date range';
  return `${shortDate(range.start)} - ${shortDate(range.end)}`;
}

function aggregateDay(day: (typeof DAILY_DATA)[number], segment: SegmentFilter): AggregatedDay {
  const included = segment === 'All segments' ? SEGMENTS : [segment];
  const snapshots = included.map((item) => day.segments[item]);
  const mrr = snapshots.reduce((sum, item) => sum + item.mrr, 0);
  const subscribers = snapshots.reduce((sum, item) => sum + item.subscribers, 0);

  return {
    date: day.date,
    mrr,
    subscribers,
    nrr: snapshots.reduce((sum, item) => sum + item.nrr * item.mrr, 0) / mrr,
    churn: snapshots.reduce((sum, item) => sum + item.churn * item.subscribers, 0) / subscribers,
    newSubscriptions: snapshots.reduce((sum, item) => sum + item.newSubscriptions, 0),
    cancellations: snapshots.reduce((sum, item) => sum + item.cancellations, 0),
  };
}

function getPeriodStats(days: AggregatedDay[]): PeriodStats {
  const count = Math.max(days.length, 1);
  return {
    revenue: Math.round(days.reduce((sum, day) => sum + day.mrr / 30.4375, 0)),
    subscribers: Math.round(days.reduce((sum, day) => sum + day.subscribers, 0) / count),
    nrr: days.reduce((sum, day) => sum + day.nrr, 0) / count,
    churn: days.reduce((sum, day) => sum + day.churn, 0) / count,
  };
}

function makeBuckets(current: AggregatedDay[], previous: AggregatedDay[]): ChartBucket[] {
  if (!current.length) return [];
  const count = current.length <= 14 ? current.length : current.length <= 45 ? 10 : 12;

  return Array.from({ length: count }, (_, index) => {
    const first = Math.floor((index * current.length) / count);
    const last = Math.max(first, Math.floor(((index + 1) * current.length) / count) - 1);
    const bucket = current.slice(first, last + 1);
    const previousLast = Math.floor(((index + 1) * previous.length) / count) - 1;
    const lastDay = bucket[bucket.length - 1];

    return {
      label: current.length > 200
        ? lastDay.date.toLocaleDateString('en-US', { month: 'short' })
        : shortDate(lastDay.date),
      fullLabel: first === last ? longDate(lastDay.date) : `${shortDate(bucket[0].date)} - ${longDate(lastDay.date)}`,
      revenue: lastDay.mrr,
      previous: previousLast >= 0 ? previous[previousLast]?.mrr : undefined,
      newSubscriptions: bucket.reduce((sum, day) => sum + day.newSubscriptions, 0),
      cancellations: bucket.reduce((sum, day) => sum + day.cancellations, 0),
    };
  });
}

function Sparkline({ values, id }: { values: number[]; id: string }) {
  if (values.length < 2) return null;
  const sampleCount = Math.min(values.length, 22);
  const sampled = Array.from({ length: sampleCount }, (_, index) =>
    values[Math.round((index * (values.length - 1)) / Math.max(sampleCount - 1, 1))],
  );
  const min = Math.min(...sampled);
  const max = Math.max(...sampled);
  const span = Math.max(max - min, 0.01);
  const points = sampled.map((value, index) => {
    const x = 2 + (index / (sampled.length - 1)) * 78;
    const y = 30 - ((value - min) / span) * 25;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const path = `M ${points.join(' L ')}`;

  return (
    <svg className="sparkline" viewBox="0 0 82 34" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.19" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L 80,34 L 2,34 Z`} fill={`url(#spark-${id})`} />
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface KpiCardProps {
  title: string;
  value: string;
  current: number;
  previous?: number;
  rate?: boolean;
  lowerIsBetter?: boolean;
  icon: LucideIcon;
  sparkline: number[];
  id: string;
  index: number;
}

function KpiCard({ title, value, current, previous, rate, lowerIsBetter, icon: Icon, sparkline, id, index }: KpiCardProps) {
  const difference = current - (previous ?? current);
  const upward = difference >= 0;
  const favorable = lowerIsBetter ? !upward : upward;
  const change = previous === undefined ? 'No prior data' : rate
    ? `${difference > 0 ? '+' : ''}${difference.toFixed(1)} pts`
    : `${difference > 0 ? '+' : ''}${previous ? ((difference / previous) * 100).toFixed(1) : '0.0'}%`;
  const TrendIcon = upward ? ArrowUpRight : ArrowDownRight;

  return (
    <article className="kpi-card" style={{ animationDelay: `${index * 70}ms` }}>
      <div className="kpi-top">
        <span>{title}</span>
        <span className="kpi-icon"><Icon size={18} strokeWidth={1.8} /></span>
      </div>
      <div className="kpi-value" key={value}>{value}</div>
      <div className="kpi-bottom">
        <div className="kpi-change-group">
          <span className={`trend-badge ${previous === undefined ? 'neutral' : favorable ? 'positive' : 'negative'}`}>
            {previous !== undefined && <TrendIcon size={14} strokeWidth={2.2} />} {change}
          </span>
          <span className="kpi-comparison">vs. prev. period</span>
        </div>
        <Sparkline values={sparkline} id={id} />
      </div>
    </article>
  );
}

function TooltipShell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="chart-tooltip">
      <div className="tooltip-date">{label}</div>
      {children}
    </div>
  );
}

function RevenueTooltip({ active, payload }: { active?: boolean; payload?: { payload?: ChartBucket }[] }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <TooltipShell label={point.fullLabel}>
      <div className="tooltip-row"><span><i className="tooltip-dot current" />Current period</span><strong>{currency.format(point.revenue)}</strong></div>
      {point.previous !== undefined && (
        <div className="tooltip-row"><span><i className="tooltip-dot previous" />Previous period</span><strong>{currency.format(point.previous)}</strong></div>
      )}
    </TooltipShell>
  );
}

function ActivityTooltip({ active, payload }: { active?: boolean; payload?: { payload?: ChartBucket }[] }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <TooltipShell label={point.fullLabel}>
      <div className="tooltip-row"><span><i className="tooltip-dot current" />New subscriptions</span><strong>{integer.format(point.newSubscriptions)}</strong></div>
      <div className="tooltip-row"><span><i className="tooltip-dot muted" />Cancellations</span><strong>{integer.format(point.cancellations)}</strong></div>
    </TooltipShell>
  );
}

function MixTooltip({ active, payload }: { active?: boolean; payload?: { payload?: MixSlice }[] }) {
  const slice = payload?.[0]?.payload;
  if (!active || !slice) return null;
  return (
    <TooltipShell label={slice.name}>
      <div className="tooltip-row"><span><i className="tooltip-dot" style={{ background: slice.color }} />Revenue</span><strong>{currency.format(slice.value)}</strong></div>
      <div className="tooltip-row"><span>Share of total</span><strong>{slice.share.toFixed(1)}%</strong></div>
    </TooltipShell>
  );
}

function SortHeading({
  label,
  column,
  sort,
  onSort,
  className = '',
}: {
  label: string;
  column: SortColumn;
  sort: { column: SortColumn; direction: SortDirection };
  onSort: (column: SortColumn) => void;
  className?: string;
}) {
  const Icon = sort.column !== column ? ArrowUpDown : sort.direction === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th className={className} scope="col" aria-sort={sort.column === column ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button className={`sort-button ${sort.column === column ? 'sorted' : ''}`} onClick={() => onSort(column)} type="button">
        {label}<Icon size={13} strokeWidth={2} />
      </button>
    </th>
  );
}

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    localStorage.getItem('saas-metrics-theme') === 'dark' ? 'dark' : 'light',
  );
  const [range, setRange] = useState<DateRange>({ start: addDays(TODAY, -364), end: TODAY, preset: '12m' });
  const [segment, setSegment] = useState<SegmentFilter>('All segments');
  const [openFilter, setOpenFilter] = useState<OpenFilter>(null);
  const [draftStart, setDraftStart] = useState(inputDate(addDays(TODAY, -364)));
  const [draftEnd, setDraftEnd] = useState(inputDate(TODAY));
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All statuses' | AccountStatus>('All statuses');
  const [sort, setSort] = useState<{ column: SortColumn; direction: SortDirection }>({ column: 'joinedAt', direction: 'desc' });
  const [page, setPage] = useState(0);
  const [activeNav, setActiveNav] = useState('overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('saas-metrics-theme', theme);
  }, [theme]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) setOpenFilter(null);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenFilter(null);
        setMobileOpen(false);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const updateActiveSection = () => {
      let current = 'overview';
      navItems.slice(1).forEach(({ id }) => {
        if ((document.getElementById(id)?.getBoundingClientRect().top ?? Infinity) <= 150) current = id;
      });
      setActiveNav(current);
    };
    window.addEventListener('scroll', updateActiveSection, { passive: true });
    return () => window.removeEventListener('scroll', updateActiveSection);
  }, []);

  const allDays = useMemo(() => DAILY_DATA.map((day) => aggregateDay(day, segment)), [segment]);
  const selectedDays = useMemo(
    () => allDays.filter((day) => day.date >= range.start && day.date <= range.end),
    [allDays, range.start, range.end],
  );
  const periodLength = Math.round((range.end.getTime() - range.start.getTime()) / 86_400_000) + 1;
  const previousStart = addDays(range.start, -periodLength);
  const previousEnd = addDays(range.start, -1);
  const previousDays = useMemo(
    () => allDays.filter((day) => day.date >= previousStart && day.date <= previousEnd),
    [allDays, previousStart.getTime(), previousEnd.getTime()],
  );
  const hasComparison = previousDays.length === selectedDays.length;
  const stats = useMemo(() => getPeriodStats(selectedDays), [selectedDays]);
  const previousStats = useMemo(() => hasComparison ? getPeriodStats(previousDays) : undefined, [previousDays, hasComparison]);
  const chartData = useMemo(() => makeBuckets(selectedDays, hasComparison ? previousDays : []), [selectedDays, previousDays, hasComparison]);

  const mixData = useMemo<MixSlice[]>(() => {
    const totals = [0, 0, 0];
    const included = segment === 'All segments' ? SEGMENTS : [segment];

    DAILY_DATA.forEach((day, dayIndex) => {
      if (day.date < range.start || day.date > range.end) return;
      included.forEach((item) => {
        const revenue = day.segments[item].mrr / 30.4375;
        const shares = BILLING_SHARES[item];
        const shift = 0.012 * Math.sin(dayIndex / 65);
        totals[0] += revenue * (shares[0] + shift);
        totals[1] += revenue * (shares[1] - shift);
        totals[2] += revenue * shares[2];
      });
    });

    const total = totals.reduce((sum, value) => sum + value, 0);
    return ['Monthly', 'Annual', 'Usage-based'].map((name, index) => ({
      name,
      value: Math.round(totals[index]),
      share: total ? (totals[index] / total) * 100 : 0,
      color: BILLING_COLORS[index],
    }));
  }, [range.start, range.end, segment]);

  const filteredAccounts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return ACCOUNTS.filter((account) => {
      if (account.joinedAt < range.start || account.joinedAt > range.end) return false;
      if (segment !== 'All segments' && account.segment !== segment) return false;
      if (statusFilter !== 'All statuses' && account.status !== statusFilter) return false;
      return !query || [account.company, account.domain, account.segment, account.plan, account.status]
        .some((value) => value.toLowerCase().includes(query));
    }).sort((a, b) => {
      const aValue = sort.column === 'joinedAt' ? a.joinedAt.getTime() : a[sort.column];
      const bValue = sort.column === 'joinedAt' ? b.joinedAt.getTime() : b[sort.column];
      const comparison = typeof aValue === 'number' && typeof bValue === 'number'
        ? aValue - bValue
        : String(aValue).localeCompare(String(bValue));
      return sort.direction === 'asc' ? comparison : -comparison;
    });
  }, [range.start, range.end, segment, statusFilter, search, sort]);

  useEffect(() => setPage(0), [range.start, range.end, segment, statusFilter, search, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / PAGE_SIZE));
  const visibleAccounts = filteredAccounts.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const customInvalid = !draftStart || !draftEnd || draftStart > draftEnd
    || draftStart < inputDate(DAILY_DATA[0].date) || draftEnd > inputDate(TODAY);

  function selectPreset(option: (typeof presetOptions)[number]) {
    setRange({ start: addDays(TODAY, -(option.days - 1)), end: TODAY, preset: option.value });
    setOpenFilter(null);
  }

  function applyCustomRange() {
    if (customInvalid) return;
    setRange({ start: parseInputDate(draftStart), end: parseInputDate(draftEnd), preset: 'custom' });
    setOpenFilter(null);
  }

  function handleSort(column: SortColumn) {
    setSort((current) => ({
      column,
      direction: current.column === column
        ? current.direction === 'asc' ? 'desc' : 'asc'
        : column === 'mrr' || column === 'joinedAt' ? 'desc' : 'asc',
    }));
  }

  function navigateTo(id: string) {
    setActiveNav(id);
    setMobileOpen(false);
    if (id === 'overview') window.scrollTo({ top: 0, behavior: 'smooth' });
    else document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function exportReport() {
    const rows: (string | number)[][] = [
      ['SaaS Metrics report'],
      ['Date range', `${longDate(range.start)} to ${longDate(range.end)}`],
      ['Segment', segment],
      [],
      ['Metric', 'Value'],
      ['Total revenue', stats.revenue],
      ['Average subscribers', stats.subscribers],
      ['Net revenue retention', `${stats.nrr.toFixed(1)}%`],
      ['Customer churn rate', `${stats.churn.toFixed(1)}%`],
      [],
      ['Company', 'Domain', 'Segment', 'Plan', 'MRR', 'Status', 'Joined'],
      ...filteredAccounts.map((account) => [
        account.company, account.domain, account.segment, account.plan,
        account.mrr, account.status, inputDate(account.joinedAt),
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `saas-metrics-${inputDate(range.start)}-to-${inputDate(range.end)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const kpis: Omit<KpiCardProps, 'index'>[] = [
    {
      id: 'revenue', title: 'Total revenue', value: currency.format(stats.revenue),
      current: stats.revenue, previous: previousStats?.revenue, icon: Wallet,
      sparkline: selectedDays.map((day) => day.mrr),
    },
    {
      id: 'subscribers', title: 'Avg. subscribers', value: integer.format(stats.subscribers),
      current: stats.subscribers, previous: previousStats?.subscribers, icon: UserPlus,
      sparkline: selectedDays.map((day) => day.subscribers),
    },
    {
      id: 'retention', title: 'Net revenue retention', value: `${stats.nrr.toFixed(1)}%`,
      current: stats.nrr, previous: previousStats?.nrr, rate: true, icon: TrendingUp,
      sparkline: selectedDays.map((day) => day.nrr),
    },
    {
      id: 'churn', title: 'Customer churn rate', value: `${stats.churn.toFixed(1)}%`,
      current: stats.churn, previous: previousStats?.churn, rate: true, lowerIsBetter: true, icon: Activity,
      sparkline: selectedDays.map((day) => day.churn),
    },
  ];

  return (
    <div className="app-shell">
      {mobileOpen && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`} aria-label="Main navigation">
        <div className="sidebar-brand">
          <button className="brand-home" onClick={() => navigateTo('overview')} type="button" aria-label="SaaS Metrics overview">
            <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>
            <div className="brand-copy"><strong>SaaS Metrics</strong><small>ANALYTICS WORKSPACE</small></div>
          </button>
          <button className="sidebar-close" aria-label="Close navigation" onClick={() => setMobileOpen(false)} type="button"><X size={19} /></button>
        </div>

        <div className="sidebar-section-label">WORKSPACE</div>
        <nav className="sidebar-nav">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${activeNav === id ? 'active' : ''}`} onClick={() => navigateTo(id)} type="button">
              <Icon size={19} strokeWidth={activeNav === id ? 2.1 : 1.8} />
              <span>{label}</span>
              {activeNav === id && <span className="nav-active-indicator" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />
        <div className="sidebar-bottom">
          <div className="workspace-caption"><span className="workspace-dot" /> YOUR WORKSPACE</div>
          <div className="sidebar-profile">
            <div className="profile-avatar">AM</div>
            <div className="profile-details"><strong>Alex Morgan</strong><span>Workspace admin</span></div>
          </div>
        </div>
      </aside>

      <div className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMobileOpen(true)} type="button"><Menu size={21} /></button>
            <div className="breadcrumb"><span>Workspace</span><ChevronRight size={15} /><strong>{navItems.find((item) => item.id === activeNav)?.label}</strong></div>
          </div>
          <div className="topbar-right">
            <span className="today-label">{TODAY.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</span>
            <span className="topbar-separator" />
            <button className="icon-button theme-button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'} title={theme === 'light' ? 'Dark mode' : 'Light mode'} type="button">
              {theme === 'light' ? <Moon size={19} strokeWidth={1.9} /> : <Sun size={19} strokeWidth={1.9} />}
            </button>
            <div className="topbar-avatar" aria-label="Alex Morgan">AM</div>
          </div>
        </header>

        <main className="dashboard-content" id="overview">
          <div className="page-heading">
            <div>
              <h1>Overview</h1>
              <p>A clear view of the numbers driving your growth.</p>
            </div>
            <button className="export-button" onClick={exportReport} type="button" title="Download the current report as CSV">
              <Download size={16} strokeWidth={2} /> Export report
            </button>
          </div>

          <div className="filter-row">
            <div className="filters" ref={filterRef}>
              <span className="filter-label">Showing data for</span>
              <div className="filter-wrapper">
                <button
                  className={`filter-trigger ${openFilter === 'date' ? 'filter-open' : ''}`}
                  onClick={() => {
                    setDraftStart(inputDate(range.start));
                    setDraftEnd(inputDate(range.end));
                    setOpenFilter(openFilter === 'date' ? null : 'date');
                  }}
                  aria-expanded={openFilter === 'date'}
                  aria-haspopup="true"
                  type="button"
                >
                  <CalendarDays size={16} /><span>{getRangeLabel(range)}</span><ChevronDown size={15} className="trigger-chevron" />
                </button>
                {openFilter === 'date' && (
                  <div className="filter-popover date-popover">
                    <div className="popover-title">Select date range</div>
                    {presetOptions.map((option) => (
                      <button key={option.value} className={`popover-option ${range.preset === option.value ? 'chosen' : ''}`} onClick={() => selectPreset(option)} type="button">
                        {option.label}{range.preset === option.value && <Check size={15} />}
                      </button>
                    ))}
                    <div className="popover-divider" />
                    <div className="custom-range-label">Custom range</div>
                    <div className="custom-date-fields">
                      <label>From<input type="date" value={draftStart} min={inputDate(DAILY_DATA[0].date)} max={inputDate(TODAY)} onChange={(event) => setDraftStart(event.target.value)} /></label>
                      <label>To<input type="date" value={draftEnd} min={inputDate(DAILY_DATA[0].date)} max={inputDate(TODAY)} onChange={(event) => setDraftEnd(event.target.value)} /></label>
                    </div>
                    <button className="apply-range" onClick={applyCustomRange} disabled={customInvalid} type="button">Apply range</button>
                  </div>
                )}
              </div>
              <div className="filter-wrapper">
                <button className={`filter-trigger segment-trigger ${openFilter === 'segment' ? 'filter-open' : ''}`} onClick={() => setOpenFilter(openFilter === 'segment' ? null : 'segment')} aria-expanded={openFilter === 'segment'} aria-haspopup="true" type="button">
                  <SlidersHorizontal size={16} /><span>{segment}</span><ChevronDown size={15} className="trigger-chevron" />
                </button>
                {openFilter === 'segment' && (
                  <div className="filter-popover segment-popover">
                    <div className="popover-title">Customer segment</div>
                    {(['All segments', ...SEGMENTS] as SegmentFilter[]).map((option) => (
                      <button key={option} className={`popover-option ${segment === option ? 'chosen' : ''}`} onClick={() => { setSegment(option); setOpenFilter(null); }} type="button">
                        {option}{segment === option && <Check size={15} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <span className="comparison-note"><span className="comparison-dot" /> {hasComparison ? 'Compared to previous period' : 'No earlier comparison available'}</span>
          </div>

          <section className="kpi-grid" aria-label="Key performance indicators">
            {kpis.map((kpi, index) => <KpiCard key={kpi.id} {...kpi} index={index} />)}
          </section>

          <section className="chart-grid" id="revenue" aria-label="Revenue analytics">
            <article className="panel revenue-panel">
              <div className="panel-heading">
                <div><h2>Revenue performance</h2><p>Monthly recurring revenue over time</p></div>
                <div className="chart-legend revenue-legend"><span><i className="legend-dot current" />Current</span>{hasComparison && <span><i className="legend-line" />Previous</span>}</div>
              </div>
              <div className="revenue-chart" aria-label="Line chart showing recurring revenue over time">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 14, right: 5, left: -8, bottom: 2 }}>
                    <defs>
                      <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.005} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="4 5" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--axis-text)', fontSize: 11 }} tickMargin={13} minTickGap={18} interval="preserveStartEnd" />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--axis-text)', fontSize: 11 }} tickFormatter={(value: number) => compactCurrency(value)} width={54} domain={['auto', 'auto']} tickCount={5} />
                    <Tooltip content={<RevenueTooltip />} cursor={{ stroke: 'var(--accent)', strokeWidth: 1, strokeDasharray: '4 4', opacity: 0.4 }} wrapperStyle={{ outline: 'none', zIndex: 5 }} />
                    {hasComparison && <Area type="monotone" dataKey="previous" stroke="var(--previous-line)" strokeWidth={2} strokeDasharray="5 5" fill="none" dot={false} activeDot={false} isAnimationActive animationDuration={700} animationEasing="ease-out" />}
                    <Area type="monotone" dataKey="revenue" stroke="var(--accent)" strokeWidth={2.7} fill="url(#revenueFill)" dot={chartData.length === 1} activeDot={{ r: 6, stroke: 'var(--surface)', strokeWidth: 3, fill: 'var(--accent)' }} isAnimationActive animationDuration={750} animationEasing="ease-out" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="panel mix-panel">
              <div className="panel-heading">
                <div><h2>Revenue by billing</h2><p>How your revenue is collected</p></div>
              </div>
              <div className="donut-wrap">
                <div className="donut-chart" aria-label="Donut chart showing revenue by billing type">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={mixData} cx="50%" cy="50%" innerRadius={70} outerRadius={93} paddingAngle={3} cornerRadius={4} dataKey="value" stroke="none" isAnimationActive animationDuration={750} animationEasing="ease-out">
                        {mixData.map((slice) => <Cell key={slice.name} fill={slice.color} />)}
                      </Pie>
                      <Tooltip content={<MixTooltip />} wrapperStyle={{ outline: 'none', zIndex: 6 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="donut-center"><strong>{compactCurrency(stats.revenue, 1)}</strong><span>TOTAL REVENUE</span></div>
                </div>
              </div>
              <div className="mix-legend">
                {mixData.map((slice) => (
                  <div className="mix-legend-row" key={slice.name}>
                    <span className="mix-name"><i style={{ background: slice.color }} />{slice.name}</span>
                    <span className="mix-amount">{compactCurrency(slice.value, 1)} <small>{slice.share.toFixed(0)}%</small></span>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="panel activity-panel" id="subscriptions" aria-label="Subscription activity">
            <div className="panel-heading">
              <div><h2>Subscriber activity</h2><p>New subscriptions and cancellations across the period</p></div>
              <div className="chart-legend"><span><i className="legend-dot current" />New subscriptions</span><span><i className="legend-dot cancellations" />Cancellations</span></div>
            </div>
            <div className="activity-chart" aria-label="Bar chart comparing new subscriptions and cancellations">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barGap={5} barCategoryGap="38%" margin={{ top: 12, right: 5, left: -8, bottom: 2 }}>
                  <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="4 5" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--axis-text)', fontSize: 11 }} tickMargin={12} minTickGap={18} interval="preserveStartEnd" />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--axis-text)', fontSize: 11 }} width={54} allowDecimals={false} tickCount={5} />
                  <Tooltip content={<ActivityTooltip />} cursor={{ fill: 'var(--chart-hover)' }} wrapperStyle={{ outline: 'none', zIndex: 5 }} />
                  <Bar dataKey="newSubscriptions" fill="var(--accent)" maxBarSize={23} radius={[4, 4, 0, 0]} isAnimationActive animationDuration={700} animationEasing="ease-out" />
                  <Bar dataKey="cancellations" fill="var(--bar-muted)" maxBarSize={23} radius={[4, 4, 0, 0]} isAnimationActive animationDuration={800} animationEasing="ease-out" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="customers-section" id="customers" aria-label="Customer accounts">
            <div className="section-heading"><div><h2>Customer accounts</h2><p>A closer look at accounts added during this period.</p></div></div>
            <div className="table-panel">
              <div className="table-toolbar">
                <div className="table-count"><span className="count-icon"><UsersRound size={17} /></span><strong>{integer.format(filteredAccounts.length)} accounts</strong><span>in this view</span></div>
                <div className="table-actions">
                  <div className="search-field"><Search size={17} /><input type="search" placeholder="Search accounts..." aria-label="Search accounts" value={search} onChange={(event) => setSearch(event.target.value)} />{search && <button aria-label="Clear search" onClick={() => setSearch('')} type="button"><X size={15} /></button>}</div>
                  <div className="status-select-wrap"><Filter size={16} /><select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'All statuses' | AccountStatus)}><option>All statuses</option><option>Active</option><option>Trialing</option><option>At risk</option></select><ChevronDown size={15} /></div>
                </div>
              </div>
              <div className="table-scroll">
                <table>
                  <thead><tr>
                    <SortHeading label="Company" column="company" sort={sort} onSort={handleSort} />
                    <SortHeading label="Segment" column="segment" sort={sort} onSort={handleSort} />
                    <SortHeading label="Plan" column="plan" sort={sort} onSort={handleSort} />
                    <SortHeading label="MRR" column="mrr" sort={sort} onSort={handleSort} className="numeric-column" />
                    <SortHeading label="Status" column="status" sort={sort} onSort={handleSort} />
                    <SortHeading label="Joined" column="joinedAt" sort={sort} onSort={handleSort} />
                  </tr></thead>
                  <tbody>
                    {visibleAccounts.map((account: Account) => (
                      <tr key={account.id}>
                        <td><div className="company-cell"><span className="company-avatar" style={{ background: account.color }}>{account.company.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><span className="company-details"><strong>{account.company}</strong><small>{account.domain}</small></span></div></td>
                        <td className="regular-cell">{account.segment}</td>
                        <td className="regular-cell">{account.plan}</td>
                        <td className="mrr-cell">{currency.format(account.mrr)}</td>
                        <td><span className={`status-pill ${account.status.toLowerCase().replace(' ', '-')}`}><i />{account.status}</span></td>
                        <td className="date-cell">{longDate(account.joinedAt)}</td>
                      </tr>
                    ))}
                    {!visibleAccounts.length && <tr><td colSpan={6}><div className="empty-state"><Search size={25} /><strong>No accounts found</strong><span>Try a different search, status, segment, or date range.</span></div></td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="table-footer">
                <span>{filteredAccounts.length ? `Showing ${page * PAGE_SIZE + 1}-${Math.min((page + 1) * PAGE_SIZE, filteredAccounts.length)} of ${filteredAccounts.length} accounts` : 'Showing 0 accounts'}</span>
                <div className="pagination"><button onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={page === 0} aria-label="Previous page" type="button"><ChevronLeft size={17} /></button><span>Page {page + 1} of {totalPages}</span><button onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))} disabled={page >= totalPages - 1} aria-label="Next page" type="button"><ChevronRight size={17} /></button></div>
              </div>
            </div>
          </section>
          <footer className="page-footer"><span>SaaS Metrics</span><span>Sample data for demonstration</span></footer>
        </main>
      </div>
    </div>
  );
}
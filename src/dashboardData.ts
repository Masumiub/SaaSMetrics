export const SEGMENTS = ['Startup', 'Growth', 'Enterprise'] as const;

export type Segment = (typeof SEGMENTS)[number];
export type SegmentFilter = Segment | 'All segments';
export type AccountStatus = 'Active' | 'Trialing' | 'At risk';

export interface SegmentSnapshot {
  mrr: number;
  subscribers: number;
  nrr: number;
  churn: number;
  newSubscriptions: number;
  cancellations: number;
}

export interface DailyRecord {
  date: Date;
  segments: Record<Segment, SegmentSnapshot>;
}

export interface Account {
  id: number;
  company: string;
  domain: string;
  segment: Segment;
  plan: string;
  mrr: number;
  status: AccountStatus;
  joinedAt: Date;
  color: string;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function inputDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseInputDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export const TODAY = startOfDay(new Date());

const segmentSettings: Record<
  Segment,
  { mrr: number; subscribers: number; nrr: number; churn: number; newSubs: number; cancellations: number }
> = {
  Startup: { mrr: 22600, subscribers: 1510, nrr: 108.7, churn: 3.2, newSubs: 6.5, cancellations: 2.3 },
  Growth: { mrr: 42500, subscribers: 720, nrr: 114.2, churn: 2.1, newSubs: 3.8, cancellations: 1.2 },
  Enterprise: { mrr: 63800, subscribers: 168, nrr: 119.1, churn: 1.2, newSubs: 1.4, cancellations: 0.5 },
};

const DATA_DAYS = 820;

// Daily snapshots make every range and segment filter use the same underlying data.
export const DAILY_DATA: DailyRecord[] = Array.from({ length: DATA_DAYS }, (_, index) => {
  const progress = index / (DATA_DAYS - 1);
  const date = addDays(TODAY, index - (DATA_DAYS - 1));
  const segments = {} as Record<Segment, SegmentSnapshot>;

  SEGMENTS.forEach((segment, segmentIndex) => {
    const setting = segmentSettings[segment];
    const wave = 1 + 0.013 * Math.sin(index / 22 + segmentIndex) + 0.006 * Math.cos(index / 8 + segmentIndex * 1.7);
    const growth = 0.55 + 0.45 * Math.pow(progress, 1.12);
    const subscriberGrowth = 0.6 + 0.4 * progress;

    segments[segment] = {
      mrr: Math.round((setting.mrr * growth * wave) / 10) * 10,
      subscribers: Math.round(setting.subscribers * subscriberGrowth * (1 + 0.007 * Math.sin(index / 17 + segmentIndex))),
      nrr: setting.nrr - 3.3 * (1 - progress) + 0.55 * Math.sin(index / 32 + segmentIndex),
      churn: setting.churn + 0.58 * (1 - progress) + 0.11 * Math.sin(index / 25 + segmentIndex),
      newSubscriptions: Math.max(1, Math.round(setting.newSubs * (0.73 + progress * 0.27) + 1.2 * Math.sin(index / 9 + segmentIndex))),
      cancellations: Math.max(0, Math.round(setting.cancellations * (0.8 + progress * 0.2) + 0.6 * Math.cos(index / 13 + segmentIndex))),
    };
  });

  return { date, segments };
});

const prefixes = [
  'Northstar', 'Apex', 'Meridian', 'Horizon', 'Crestline', 'Relay', 'Arcwell', 'Keystone',
  'Brightside', 'Summit', 'Atlas', 'Pioneer', 'Evergreen', 'Orbit', 'Bluepeak', 'Lighthouse',
  'Vantage', 'Westward', 'Fieldstone', 'Clearpath', 'Mosaic', 'Oakline', 'Sonder', 'Alto',
  'Harbor', 'Noble', 'Tandem', 'Kinetic', 'Forma', 'Signal', 'Haven', 'Cobalt', 'Forward',
  'Springboard', 'Aster', 'Vertex', 'Lucent', 'Origin', 'Nexus', 'Ridgeway',
];
const suffixes = ['Labs', 'Group', 'Digital', 'Systems', 'Studio', 'Technologies'];
const segmentCycle: Segment[] = [
  'Growth', 'Enterprise', 'Startup', 'Growth', 'Enterprise',
  'Startup', 'Growth', 'Startup', 'Enterprise', 'Growth',
];
const avatarColors = ['#E9E7FC', '#E0F2EF', '#FBECDD', '#E3ECFA', '#F5E5EE', '#E6F0E3'];

export const ACCOUNTS: Account[] = Array.from({ length: 155 }, (_, index) => {
  const segment = segmentCycle[index % segmentCycle.length];
  const company = `${prefixes[index % prefixes.length]} ${suffixes[(index + Math.floor(index / prefixes.length)) % suffixes.length]}`;
  const mrr = segment === 'Startup'
    ? 89 + ((index * 37) % 12) * 24
    : segment === 'Growth'
      ? 490 + ((index * 67) % 18) * 75
      : 2850 + ((index * 127) % 16) * 280;

  return {
    id: 1001 + index,
    company,
    domain: `${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
    segment,
    plan: segment === 'Startup' ? 'Starter' : segment === 'Growth' ? 'Growth' : 'Enterprise',
    mrr,
    status: index % 13 === 5 ? 'At risk' : index % 9 === 2 ? 'Trialing' : 'Active',
    joinedAt: addDays(TODAY, -(2 + index * 5)),
    color: avatarColors[index % avatarColors.length],
  };
});
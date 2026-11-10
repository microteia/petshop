import type { Contribution, ReportModuleTemplate, ReportSpec, WidgetSpec } from '@microteia/sdk';
import { deriveReportRequires, REPORT_SPEC_VERSION, surfaceWidgetSpec } from '@microteia/sdk';
import { APPOINTMENT, VACCINATION_CURRENT } from './catalog';
import { APPOINTMENT_ITEMS, APPOINTMENTS, label, PETS, VACCINATIONS } from './collections';

/**
 * Reports and the dashboard — questions asked of the data, with no code.
 *
 * A report declares WHAT it covers (the dataset), HOW it folds (the shape) and how it LOOKS (the
 * presentation). Four of them are also cards on the office Dashboard, below: Widget DSL nodes that name
 * the report by key — nothing in them runs, so nothing in them needs anybody's review.
 *
 * Date buckets are cut in UTC on purpose: a date field is stored as its day at noon UTC, so UTC gives the
 * right day in every time zone.
 */

const DONE = { path: 'status', op: 'eq' as const, value: { kind: 'Literal' as const, value: APPOINTMENT.done } };

const REVENUE_BY_MONTH: ReportSpec = {
  v: REPORT_SPEC_VERSION,
  dataset: {
    table: APPOINTMENTS,
    where: [DONE],
    dimensions: [{ key: 'month', path: 'scheduledOn', label: label('report.month'), granularity: 'month', timeZone: 'UTC' }],
    measures: [
      { key: 'revenue', op: 'sum', path: 'total', label: label('report.revenue'), format: { kind: 'currency' } },
      { key: 'visits', op: 'count', label: label('report.visits') },
      { key: 'average', kind: 'computed', expression: 'revenue / visits', label: label('report.average-ticket'), format: { kind: 'currency' } },
    ],
  },
  shape: { kind: 'summary', groupBy: [{ dimension: 'month' }], values: ['revenue', 'visits', 'average'], grandTotal: true },
  presentation: { chart: { kind: 'column', category: 'month', series: ['revenue'] }, export: { csv: true } },
};

const SERVICES_RANKING: ReportSpec = {
  v: REPORT_SPEC_VERSION,
  dataset: {
    table: APPOINTMENT_ITEMS,
    // The appointment's status lives on the appointment, read through the reference.
    includeWhen: `appointment.status == "${APPOINTMENT.done}"`,
    dimensions: [{ key: 'service', path: 'service.name', label: label('report.service'), sort: { dir: 'asc' } }],
    measures: [
      { key: 'times', op: 'count', label: label('report.times') },
      { key: 'revenue', op: 'sum', path: 'price', label: label('report.revenue'), format: { kind: 'currency' } },
    ],
  },
  shape: { kind: 'summary', groupBy: [{ dimension: 'service' }], values: ['times', 'revenue'], grandTotal: true },
  presentation: { chart: { kind: 'bar', category: 'service', series: ['times'] }, export: { csv: true } },
};

const APPOINTMENTS_BY_STATUS: ReportSpec = {
  v: REPORT_SPEC_VERSION,
  dataset: {
    table: APPOINTMENTS,
    dimensions: [
      { key: 'status', path: 'status', label: label('report.status') },
      { key: 'month', path: 'scheduledOn', label: label('report.month'), granularity: 'month', timeZone: 'UTC' },
    ],
    measures: [{ key: 'count', op: 'count', label: label('report.appointments') }],
  },
  shape: { kind: 'matrix', rows: [{ dimension: 'status' }], columns: [{ dimension: 'month' }], values: ['count'], grandTotal: true, emptyCell: 'zero' },
  presentation: { prompts: [{ key: 'from', label: label('report.from'), path: 'scheduledOn', op: 'gte' }], export: { csv: true } },
};

/** The doses due in the next 30 days that nobody has renewed yet: the list of calls to make. */
export const DUE_SOON = `not isEmpty(nextDoseOn) and dateDiff(nextDoseOn, today(), "days") >= 0 and dateDiff(nextDoseOn, today(), "days") <= 30`;

const VACCINES_DUE: ReportSpec = {
  v: REPORT_SPEC_VERSION,
  dataset: {
    table: VACCINATIONS,
    where: [{ path: 'status', op: 'eq', value: { kind: 'Literal', value: VACCINATION_CURRENT } }],
    includeWhen: DUE_SOON,
    dimensions: [
      { key: 'nextDose', path: 'nextDoseOn', label: label('report.next-dose') },
      { key: 'pet', path: 'pet.name', label: label('report.pet') },
      { key: 'owner', path: 'pet.customer.name', label: label('report.owner') },
      { key: 'phone', path: 'pet.customer.phone', label: label('report.phone') },
      { key: 'vaccine', path: 'vaccine.name', label: label('report.vaccine') },
    ],
    measures: [{ key: 'doses', op: 'count', label: label('report.doses') }],
  },
  shape: { kind: 'tabular', columns: ['nextDose', 'pet', 'owner', 'phone', 'vaccine'], orderBy: [{ path: 'nextDoseOn', dir: 'asc' }] },
  presentation: { export: { csv: true } },
};

const PETS_BY_SPECIES: ReportSpec = {
  v: REPORT_SPEC_VERSION,
  dataset: {
    table: PETS,
    dimensions: [{ key: 'species', path: 'species', label: label('report.species') }],
    measures: [{ key: 'pets', op: 'count', label: label('report.pets') }],
  },
  shape: { kind: 'summary', groupBy: [{ dimension: 'species' }], values: ['pets'], grandTotal: true },
  presentation: { chart: { kind: 'donut', category: 'species', series: ['pets'] } },
};

/** The report's key is not rewritten on install, so it carries the extension's prefix. */
const report = (templateId: string, icon: string, spec: ReportSpec): ReportModuleTemplate => ({
  templateId: `pet-${templateId}`,
  key: `pet-${templateId}`,
  title: label(`report.${templateId}`),
  description: label(`report.${templateId}.description`),
  icon,
  origin: 'plugin',
  sourceId: `pet-${templateId}`,
  managed: true,
  enabled: true,
  spec: { ...spec, requires: deriveReportRequires(spec) },
});

export const REPORTS: ReportModuleTemplate[] = [
  report('revenue-by-month', 'barChart', REVENUE_BY_MONTH),
  report('services-ranking', 'barChartBox', SERVICES_RANKING),
  report('appointments-by-status', 'calendarSchedule', APPOINTMENTS_BY_STATUS),
  report('vaccines-due', 'calendarCheck', VACCINES_DUE),
  report('pets-by-species', 'pieChart', PETS_BY_SPECIES),
];

// ─── Cards on the Dashboard (com.microteia.dashboard) ──────────────────────

/**
 * The Dashboard extension is a PLACE: a surface named `dashboard` that draws the cards every installed
 * extension offers there. Pet Shop offers four, each a `report` node — data shown with no code, so no trust
 * gesture. The surface is a name, not a dependency: without the Dashboard installed the cards have nowhere
 * to appear, and nothing breaks.
 *
 * `defaultSpan` and `order` are only where a card starts. The office turns cards on and off, orders and
 * sizes them in Settings › Dashboard, and each person can assemble their own.
 */
export const DASHBOARD_SURFACE = 'dashboard';

interface DashboardCard {
  key: string;
  report: string;
  icon: string;
  defaultSpan: 1 | 2 | 3;
  order: number;
}

export const DASHBOARD_CARDS: DashboardCard[] = [
  { key: 'pet-revenue', report: 'pet-revenue-by-month', icon: 'barChart', defaultSpan: 2, order: 10 },
  { key: 'pet-vaccines-due', report: 'pet-vaccines-due', icon: 'calendarCheck', defaultSpan: 1, order: 20 },
  { key: 'pet-services', report: 'pet-services-ranking', icon: 'barChartBox', defaultSpan: 2, order: 30 },
  { key: 'pet-species', report: 'pet-pets-by-species', icon: 'pieChart', defaultSpan: 1, order: 40 },
];

export const REPORT_CONTRIBUTIONS: Contribution[] = DASHBOARD_CARDS.map((card) =>
  surfaceWidgetSpec(
    {
      surface: DASHBOARD_SURFACE,
      key: card.key,
      title: label(`report.${card.report.replace(/^pet-/, '')}`),
      description: label(`report.${card.report.replace(/^pet-/, '')}.description`),
      icon: card.icon,
      defaultSpan: card.defaultSpan,
      order: card.order,
    },
    { type: 'report', report: card.report } satisfies WidgetSpec,
  ),
);

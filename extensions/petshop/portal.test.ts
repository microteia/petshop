import { describe, expect, it } from 'vitest';
import { packagesSchemaContext, undeclaredReportPaths, validateReportSpec } from '@microteia/sdk';
import { evaluateFieldExpression } from '../node_modules/@microteia/sdk/lib/domain/schema/fieldExpression.js';
import { APPOINTMENT } from './catalog';
import { APPOINTMENT_ITEMS, APPOINTMENTS, CUSTOMERS, PETS, VACCINATIONS } from './collections';
import { DOCUMENT_CONTRIBUTIONS, RECEIPT, VACCINATION_CARD } from './documents';
import { petshopPlugin } from './plugin';
import { INVITE_ACTION, INVITE_ACTION_ID, PORTAL, UPCOMING } from './portal';
import { DASHBOARD_CARDS, DASHBOARD_SURFACE, DUE_SOON, REPORTS } from './reports';

const screens = petshopPlugin.screens ?? [];
const screen = (key: string) => screens.find((one) => one.key === key)!;
const at = new Date('2026-11-10T18:00:00Z');
const timeZone = 'America/Sao_Paulo';
const day = (text: string) => new Date(`${text}T12:00:00Z`);

describe('the customer portal', () => {
  it('the customer receives guests; everything else reaches them through the customer', () => {
    expect(screen(CUSTOMERS).portal).toMatchObject({ subject: 'self', invites: { automation: true } });
    for (const key of Object.keys(PORTAL).filter((one) => one !== CUSTOMERS)) {
      expect(screen(key).portal?.subject, key).toBe('parent');
      expect(screen(key).parentEntity, key).toBeTruthy();
    }
  });

  it('only stored fields of the screen leave the shop — never a derived one, never a note', () => {
    for (const [key, declaration] of Object.entries(PORTAL)) {
      const fields = new Map(screen(key).fields.map((one) => [one.key, one]));
      for (const name of declaration.fields) {
        expect(fields.has(name), `${key}.${name}`).toBe(true);
        expect(fields.get(name)?.logic?.derive, `${key}.${name} is derived`).toBeUndefined();
      }
      expect(declaration.fields).not.toContain('cancelReason');
    }
    expect(PORTAL[PETS].fields).not.toContain('notes');
  });

  it('a name read through a reference to an internal screen is declared, never copied', () => {
    expect(PORTAL[PETS].referenceTitles).toEqual(['breed']);
    expect(PORTAL[VACCINATIONS].referenceTitles).toEqual(['vaccine']);
    expect(PORTAL[APPOINTMENT_ITEMS].referenceTitles).toEqual(['service']);
  });

  it('the owner requests an appointment with a day, a time and what they would like, and confirms one', () => {
    expect(PORTAL[APPOINTMENTS].create?.fields).toEqual(['scheduledOn', 'time', 'notes']);
    expect(PORTAL[APPOINTMENTS].actions).toEqual(['confirm']);
    expect(screen(APPOINTMENTS).viewActionIds).toContain('pet-appointment-confirm-action');
  });

  it('the staff invite a customer from their record, once there is an e-mail', () => {
    expect(screen(CUSTOMERS).viewActionIds).toContain(INVITE_ACTION_ID);
    expect(INVITE_ACTION.disabledWhen).toBe('isEmpty(email)');
    const flow = petshopPlugin.workflows.find((one) => one.templateId === INVITE_ACTION.workflowId)!;
    expect(flow.steps[0]).toMatchObject({ stepDefinitionId: 'portal-invite', configuration: { subjectCollection: { value: CUSTOMERS } } });
  });

  it('the home shows the appointments still to come', () => {
    const upcoming = (status: string) => evaluateFieldExpression(UPCOMING, { value: null, data: { status } });
    expect(upcoming(APPOINTMENT.scheduled)).toBe(true);
    expect(upcoming(APPOINTMENT.requested)).toBe(true);
    expect(upcoming(APPOINTMENT.done)).toBe(false);
  });
});

describe('reports and the dashboard', () => {
  const context = packagesSchemaContext([petshopPlugin]);

  it.each(REPORTS)('$key is valid and reads only declared fields', (report) => {
    expect(report.key).toMatch(/^pet-/);
    expect(validateReportSpec(report.spec, { schema: context }).filter((issue) => issue.severity === 'error')).toEqual([]);
    expect(undeclaredReportPaths(report.spec, context)).toEqual([]);
  });

  it('offers cards on the Dashboard extension instead of a dashboard of its own', () => {
    const contributes = petshopPlugin.manifest.contributes ?? [];
    const keys = REPORTS.map((one) => one.key);
    const cards = contributes.filter((one) => one.point === 'ui.widget');
    expect(cards).toHaveLength(DASHBOARD_CARDS.length);
    for (const card of cards) {
      expect(card.metadata).toMatchObject({ surface: DASHBOARD_SURFACE, title: expect.stringMatching(/^@/) });
      const spec = (card.impl as unknown as { spec: { type: string; report: string } }).spec;
      expect(spec.type).toBe('report');
      expect(keys).toContain(spec.report);
    }
    // No page or menu entry competing with the Dashboard's own.
    expect(contributes.some((one) => one.point === 'ui.page')).toBe(false);
    expect(contributes.some((one) => one.point === 'ui.nav' && /dashboard/.test(JSON.stringify(one.metadata)))).toBe(false);
  });

  it('"due in 30 days" is the window from today to 30 days ahead', () => {
    const due = (nextDoseOn: string) => evaluateFieldExpression(DUE_SOON, { value: null, data: { nextDoseOn: day(nextDoseOn) }, at, timeZone });
    expect(due('2026-11-10')).toBe(true);
    expect(due('2026-12-10')).toBe(true);
    expect(due('2026-12-11')).toBe(false);
    expect(due('2026-11-09')).toBe(false);
  });
});

describe('documents', () => {
  const template = (key: string) => DOCUMENT_CONTRIBUTIONS.find((one) => (one.metadata as { key: string }).key === key)!.metadata as {
    collection: string;
    datasets: { name: string; from: string; via: string }[];
  };

  /** The first segment of every path in the text — what the template reads from the record or a loop item. */
  const roots = (body: string) =>
    [...body.matchAll(/\{\{(?:#if |#each )?([a-zA-Z][a-zA-Z0-9]*)/g)].map((match) => match[1]).filter((name) => !['formatDate', 'formatMoney', 'today'].includes(name));

  it('the vaccination card reads fields of the pet and of its doses', () => {
    const card = template('pet-vaccination-card');
    expect(card).toMatchObject({ collection: PETS, datasets: [{ name: 'doses', from: VACCINATIONS, via: 'pet' }] });
    const known = new Set([...screen(PETS).fields, ...screen(VACCINATIONS).fields].map((one) => one.key).concat('doses'));
    for (const name of roots(VACCINATION_CARD)) expect(known.has(name), name).toBe(true);
  });

  it('the receipt reads fields of the appointment and of its lines', () => {
    const receipt = template('pet-appointment-receipt');
    expect(receipt).toMatchObject({ collection: APPOINTMENTS, datasets: [{ name: 'lines', from: APPOINTMENT_ITEMS, via: 'appointment' }] });
    const known = new Set([...screen(APPOINTMENTS).fields, ...screen(APPOINTMENT_ITEMS).fields].map((one) => one.key).concat('lines'));
    for (const name of roots(RECEIPT)) expect(known.has(name), name).toBe(true);
  });
});

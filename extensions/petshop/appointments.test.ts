import { describe, expect, it } from 'vitest';
// The platform's own engines — test-only imports, see plugin.test.ts.
import {
  evaluateFieldExpression,
  evaluateFieldValidation,
} from '../node_modules/@microteia/sdk/lib/domain/schema/fieldExpression.js';
import type { WorkflowStep } from '@microteia/sdk';
import {
  APPOINTMENT,
  APPOINTMENT_STATUSES,
  PACKAGE_ACTIVE,
  PACKAGE_EXPIRED,
  PACKAGE_USED_UP,
  SERVICE_CATEGORIES,
  SERVICE_SEEDS,
} from './catalog';
import { APPOINTMENT_ITEMS, APPOINTMENTS, PACKAGES, PETS, SERVICES, WEIGHTS } from './collections';
import { MESSAGES, NAMESPACE } from './messages';
import { petshopPlugin, WEIGHT_RULE, WEIGHT_SUMMARY } from './plugin';
import {
  APPOINTMENT_ACTIONS,
  APPOINTMENT_BUTTON_FLOWS,
  APPOINTMENTS_NAV,
  CANCEL_PERMISSION,
  CANCEL_REASON_RULE,
  CREDITS_LEFT,
  ITEM_PRICE,
  ITEM_REQUIRES_VACCINES,
  ITEM_SNAPSHOT_IS_WRONG,
  OPEN_APPOINTMENT_STATUSES,
  PACKAGE_STATUS_FOR_TODAY,
  RECEIPT_TEMPLATE,
  SERVICE_SEED_RECORDS,
  VACCINES_BLOCK_CHECK_IN,
  VACCINES_REFUSE_CHECK_IN,
} from './appointments';

const screen = (key: string) => (petshopPlugin.screens ?? []).find((one) => one.key === key)!;
const field = (screenKey: string, key: string) => screen(screenKey).fields.find((one) => one.key === key)!;
const workflow = (templateId: string) => petshopPlugin.workflows.find((one) => one.templateId === templateId)!;
const flatten = (list: WorkflowStep[]): WorkflowStep[] =>
  list.flatMap((step) => [step, ...flatten(step.branches?.whenTrue ?? []), ...flatten(step.branches?.whenFalse ?? []), ...flatten(step.loop?.body ?? [])]);

// 10 Nov 2026, 15:00 in São Paulo. A date field reaches an expression as that day at noon UTC.
const at = new Date('2026-11-10T18:00:00Z');
const timeZone = 'America/Sao_Paulo';
const day = (text: string) => new Date(`${text}T12:00:00Z`);
const evaluate = (expression: string, data: Record<string, unknown>) => evaluateFieldExpression(expression, { value: null, data, at, timeZone });

describe('services, appointments and packages', () => {
  describe('the price of each line is the price charged that day', () => {
    const service = { id: 's1', price: 60, requiresVaccines: true };
    const line = (event: Record<string, unknown>) => ({ event: { changeType: 'created', service, ...event } });

    it("a new line without a price takes the service's price", () => {
      expect(evaluate(ITEM_PRICE, line({ price: null }))).toBe(60);
    });

    it('a price someone typed is kept: that is a discount', () => {
      expect(evaluate(ITEM_PRICE, line({ price: 45 }))).toBe(45);
    });

    it('a line paid with a package costs nothing', () => {
      expect(evaluate(ITEM_PRICE, line({ price: 60, package: 'k1' }))).toBe(0);
    });

    it('changing the service on an existing line takes the new price', () => {
      const other = { id: 's2', price: 110, requiresVaccines: true };
      expect(evaluate(ITEM_PRICE, { event: { changeType: 'updated', service: other, price: 60, old: { service: 's1' } } })).toBe(110);
    });

    it('the second pass, fired by its own write, finds nothing left to do', () => {
      // On the second pass the service is unchanged: `old.service` is the stored id, as is `service`.
      const second = { event: { changeType: 'updated', service: 's1', price: 60, requiresVaccines: true, old: { service: 's1' } } };
      expect(evaluate(ITEM_PRICE, second)).toBe(60);
      const wrong = evaluate(ITEM_SNAPSHOT_IS_WRONG, { event: { ...line({ price: 60, requiresVaccines: true }).event } });
      expect(wrong).toBe(false);
    });

    it("copies whether the service requires vaccines, so the appointment can count them", () => {
      expect(evaluate(ITEM_REQUIRES_VACCINES, line({}))).toBe(true);
      expect(evaluate(ITEM_REQUIRES_VACCINES, { event: { service: { requiresVaccines: false } } })).toBe(false);
    });

    it('the price is a declared snapshot in the model, never a silent copy', async () => {
      const model = (await import('./domain-model.json')).default;
      const item = model.entities.find((one) => one.name === 'AppointmentItem')!;
      const price = item.fields.find((one) => one.key === 'price') as { semanticType: string; source?: string; reason?: string };
      expect(price).toMatchObject({ semanticType: 'snapshot', source: 'Service.price' });
      expect(price.reason?.length).toBeGreaterThan(20);
    });
  });

  describe('the appointment', () => {
    it('is named by its number, and its card shows the pet by name through the reference', () => {
      expect(screen(APPOINTMENTS).titleFieldKey).toBe('number');
      expect(field(APPOINTMENTS, 'number').type).toBe('text');
      const nodes = JSON.stringify(screen(APPOINTMENTS).cardTemplate);
      expect(nodes).toContain('"type":"title"');
      expect(nodes).toContain('"field":"pet"');
    });

    it('is numbered per year by the kernel, and its total is the sum of its lines', () => {
      expect(field(APPOINTMENTS, 'number').autoValue).toEqual({ pattern: 'YYYY/00000', sequence: { resetBy: 'year' } });
      expect(field(APPOINTMENTS, 'total').aggregation).toEqual({ from: APPOINTMENT_ITEMS, via: 'appointment', op: 'sum', field: 'price' });
    });

    it('is a tab of the pet with a menu entry of its own; its lines are a tab of the appointment', () => {
      expect(screen(APPOINTMENTS)).toMatchObject({ parentEntity: PETS, parentFieldKey: 'pet', parentRelation: 'related', hideFromSidebar: true });
      expect(screen(APPOINTMENT_ITEMS)).toMatchObject({ parentEntity: APPOINTMENTS, parentFieldKey: 'appointment', parentRelation: 'owned' });
      expect(petshopPlugin.manifest.contributes).toContain(APPOINTMENTS_NAV);
    });

    it('the menu badge and the list it opens cut the same slice: the open appointments', () => {
      const metadata = APPOINTMENTS_NAV.metadata as { badge: { when: string }; filter: { key: string; values: string[] }[] };
      expect(metadata.filter).toEqual([{ key: 'status', values: OPEN_APPOINTMENT_STATUSES }]);
      for (const status of Object.values(APPOINTMENT)) {
        expect(evaluate(metadata.badge.when, { status }), status).toBe(OPEN_APPOINTMENT_STATUSES.includes(status as never));
      }
    });

    it('the status is never edited by hand', () => {
      expect(field(APPOINTMENTS, 'status').logic?.disabledWhen).toBe('true');
      expect(field(APPOINTMENTS, 'status').defaultValue).toBe(APPOINTMENT.scheduled);
    });

    it('a cancelled appointment always says why', () => {
      const refusal = (status: string, value: string | null) =>
        evaluateFieldValidation(CANCEL_REASON_RULE, { value, data: { status, cancelReason: value }, at, timeZone });
      expect(refusal(APPOINTMENT.cancelled, null)).toBeTruthy();
      expect(refusal(APPOINTMENT.cancelled, 'The owner is travelling')).toBeFalsy();
      expect(refusal(APPOINTMENT.scheduled, null)).toBeFalsy();
    });
  });

  describe('the buttons', () => {
    it('every action fires a flow of this package, and every flow answers the button on its last step', () => {
      for (const action of APPOINTMENT_ACTIONS) {
        const flow = workflow(action.workflowId!);
        expect(flow, action.key).toBeDefined();
        expect(flow.eventName).toBe('workflow.called');
        expect(flow.parameters?.[0]).toMatchObject({ key: 'recordId', type: 'EntityReference', entityType: APPOINTMENTS });
        const last = flow.steps.at(-1)!;
        expect(last.stepDefinitionId, action.key).toBe('map');
        expect((last.configuration.map as { value: { name?: string } }).value.name, action.key).toBeUndefined();
        expect(screen(APPOINTMENTS).viewActionIds).toContain(action.templateId);
      }
    });

    it('each flow runs only from the states its button allows', () => {
      const from = (key: string) =>
        APPOINTMENT_STATUSES.map((term) => term.key).filter(
          (status) => evaluate(workflow(`pet-appointment-${key}`).condition.kind === 'Expression' ? (workflow(`pet-appointment-${key}`).condition as { expression: string }).expression : 'false', { event: { recordId: { status } } }) === true,
        );
      expect(from('approve')).toEqual([APPOINTMENT.requested]);
      expect(from('confirm')).toEqual([APPOINTMENT.scheduled]);
      expect(from('check-in')).toEqual([APPOINTMENT.scheduled]);
      expect(from('ready')).toEqual([APPOINTMENT.inService]);
      expect(from('finish')).toEqual([APPOINTMENT.ready]);
      expect(from('cancel')).toEqual([APPOINTMENT.requested, APPOINTMENT.scheduled]);
    });

    it('the button is greyed out exactly where its flow would not run', () => {
      for (const action of APPOINTMENT_ACTIONS) {
        const flow = workflow(action.workflowId!);
        for (const term of APPOINTMENT_STATUSES) {
          const runs = evaluate((flow.condition as { expression: string }).expression, { event: { recordId: { status: term.key } } });
          const disabled = evaluate(action.disabledWhen!, { status: term.key, confirmedByOwner: false, vaccineChecks: 0, pet: { overdueVaccines: 0 } });
          expect(disabled, `${action.key} on ${term.key}`).toBe(!runs);
        }
      }
    });

    it('check-in is refused while a booked service requires vaccines and the pet has an overdue one', () => {
      const blocked = (vaccineChecks: number | null, overdueVaccines: number | null) => evaluate(VACCINES_BLOCK_CHECK_IN, { vaccineChecks, pet: { overdueVaccines } });
      expect(blocked(1, 1)).toBe(true);
      expect(blocked(1, 0)).toBe(false);
      expect(blocked(0, 2)).toBe(false);
      expect(blocked(null, null)).toBe(false);
      const refused = (vaccineChecks: number, overdueVaccines: number) => evaluate(VACCINES_REFUSE_CHECK_IN, { event: { recordId: { vaccineChecks, pet: { overdueVaccines } } } });
      expect(refused(2, 1)).toBe(true);
      expect(refused(0, 1)).toBe(false);
      const steps = flatten(workflow('pet-appointment-check-in').steps);
      const refusal = steps.find((step) => step.id === 'refuseCheckIn')!;
      expect((refusal.configuration.map as { value: { fields: { value: { value: unknown } }[] } }).value.fields[0].value.value).toEqual(['ERROR', `@${NAMESPACE}/error.check-in-vaccines`]);
      expect(steps.find((step) => step.id === 'refuseCheckInExit')?.stepDefinitionId).toBe('exit');
    });

    it('only whoever holds the cancel permission sees Cancel, and the flow asks for the reason', () => {
      const cancel = APPOINTMENT_ACTIONS.find((action) => action.key === 'cancel')!;
      expect(cancel).toMatchObject({ hiddenWhen: `not hasPermission("${CANCEL_PERMISSION}")`, promptParameters: true, danger: true });
      expect(workflow('pet-appointment-cancel').parameters?.find((one) => one.key === 'reason')).toMatchObject({ required: true });
      const permission = petshopPlugin.manifest.contributes?.find((one) => (one.metadata as { id?: string }).id === CANCEL_PERMISSION);
      expect(permission?.metadata).toMatchObject({ requires: [`${APPOINTMENTS}.update`] });
    });

    it('Finish attaches the receipt, shared with the owner in the portal', () => {
      const receipt = flatten(workflow('pet-appointment-finish').steps).find((step) => step.stepDefinitionId === 'render-document')!;
      expect(receipt.configuration).toMatchObject({
        templateKey: { value: RECEIPT_TEMPLATE },
        recordId: { kind: 'Event', path: 'recordId' },
        destination: { value: 'record' },
        portalShared: { value: true },
      });
      expect(screen(APPOINTMENTS).hasDocuments).toBe(true);
    });

    it('Ready for pickup e-mails the owner, from the e-mail of the customer', () => {
      const tell = flatten(workflow('pet-appointment-ready').steps).find((step) => step.stepDefinitionId === 'notify')!;
      expect(tell.configuration.recipientAddresses).toEqual({ kind: 'Event', path: 'recordId.pet.customer.email' });
      const remind = flatten(workflow('pet-appointment-reminder').steps).find((step) => step.stepDefinitionId === 'notify')!;
      expect(remind.configuration.recipientAddresses).toEqual({ kind: 'Event', path: 'pet.customer.email' });
      expect(workflow('pet-appointment-reminder').dateReached).toEqual({ field: 'scheduledOn', offset: '-1d', at: '18:00' });
    });

    it('no flow a button fires waits: a button waits for the answer', () => {
      for (const flow of APPOINTMENT_BUTTON_FLOWS) {
        expect(flatten(flow.steps).some((step) => step.stepDefinitionId === 'delay'), flow.templateId).toBe(false);
      }
    });
  });

  describe('the clock and the portal move appointments on', () => {
    it('the day after, a scheduled appointment nobody checked in is a no-show', () => {
      expect(workflow('pet-appointment-no-show')).toMatchObject({ eventName: `${APPOINTMENTS}.dateReached`, dateReached: { field: 'scheduledOn', offset: '+1d' } });
    });

    it('an appointment created by the owner in the portal becomes a request for the staff', () => {
      const expression = (workflow('pet-appointment-requested').condition as { expression: string }).expression;
      expect(evaluate(expression, { event: { changeType: 'created', createdVia: 'portal', status: APPOINTMENT.scheduled } })).toBe(true);
      expect(evaluate(expression, { event: { changeType: 'created', createdVia: 'ui', status: APPOINTMENT.scheduled } })).toBe(false);
      expect(evaluate(expression, { event: { changeType: 'created', createdVia: 'portal', status: APPOINTMENT.requested } })).toBe(false);
    });
  });

  describe('packages of credits', () => {
    const status = (creditsUsed: number | null, credits: number, expiresOn: string | null) =>
      evaluate(PACKAGE_STATUS_FOR_TODAY, { event: { creditsUsed, credits, expiresOn: expiresOn ? day(expiresOn) : null } });

    it('active while credits are left and its date has not passed', () => {
      expect(status(null, 4, null)).toBe(PACKAGE_ACTIVE);
      expect(status(3, 4, '2026-11-10')).toBe(PACKAGE_ACTIVE);
    });

    it('used up when no credit is left, expired from the day after its date', () => {
      expect(status(4, 4, '2027-01-01')).toBe(PACKAGE_USED_UP);
      expect(status(1, 4, '2026-11-09')).toBe(PACKAGE_EXPIRED);
    });

    it('counts the lines paid with it, and shows the credits left', () => {
      expect(field(PACKAGES, 'creditsUsed').aggregation).toEqual({ from: APPOINTMENT_ITEMS, via: 'package', op: 'count' });
      expect(evaluate(CREDITS_LEFT, { credits: 4, creditsUsed: 1 })).toBe(3);
      expect(evaluate(CREDITS_LEFT, { credits: 4, creditsUsed: null })).toBe(4);
    });

    it('a line offers only the active packages of its pet for its service', () => {
      expect(field(APPOINTMENT_ITEMS, 'package').optionsFilter?.where).toEqual([
        { path: 'pet', op: 'eq', value: { field: 'appointment.pet' } },
        { path: 'service', op: 'eq', value: { field: 'service' } },
        { path: 'status', op: 'eq', value: { literal: PACKAGE_ACTIVE } },
      ]);
    });
  });

  describe('the catalog of services', () => {
    it('starts with the common services, named in the language of the organization', () => {
      const categories = SERVICE_CATEGORIES.map((term) => term.key);
      const en = MESSAGES.find((bundle) => bundle.locale === 'en')!.messages;
      const pt = MESSAGES.find((bundle) => bundle.locale === 'pt-BR')!.messages;
      expect(screen(SERVICES).seed).toEqual({ mode: 'required', records: SERVICE_SEED_RECORDS });
      for (const [index, record] of SERVICE_SEED_RECORDS.entries()) {
        const key = String(record.data.name).replace(`@${NAMESPACE}/`, '');
        expect(en[key]).toBe(SERVICE_SEEDS[index].en);
        expect(pt[key]).toBe(SERVICE_SEEDS[index].ptBR);
        expect(categories).toContain(record.data.category);
        expect(record.data.price).toBeGreaterThan(0);
      }
    });
  });

  describe('weight', () => {
    it("the pet's weight is the one of its most recent weighing", () => {
      expect(field(PETS, 'currentWeightKg').aggregation).toEqual({
        from: WEIGHTS, via: 'pet', op: 'latest', field: 'weightKg', orderBy: [{ path: 'measuredOn', dir: 'desc' }],
      });
      expect(screen(WEIGHTS)).toMatchObject({ parentEntity: PETS, parentRelation: 'owned', hideFromSidebar: true });
    });

    it('a weighing is named by its day and weight, and its card draws both fields — never "Untitled"', () => {
      const weights = screen(WEIGHTS);
      expect(weights.titleFieldKey).toBe('summary');
      expect(field(WEIGHTS, 'summary')).toMatchObject({ type: 'text', hiddenInForm: true, logic: { compute: WEIGHT_SUMMARY } });
      expect(evaluate(WEIGHT_SUMMARY, { measuredOn: day('2026-11-10'), weightKg: 3 })).toBe('10/11/2026 · 3 kg');
      expect(evaluate(WEIGHT_SUMMARY, { measuredOn: null, weightKg: 3 })).toBeNull();
      const card = JSON.stringify(weights.cardTemplate);
      expect(card).toContain('"field":"measuredOn"');
      expect(card).toContain('"field":"weightKg"');
    });

    it('a weight is between 0 and 200 kg', () => {
      const refused = (value: number) => evaluateFieldValidation(WEIGHT_RULE, { value, data: { weightKg: value }, at, timeZone });
      expect(refused(12.5)).toBeFalsy();
      expect(refused(0)).toBeTruthy();
      expect(refused(250)).toBeTruthy();
    });
  });
});

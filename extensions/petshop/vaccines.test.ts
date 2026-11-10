import { describe, expect, it } from 'vitest';
import { buildPlugin } from '@microteia/sdk/node';
// The platform's own engines — test-only imports, see plugin.test.ts.
import {
  evaluateFieldExpression,
  evaluateFieldValidation,
} from '../node_modules/@microteia/sdk/lib/domain/schema/fieldExpression.js';
import { matchesOptionsFilter, resolveOptionsFilter } from '../node_modules/@microteia/sdk/lib/domain/schema/optionsFilter.js';
import type { WorkflowStep } from '@microteia/sdk';
import { BATCH_AVAILABLE, BATCH_EXPIRED, BATCH_STATUSES } from './catalog';
import { BATCH_STATUS_LIST, CUSTOMERS, PETS, VACCINATIONS, VACCINE_BATCHES, VACCINES } from './collections';
import { NAMESPACE } from './messages';
import { petshopPlugin } from './plugin';
import {
  APPLIED_NOT_FUTURE_RULE,
  AVAILABLE_BATCHES_OF_VACCINE,
  BATCH_EXPIRES_ON_DATE,
  BATCH_STATUS_FOR_TODAY,
  BATCH_STATUS_ON_SAVE,
  DEFAULT_REMIND_DAYS,
  DOSES_LEFT,
  DOSES_POSITIVE_RULE,
  EXPIRY_AFTER_MANUFACTURE_RULE,
  LATER_DOSE,
  NEXT_DOSE_AFTER_APPLIED_RULE,
  NEXT_DOSE_REMINDER,
  REMIND_DAYS_RULE,
  REMIND_ON,
  VACCINE_DUE_CATEGORY,
  EARLIER_DOSES,
  RENEW_EARLIER_DOSES,
  VACCINATION_OVERDUE_ON_DATE,
  VACCINATION_STATUS_FOR_TODAY,
  VACCINATION_STATUS_ON_SAVE,
} from './vaccines';
import { VACCINATION_CURRENT, VACCINATION_OVERDUE, VACCINATION_RENEWED } from './catalog';
import { OVERDUE_FILTER } from './plugin';

const screen = (key: string) => (petshopPlugin.screens ?? []).find((one) => one.key === key)!;
const field = (screenKey: string, key: string) => screen(screenKey).fields.find((one) => one.key === key)!;
const ref = (key: string) => `@${NAMESPACE}/${key}`;

// 10 Nov 2026, 15:00 in São Paulo. A date field reaches an expression as that day at noon UTC.
const at = new Date('2026-11-10T18:00:00Z');
const timeZone = 'America/Sao_Paulo';
const day = (text: string) => new Date(`${text}T12:00:00Z`);
const dayOf = (value: unknown) => (value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10));

describe('vaccines', () => {
  it('the package installs: the platform finds nothing to refuse', () => {
    const built = buildPlugin({ entry: new URL('./plugin.ts', import.meta.url).pathname });
    expect(built.issues).toEqual([]);
  });

  describe('screens', () => {
    it('vaccines have a menu entry; batches are a tab of the vaccine, vaccinations a tab of the pet', () => {
      expect(screen(VACCINES).hideFromSidebar).not.toBe(true);
      expect(screen(VACCINE_BATCHES)).toMatchObject({ parentEntity: VACCINES, parentFieldKey: 'vaccine', hideFromSidebar: true });
      expect(screen(VACCINATIONS)).toMatchObject({ parentEntity: PETS, parentFieldKey: 'pet', hideFromSidebar: true });
    });

    it('keeps the screen identities the plan recorded in business-rules.json', () => {
      for (const key of [VACCINES, VACCINE_BATCHES, VACCINATIONS]) {
        expect(screen(key).sourceId).toBe(`${NAMESPACE}:${key}`);
      }
    });

    it('a lot number cannot repeat within one vaccine, whatever the case', () => {
      expect(screen(VACCINE_BATCHES).keys).toEqual([
        expect.objectContaining({ kind: 'unique', fields: ['lotNumber'], scope: 'parent', normalize: { caseInsensitive: true } }),
      ]);
    });

    it('the same vaccine name cannot repeat within one laboratory', () => {
      expect(screen(VACCINES).keys).toEqual([expect.objectContaining({ kind: 'unique', fields: ['laboratory', 'name'] })]);
    });

    it('a batch is born available, and nobody picks its status by hand', () => {
      expect(field(VACCINE_BATCHES, 'status')).toMatchObject({
        lookupCollection: BATCH_STATUS_LIST,
        defaultValue: BATCH_AVAILABLE,
        logic: { disabledWhen: 'true' },
      });
    });

    it('a vaccination reminds 2 days before unless told otherwise', () => {
      expect(DEFAULT_REMIND_DAYS).toBe(2);
      expect(field(VACCINATIONS, 'remindDaysBefore').defaultValue).toBe(2);
    });

    it('the reminder date is stored, so the kernel clock can fire on it', () => {
      expect(field(VACCINATIONS, 'remindOn')).toMatchObject({ type: 'date', logic: { compute: REMIND_ON } });
    });
  });

  describe('lists', () => {
    const statuses = (petshopPlugin.lookups ?? []).find((one) => one.collection === BATCH_STATUS_LIST)!;

    it('always seeds the batch statuses the automations compare', () => {
      expect(statuses.seed).toBe('required');
      expect(statuses.options?.map((option) => option.key)).toEqual([BATCH_AVAILABLE, BATCH_EXPIRED]);
      expect(BATCH_STATUSES.map((term) => term.key)).toEqual([BATCH_AVAILABLE, BATCH_EXPIRED]);
    });
  });

  describe('the batch picker of a vaccination', () => {
    const batches = [
      { id: 'b1', vaccine: 'rabies', status: BATCH_AVAILABLE },
      { id: 'b2', vaccine: 'rabies', status: BATCH_EXPIRED },
      { id: 'b3', vaccine: 'v10', status: BATCH_AVAILABLE },
    ];
    const offered = (vaccine: string | null) => {
      const filter = resolveOptionsFilter(AVAILABLE_BATCHES_OF_VACCINE, { vaccine });
      return batches.filter((batch) => filter !== null && !filter.blocked && matchesOptionsFilter(batch, filter)).map((batch) => batch.id);
    };

    it('offers only the available batches of the chosen vaccine', () => {
      expect(offered('rabies')).toEqual(['b1']);
      expect(offered('v10')).toEqual(['b3']);
    });

    it('offers nothing until a vaccine is chosen', () => {
      expect(offered(null)).toEqual([]);
    });

    it('is the filter the Batch field declares, and each rule sits on its field', () => {
      expect(field(VACCINE_BATCHES, 'dosesPurchased').logic?.validate).toBe(DOSES_POSITIVE_RULE);
      expect(field(VACCINATIONS, 'batch').optionsFilter).toBe(AVAILABLE_BATCHES_OF_VACCINE);
    });
  });

  describe('field rules', () => {
    const check = (rule: string, value: unknown, data: Record<string, unknown>) =>
      evaluateFieldValidation(rule, { value, data, at, timeZone });

    it('the expiry date comes after the manufacture date', () => {
      const rule = (expiry: string, made: string | null) =>
        check(EXPIRY_AFTER_MANUFACTURE_RULE, day(expiry), { expiryDate: day(expiry), manufacturedOn: made ? day(made) : null });
      expect(rule('2027-01-01', '2026-01-01')).toBeNull();
      expect(rule('2027-01-01', null)).toBeNull();
      expect(rule('2026-01-01', '2026-01-01')).toBe(ref('error.expiry-before-manufacture'));
      expect(rule('2025-12-31', '2026-01-01')).toBe(ref('error.expiry-before-manufacture'));
    });

    it('an expired batch can still be registered: the automation marks it, the form does not refuse it', () => {
      expect(check(EXPIRY_AFTER_MANUFACTURE_RULE, day('2020-01-01'), { expiryDate: day('2020-01-01') })).toBeNull();
    });

    it('doses purchased, when given, are more than zero', () => {
      expect(check(DOSES_POSITIVE_RULE, 10, { dosesPurchased: 10 })).toBeNull();
      expect(check(DOSES_POSITIVE_RULE, null, { dosesPurchased: null })).toBeNull();
      expect(check(DOSES_POSITIVE_RULE, 0, { dosesPurchased: 0 })).toBe(ref('error.doses-positive'));
    });

    it('a vaccine cannot be applied in the future', () => {
      expect(check(APPLIED_NOT_FUTURE_RULE, day('2026-11-10'), { appliedOn: day('2026-11-10') })).toBeNull();
      expect(check(APPLIED_NOT_FUTURE_RULE, day('2026-11-11'), { appliedOn: day('2026-11-11') })).toBe(ref('error.applied-future'));
    });

    it('the next dose comes after the date applied', () => {
      const rule = (next: string) => check(NEXT_DOSE_AFTER_APPLIED_RULE, day(next), { appliedOn: day('2026-11-10'), nextDoseOn: day(next) });
      expect(rule('2027-11-10')).toBeNull();
      expect(rule('2026-11-10')).toBe(ref('error.next-dose-before-applied'));
      expect(check(NEXT_DOSE_AFTER_APPLIED_RULE, null, { appliedOn: day('2026-11-10'), nextDoseOn: null })).toBeNull();
    });

    it('reminds between 0 and 60 days before', () => {
      expect(check(REMIND_DAYS_RULE, 0, { remindDaysBefore: 0 })).toBeNull();
      expect(check(REMIND_DAYS_RULE, 60, { remindDaysBefore: 60 })).toBeNull();
      expect(check(REMIND_DAYS_RULE, 61, { remindDaysBefore: 61 })).toBe(ref('error.remind-days'));
      expect(check(REMIND_DAYS_RULE, -1, { remindDaysBefore: -1 })).toBe(ref('error.remind-days'));
    });
  });

  describe('the reminder date', () => {
    const remindOn = (nextDoseOn: string | null, remindDaysBefore: number | null) =>
      evaluateFieldExpression(REMIND_ON, { value: null, data: { nextDoseOn: nextDoseOn ? day(nextDoseOn) : null, remindDaysBefore }, at, timeZone });

    it('is 2 days before the next dose by default', () => {
      expect(dayOf(remindOn('2027-11-10', null))).toBe('2027-11-08');
    });

    it('follows the days set on the vaccination', () => {
      expect(dayOf(remindOn('2027-11-10', 7))).toBe('2027-11-03');
      expect(dayOf(remindOn('2027-11-10', 0))).toBe('2027-11-10');
    });

    it('is empty without a next dose', () => {
      expect(remindOn(null, 2)).toBeNull();
    });
  });

  it('doses left are the doses purchased minus the doses applied', () => {
    const left = (dosesPurchased: number | null, dosesApplied: number | null) =>
      evaluateFieldExpression(DOSES_LEFT, { value: null, data: { dosesPurchased, dosesApplied } });
    expect(left(10, 3)).toBe(7);
    expect(left(10, null)).toBe(10);
    expect(left(null, 3)).toBeNull();
  });

  describe('batch status automations', () => {
    // Evaluated by the field engine as a stand-in for the automation's: the same functions, the same day.
    const status = (expiry: string) =>
      evaluateFieldExpression(BATCH_STATUS_FOR_TODAY, { value: null, data: { event: { expiryDate: day(expiry) } }, at, timeZone });

    it('a batch is available through its expiry date and expired from the day after', () => {
      expect(status('2026-11-11')).toBe(BATCH_AVAILABLE);
      expect(status('2026-11-10')).toBe(BATCH_AVAILABLE);
      expect(status('2026-11-09')).toBe(BATCH_EXPIRED);
    });

    it('the clock fires the day after the expiry date, and saving fixes a date that already passed', () => {
      expect(BATCH_EXPIRES_ON_DATE).toMatchObject({
        eventName: `${VACCINE_BATCHES}.dateReached`,
        dateReached: { field: 'expiryDate', offset: '+1d' },
      });
      expect(BATCH_STATUS_ON_SAVE.eventName).toBe(`${VACCINE_BATCHES}.saved`);
    });

    it('both only run when the status is wrong, so their own write does not loop', () => {
      for (const workflow of [BATCH_EXPIRES_ON_DATE, BATCH_STATUS_ON_SAVE]) {
        expect(workflow.condition).toEqual({ kind: 'Expression', expression: `${BATCH_STATUS_FOR_TODAY} != event.status` });
        expect(workflow.steps.map((step) => step.stepDefinitionId)).toEqual(['map', 'upsert']);
      }
    });
  });

  describe('the next-dose reminder', () => {
    const steps = (list: WorkflowStep[]): WorkflowStep[] =>
      list.flatMap((step) => [step, ...steps(step.branches?.whenTrue ?? []), ...steps(step.branches?.whenFalse ?? [])]);
    const all = steps(NEXT_DOSE_REMINDER.steps);
    const step = (id: string) => all.find((one) => one.id === id)!;

    it('fires on the reminder date, which already carries the days before', () => {
      expect(NEXT_DOSE_REMINDER).toMatchObject({
        eventName: `${VACCINATIONS}.dateReached`,
        dateReached: { field: 'remindOn', offset: '0d' },
      });
    });

    it('stays quiet when the pet already took a later dose of the same vaccine', () => {
      expect(LATER_DOSE.where.map((one) => [one.path, one.op])).toEqual([
        ['pet', 'eq'],
        ['vaccine', 'eq'],
        ['appliedOn', 'gt'],
      ]);
      expect(step('stillDue').condition).toEqual({ kind: 'Expression', expression: 'output.laterDose.count == 0' });
    });

    it('alerts the staff in the app, under a notification type they can tune', () => {
      expect(step('notifyStaff').configuration).toMatchObject({
        recipientPermission: { kind: 'Literal', value: `${VACCINATIONS}.read` },
        category: { kind: 'Literal', value: `${NAMESPACE}/${VACCINE_DUE_CATEGORY}` },
        toInApp: { kind: 'Literal', value: true },
      });
    });

    it("e-mails the owner at the customer's contact e-mail, only when there is one", () => {
      expect(step('notifyOwner').configuration).toMatchObject({
        recipientAddresses: { kind: 'Event', path: 'pet.customer.email' },
        toEmail: { kind: 'Literal', value: true },
      });
      expect(field(CUSTOMERS, 'email').contact).toBe('email');
      expect(field(PETS, 'customer').refEntity).toBe(CUSTOMERS);
      expect(field(VACCINATIONS, 'pet').refEntity).toBe(PETS);
      expect(step('ownerHasEmail').condition).toEqual({ kind: 'Expression', expression: 'not isEmpty(event.pet.customer.email)' });
    });

    it('every flow has a description, so the platform can find it', () => {
      for (const workflow of petshopPlugin.workflows) expect(workflow.description).toMatch(/^@/);
    });
  });

  describe('the status of a dose', () => {
    const status = (nextDoseOn: string | null, renewedBy: string | null = null) =>
      evaluateFieldExpression(VACCINATION_STATUS_FOR_TODAY, {
        value: null,
        data: { event: { nextDoseOn: nextDoseOn ? day(nextDoseOn) : null, renewedBy } },
        at,
        timeZone,
      });

    it('is current through the day of the next dose, and overdue from the day after', () => {
      expect(status('2026-11-10')).toBe(VACCINATION_CURRENT);
      expect(status('2026-11-09')).toBe(VACCINATION_OVERDUE);
      expect(status(null)).toBe(VACCINATION_CURRENT);
    });

    it('a dose renewed by a later one is renewed, whatever its date', () => {
      expect(status('2026-01-01', 'later-dose')).toBe(VACCINATION_RENEWED);
    });

    it('the clock and the save both write it, only when it is wrong', () => {
      expect(VACCINATION_OVERDUE_ON_DATE).toMatchObject({ eventName: `${VACCINATIONS}.dateReached`, dateReached: { field: 'nextDoseOn', offset: '+1d' } });
      for (const workflow of [VACCINATION_OVERDUE_ON_DATE, VACCINATION_STATUS_ON_SAVE]) {
        expect(workflow.condition).toEqual({ kind: 'Expression', expression: `${VACCINATION_STATUS_FOR_TODAY} != event.status` });
      }
    });

    it('a new dose renews the earlier doses of the same vaccine for the same pet, one by one', () => {
      expect(RENEW_EARLIER_DOSES.condition).toEqual({ kind: 'Expression', expression: 'event.changeType == "created"' });
      expect(EARLIER_DOSES.where.map((one) => [one.path, one.op])).toEqual([['pet', 'eq'], ['vaccine', 'eq'], ['appliedOn', 'lt'], ['status', 'neq']]);
      const loop = RENEW_EARLIER_DOSES.steps.find((step) => step.type === 'Loop')!;
      expect(loop.loop?.source).toEqual({ kind: 'Output', stepId: 'earlierDoses', outputId: 'results' });
      expect(loop.loop?.body.map((step) => step.stepDefinitionId)).toEqual(['map', 'upsert']);
    });

    it("the pet counts its overdue doses, which the card and the Check in button read", () => {
      expect(field(PETS, 'overdueVaccines').aggregation).toEqual({ from: VACCINATIONS, via: 'pet', op: 'count', filter: OVERDUE_FILTER });
      expect(evaluateFieldExpression(OVERDUE_FILTER, { value: null, data: { status: VACCINATION_OVERDUE } })).toBe(true);
      expect(evaluateFieldExpression(OVERDUE_FILTER, { value: null, data: { status: VACCINATION_RENEWED } })).toBe(false);
    });

    it('the reminder is not sent for a dose that was already renewed', () => {
      expect(NEXT_DOSE_REMINDER.condition).toEqual({ kind: 'Expression', expression: `not isEmpty(event.nextDoseOn) and event.status != "${VACCINATION_RENEWED}"` });
    });
  });
});

import { describe, expect, it } from 'vitest';
import { evaluateFieldExpression } from '../node_modules/@microteia/sdk/lib/domain/schema/fieldExpression.js';
import type { WorkflowStep } from '@microteia/sdk';
import { APPOINTMENT, APPOINTMENT_STATUSES, VACCINATION_CURRENT, VACCINATION_OVERDUE, VACCINATION_RENEWED } from './catalog';
import { APPOINTMENTS, VACCINATIONS } from './collections';
import { petshopPlugin } from './plugin';
import {
  APPOINTMENT_MIRROR,
  APPOINTMENT_PRIORITY,
  CALENDAR,
  CALENDAR_CLOSED,
  CALENDAR_PENDING,
  itemOf,
  MOVABLE,
  RESCHEDULE_ACTION,
  VACCINATION_MIRROR,
  VACCINATION_PRIORITY,
} from './calendar';

const workflow = (templateId: string) => petshopPlugin.workflows.find((one) => one.templateId === templateId)!;
const flatten = (list: WorkflowStep[]): WorkflowStep[] =>
  list.flatMap((step) => [step, ...flatten(step.branches?.whenTrue ?? []), ...flatten(step.branches?.whenFalse ?? [])]);
const evaluate = (expression: string, data: Record<string, unknown>) => evaluateFieldExpression(expression, { value: null, data });
const contribution = (point: string, origem: string) =>
  (petshopPlugin.manifest.contributes ?? []).find((one) => one.point === point && (one.metadata as { origem?: string }).origem === origem);

describe('the Pet Shop on the Calendar', () => {
  it('declares the Calendar, whose collection it writes', () => {
    expect(petshopPlugin.manifest.dependencies).toEqual({ 'com.microteia.calendar': { version: '^1.8.0', collections: [CALENDAR] } });
  });

  describe('the mirror', () => {
    it('finds the item a record already has by the pair the Calendar opens it with', () => {
      expect(itemOf(APPOINTMENTS).where).toEqual([
        { path: 'origem', op: 'eq', value: { kind: 'Literal', value: APPOINTMENTS } },
        { path: 'origemId', op: 'eq', value: { kind: 'Event', path: 'id' } },
      ]);
    });

    it.each([
      ['pet-calendar-appointment', `${APPOINTMENTS}.saved`],
      ['pet-calendar-appointment-deleted', `${APPOINTMENTS}.deleted`],
      ['pet-calendar-vaccination', `${VACCINATIONS}.saved`],
      ['pet-calendar-vaccination-deleted', `${VACCINATIONS}.deleted`],
    ])('%s follows %s', (templateId, eventName) => {
      expect(workflow(templateId).eventName).toBe(eventName);
    });

    it('updates the item that exists, creates one otherwise, and removes it when the record no longer shows', () => {
      const steps = flatten(workflow('pet-calendar-vaccination').steps);
      const update = steps.find((step) => step.id === 'updateItemObject')!;
      const create = steps.find((step) => step.id === 'createItemObject')!;
      const fieldsOf = (step: WorkflowStep) => (step.configuration.map as { value: { fields: { name: string }[] } }).value.fields.map((one) => one.name);
      expect(fieldsOf(update)).toContain('id');
      expect(fieldsOf(create)).not.toContain('id');
      for (const required of ['title', 'status', 'priority', 'date', 'origem', 'origemId']) {
        expect(fieldsOf(create), required).toContain(required);
      }
      expect(steps.find((step) => step.id === 'removeItem')?.stepDefinitionId).toBe('remove');
    });

    it('an appointment that is over stays on its day, closed', () => {
      const status = (value: string) => evaluate(APPOINTMENT_MIRROR.fields.status, { event: { status: value } });
      for (const term of APPOINTMENT_STATUSES) {
        const over = [APPOINTMENT.done, APPOINTMENT.cancelled, APPOINTMENT.noShow].includes(term.key as never);
        expect(status(term.key), term.key).toBe(over ? CALENDAR_CLOSED : CALENDAR_PENDING);
      }
    });

    it('a request to approve and a pet waiting for pickup come first', () => {
      const priority = (status: string) => evaluate(APPOINTMENT_PRIORITY, { event: { status } });
      expect(priority(APPOINTMENT.requested)).toBe('high');
      expect(priority(APPOINTMENT.ready)).toBe('high');
      expect(priority(APPOINTMENT.scheduled)).toBe('medium');
      expect(priority(APPOINTMENT.done)).toBe('low');
    });

    it('a next dose shows only when there is one, critical once overdue, closed once renewed', () => {
      expect(evaluate(VACCINATION_MIRROR.shows, { event: { nextDoseOn: null } })).toBe(false);
      expect(evaluate(VACCINATION_MIRROR.shows, { event: { nextDoseOn: new Date('2026-12-01T12:00:00Z') } })).toBe(true);
      expect(evaluate(VACCINATION_PRIORITY, { event: { status: VACCINATION_OVERDUE } })).toBe('critical');
      expect(evaluate(VACCINATION_PRIORITY, { event: { status: VACCINATION_CURRENT } })).toBe('high');
      expect(evaluate(VACCINATION_MIRROR.fields.status, { event: { status: VACCINATION_RENEWED } })).toBe(CALENDAR_CLOSED);
    });

    it('the title is data — names and numbers — never a phrase', () => {
      expect(evaluate(APPOINTMENT_MIRROR.fields.title, { event: { pet: { name: 'Rex' }, number: '2026/00012' } })).toBe('Rex · 2026/00012');
    });
  });

  describe('how the cards present themselves', () => {
    it('an appointment card does not repeat the time the Calendar already prints', () => {
      expect((contribution('calendar.source', APPOINTMENTS)?.metadata as { subtitleFields: string[] }).subtitleFields).not.toContain('hour');
    });

    it.each([APPOINTMENTS, VACCINATIONS])('%s declares its tag on calendar.source', (origem) => {
      expect(contribution('calendar.source', origem)?.metadata).toMatchObject({ origem, label: expect.stringMatching(/^@/), icon: expect.any(String) });
    });
  });

  describe('dragging an appointment', () => {
    it('runs the reschedule action, only for whoever may change appointments', () => {
      const move = contribution('calendar.moveaction', APPOINTMENTS)!;
      expect(move.metadata).toMatchObject({ actionSourceId: RESCHEDULE_ACTION, hiddenWhen: `not hasPermission("${APPOINTMENTS}.update")` });
      expect((petshopPlugin.actions ?? []).find((one) => one.templateId === RESCHEDULE_ACTION)?.workflowId).toBe('pet-appointment-reschedule');
    });

    it('moves only an appointment that has not started', () => {
      const movable = (status: string) => evaluate(MOVABLE, { output: { appointment: { first: { status } } } });
      expect(movable(APPOINTMENT.requested)).toBe(true);
      expect(movable(APPOINTMENT.scheduled)).toBe(true);
      expect(movable(APPOINTMENT.inService)).toBe(false);
      expect(movable(APPOINTMENT.done)).toBe(false);
    });

    it('writes the new day on the appointment and asks the owner to confirm again — never on the item', () => {
      const flow = workflow('pet-appointment-reschedule');
      const write = flow.steps.find((step) => step.stepDefinitionId === 'upsert')!;
      expect((write.configuration.upsert as { value: { table: string } }).value.table).toBe(APPOINTMENTS);
      const fields = (flow.steps.find((step) => step.id === 'rescheduledObject')!.configuration.map as { value: { fields: { name: string }[] } }).value.fields;
      expect(fields.map((one) => one.name)).toEqual(['id', 'scheduledOn', 'confirmedByOwner']);
      expect(flow.steps.at(-1)?.stepDefinitionId).toBe('map');
    });
  });
});

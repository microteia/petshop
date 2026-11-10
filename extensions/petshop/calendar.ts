import type {
  ActionModuleTemplate,
  Contribution,
  MapStepConfig,
  QuerySpec,
  RemoveStepConfig,
  UpsertStepConfig,
  WorkflowModuleTemplate,
  WorkflowStep,
} from '@microteia/sdk';
import { pointContribution } from '@microteia/sdk';
import { APPOINTMENT, VACCINATION_OVERDUE, VACCINATION_RENEWED } from './catalog';
import { APPOINTMENTS, label, VACCINATIONS } from './collections';

/**
 * The Pet Shop on the Calendar (com.microteia.calendar).
 *
 * The Calendar owns nothing it shows. Each item on it is a MIRROR kept by the record that created it —
 * here, each appointment and each next vaccine dose. The origin writes the item, keeps it current when the
 * record changes, and removes it when the record is deleted; the Calendar only draws it, and clicking a card
 * opens the record through the `origem` (collection) + `origemId` pair on the item.
 *
 * Three declarations, all data — no code:
 *
 * - **The mirror** — one workflow per origin on save and one on delete, writing the `calendar` collection.
 * - **`calendar.source`** — how Pet Shop cards present themselves: the tag, its icon and colour, and the
 *   item fields that make the line under the title. Read when the agenda is drawn.
 * - **`calendar.moveaction`** — what dragging an APPOINTMENT to another day means: it reschedules it. The
 *   Calendar writes nothing on its own; it runs the action this extension names, with `targetDate`.
 *
 * The office switches each origin and each drag handler on or off in Settings › Calendar.
 */

/** The Calendar's collection and its option keys, as its package declares them. Keys, never labels. */
export const CALENDAR = 'calendar';
export const CALENDAR_PENDING = 'pending';
export const CALENDAR_CLOSED = 'closed';

/** The appointments that are over: their item stays on the agenda, closed, on the day it happened. */
export const CLOSED_APPOINTMENT = [APPOINTMENT.done, APPOINTMENT.cancelled, APPOINTMENT.noShow]
  .map((status) => `event.status == "${status}"`)
  .join(' or ');

/** What needs the shop's attention first: a request to approve, a pet waiting for its owner. */
export const APPOINTMENT_PRIORITY =
  `if(${CLOSED_APPOINTMENT}, "low", ` +
  `if(event.status == "${APPOINTMENT.requested}" or event.status == "${APPOINTMENT.ready}", "high", "medium"))`;

export const VACCINATION_PRIORITY = `if(event.status == "${VACCINATION_OVERDUE}", "critical", "high")`;

// ─── The mirror ─────────────────────────────────────────────────────────────

interface Mirror {
  key: string;
  collection: string;
  /** Whether the record has an item on the agenda at all. */
  shows: string;
  /** The item's fields, as expressions over the record (`event`). `origem`, `origemId` are added. */
  fields: Record<'title' | 'status' | 'priority' | 'date', string> & Partial<Record<'hour' | 'description', string>>;
}

/** The item this record already has on the agenda, if any. Two equalities, both answered by the database. */
export const itemOf = (collection: string): QuerySpec => ({
  table: CALENDAR,
  where: [
    { path: 'origem', op: 'eq', value: { kind: 'Literal', value: collection } },
    { path: 'origemId', op: 'eq', value: { kind: 'Event', path: 'id' } },
  ],
  limit: 1,
  projections: ['id'],
});

const step = (id: string, stepDefinitionId: string, order: number, configuration: WorkflowStep['configuration']): WorkflowStep => ({
  id,
  stepDefinitionId,
  type: 'Action',
  order,
  enabled: true,
  configuration,
});

const branch = (id: string, order: number, expression: string, whenTrue: WorkflowStep[], whenFalse: WorkflowStep[] = []): WorkflowStep => ({
  id,
  stepDefinitionId: '',
  type: 'Condition',
  order,
  enabled: true,
  configuration: {},
  condition: { kind: 'Expression', expression },
  branches: { whenTrue, whenFalse },
});

const findItem = (mirror: Mirror) => step('existingItem', 'query', 0, { query: { kind: 'Literal', value: itemOf(mirror.collection) } });
const HAS_ITEM = 'output.existingItem.count > 0';

/** Writes the item: with the id of the one already there, or as a new one. */
const writeItem = (mirror: Mirror, withId: boolean): WorkflowStep[] => {
  const fields: MapStepConfig['fields'] = [
    ...(withId ? [{ name: 'id', value: { kind: 'Expression' as const, expression: 'output.existingItem.first.id' } }] : []),
    ...Object.entries(mirror.fields).map(([name, expression]) => ({ name, value: { kind: 'Expression' as const, expression } })),
    { name: 'origem', value: { kind: 'Literal', value: mirror.collection } },
    { name: 'origemId', value: { kind: 'Event', path: 'id' } },
  ];
  const id = withId ? 'updateItem' : 'createItem';
  return [
    step(`${id}Object`, 'map', 0, { map: { kind: 'Literal', value: { name: 'item', fields } satisfies MapStepConfig } }),
    step(`${id}Write`, 'upsert', 1, {
      upsert: { kind: 'Literal', value: { table: CALENDAR, source: 'input', property: 'item' } satisfies UpsertStepConfig },
    }),
  ];
};

const removeItem = (): WorkflowStep =>
  step('removeItem', 'remove', 0, {
    remove: {
      kind: 'Literal',
      value: { table: CALENDAR, id: { kind: 'Expression', expression: 'output.existingItem.first.id' } } satisfies RemoveStepConfig,
    },
  });

/**
 * On every save the item is written again with the record's current values. Writing the same values
 * publishes nothing — the platform does not publish a document that did not change — so this never loops.
 */
const mirrorOnSave = (mirror: Mirror): WorkflowModuleTemplate => ({
  templateId: `pet-calendar-${mirror.key}`,
  name: label(`workflow.calendar-${mirror.key}`),
  description: label(`workflow.calendar-${mirror.key}.description`),
  eventName: `${mirror.collection}.saved`,
  version: 1,
  condition: { kind: 'AlwaysTrue' },
  steps: [
    findItem(mirror),
    branch('shows', 1, mirror.shows,
      [branch('updateOrCreate', 0, HAS_ITEM, writeItem(mirror, true), writeItem(mirror, false))],
      [branch('hadItem', 0, HAS_ITEM, [removeItem()])]),
  ],
});

/** A deleted record takes its item off the agenda — the Calendar would otherwise open a record that is gone. */
const mirrorOnDelete = (mirror: Mirror): WorkflowModuleTemplate => ({
  templateId: `pet-calendar-${mirror.key}-deleted`,
  name: label(`workflow.calendar-${mirror.key}-deleted`),
  description: label(`workflow.calendar-${mirror.key}-deleted.description`),
  eventName: `${mirror.collection}.deleted`,
  version: 1,
  condition: { kind: 'AlwaysTrue' },
  steps: [findItem(mirror), branch('hadItem', 1, HAS_ITEM, [removeItem()])],
});

export const APPOINTMENT_MIRROR: Mirror = {
  key: 'appointment',
  collection: APPOINTMENTS,
  shows: 'true',
  fields: {
    // Data, not a phrase: the pet's name and the appointment number, which no catalog translates anyway.
    title: 'concat(event.pet.name, " · ", event.number)',
    status: `if(${CLOSED_APPOINTMENT}, "${CALENDAR_CLOSED}", "${CALENDAR_PENDING}")`,
    priority: APPOINTMENT_PRIORITY,
    date: 'event.scheduledOn',
    hour: 'event.time',
    description: 'event.notes',
  },
};

export const VACCINATION_MIRROR: Mirror = {
  key: 'vaccination',
  collection: VACCINATIONS,
  // Only a dose with a next dose has a day on the agenda.
  shows: 'not isEmpty(event.nextDoseOn)',
  fields: {
    title: 'concat(event.pet.name, " · ", event.vaccine.name)',
    // A renewed dose is answered: its item closes, on the day the next dose was due.
    status: `if(event.status == "${VACCINATION_RENEWED}", "${CALENDAR_CLOSED}", "${CALENDAR_PENDING}")`,
    priority: VACCINATION_PRIORITY,
    date: 'event.nextDoseOn',
    description: 'event.pet.customer.name',
  },
};

// ─── Dragging an appointment reschedules it ─────────────────────────────────

const RESCHEDULE_WORKFLOW = 'pet-appointment-reschedule';
export const RESCHEDULE_ACTION = 'pet-appointment-reschedule-action';

/** Only an appointment that has not started can move. Read from the appointment, not from the item. */
export const MOVABLE = `output.appointment.first.status == "${APPOINTMENT.requested}" or output.appointment.first.status == "${APPOINTMENT.scheduled}"`;

/**
 * The Calendar runs this with the ITEM it shows (`recordId`, an item of `calendar`) and the day it was
 * dropped on (`targetDate`). The flow finds the appointment the item mirrors, moves it, and asks the owner
 * to confirm again; the appointment's own save then moves the item — the agenda never writes it.
 */
const RESCHEDULE: WorkflowModuleTemplate = {
  templateId: RESCHEDULE_WORKFLOW,
  name: label('workflow.appointment-reschedule'),
  description: label('workflow.appointment-reschedule.description'),
  eventName: 'workflow.called',
  version: 1,
  // `targetDate` is what the Calendar sends with a drag; nothing else fires this flow with one.
  condition: { kind: 'Expression', expression: `event.recordId.origem == "${APPOINTMENTS}" and not isEmpty(event.targetDate)` },
  parameters: [
    { key: 'recordId', label: label('calendar.item'), type: 'EntityReference', entityType: CALENDAR, required: true },
    { key: 'targetDate', label: label('appointment.field.scheduled-on'), type: 'Date', required: false },
  ],
  steps: [
    step('appointment', 'query', 0, {
      query: {
        kind: 'Literal',
        value: {
          table: APPOINTMENTS,
          where: [{ path: 'id', op: 'eq', value: { kind: 'Expression', expression: 'event.recordId.origemId' } }],
          limit: 1,
          projections: ['id', 'status'],
        } satisfies QuerySpec,
      },
    }),
    branch('movable', 1, MOVABLE, [], [
      step('refuseMove', 'map', 0, {
        map: {
          kind: 'Literal',
          value: { fields: [{ name: 'status', value: { kind: 'Literal', value: ['ERROR', label('error.reschedule-started')] } }] } satisfies MapStepConfig,
        },
      }),
      step('refuseMoveExit', 'exit', 1, {}),
    ]),
    step('rescheduledObject', 'map', 2, {
      map: {
        kind: 'Literal',
        value: {
          name: 'appointment',
          fields: [
            { name: 'id', value: { kind: 'Expression', expression: 'output.appointment.first.id' } },
            { name: 'scheduledOn', value: { kind: 'Event', path: 'targetDate' } },
            // A new day is a new commitment: the owner confirms again, and is reminded the evening before.
            { name: 'confirmedByOwner', value: { kind: 'Literal', value: false } },
          ],
        } satisfies MapStepConfig,
      },
    }),
    step('rescheduledWrite', 'upsert', 3, {
      upsert: { kind: 'Literal', value: { table: APPOINTMENTS, source: 'input', property: 'appointment' } satisfies UpsertStepConfig },
    }),
    step('answer', 'map', 4, {
      map: {
        kind: 'Literal',
        value: {
          fields: [
            { name: 'status', value: { kind: 'Literal', value: 'SUCCESS' } },
            { name: 'actions', value: { kind: 'Literal', value: ['refresh'] } },
          ],
        } satisfies MapStepConfig,
      },
    }),
  ],
};

export const CALENDAR_ACTIONS: ActionModuleTemplate[] = [
  {
    templateId: RESCHEDULE_ACTION,
    key: 'reschedule',
    title: label('action.reschedule'),
    icon: 'calendarSchedule',
    workflowId: RESCHEDULE_WORKFLOW,
    order: 10,
    enabled: true,
    danger: false,
  },
];

export const CALENDAR_WORKFLOWS: WorkflowModuleTemplate[] = [
  mirrorOnSave(APPOINTMENT_MIRROR),
  mirrorOnDelete(APPOINTMENT_MIRROR),
  mirrorOnSave(VACCINATION_MIRROR),
  mirrorOnDelete(VACCINATION_MIRROR),
  RESCHEDULE,
];

// ─── The declarations the Calendar reads ────────────────────────────────────

const CALENDAR_SOURCE_POINT = 'calendar.source';
const CALENDAR_MOVE_POINT = 'calendar.moveaction';

export const CALENDAR_CONTRIBUTIONS: Contribution[] = [
  pointContribution(CALENDAR_SOURCE_POINT, 'pet-calendar-source-appointments', {
    key: 'pet-appointments',
    label: label('calendar.source.appointments'),
    origem: APPOINTMENTS,
    icon: 'calendarSchedule',
    color: 'primary',
    // The Calendar already prints the time on every card; the subtitle would repeat it.
    subtitleFields: [],
    metaFields: ['description'],
  }, '1.0.0'),
  pointContribution(CALENDAR_SOURCE_POINT, 'pet-calendar-source-vaccinations', {
    key: 'pet-vaccinations',
    label: label('calendar.source.vaccinations'),
    origem: VACCINATIONS,
    icon: 'medicineBottle',
    color: 'warning',
    subtitleFields: ['description'],
    metaFields: [],
  }, '1.0.0'),
  pointContribution(CALENDAR_MOVE_POINT, 'pet-calendar-move-appointments', {
    key: 'pet-reschedule-appointment',
    label: label('calendar.move.appointments'),
    origem: APPOINTMENTS,
    actionSourceId: RESCHEDULE_ACTION,
    // Drawn only for whoever may change appointments; the flow itself refuses one that already started.
    hiddenWhen: `not hasPermission("${APPOINTMENTS}.update")`,
  }, '1.0.0'),
];

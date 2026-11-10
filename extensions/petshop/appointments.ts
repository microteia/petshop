import type {
  ActionModuleTemplate,
  CardTemplate,
  Contribution,
  LookupModuleTemplate,
  MapStepConfig,
  OptionsFilterSpec,
  ScreenModuleTemplate,
  ScreenSeedRecord,
  TemplateField,
  UpsertStepConfig,
  WorkflowModuleTemplate,
  WorkflowStep,
} from '@microteia/sdk';
import { accessPermissionContribution, nav, notificationCategory } from '@microteia/sdk';
import {
  APPOINTMENT,
  APPOINTMENT_STATUSES,
  PACKAGE_ACTIVE,
  PACKAGE_EXPIRED,
  PACKAGE_STATUSES,
  PACKAGE_USED_UP,
  SERVICE_CATEGORIES,
  SERVICE_SEEDS,
  termMessageKey,
  type Term,
} from './catalog';
import {
  APPOINTMENT_ITEMS,
  APPOINTMENT_STATUS_LIST,
  APPOINTMENTS,
  label,
  PACKAGE_STATUS_LIST,
  PACKAGES,
  PETS,
  SERVICE_CATEGORY_LIST,
  SERVICES,
  sourceIdOf,
} from './collections';
import { NAMESPACE } from './messages';

/**
 * Services, appointments and packages — the grooming side of the shop.
 *
 * - **Service** is what the shop does and charges for (a bath, a grooming), with its price and whether it
 *   requires the pet's vaccines to be up to date. A screen in the menu, seeded with the common services.
 * - **Appointment** is one visit of one pet, on a day and a time, numbered per year (2026/00012). It is a
 *   tab of the pet AND has its own menu entry, like the pet itself. Its status moves only through the
 *   buttons and the clock — never by hand:
 *
 *       requested ─approve─► scheduled ─check in─► in service ─ready─► ready ─finish─► done
 *           │                   │  ▲ confirm (owner)
 *           └──── cancel ───────┴──────────────► cancelled          scheduled ─(next day)─► no-show
 *
 * - **Appointment item** is one service of the appointment, at the price charged that day — a declared
 *   snapshot of the service price, filled by an automation, so a later price change never rewrites a past
 *   visit. The appointment's total is the SUM of its items, recomputed by the kernel on every write.
 * - **Package** is a number of credits of one service bought for a pet ("4 baths"). A line paid with it
 *   costs nothing and uses one credit; the package is used up when no credit is left, and expires on its
 *   date.
 */

// ─── Shared pieces ──────────────────────────────────────────────────────────

const options = (prefix: string, terms: Term[], colors: Record<string, string> = {}) =>
  terms.map((term) => ({ key: term.key, label: label(termMessageKey(prefix, term.key)), color: colors[term.key] }));

const refuse = (accepts: string, message: string): string => `if(${accepts}, null, "${label(message)}")`;

const action = (
  id: string,
  stepDefinitionId: string,
  order: number,
  configuration: WorkflowStep['configuration'],
): WorkflowStep => ({ id, stepDefinitionId, type: 'Action', order, enabled: true, configuration });

const condition = (id: string, order: number, expression: string, whenTrue: WorkflowStep[], whenFalse: WorkflowStep[] = []): WorkflowStep => ({
  id,
  stepDefinitionId: '',
  type: 'Condition',
  order,
  enabled: true,
  configuration: {},
  condition: { kind: 'Expression', expression },
  branches: { whenTrue, whenFalse },
});

/** A `map` that assembles one record, then the `upsert` that writes it. */
const writeRecord = (id: string, table: string, order: number, fields: MapStepConfig['fields']): WorkflowStep[] => [
  action(`${id}Object`, 'map', order, { map: { kind: 'Literal', value: { name: id, fields } satisfies MapStepConfig } }),
  action(`${id}Write`, 'upsert', order + 1, {
    upsert: { kind: 'Literal', value: { table, source: 'input', property: id } satisfies UpsertStepConfig },
  }),
];

/**
 * What a button reads: the LAST step that runs. An unnamed `map` publishes its fields at the root, where the
 * button looks for `status` and `actions`. `refresh` reloads the record, so the new status shows at once.
 */
const answer = (order: number): WorkflowStep =>
  action('answer', 'map', order, {
    map: {
      kind: 'Literal',
      value: {
        fields: [
          { name: 'status', value: { kind: 'Literal', value: 'SUCCESS' } },
          { name: 'actions', value: { kind: 'Literal', value: ['refresh'] } },
        ],
      } satisfies MapStepConfig,
    },
  });

/** A refusal the person reads, then `exit`: the exit keeps the step before it as the answer. */
const refusal = (id: string, message: string): WorkflowStep[] => [
  action(id, 'map', 0, {
    map: {
      kind: 'Literal',
      value: { fields: [{ name: 'status', value: { kind: 'Literal', value: ['ERROR', label(message)] } }] } satisfies MapStepConfig,
    },
  }),
  action(`${id}Exit`, 'exit', 1, {}),
];

// ─── Option lists ───────────────────────────────────────────────────────────

const APPOINTMENT_COLORS: Record<string, string> = {
  [APPOINTMENT.requested]: 'warning',
  [APPOINTMENT.scheduled]: 'info',
  [APPOINTMENT.inService]: 'primary',
  [APPOINTMENT.ready]: 'success',
  [APPOINTMENT.done]: 'secondary',
  [APPOINTMENT.cancelled]: 'danger',
  [APPOINTMENT.noShow]: 'danger',
};

const PACKAGE_COLORS: Record<string, string> = {
  [PACKAGE_ACTIVE]: 'success',
  [PACKAGE_USED_UP]: 'secondary',
  [PACKAGE_EXPIRED]: 'danger',
};

export const APPOINTMENT_LOOKUPS: LookupModuleTemplate[] = [
  {
    collection: SERVICE_CATEGORY_LIST,
    label: label('lookup.service-categories'),
    seed: 'required',
    options: options('service-category', SERVICE_CATEGORIES),
  },
  {
    collection: APPOINTMENT_STATUS_LIST,
    label: label('lookup.appointment-statuses'),
    // `required`: the flows, the buttons and the portal compare these keys, so they exist everywhere.
    seed: 'required',
    options: options('appointment-status', APPOINTMENT_STATUSES, APPOINTMENT_COLORS),
  },
  {
    collection: PACKAGE_STATUS_LIST,
    label: label('lookup.package-statuses'),
    seed: 'required',
    options: options('package-status', PACKAGE_STATUSES, PACKAGE_COLORS),
  },
];

// ─── Service ────────────────────────────────────────────────────────────────

export const PRICE_NOT_NEGATIVE_RULE = refuse('isEmpty(value) or value >= 0', 'error.price-negative');
export const DURATION_RULE = refuse('isEmpty(value) or (value > 0 and value <= 600)', 'error.duration');

const SERVICE_FIELDS: TemplateField[] = [
  { key: 'name', label: label('service.field.name'), type: 'text', required: true, order: 0, searchable: true },
  {
    key: 'category',
    label: label('service.field.category'),
    type: 'select',
    lookupCollection: SERVICE_CATEGORY_LIST,
    optionsAllowUserAdd: true,
    required: true,
    order: 1,
    filterable: true,
    showInList: true,
  },
  {
    key: 'price',
    label: label('service.field.price'),
    type: 'currency',
    required: true,
    order: 2,
    showInList: true,
    listIcon: 'priceTag',
    logic: { validate: PRICE_NOT_NEGATIVE_RULE },
  },
  {
    key: 'durationMinutes',
    label: label('service.field.duration'),
    type: 'number',
    required: false,
    order: 3,
    showInList: true,
    listIcon: 'timer',
    logic: { validate: DURATION_RULE },
  },
  {
    key: 'requiresVaccines',
    label: label('service.field.requires-vaccines'),
    type: 'checkbox',
    required: false,
    defaultValue: true,
    order: 4,
    filterable: true,
  },
  { key: 'description', label: label('service.field.description'), type: 'textarea', required: false, order: 5 },
];

/** Seeded once per organization; the name is a message reference, written in the organization's language. */
export const SERVICE_SEED_RECORDS: ScreenSeedRecord[] = SERVICE_SEEDS.map((service) => ({
  key: service.key,
  data: {
    name: label(termMessageKey('service.seed', service.key)),
    category: service.category,
    price: service.price,
    durationMinutes: service.durationMinutes,
    requiresVaccines: service.requiresVaccines,
  },
}));

const SERVICE_SCREEN: ScreenModuleTemplate = {
  key: SERVICES,
  sourceId: sourceIdOf(SERVICES),
  titleSingular: label('service.singular'),
  titlePlural: label('service.plural'),
  icon: 'magic',
  titleFieldKey: 'name',
  subtitleFieldKey: 'category',
  // After Pets (25), before Breeds (30).
  sidebarOrder: 28,
  fields: SERVICE_FIELDS,
  keys: [
    { name: 'name', kind: 'unique', fields: ['name'], normalize: { caseInsensitive: true }, message: label('service.key.name') },
  ],
  seed: { mode: 'required', records: SERVICE_SEED_RECORDS },
};

// ─── Appointment ────────────────────────────────────────────────────────────

/** A reason is asked when cancelling, and an appointment that was cancelled always says why. */
export const CANCEL_REASON_RULE = refuse(`status != "${APPOINTMENT.cancelled}" or not isEmpty(value)`, 'error.cancel-reason');

const VISIT = label('appointment.section.visit');
const SERVICE_SECTION = label('appointment.section.service');

const APPOINTMENT_FIELDS: TemplateField[] = [
  {
    key: 'number',
    label: label('appointment.field.number'),
    type: 'text',
    required: false,
    order: 0,
    section: VISIT,
    searchable: true,
    showInList: true,
    // Given by the kernel when the record is created, from a counter that restarts every year: two
    // appointments never share a number, and nobody can change it afterwards.
    autoValue: { pattern: 'YYYY/00000', sequence: { resetBy: 'year' } },
  },
  {
    key: 'pet',
    label: label('appointment.field.pet'),
    type: 'reference',
    refEntity: PETS,
    required: true,
    order: 1,
    section: VISIT,
    searchable: true,
    filterable: true,
    showInList: true,
  },
  {
    key: 'scheduledOn',
    label: label('appointment.field.scheduled-on'),
    type: 'date',
    required: true,
    order: 2,
    section: VISIT,
    filterable: true,
    showInList: true,
  },
  { key: 'time', label: label('appointment.field.time'), type: 'time', required: true, order: 3, section: VISIT, showInList: true },
  {
    key: 'status',
    label: label('appointment.field.status'),
    type: 'select',
    lookupCollection: APPOINTMENT_STATUS_LIST,
    optionsColored: true,
    required: true,
    defaultValue: APPOINTMENT.scheduled,
    order: 4,
    section: VISIT,
    filterable: true,
    showInList: true,
    // Moved by the buttons and the clock, never by hand.
    logic: { disabledWhen: 'true' },
  },
  { key: 'groomer', label: label('appointment.field.groomer'), type: 'text', required: false, order: 5, section: VISIT, searchable: true },
  {
    key: 'confirmedByOwner',
    label: label('appointment.field.confirmed'),
    type: 'checkbox',
    required: false,
    order: 6,
    section: VISIT,
    filterable: true,
    // Set by the Confirm button — the owner's, in the portal, or the staff's on the owner's behalf.
    logic: { disabledWhen: 'true' },
  },
  {
    key: 'total',
    label: label('appointment.field.total'),
    type: 'currency',
    required: false,
    order: 7,
    section: SERVICE_SECTION,
    showInList: true,
    aggregation: { from: APPOINTMENT_ITEMS, via: 'appointment', op: 'sum', field: 'price' },
  },
  {
    key: 'vaccineChecks',
    label: label('appointment.field.vaccine-checks'),
    type: 'number',
    required: false,
    order: 8,
    section: SERVICE_SECTION,
    // Read by the Check in button; nobody needs to see it.
    hiddenInForm: true,
    aggregation: { from: APPOINTMENT_ITEMS, via: 'appointment', op: 'count', filter: 'requiresVaccines == true' },
  },
  {
    key: 'cancelReason',
    label: label('appointment.field.cancel-reason'),
    type: 'text',
    required: false,
    order: 9,
    section: SERVICE_SECTION,
    logic: {
      validate: CANCEL_REASON_RULE,
      hiddenWhen: `status != "${APPOINTMENT.cancelled}"`,
      disabledWhen: 'true',
    },
  },
  { key: 'notes', label: label('appointment.field.notes'), type: 'textarea', required: false, order: 10, section: SERVICE_SECTION },
];

/** The appointment card: its number and status, the pet, when, and how much — the buttons on hover. */
export const APPOINTMENT_CARD: CardTemplate = {
  accent: { field: 'status' },
  body: [
    {
      type: 'row',
      justify: 'between',
      children: [{ type: 'title' }, { type: 'field', field: 'status', variant: 'badge' }],
    },
    {
      type: 'row',
      wrap: true,
      children: [
        { type: 'field', field: 'scheduledOn', icon: 'calendar' },
        { type: 'field', field: 'time', icon: 'time' },
      ],
    },
    // The pet, through the reference: its current name, never an id. Inside a pet's Appointments tab, where
    // every card has the same pet, the platform leaves it out.
    { type: 'field', field: 'pet', icon: 'heart', variant: 'strong' },
    {
      type: 'row',
      justify: 'between',
      children: [
        { type: 'field', field: 'total', variant: 'strong' },
        { type: 'text', text: label('appointment.card.confirmed'), tone: 'success', hiddenWhen: 'confirmedByOwner != true' },
      ],
    },
    { type: 'actions', placement: 'hover' },
  ],
};

// ─── Appointment item ───────────────────────────────────────────────────────

/** Only the active packages of this appointment's pet, for this service. */
export const ACTIVE_PACKAGES_OF_PET_AND_SERVICE: OptionsFilterSpec = {
  where: [
    { path: 'pet', op: 'eq', value: { field: 'appointment.pet' } },
    { path: 'service', op: 'eq', value: { field: 'service' } },
    { path: 'status', op: 'eq', value: { literal: PACKAGE_ACTIVE } },
  ],
};

const ITEM_FIELDS: TemplateField[] = [
  {
    key: 'appointment',
    label: label('item.field.appointment'),
    type: 'reference',
    refEntity: APPOINTMENTS,
    required: true,
    order: 0,
  },
  {
    key: 'service',
    label: label('item.field.service'),
    type: 'reference',
    refEntity: SERVICES,
    required: true,
    order: 1,
    searchable: true,
    showInList: true,
  },
  {
    key: 'package',
    label: label('item.field.package'),
    type: 'reference',
    refEntity: PACKAGES,
    required: false,
    order: 2,
    showInList: true,
    optionsFilter: ACTIVE_PACKAGES_OF_PET_AND_SERVICE,
  },
  {
    key: 'price',
    label: label('item.field.price'),
    placeholder: label('item.field.price.placeholder'),
    type: 'currency',
    required: false,
    order: 3,
    showInList: true,
    logic: { validate: PRICE_NOT_NEGATIVE_RULE },
  },
  {
    key: 'requiresVaccines',
    label: label('item.field.requires-vaccines'),
    type: 'checkbox',
    required: false,
    order: 4,
    // A copy of the service's rule on the day it was booked, written by the automation below.
    hiddenInForm: true,
  },
];

// ─── Package ────────────────────────────────────────────────────────────────

export const CREDITS_POSITIVE_RULE = refuse('isEmpty(value) or value > 0', 'error.credits-positive');
export const EXPIRES_AFTER_PURCHASE_RULE = refuse(
  'isEmpty(value) or isEmpty(purchasedOn) or dateDiff(value, purchasedOn, "days") > 0',
  'error.package-expiry',
);
export const CREDITS_LEFT = 'if(isEmpty(credits), null, credits - coalesce(creditsUsed, 0))';

const PACKAGE_FIELDS: TemplateField[] = [
  { key: 'pet', label: label('package.field.pet'), type: 'reference', refEntity: PETS, required: true, order: 0 },
  {
    key: 'service',
    label: label('package.field.service'),
    type: 'reference',
    refEntity: SERVICES,
    required: true,
    order: 1,
    searchable: true,
    showInList: true,
  },
  {
    key: 'status',
    label: label('package.field.status'),
    type: 'select',
    lookupCollection: PACKAGE_STATUS_LIST,
    optionsColored: true,
    required: true,
    defaultValue: PACKAGE_ACTIVE,
    order: 2,
    filterable: true,
    showInList: true,
    // Moved by the automations, from the credits and the date.
    logic: { disabledWhen: 'true' },
  },
  {
    key: 'credits',
    label: label('package.field.credits'),
    type: 'number',
    required: true,
    order: 3,
    logic: { validate: CREDITS_POSITIVE_RULE },
  },
  {
    key: 'creditsUsed',
    label: label('package.field.credits-used'),
    type: 'number',
    required: false,
    order: 4,
    aggregation: { from: APPOINTMENT_ITEMS, via: 'package', op: 'count' },
  },
  {
    key: 'creditsLeft',
    label: label('package.field.credits-left'),
    type: 'number',
    required: false,
    order: 5,
    showInList: true,
    listIcon: 'coins',
    logic: { derive: CREDITS_LEFT },
  },
  { key: 'purchasedOn', label: label('package.field.purchased-on'), type: 'date', required: true, order: 6 },
  {
    key: 'expiresOn',
    label: label('package.field.expires-on'),
    type: 'date',
    required: false,
    order: 7,
    showInList: true,
    listIcon: 'calendarClose',
    logic: { validate: EXPIRES_AFTER_PURCHASE_RULE },
  },
  { key: 'price', label: label('package.field.price'), type: 'currency', required: false, order: 8, logic: { validate: PRICE_NOT_NEGATIVE_RULE } },
];

// ─── Buttons ────────────────────────────────────────────────────────────────

export const CANCEL_PERMISSION = `${APPOINTMENTS}.cancel`;
const UPDATE_PERMISSION = `${APPOINTMENTS}.update`;
const STAFF_ONLY = `not hasPermission("${UPDATE_PERMISSION}")`;

/**
 * The Check in button is greyed out while a booked service requires vaccines and the pet has an overdue
 * one. The same rule is the flow's own refusal, which also holds where the button is not drawn.
 */
export const VACCINES_BLOCK_CHECK_IN = 'coalesce(vaccineChecks, 0) > 0 and coalesce(pet.overdueVaccines, 0) > 0';

/** The same rule inside the flow, where the record is the `recordId` parameter, read as stored. */
export const VACCINES_REFUSE_CHECK_IN =
  'coalesce(event.recordId.vaccineChecks, 0) > 0 and coalesce(event.recordId.pet.overdueVaccines, 0) > 0';

const appointmentAction = (
  key: string,
  icon: string,
  order: number,
  extra: { disabledWhen: string; hiddenWhen?: string; confirmMessage?: string; danger?: boolean; promptParameters?: boolean },
): ActionModuleTemplate => ({
  templateId: `pet-appointment-${key}-action`,
  key,
  title: label(`action.${key}`),
  icon,
  workflowId: `pet-appointment-${key}`,
  order,
  enabled: true,
  danger: false,
  hiddenWhen: STAFF_ONLY,
  ...extra,
});

export const APPOINTMENT_ACTIONS: ActionModuleTemplate[] = [
  appointmentAction('approve', 'checkboxCircle', 0, { disabledWhen: `status != "${APPOINTMENT.requested}"` }),
  appointmentAction('confirm', 'thumbUp', 1, {
    // Offered to the owner in the portal too, so it is hidden — not just greyed — once it no longer applies.
    hiddenWhen: `status != "${APPOINTMENT.scheduled}" or confirmedByOwner == true`,
    disabledWhen: `status != "${APPOINTMENT.scheduled}" or confirmedByOwner == true`,
    confirmMessage: label('action.confirm.confirm'),
  }),
  appointmentAction('check-in', 'pulse', 2, {
    disabledWhen: `status != "${APPOINTMENT.scheduled}" or (${VACCINES_BLOCK_CHECK_IN})`,
  }),
  appointmentAction('ready', 'notification', 3, { disabledWhen: `status != "${APPOINTMENT.inService}"` }),
  appointmentAction('finish', 'flag', 4, {
    disabledWhen: `status != "${APPOINTMENT.ready}"`,
    confirmMessage: label('action.finish.confirm'),
  }),
  appointmentAction('cancel', 'closeCircle', 5, {
    hiddenWhen: `not hasPermission("${CANCEL_PERMISSION}")`,
    disabledWhen: `status != "${APPOINTMENT.requested}" and status != "${APPOINTMENT.scheduled}"`,
    danger: true,
    // Opens the flow's form, which asks for the reason.
    promptParameters: true,
  }),
];

const actionIds = (...keys: string[]) => keys.map((key) => `pet-appointment-${key}-action`);

// ─── Screens ────────────────────────────────────────────────────────────────

const APPOINTMENT_SCREEN: ScreenModuleTemplate = {
  key: APPOINTMENTS,
  sourceId: sourceIdOf(APPOINTMENTS),
  titleSingular: label('appointment.singular'),
  titlePlural: label('appointment.plural'),
  icon: 'calendarSchedule',
  // The number names the appointment: unique, given on creation, and plain text wherever a title is shown —
  // ⌘K, the portal, a link. The pet is a line of the card.
  titleFieldKey: 'number',
  subtitleFieldKey: 'scheduledOn',
  fields: APPOINTMENT_FIELDS,
  cardTemplate: APPOINTMENT_CARD,
  // The receipt is attached here when the pet is picked up (domain-model.json, entity.tabs).
  hasDocuments: true,
  // A tab of the pet, and `related` so appointments stay a top-level list with their own menu entry and
  // are found in ⌘K. The pet link is required, so the card offers Delete, never Unlink.
  parentEntity: PETS,
  parentFieldKey: 'pet',
  parentRelation: 'related',
  hideFromSidebar: true,
  // The quick gestures of the day on the card; every gesture in the open record.
  cardActionIds: actionIds('ready', 'finish'),
  viewActionIds: actionIds('approve', 'confirm', 'check-in', 'ready', 'finish', 'cancel'),
};

const ITEM_SCREEN: ScreenModuleTemplate = {
  key: APPOINTMENT_ITEMS,
  sourceId: sourceIdOf(APPOINTMENT_ITEMS),
  titleSingular: label('item.singular'),
  titlePlural: label('item.plural'),
  icon: 'priceTag',
  titleFieldKey: 'service',
  subtitleFieldKey: 'price',
  fields: ITEM_FIELDS,
  parentEntity: APPOINTMENTS,
  parentFieldKey: 'appointment',
  parentRelation: 'owned',
  hideFromSidebar: true,
  keys: [{ name: 'service', kind: 'unique', fields: ['service'], scope: 'parent', message: label('item.key.service') }],
};

const PACKAGE_SCREEN: ScreenModuleTemplate = {
  key: PACKAGES,
  sourceId: sourceIdOf(PACKAGES),
  titleSingular: label('package.singular'),
  titlePlural: label('package.plural'),
  icon: 'gift',
  titleFieldKey: 'service',
  subtitleFieldKey: 'status',
  fields: PACKAGE_FIELDS,
  parentEntity: PETS,
  parentFieldKey: 'pet',
  parentRelation: 'owned',
  hideFromSidebar: true,
};

export const APPOINTMENT_SCREENS: ScreenModuleTemplate[] = [SERVICE_SCREEN, APPOINTMENT_SCREEN, ITEM_SCREEN, PACKAGE_SCREEN];

/** The open appointments: what the shop still has to deal with. The badge and the list cut the same slice. */
export const OPEN_APPOINTMENT_STATUSES = [APPOINTMENT.requested, APPOINTMENT.scheduled, APPOINTMENT.inService, APPOINTMENT.ready];

export const APPOINTMENTS_NAV = nav({
  screen: APPOINTMENTS,
  label: label('appointment.plural'),
  icon: 'calendarSchedule',
  // After the dashboard (10), before Customers (20).
  order: 15,
  badge: { collection: APPOINTMENTS, when: OPEN_APPOINTMENT_STATUSES.map((status) => `status == "${status}"`).join(' or ') },
  filter: [{ key: 'status', values: [...OPEN_APPOINTMENT_STATUSES] }],
});

// ─── Automations: the price of each line ────────────────────────────────────

/**
 * The price of a line: free when paid with a package; otherwise the service's price when the line is new
 * without one, or when its service or package changed. A price someone typed is kept — that is a discount.
 */
export const ITEM_PRICE =
  'if(not isEmpty(event.package), 0, ' +
  'if(isEmpty(event.price) or (event.changeType == "updated" and (event.service != event.old.service or event.package != event.old.package)), ' +
  'event.service.price, event.price))';
export const ITEM_REQUIRES_VACCINES = 'event.service.requiresVaccines == true';

/** The second pass — fired by its own write — computes the same values and stops here. */
export const ITEM_SNAPSHOT_IS_WRONG = `${ITEM_PRICE} != event.price or ${ITEM_REQUIRES_VACCINES} != (event.requiresVaccines == true)`;

const ITEM_SNAPSHOT: WorkflowModuleTemplate = {
  templateId: 'pet-item-snapshot',
  name: label('workflow.item-snapshot'),
  description: label('workflow.item-snapshot.description'),
  eventName: `${APPOINTMENT_ITEMS}.saved`,
  version: 1,
  condition: { kind: 'Expression', expression: ITEM_SNAPSHOT_IS_WRONG },
  steps: writeRecord('line', APPOINTMENT_ITEMS, 0, [
    { name: 'id', value: { kind: 'Event', path: 'id' } },
    { name: 'price', value: { kind: 'Expression', expression: ITEM_PRICE } },
    { name: 'requiresVaccines', value: { kind: 'Expression', expression: ITEM_REQUIRES_VACCINES } },
  ]),
};

// ─── Automations: the buttons ───────────────────────────────────────────────

const recordParameter = {
  key: 'recordId',
  label: label('appointment.singular'),
  type: 'EntityReference' as const,
  entityType: APPOINTMENTS,
  required: true,
};

/** A flow a button fires. It runs only from the states it moves, read from the stored record. */
const buttonFlow = (
  key: string,
  from: string[],
  steps: WorkflowStep[],
  parameters: WorkflowModuleTemplate['parameters'] = [],
): WorkflowModuleTemplate => ({
  templateId: `pet-appointment-${key}`,
  name: label(`workflow.appointment-${key}`),
  description: label(`workflow.appointment-${key}.description`),
  eventName: 'workflow.called',
  version: 1,
  condition: { kind: 'Expression', expression: from.map((state) => `event.recordId.status == "${state}"`).join(' or ') },
  parameters: [recordParameter, ...(parameters ?? [])],
  steps,
});

const setStatus = (status: string, order: number, extra: MapStepConfig['fields'] = []): WorkflowStep[] =>
  writeRecord('appointment', APPOINTMENTS, order, [
    { name: 'id', value: { kind: 'Event', path: 'recordId' } },
    { name: 'status', value: { kind: 'Literal', value: status } },
    ...extra,
  ]);

/**
 * Where the appointment is in a flow's context: at the root of the event on a save or a date, under the
 * `recordId` parameter in a flow a button fires.
 */
type AppointmentRoot = 'event' | 'recordId';
const inExpression = (root: AppointmentRoot) => (root === 'event' ? 'event' : 'event.recordId');
const inEventPath = (root: AppointmentRoot, path: string) => (root === 'event' ? path : `recordId.${path}`);

/** The values every appointment message fills in — and the ones the organization may use in its own texts. */
export const appointmentParams = (root: AppointmentRoot) => {
  const at = inExpression(root);
  return `object("pet", ${at}.pet.name, "number", ${at}.number, "date", formatDate(${at}.scheduledOn, "DD/MM/YYYY"), "time", ${at}.time)`;
};

const notifyOwner = (id: string, order: number, root: AppointmentRoot, message: string): WorkflowStep =>
  condition(`${id}HasEmail`, order, `not isEmpty(${inExpression(root)}.pet.customer.email)`, [
    action(id, 'notify', 0, {
      title: { kind: 'Literal', value: label(`notify.${message}.title`) },
      message: { kind: 'Literal', value: label(`notify.${message}.message`) },
      messageParams: { kind: 'Expression', expression: appointmentParams(root) },
      // The customer's e-mail, declared `contact: 'email'` on the Customer screen: an unsubscribe link in
      // every message, and every send in the audit trail. The owner has no account, so no record link.
      recipientAddresses: { kind: 'Event', path: inEventPath(root, 'pet.customer.email') },
      toEmail: { kind: 'Literal', value: true },
      toInApp: { kind: 'Literal', value: false },
      toAudit: { kind: 'Literal', value: false },
      openRecord: { kind: 'Literal', value: false },
    }),
  ]);

export const RECEIPT_TEMPLATE = 'pet-appointment-receipt';

export const APPOINTMENT_BUTTON_FLOWS: WorkflowModuleTemplate[] = [
  buttonFlow('approve', [APPOINTMENT.requested], [...setStatus(APPOINTMENT.scheduled, 0), answer(2)]),
  buttonFlow('confirm', [APPOINTMENT.scheduled], [
    ...writeRecord('appointment', APPOINTMENTS, 0, [
      { name: 'id', value: { kind: 'Event', path: 'recordId' } },
      { name: 'confirmedByOwner', value: { kind: 'Literal', value: true } },
    ]),
    answer(2),
  ]),
  buttonFlow('check-in', [APPOINTMENT.scheduled], [
    // The record in hand already carries both numbers: the services that require vaccines (an aggregate
    // of its lines) and the pet's overdue vaccinations (an aggregate of the pet's doses). No query.
    condition('vaccinesOverdue', 0, VACCINES_REFUSE_CHECK_IN, refusal('refuseCheckIn', 'error.check-in-vaccines')),
    ...setStatus(APPOINTMENT.inService, 1),
    answer(3),
  ]),
  buttonFlow('ready', [APPOINTMENT.inService], [
    ...setStatus(APPOINTMENT.ready, 0),
    notifyOwner('tellOwnerReady', 2, 'recordId', 'appointment-ready'),
    answer(3),
  ]),
  buttonFlow('finish', [APPOINTMENT.ready], [
    ...setStatus(APPOINTMENT.done, 0),
    // The receipt, attached to the appointment's Documents tab and shared with the owner in the portal.
    action('receipt', 'render-document', 2, {
      templateKey: { kind: 'Literal', value: RECEIPT_TEMPLATE },
      recordId: { kind: 'Event', path: 'recordId' },
      destination: { kind: 'Literal', value: 'record' },
      output: { kind: 'Literal', value: 'pdf' },
      portalShared: { kind: 'Literal', value: true },
    }),
    answer(3),
  ]),
  buttonFlow(
    'cancel',
    [APPOINTMENT.requested, APPOINTMENT.scheduled],
    [...setStatus(APPOINTMENT.cancelled, 0, [{ name: 'cancelReason', value: { kind: 'Event', path: 'reason' } }]), answer(2)],
    [{ key: 'reason', label: label('appointment.field.cancel-reason'), type: 'String', required: true, rules: { validate: { maxLength: 200 } } }],
  ),
];

// ─── Automations: the portal and the clock ──────────────────────────────────

export const APPOINTMENT_REQUESTED_CATEGORY = 'appointment-requested';

/** An appointment the owner asked for in the portal waits for the shop to approve it. */
const REQUESTED_IN_PORTAL: WorkflowModuleTemplate = {
  templateId: 'pet-appointment-requested',
  name: label('workflow.appointment-requested'),
  description: label('workflow.appointment-requested.description'),
  eventName: `${APPOINTMENTS}.saved`,
  version: 1,
  condition: {
    kind: 'Expression',
    expression: `event.changeType == "created" and event.createdVia == "portal" and event.status == "${APPOINTMENT.scheduled}"`,
  },
  steps: [
    ...writeRecord('appointment', APPOINTMENTS, 0, [
      { name: 'id', value: { kind: 'Event', path: 'id' } },
      { name: 'status', value: { kind: 'Literal', value: APPOINTMENT.requested } },
    ]),
    action('tellStaff', 'notify', 2, {
      title: { kind: 'Literal', value: label('notify.appointment-requested.title') },
      message: { kind: 'Literal', value: label('notify.appointment-requested.message') },
      messageParams: { kind: 'Expression', expression: appointmentParams('event') },
      category: { kind: 'Literal', value: `${NAMESPACE}/${APPOINTMENT_REQUESTED_CATEGORY}` },
      recipientPermission: { kind: 'Literal', value: UPDATE_PERMISSION },
      toInApp: { kind: 'Literal', value: true },
      toAudit: { kind: 'Literal', value: false },
    }),
  ],
};

/** The evening before, the owner is reminded — only while the appointment still stands. */
const REMINDER_DAY_BEFORE: WorkflowModuleTemplate = {
  templateId: 'pet-appointment-reminder',
  name: label('workflow.appointment-reminder'),
  description: label('workflow.appointment-reminder.description'),
  eventName: `${APPOINTMENTS}.dateReached`,
  dateReached: { field: 'scheduledOn', offset: '-1d', at: '18:00' },
  version: 1,
  condition: { kind: 'Expression', expression: `event.status == "${APPOINTMENT.scheduled}"` },
  steps: [notifyOwner('remindOwner', 0, 'event', 'appointment-reminder')],
};

/** The day after, an appointment nobody checked in is a no-show. A clock moves records on; it never stops them. */
const NO_SHOW: WorkflowModuleTemplate = {
  templateId: 'pet-appointment-no-show',
  name: label('workflow.appointment-no-show'),
  description: label('workflow.appointment-no-show.description'),
  eventName: `${APPOINTMENTS}.dateReached`,
  dateReached: { field: 'scheduledOn', offset: '+1d', at: '00:10' },
  version: 1,
  condition: { kind: 'Expression', expression: `event.status == "${APPOINTMENT.scheduled}"` },
  steps: writeRecord('appointment', APPOINTMENTS, 0, [
    { name: 'id', value: { kind: 'Event', path: 'id' } },
    { name: 'status', value: { kind: 'Literal', value: APPOINTMENT.noShow } },
  ]),
};

// ─── Automations: the status of a package ───────────────────────────────────

/**
 * Used up when no credit is left; expired the day after its date; active otherwise. The credits used are an
 * aggregate the kernel recounts on every line written, and that recount saves the package — which is what
 * runs the flow on save below.
 */
export const PACKAGE_STATUS_FOR_TODAY =
  `if(coalesce(event.creditsUsed, 0) >= event.credits, "${PACKAGE_USED_UP}", ` +
  `if(not isEmpty(event.expiresOn) and dateDiff(event.expiresOn, today(), "days") < 0, "${PACKAGE_EXPIRED}", "${PACKAGE_ACTIVE}"))`;

const packageStatusSteps = () =>
  writeRecord('package', PACKAGES, 0, [
    { name: 'id', value: { kind: 'Event', path: 'id' } },
    { name: 'status', value: { kind: 'Expression', expression: PACKAGE_STATUS_FOR_TODAY } },
  ]);

const PACKAGE_STATUS_IS_WRONG = { kind: 'Expression' as const, expression: `${PACKAGE_STATUS_FOR_TODAY} != event.status` };

const PACKAGE_EXPIRES: WorkflowModuleTemplate = {
  templateId: 'pet-package-expires',
  name: label('workflow.package-expires'),
  description: label('workflow.package-expires.description'),
  eventName: `${PACKAGES}.dateReached`,
  dateReached: { field: 'expiresOn', offset: '+1d', at: '00:05' },
  version: 1,
  condition: PACKAGE_STATUS_IS_WRONG,
  steps: packageStatusSteps(),
};

const PACKAGE_STATUS_ON_SAVE: WorkflowModuleTemplate = {
  templateId: 'pet-package-status-on-save',
  name: label('workflow.package-status'),
  description: label('workflow.package-status.description'),
  eventName: `${PACKAGES}.saved`,
  version: 1,
  condition: PACKAGE_STATUS_IS_WRONG,
  steps: packageStatusSteps(),
};

export const APPOINTMENT_WORKFLOWS: WorkflowModuleTemplate[] = [
  ITEM_SNAPSHOT,
  ...APPOINTMENT_BUTTON_FLOWS,
  REQUESTED_IN_PORTAL,
  REMINDER_DAY_BEFORE,
  NO_SHOW,
  PACKAGE_EXPIRES,
  PACKAGE_STATUS_ON_SAVE,
];

export const APPOINTMENT_CONTRIBUTIONS: Contribution[] = [
  APPOINTMENTS_NAV,
  // Cancelling has a permission of its own: the organization gives it to whoever it trusts with it.
  accessPermissionContribution({
    id: CANCEL_PERMISSION,
    name: label('permission.cancel'),
    description: label('permission.cancel.description'),
    requires: [UPDATE_PERMISSION],
  }),
  notificationCategory({
    key: APPOINTMENT_REQUESTED_CATEGORY,
    title: label('notification.appointment-requested'),
    description: label('notification.appointment-requested.description'),
    icon: 'calendarEvent',
    variables: ['pet', 'number', 'date', 'time'],
  }),
];

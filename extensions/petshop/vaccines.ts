import type {
  Contribution,
  LookupModuleTemplate,
  QuerySpec,
  ScreenModuleTemplate,
  TemplateField,
  UpsertStepConfig,
  WorkflowModuleTemplate,
  WorkflowStep,
} from '@microteia/sdk';
import { notificationCategory } from '@microteia/sdk';
import {
  BATCH_AVAILABLE,
  BATCH_EXPIRED,
  BATCH_STATUSES,
  LABORATORIES,
  termMessageKey,
  VACCINATION_CURRENT,
  VACCINATION_OVERDUE,
  VACCINATION_RENEWED,
  VACCINATION_STATUSES,
} from './catalog';
import {
  BATCH_STATUS_LIST,
  LABORATORY_LIST,
  label,
  PETS,
  VACCINATION_STATUS_LIST,
  VACCINATIONS,
  VACCINE_BATCHES,
  VACCINES,
} from './collections';
import { NAMESPACE } from './messages';

/**
 * Vaccines — what the shop applies, each batch it buys, and each dose a pet receives.
 *
 * - **Vaccine** is the product (name, laboratory, what it protects against): a screen in the menu.
 * - **Batch** is one purchase of that product: a lot number unique within the vaccine, its dates and
 *   doses. A tab of the vaccine. Its status is `available` until the day after its expiry date, when the
 *   kernel clock turns it `expired` — and only available batches are offered for a vaccination.
 * - **Vaccination** is one dose applied to a pet: a tab of the pet. Its reminder date is the next dose
 *   minus "Remind (days before)" (2 unless changed on that vaccination), and on that day staff get an
 *   alert in the app and the owner an e-mail — unless the pet already took a later dose of that vaccine.
 *
 * Why the status is STORED and moved by automations, instead of compared with the expiry date where it
 * is used: a picker's filter compares with `eq`/`in`, never with a date, and a field rule reads only its
 * own record, so "not expired" has to be a value on the batch for the vaccination form to filter by it.
 */

// ─── Lists ──────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = { [BATCH_AVAILABLE]: 'success', [BATCH_EXPIRED]: 'danger' };
const VACCINATION_COLOR: Record<string, string> = {
  [VACCINATION_CURRENT]: 'success',
  [VACCINATION_OVERDUE]: 'danger',
  [VACCINATION_RENEWED]: 'secondary',
};

export const VACCINE_LOOKUPS: LookupModuleTemplate[] = [
  {
    collection: LABORATORY_LIST,
    label: label('lookup.laboratories'),
    seed: 'required',
    options: LABORATORIES.map((term) => ({ key: term.key, label: label(termMessageKey('laboratory', term.key)) })),
  },
  {
    collection: BATCH_STATUS_LIST,
    label: label('lookup.batch-statuses'),
    // `required`: the automations compare these keys, so they must exist in every organization.
    seed: 'required',
    options: BATCH_STATUSES.map((term) => ({
      key: term.key,
      label: label(termMessageKey('batch-status', term.key)),
      color: STATUS_COLOR[term.key],
    })),
  },
  {
    collection: VACCINATION_STATUS_LIST,
    label: label('lookup.vaccination-statuses'),
    // `required`: the automations and the pet's overdue count compare these keys.
    seed: 'required',
    options: VACCINATION_STATUSES.map((term) => ({
      key: term.key,
      label: label(termMessageKey('vaccination-status', term.key)),
      color: VACCINATION_COLOR[term.key],
    })),
  },
];

// ─── Field rules ────────────────────────────────────────────────────────────
// A rule returns the message that refuses the value, or null to accept it. Dates are compared through
// dateDiff (first minus second, in days): a stored date and today() are different shapes.

const refuse = (accepts: string, message: string): string => `if(${accepts}, null, "${label(message)}")`;

export const EXPIRY_AFTER_MANUFACTURE_RULE = refuse(
  'isEmpty(value) or isEmpty(manufacturedOn) or dateDiff(value, manufacturedOn, "days") > 0',
  'error.expiry-before-manufacture',
);
export const DOSES_POSITIVE_RULE = refuse('isEmpty(value) or value > 0', 'error.doses-positive');
export const APPLIED_NOT_FUTURE_RULE = refuse('isEmpty(value) or dateDiff(value, today(), "days") <= 0', 'error.applied-future');
export const NEXT_DOSE_AFTER_APPLIED_RULE = refuse(
  'isEmpty(value) or isEmpty(appliedOn) or dateDiff(value, appliedOn, "days") > 0',
  'error.next-dose-before-applied',
);
export const REMIND_DAYS_RULE = refuse('isEmpty(value) or (value >= 0 and value <= 60)', 'error.remind-days');

/** Days before the next dose the reminder goes out, when a vaccination does not say otherwise. */
export const DEFAULT_REMIND_DAYS = 2;

/**
 * Stored on save (`compute`), not derived on read: the kernel clock fires on a stored date. It reads only
 * this record, so it never goes stale — the next dose and the days before it are both here.
 */
export const REMIND_ON = `if(isEmpty(nextDoseOn), null, addDays(nextDoseOn, 0 - coalesce(remindDaysBefore, ${DEFAULT_REMIND_DAYS})))`;

/** Derived on read: the doses applied are recounted by the kernel, and a stored difference would lag it. */
export const DOSES_LEFT = 'if(isEmpty(dosesPurchased), null, dosesPurchased - coalesce(dosesApplied, 0))';

// ─── Vaccine ────────────────────────────────────────────────────────────────

const VACCINE_FIELDS: TemplateField[] = [
  { key: 'name', label: label('vaccine.field.name'), type: 'text', required: true, order: 0, searchable: true },
  {
    key: 'laboratory',
    label: label('vaccine.field.laboratory'),
    type: 'select',
    lookupCollection: LABORATORY_LIST,
    // A laboratory the list does not have yet is typed and added right there.
    optionsAllowUserAdd: true,
    required: true,
    order: 1,
    filterable: true,
    showInList: true,
  },
  {
    key: 'diseases',
    label: label('vaccine.field.diseases'),
    placeholder: label('vaccine.field.diseases.placeholder'),
    type: 'text',
    required: false,
    order: 2,
    searchable: true,
    showInList: true,
  },
  { key: 'notes', label: label('vaccine.field.notes'), type: 'textarea', required: false, order: 3 },
];

const VACCINE_SCREEN: ScreenModuleTemplate = {
  key: VACCINES,
  sourceId: 'br.com.microteia.petshop:pet_petshopVaccines',
  titleSingular: label('vaccine.singular'),
  titlePlural: label('vaccine.plural'),
  icon: 'medicineBottle',
  titleFieldKey: 'name',
  subtitleFieldKey: 'laboratory',
  // After Breeds (30).
  sidebarOrder: 35,
  fields: VACCINE_FIELDS,
  keys: [
    {
      name: 'name-laboratory',
      kind: 'unique',
      fields: ['laboratory', 'name'],
      normalize: { caseInsensitive: true },
      message: label('vaccine.key.name-laboratory'),
    },
  ],
};

// ─── Batch ──────────────────────────────────────────────────────────────────

const BATCH = label('batch.section.batch');
const STOCK = label('batch.section.stock');

const BATCH_FIELDS: TemplateField[] = [
  { key: 'lotNumber', label: label('batch.field.lot-number'), type: 'text', required: true, order: 0, section: BATCH, searchable: true },
  {
    key: 'vaccine',
    label: label('batch.field.vaccine'),
    type: 'reference',
    refEntity: VACCINES,
    required: true,
    order: 1,
    section: BATCH,
    searchable: true,
    filterable: true,
  },
  {
    key: 'status',
    label: label('batch.field.status'),
    type: 'select',
    lookupCollection: BATCH_STATUS_LIST,
    optionsColored: true,
    required: true,
    defaultValue: BATCH_AVAILABLE,
    order: 2,
    section: BATCH,
    filterable: true,
    showInList: true,
    // Moved only by the expiry date, through the automations below; a hand-picked status would be
    // overwritten on the next save anyway.
    logic: { disabledWhen: 'true' },
  },
  { key: 'manufacturedOn', label: label('batch.field.manufactured-on'), type: 'date', required: false, order: 3, section: BATCH },
  {
    key: 'expiryDate',
    label: label('batch.field.expiry-date'),
    type: 'date',
    required: true,
    order: 4,
    section: BATCH,
    showInList: true,
    listIcon: 'calendarClose',
    logic: { validate: EXPIRY_AFTER_MANUFACTURE_RULE },
  },
  { key: 'purchasedOn', label: label('batch.field.purchased-on'), type: 'date', required: false, order: 5, section: STOCK },
  {
    key: 'dosesPurchased',
    label: label('batch.field.doses-purchased'),
    type: 'number',
    required: false,
    order: 6,
    section: STOCK,
    logic: { validate: DOSES_POSITIVE_RULE },
  },
  {
    key: 'dosesApplied',
    label: label('batch.field.doses-applied'),
    type: 'number',
    required: false,
    order: 7,
    section: STOCK,
    aggregation: { from: VACCINATIONS, via: 'batch', op: 'count' },
  },
  {
    key: 'dosesLeft',
    label: label('batch.field.doses-left'),
    type: 'number',
    required: false,
    order: 8,
    section: STOCK,
    showInList: true,
    logic: { derive: DOSES_LEFT },
  },
];

const BATCH_SCREEN: ScreenModuleTemplate = {
  key: VACCINE_BATCHES,
  sourceId: 'br.com.microteia.petshop:pet_petshopVaccineBatches',
  titleSingular: label('batch.singular'),
  titlePlural: label('batch.plural'),
  icon: 'barcode',
  titleFieldKey: 'lotNumber',
  subtitleFieldKey: 'expiryDate',
  fields: BATCH_FIELDS,
  // A batch exists because of its vaccine: a tab there, no menu entry of its own.
  parentEntity: VACCINES,
  parentFieldKey: 'vaccine',
  parentRelation: 'owned',
  hideFromSidebar: true,
  keys: [
    {
      name: 'lot',
      kind: 'unique',
      fields: ['lotNumber'],
      scope: 'parent',
      normalize: { caseInsensitive: true },
      message: label('batch.key.lot'),
    },
  ],
};

// ─── Vaccination ────────────────────────────────────────────────────────────

const DOSE = label('vaccination.section.dose');
const NEXT_DOSE = label('vaccination.section.next-dose');
const NOTES = label('vaccination.section.notes');

/** Only the available batches of the vaccine chosen above. Changing the vaccine clears the batch. */
export const AVAILABLE_BATCHES_OF_VACCINE = {
  where: [
    { path: 'vaccine', op: 'eq' as const, value: { field: 'vaccine' } },
    { path: 'status', op: 'eq' as const, value: { literal: BATCH_AVAILABLE } },
  ],
};

const VACCINATION_FIELDS: TemplateField[] = [
  {
    key: 'pet',
    label: label('vaccination.field.pet'),
    type: 'reference',
    refEntity: PETS,
    required: true,
    order: 0,
    section: DOSE,
    searchable: true,
    filterable: true,
  },
  {
    key: 'vaccine',
    label: label('vaccination.field.vaccine'),
    type: 'reference',
    refEntity: VACCINES,
    required: true,
    order: 1,
    section: DOSE,
    searchable: true,
    filterable: true,
    showInList: true,
  },
  {
    key: 'batch',
    label: label('vaccination.field.batch'),
    type: 'reference',
    refEntity: VACCINE_BATCHES,
    required: true,
    order: 2,
    section: DOSE,
    searchable: true,
    optionsFilter: AVAILABLE_BATCHES_OF_VACCINE,
  },
  {
    key: 'appliedOn',
    label: label('vaccination.field.applied-on'),
    type: 'date',
    required: true,
    order: 3,
    section: DOSE,
    showInList: true,
    logic: { validate: APPLIED_NOT_FUTURE_RULE },
  },
  {
    key: 'veterinarian',
    label: label('vaccination.field.veterinarian'),
    type: 'text',
    required: false,
    order: 4,
    section: DOSE,
    searchable: true,
  },
  {
    key: 'nextDoseOn',
    label: label('vaccination.field.next-dose-on'),
    type: 'date',
    required: false,
    order: 5,
    section: NEXT_DOSE,
    showInList: true,
    listIcon: 'calendarSchedule',
    logic: { validate: NEXT_DOSE_AFTER_APPLIED_RULE },
  },
  {
    key: 'remindDaysBefore',
    label: label('vaccination.field.remind-days-before'),
    type: 'number',
    required: false,
    defaultValue: DEFAULT_REMIND_DAYS,
    order: 6,
    section: NEXT_DOSE,
    logic: { validate: REMIND_DAYS_RULE },
  },
  {
    key: 'remindOn',
    label: label('vaccination.field.remind-on'),
    type: 'date',
    required: false,
    order: 7,
    section: NEXT_DOSE,
    logic: { compute: REMIND_ON },
  },
  {
    key: 'status',
    label: label('vaccination.field.status'),
    type: 'select',
    lookupCollection: VACCINATION_STATUS_LIST,
    optionsColored: true,
    required: false,
    defaultValue: VACCINATION_CURRENT,
    order: 8,
    section: NEXT_DOSE,
    filterable: true,
    showInList: true,
    // Moved by the automations below — the next dose date and a later dose decide it.
    logic: { disabledWhen: 'true' },
  },
  {
    key: 'renewedBy',
    label: label('vaccination.field.renewed-by'),
    type: 'reference',
    refEntity: VACCINATIONS,
    required: false,
    order: 9,
    section: NEXT_DOSE,
    // Written by the later dose's automation; empty while the dose was not renewed.
    logic: { disabledWhen: 'true', hiddenWhen: 'isEmpty(renewedBy)' },
  },
  { key: 'notes', label: label('vaccination.field.notes'), type: 'textarea', required: false, order: 10, section: NOTES },
];

const VACCINATION_SCREEN: ScreenModuleTemplate = {
  key: VACCINATIONS,
  sourceId: 'br.com.microteia.petshop:pet_petshopVaccinations',
  titleSingular: label('vaccination.singular'),
  titlePlural: label('vaccination.plural'),
  icon: 'calendarCheck',
  titleFieldKey: 'vaccine',
  subtitleFieldKey: 'appliedOn',
  fields: VACCINATION_FIELDS,
  // A dose exists because of its pet: a tab of the pet, no menu entry of its own.
  parentEntity: PETS,
  parentFieldKey: 'pet',
  parentRelation: 'owned',
  hideFromSidebar: true,
};

export const VACCINE_SCREENS: ScreenModuleTemplate[] = [VACCINE_SCREEN, BATCH_SCREEN, VACCINATION_SCREEN];

// ─── Batch status: the expiry date decides it ───────────────────────────────

/** The status a batch should have today. The day after its expiry date it is expired. */
export const BATCH_STATUS_FOR_TODAY = `if(dateDiff(event.expiryDate, today(), "days") < 0, "${BATCH_EXPIRED}", "${BATCH_AVAILABLE}")`;

/**
 * Writes the status the expiry date asks for. The condition lets the run through only when the status
 * is wrong, so the write it makes — which publishes a save again — finds nothing left to do.
 */
const batchStatusSteps = (): WorkflowStep[] => [
  {
    id: 'statusForToday',
    stepDefinitionId: 'map',
    type: 'Action',
    order: 0,
    enabled: true,
    configuration: {
      map: {
        kind: 'Literal',
        value: {
          name: 'batch',
          fields: [
            { name: 'id', value: { kind: 'Event', path: 'id' } },
            { name: 'status', value: { kind: 'Expression', expression: BATCH_STATUS_FOR_TODAY } },
          ],
        },
      },
    },
  },
  {
    id: 'writeStatus',
    stepDefinitionId: 'upsert',
    type: 'Action',
    order: 1,
    enabled: true,
    configuration: {
      upsert: { kind: 'Literal', value: { table: VACCINE_BATCHES, source: 'input', property: 'batch' } satisfies UpsertStepConfig },
    },
  },
];

const STATUS_IS_WRONG = { kind: 'Expression' as const, expression: `${BATCH_STATUS_FOR_TODAY} != event.status` };

export const BATCH_EXPIRES_ON_DATE: WorkflowModuleTemplate = {
  templateId: 'pet-batch-expires',
  name: label('workflow.batch-expires'),
  description: label('workflow.batch-expires.description'),
  eventName: `${VACCINE_BATCHES}.dateReached`,
  // Just after midnight of the day after the expiry date: the batch can still be used on its last day.
  dateReached: { field: 'expiryDate', offset: '+1d', at: '00:05' },
  version: 1,
  condition: STATUS_IS_WRONG,
  steps: batchStatusSteps(),
};

/**
 * A batch registered already past its date, or whose date was corrected, gets the right status as soon
 * as it is saved — the clock fires once per date, and never for a date that already passed.
 */
export const BATCH_STATUS_ON_SAVE: WorkflowModuleTemplate = {
  templateId: 'pet-batch-status-on-save',
  name: label('workflow.batch-status'),
  description: label('workflow.batch-status.description'),
  eventName: `${VACCINE_BATCHES}.saved`,
  version: 1,
  condition: STATUS_IS_WRONG,
  steps: batchStatusSteps(),
};

// ─── Reminder of the next dose ──────────────────────────────────────────────

export const VACCINE_DUE_CATEGORY = 'vaccine-due';

/** The values the reminder texts fill in — and the ones the organization may use in its own templates. */
const REMINDER_PARAMS =
  'object("pet", event.pet.name, "customer", event.pet.customer.name, "vaccine", event.vaccine.name, "date", formatDate(event.nextDoseOn, "DD/MM/YYYY"))';

/**
 * A later dose of the same vaccine for the same pet means this reminder is already answered. Equalities
 * go to the database; the date is compared over what they found.
 */
export const LATER_DOSE: QuerySpec = {
  table: VACCINATIONS,
  where: [
    { path: 'pet', op: 'eq', value: { kind: 'Event', path: 'pet' } },
    { path: 'vaccine', op: 'eq', value: { kind: 'Event', path: 'vaccine' } },
    { path: 'appliedOn', op: 'gt', value: { kind: 'Event', path: 'appliedOn' } },
  ],
  limit: 1,
  projections: ['id'],
};

const notifyStaff: WorkflowStep = {
  id: 'notifyStaff',
  stepDefinitionId: 'notify',
  type: 'Action',
  order: 0,
  enabled: true,
  configuration: {
    title: { kind: 'Literal', value: label('notify.vaccine-due.title') },
    message: { kind: 'Literal', value: label('notify.vaccine-due.message') },
    messageParams: { kind: 'Expression', expression: REMINDER_PARAMS },
    category: { kind: 'Literal', value: `${NAMESPACE}/${VACCINE_DUE_CATEGORY}` },
    // Everyone who can see vaccinations; each person picks the channels for this type in Notifications.
    recipientPermission: { kind: 'Literal', value: `${VACCINATIONS}.read` },
    toInApp: { kind: 'Literal', value: true },
    toAudit: { kind: 'Literal', value: false },
  },
};

const notifyOwner: WorkflowStep = {
  id: 'notifyOwner',
  stepDefinitionId: 'notify',
  type: 'Action',
  order: 0,
  enabled: true,
  configuration: {
    title: { kind: 'Literal', value: label('notify.owner.title') },
    message: { kind: 'Literal', value: label('notify.owner.message') },
    messageParams: { kind: 'Expression', expression: REMINDER_PARAMS },
    // The customer's e-mail, declared `contact: 'email'` on the Customer screen. Every message carries an
    // unsubscribe link, and every send is written to the audit trail.
    recipientAddresses: { kind: 'Event', path: 'pet.customer.email' },
    toEmail: { kind: 'Literal', value: true },
    toInApp: { kind: 'Literal', value: false },
    toAudit: { kind: 'Literal', value: false },
    // The owner has no account: a link to the record would open nothing for them.
    openRecord: { kind: 'Literal', value: false },
  },
};

export const NEXT_DOSE_REMINDER: WorkflowModuleTemplate = {
  templateId: 'pet-vaccine-reminder',
  name: label('workflow.vaccine-reminder'),
  description: label('workflow.vaccine-reminder.description'),
  eventName: `${VACCINATIONS}.dateReached`,
  // `remindOn` already carries the days before, so the clock fires on the day itself.
  dateReached: { field: 'remindOn', offset: '0d', at: '08:00' },
  version: 1,
  condition: { kind: 'Expression', expression: `not isEmpty(event.nextDoseOn) and event.status != "${VACCINATION_RENEWED}"` },
  steps: [
    {
      id: 'laterDose',
      stepDefinitionId: 'query',
      type: 'Action',
      order: 0,
      enabled: true,
      configuration: { query: { kind: 'Literal', value: LATER_DOSE } },
    },
    {
      id: 'stillDue',
      stepDefinitionId: '',
      type: 'Condition',
      order: 1,
      enabled: true,
      configuration: {},
      condition: { kind: 'Expression', expression: 'output.laterDose.count == 0' },
      branches: {
        whenTrue: [
          notifyStaff,
          {
            id: 'ownerHasEmail',
            stepDefinitionId: '',
            type: 'Condition',
            order: 1,
            enabled: true,
            configuration: {},
            condition: { kind: 'Expression', expression: 'not isEmpty(event.pet.customer.email)' },
            branches: { whenTrue: [notifyOwner], whenFalse: [] },
          },
        ],
        whenFalse: [],
      },
    },
  ],
};

// ─── Vaccination status: current, overdue, renewed ──────────────────────────

/**
 * The status a dose should have today. Renewed wins: once a later dose exists, this one is answered. Then
 * overdue from the day after the next dose. A dose saved before this version has no status, and gets one
 * here the next time it is saved or its next dose arrives.
 */
export const VACCINATION_STATUS_FOR_TODAY =
  `if(not isEmpty(event.renewedBy), "${VACCINATION_RENEWED}", ` +
  `if(not isEmpty(event.nextDoseOn) and dateDiff(event.nextDoseOn, today(), "days") < 0, "${VACCINATION_OVERDUE}", "${VACCINATION_CURRENT}"))`;

const vaccinationStatusSteps = (): WorkflowStep[] => [
  {
    id: 'statusForToday',
    stepDefinitionId: 'map',
    type: 'Action',
    order: 0,
    enabled: true,
    configuration: {
      map: {
        kind: 'Literal',
        value: {
          name: 'dose',
          fields: [
            { name: 'id', value: { kind: 'Event', path: 'id' } },
            { name: 'status', value: { kind: 'Expression', expression: VACCINATION_STATUS_FOR_TODAY } },
          ],
        },
      },
    },
  },
  {
    id: 'writeStatus',
    stepDefinitionId: 'upsert',
    type: 'Action',
    order: 1,
    enabled: true,
    configuration: {
      upsert: { kind: 'Literal', value: { table: VACCINATIONS, source: 'input', property: 'dose' } satisfies UpsertStepConfig },
    },
  },
];

const VACCINATION_STATUS_IS_WRONG = { kind: 'Expression' as const, expression: `${VACCINATION_STATUS_FOR_TODAY} != event.status` };

/** The day after the next dose, a dose nobody renewed becomes overdue — and the pet's overdue count goes up. */
export const VACCINATION_OVERDUE_ON_DATE: WorkflowModuleTemplate = {
  templateId: 'pet-vaccination-overdue',
  name: label('workflow.vaccination-overdue'),
  description: label('workflow.vaccination-overdue.description'),
  eventName: `${VACCINATIONS}.dateReached`,
  dateReached: { field: 'nextDoseOn', offset: '+1d', at: '00:10' },
  version: 1,
  condition: VACCINATION_STATUS_IS_WRONG,
  steps: vaccinationStatusSteps(),
};

/** A dose registered late, whose date was corrected, or just renewed, gets its status as soon as it is saved. */
export const VACCINATION_STATUS_ON_SAVE: WorkflowModuleTemplate = {
  templateId: 'pet-vaccination-status-on-save',
  name: label('workflow.vaccination-status'),
  description: label('workflow.vaccination-status.description'),
  eventName: `${VACCINATIONS}.saved`,
  version: 1,
  condition: VACCINATION_STATUS_IS_WRONG,
  steps: vaccinationStatusSteps(),
};

/**
 * The earlier doses of the same vaccine for the same pet that are still waiting for this one. Equalities go
 * to the database; the date and the status are compared over what they found.
 */
export const EARLIER_DOSES: QuerySpec = {
  table: VACCINATIONS,
  where: [
    { path: 'pet', op: 'eq', value: { kind: 'Event', path: 'pet' } },
    { path: 'vaccine', op: 'eq', value: { kind: 'Event', path: 'vaccine' } },
    { path: 'appliedOn', op: 'lt', value: { kind: 'Event', path: 'appliedOn' } },
    { path: 'status', op: 'neq', value: { kind: 'Literal', value: VACCINATION_RENEWED } },
  ],
  limit: 100,
  projections: ['id'],
};

/**
 * A new dose renews the earlier ones: each is marked renewed, pointing at the dose that renewed it. The
 * write fires their own save, where the status is already right, so nothing cascades.
 */
export const RENEW_EARLIER_DOSES: WorkflowModuleTemplate = {
  templateId: 'pet-vaccination-renews',
  name: label('workflow.vaccination-renews'),
  description: label('workflow.vaccination-renews.description'),
  eventName: `${VACCINATIONS}.saved`,
  version: 1,
  condition: { kind: 'Expression', expression: 'event.changeType == "created"' },
  steps: [
    {
      id: 'earlierDoses',
      stepDefinitionId: 'query',
      type: 'Action',
      order: 0,
      enabled: true,
      configuration: { query: { kind: 'Literal', value: EARLIER_DOSES } },
    },
    {
      id: 'renewEach',
      stepDefinitionId: '',
      type: 'Loop',
      order: 1,
      enabled: true,
      configuration: {},
      loop: {
        source: { kind: 'Output', stepId: 'earlierDoses', outputId: 'results' },
        itemName: 'earlier',
        outputName: 'renewed',
        body: [
          {
            id: 'renewal',
            stepDefinitionId: 'map',
            type: 'Action',
            order: 0,
            enabled: true,
            configuration: {
              map: {
                kind: 'Literal',
                value: {
                  name: 'renewal',
                  fields: [
                    { name: 'id', value: { kind: 'Expression', expression: 'earlier.id' } },
                    { name: 'renewedBy', value: { kind: 'Event', path: 'id' } },
                    { name: 'status', value: { kind: 'Literal', value: VACCINATION_RENEWED } },
                  ],
                },
              },
            },
          },
          {
            id: 'writeRenewal',
            stepDefinitionId: 'upsert',
            type: 'Action',
            order: 1,
            enabled: true,
            configuration: {
              upsert: { kind: 'Literal', value: { table: VACCINATIONS, source: 'input', property: 'renewal' } satisfies UpsertStepConfig },
            },
          },
        ],
      },
    },
  ],
};

export const VACCINE_WORKFLOWS: WorkflowModuleTemplate[] = [
  BATCH_EXPIRES_ON_DATE,
  BATCH_STATUS_ON_SAVE,
  NEXT_DOSE_REMINDER,
  VACCINATION_OVERDUE_ON_DATE,
  VACCINATION_STATUS_ON_SAVE,
  RENEW_EARLIER_DOSES,
];

export const VACCINE_CONTRIBUTIONS: Contribution[] = [
  notificationCategory({
    key: VACCINE_DUE_CATEGORY,
    title: label('notification.vaccine-due'),
    description: label('notification.vaccine-due.description'),
    icon: 'calendarCheck',
    variables: ['pet', 'customer', 'vaccine', 'date'],
  }),
];

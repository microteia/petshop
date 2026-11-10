import type {
  AuthoredPlugin,
  CardTemplate,
  LookupModuleTemplate,
  ScreenModuleTemplate,
  ScreenSeedRecord,
  TemplateField,
} from '@microteia/sdk';
import { messageBundleContribution, nav } from '@microteia/sdk';
import { CAT_BREEDS, DOG_BREEDS, SEXES, SIZES, SPECIES, SPECIES_CAT, SPECIES_DOG, termMessageKey, type Term } from './catalog';
import { VACCINATION_OVERDUE } from './catalog';
import { BREEDS, CUSTOMER_TAGS, CUSTOMERS, label, PET_TAGS, PETS, SIZE_LIST, sourceIdOf, SPECIES_LIST, VACCINATIONS, WEIGHTS } from './collections';
import { MESSAGES, NAMESPACE } from './messages';
import { VACCINE_CONTRIBUTIONS, VACCINE_LOOKUPS, VACCINE_SCREENS, VACCINE_WORKFLOWS } from './vaccines';
import { APPOINTMENT_ACTIONS, APPOINTMENT_CONTRIBUTIONS, APPOINTMENT_LOOKUPS, APPOINTMENT_SCREENS, APPOINTMENT_WORKFLOWS } from './appointments';
import { DOCUMENT_CONTRIBUTIONS } from './documents';
import { INVITE_ACTION, INVITE_ACTION_ID, PORTAL_CONTRIBUTIONS, PORTAL_WORKFLOWS, withPortal } from './portal';
import { REPORT_CONTRIBUTIONS, REPORTS } from './reports';
import { CALENDAR_ACTIONS, CALENDAR_CONTRIBUTIONS, CALENDAR_WORKFLOWS } from './calendar';

/**
 * br.com.microteia.petshop — customers and their pets, and the pets' vaccines (vaccines.ts), the grooming
 * services, appointments and packages (appointments.ts), reports and cards on the Dashboard (reports.ts),
 * appointments and next doses on the Calendar (calendar.ts), the
 * vaccination card and the receipt (documents.ts), and the customer portal (portal.ts).
 *
 * The model lives beside this file in domain-model.json; read it before changing a field. Two decisions
 * there are worth knowing:
 *
 * - Breed is an ENTITY with a species, not an option list: the shop adds its own breeds of any species,
 *   and the pet has ONE breed field whose picker offers only the breeds of the pet's species
 *   (`optionsFilter`). The common dog and cat breeds arrive as seeded records.
 * - Age is DERIVED from the birth date on every read, never stored: stored, it would be the age on the
 *   day the record was saved, forever.
 *
 * The .json that "microteia-plugin build" produces from this file is what the platform installs.
 */

// ─── Collections ────────────────────────────────────────────────────────────

export {
  BREEDS,
  CUSTOMER_TAGS,
  CUSTOMERS,
  PET_TAGS,
  PETS,
  SIZE_LIST,
  SPECIES_LIST,
} from './collections';

// ─── Expressions ────────────────────────────────────────────────────────────

/** Whole months between the birth date and the organization's today. Empty without a birth date. */
const MONTHS_OLD =
  '((year(today()) - year(birthDate)) * 12 + month(today()) - month(birthDate) - if(day(today()) < day(birthDate), 1, 0))';

export const AGE_YEARS = `if(isEmpty(birthDate), null, floor(${MONTHS_OLD} / 12))`;
export const AGE_MONTHS = `if(isEmpty(birthDate), null, ${MONTHS_OLD} % 12)`;

/**
 * Compared in days through dateDiff, never with `<=`: a stored date reaches the expression as a Date
 * and today() as "YYYY-MM-DD", and a plain comparison between the two is never true.
 */
export const BIRTH_DATE_RULE = `if(isEmpty(value) or dateDiff(value, today(), "days") <= 0, null, "${label('error.birth-date-future')}")`;
export const EMAIL_RULE = `if(isEmpty(value) or isEmail(value), null, "${label('error.email')}")`;


// ─── Option lists ───────────────────────────────────────────────────────────

const options = (prefix: string, terms: Term[]) =>
  terms.map((term) => ({ key: term.key, label: label(termMessageKey(prefix, term.key)) }));

/**
 * `seed: 'required'`: a fresh install gets every option, and a later version that adds one brings it to
 * organizations that already have the list — without bringing back one the organization removed.
 */
const LOOKUPS: LookupModuleTemplate[] = [
  { collection: SPECIES_LIST, label: label('lookup.species'), seed: 'required', options: options('species', SPECIES) },
  { collection: SIZE_LIST, label: label('lookup.sizes'), seed: 'required', options: options('size', SIZES) },
];

/**
 * Two tag sets, not one: a customer is tagged "VIP" or "late payer", a pet "allergic" or "aggressive".
 * One shared list would offer each screen the other's words. The tags are the organization's — none seeded.
 */
const TAG_LISTS: LookupModuleTemplate[] = [
  { collection: CUSTOMER_TAGS, label: label('tags.customers') },
  { collection: PET_TAGS, label: label('tags.pets') },
];

// ─── Customer ───────────────────────────────────────────────────────────────

const CUSTOMER_FIELDS: TemplateField[] = [
  { key: 'name', label: label('customer.field.name'), type: 'text', required: true, order: 0, searchable: true },
  {
    key: 'phone',
    label: label('customer.field.phone'),
    type: 'text',
    required: false,
    order: 1,
    contact: 'phone',
    searchable: true,
    showInList: true,
    listIcon: 'phone',
  },
  {
    key: 'email',
    label: label('customer.field.email'),
    type: 'text',
    required: false,
    order: 2,
    contact: 'email',
    searchable: true,
    logic: { validate: EMAIL_RULE },
  },
  { key: 'notes', label: label('customer.field.notes'), type: 'textarea', required: false, order: 3 },
  {
    key: 'petCount',
    label: label('customer.field.pet-count'),
    type: 'number',
    required: false,
    order: 4,
    // Kept and still counted, but not shown: the customer's Pets tab already lists them.
    hiddenInForm: true,
    aggregation: { from: PETS, via: 'customer', op: 'count' },
  },
];

const CUSTOMER_SCREEN: ScreenModuleTemplate = {
  key: CUSTOMERS,
  sourceId: 'br.com.microteia.petshop:pet_petshopCustomers',
  titleSingular: label('customer.singular'),
  titlePlural: label('customer.plural'),
  icon: 'userHeart',
  titleFieldKey: 'name',
  subtitleFieldKey: 'phone',
  sidebarOrder: 20,
  fields: CUSTOMER_FIELDS,
  // The reasons are in domain-model.json (entity.tabs): a dated log, the customer's files, and labels.
  hasNotes: true,
  hasDocuments: true,
  hasTags: true,
  tagCollection: CUSTOMER_TAGS,
  viewActionIds: [INVITE_ACTION_ID],
};

// ─── Breed ──────────────────────────────────────────────────────────────────

const BREED_FIELDS: TemplateField[] = [
  { key: 'name', label: label('breed.field.name'), type: 'text', required: true, order: 0, searchable: true },
  {
    key: 'species',
    label: label('breed.field.species'),
    type: 'select',
    lookupCollection: SPECIES_LIST,
    // A species the list does not have yet is typed and added right there, from either form.
    optionsAllowUserAdd: true,
    required: true,
    order: 1,
    filterable: true,
    showInList: true,
  },
];

/** The seed key is `<species>.<breed>`: "mixed" is a dog breed and a cat breed, and they are two records. */
const breedSeeds = (species: string, terms: Term[]): ScreenSeedRecord[] =>
  terms.map((term) => ({ key: `${species}.${term.key}`, data: { name: term.en, species } }));

export const BREED_SEEDS: ScreenSeedRecord[] = [...breedSeeds(SPECIES_DOG, DOG_BREEDS), ...breedSeeds(SPECIES_CAT, CAT_BREEDS)];

const BREED_SCREEN: ScreenModuleTemplate = {
  key: BREEDS,
  sourceId: 'br.com.microteia.petshop:pet_petshopBreeds',
  titleSingular: label('breed.singular'),
  titlePlural: label('breed.plural'),
  icon: 'bookmark',
  titleFieldKey: 'name',
  subtitleFieldKey: 'species',
  sidebarOrder: 30,
  fields: BREED_FIELDS,
  // One "Labrador Retriever" per species, whatever the capitalisation.
  keys: [
    {
      name: 'species-name',
      kind: 'unique',
      fields: ['species', 'name'],
      normalize: { caseInsensitive: true },
      message: label('breed.key.species-name'),
    },
  ],
  /**
   * `required`: a fresh install gets every breed, and a later version that adds one delivers only the new
   * key to organizations that already have the extension. A breed the organization renamed or deleted is
   * never brought back.
   */
  seed: { mode: 'required', records: BREED_SEEDS },
};

// ─── Pet ────────────────────────────────────────────────────────────────────

/** On a reference, `path` is a field of the Breed screen and `value.field` a field of this form. */
export const BREED_BY_SPECIES = { where: [{ path: 'species', op: 'eq' as const, value: { field: 'species' } }] };

const IDENTIFICATION = label('pet.section.identification');

/** A photo of the animal: the common image formats, and small enough to load quickly on every card. */
export const PET_PHOTO_FILE = { extensions: ['jpg', 'jpeg', 'png', 'webp'], maxSizeMb: 5 };
const AGE = label('pet.section.age');
const HEALTH = label('pet.section.health');
const NOTES = label('pet.section.notes');
// Last, in a section of its own: the picture is already in the record's header, and a tall upload
// control in the middle of Identification would break its two-column pairs.
const PHOTO = label('pet.section.photo');

/** Which of the pet's vaccinations count as overdue. */
export const OVERDUE_FILTER = `status == "${VACCINATION_OVERDUE}"`;

const PET_FIELDS: TemplateField[] = [
  { key: 'name', label: label('pet.field.name'), type: 'text', required: true, order: 0, section: IDENTIFICATION, searchable: true },
  {
    key: 'customer',
    label: label('pet.field.customer'),
    type: 'reference',
    refEntity: CUSTOMERS,
    required: true,
    order: 1,
    section: IDENTIFICATION,
    searchable: true,
    filterable: true,
    showInList: true,
  },
  {
    key: 'species',
    label: label('pet.field.species'),
    type: 'select',
    lookupCollection: SPECIES_LIST,
    // A species the list does not have yet is typed and added right there, from either form.
    optionsAllowUserAdd: true,
    required: true,
    order: 2,
    section: IDENTIFICATION,
    filterable: true,
    showInList: true,
  },
  {
    key: 'breed',
    label: label('pet.field.breed'),
    type: 'reference',
    refEntity: BREEDS,
    required: false,
    order: 3,
    section: IDENTIFICATION,
    filterable: true,
    showInList: true,
    // Only the breeds of the pet's species; changing the species clears a breed it no longer offers.
    optionsFilter: BREED_BY_SPECIES,
  },
  {
    key: 'sex',
    label: label('pet.field.sex'),
    type: 'select',
    options: options('sex', SEXES),
    required: false,
    order: 4,
    section: IDENTIFICATION,
    filterable: true,
  },
  {
    key: 'size',
    label: label('pet.field.size'),
    type: 'select',
    lookupCollection: SIZE_LIST,
    required: false,
    order: 5,
    section: IDENTIFICATION,
    filterable: true,
    showInList: true,
  },
  {
    key: 'birthDate',
    label: label('pet.field.birth-date'),
    type: 'date',
    required: false,
    order: 6,
    section: AGE,
    logic: { validate: BIRTH_DATE_RULE },
  },
  { key: 'ageYears', label: label('pet.field.age-years'), type: 'number', required: false, order: 7, section: AGE, logic: { derive: AGE_YEARS } },
  { key: 'ageMonths', label: label('pet.field.age-months'), type: 'number', required: false, order: 8, section: AGE, logic: { derive: AGE_MONTHS } },
  {
    key: 'currentWeightKg',
    label: label('pet.field.current-weight'),
    type: 'number',
    required: false,
    order: 9,
    section: HEALTH,
    // The weight of the most recent weighing — the kernel picks it again whenever a weighing is written.
    aggregation: { from: WEIGHTS, via: 'pet', op: 'latest', field: 'weightKg', orderBy: [{ path: 'measuredOn', dir: 'desc' }] },
  },
  {
    key: 'weighedOn',
    label: label('pet.field.weighed-on'),
    type: 'date',
    required: false,
    order: 10,
    section: HEALTH,
    aggregation: { from: WEIGHTS, via: 'pet', op: 'latest', field: 'measuredOn', orderBy: [{ path: 'measuredOn', dir: 'desc' }] },
  },
  {
    key: 'overdueVaccines',
    label: label('pet.field.overdue-vaccines'),
    type: 'number',
    required: false,
    order: 11,
    section: HEALTH,
    // Read by the card and by the appointment's Check in button.
    aggregation: { from: VACCINATIONS, via: 'pet', op: 'count', filter: OVERDUE_FILTER },
  },
  { key: 'notes', label: label('pet.field.notes'), type: 'textarea', required: false, order: 12, section: NOTES },
  {
    key: 'photo',
    label: label('pet.field.photo'),
    type: 'file',
    required: false,
    order: 13,
    section: PHOTO,
    // Images only: the field is the card's avatar (`imageFieldKey`), and anything else would draw nothing.
    file: PET_PHOTO_FILE,
  },
];

/**
 * The pet card: who it is, its breed, whose pet it is, and its size and sex as badges. The values read
 * clearly without labels. The customer is the reference itself, so the card shows the customer's current
 * name — never a copy — and inside a customer's Pets tab, where every pet has the same owner, the
 * platform leaves it out.
 */
/** True for 0, for an empty count and for a count that arrives as text — only a positive count shows it. */
export const NO_OVERDUE_VACCINE = 'not (overdueVaccines > 0)';

export const PET_CARD: CardTemplate = {
  body: [
    {
      type: 'row',
      children: [
        { type: 'avatar', size: 'sm' },
        { type: 'stack', gap: 'xs', children: [{ type: 'title' }, { type: 'subtitle' }] },
      ],
    },
    { type: 'field', field: 'breed', variant: 'strong' },
    { type: 'field', field: 'customer', icon: 'user', variant: 'muted' },
    {
      type: 'row',
      wrap: true,
      children: [
        { type: 'field', field: 'size', variant: 'badge' },
        { type: 'field', field: 'sex', variant: 'badge' },
        { type: 'field', field: 'currentWeightKg', icon: 'scales', variant: 'muted' },
      ],
    },
    // Only when a vaccine is overdue. The condition sits on every node of the row as well as on the row:
    // the card showed "0 overdue" with it on the row alone.
    {
      type: 'row',
      hiddenWhen: NO_OVERDUE_VACCINE,
      children: [
        { type: 'icon', icon: 'alarmWarning', tone: 'danger', hiddenWhen: NO_OVERDUE_VACCINE },
        { type: 'field', field: 'overdueVaccines', variant: 'strong', hiddenWhen: NO_OVERDUE_VACCINE },
        { type: 'text', text: label('pet.card.overdue-vaccines'), tone: 'danger', hiddenWhen: NO_OVERDUE_VACCINE },
      ],
    },
    { type: 'actions', placement: 'hover' },
  ],
};

const PET_SCREEN: ScreenModuleTemplate = {
  key: PETS,
  sourceId: 'br.com.microteia.petshop:pet_petshopPets',
  titleSingular: label('pet.singular'),
  titlePlural: label('pet.plural'),
  icon: 'heart',
  titleFieldKey: 'name',
  subtitleFieldKey: 'species',
  // The card's avatar is the pet's photo; without one, the screen icon.
  imageFieldKey: 'photo',
  fields: PET_FIELDS,
  cardTemplate: PET_CARD,
  // The reasons are in domain-model.json (entity.tabs): visit observations, vaccination cards, labels.
  hasNotes: true,
  hasDocuments: true,
  hasTags: true,
  tagCollection: PET_TAGS,
  // A pet is a tab of its customer, and `related`, not `owned`: the platform keeps an owned child out of
  // the command palette (⌘K) and gives no setting to bring it back, and pets must be found by name there.
  // The owner field is required, so the card still offers Delete, never Unlink. The sidebar entry is the
  // explicit nav() in the manifest, so it does not depend on the relation.
  parentEntity: CUSTOMERS,
  parentFieldKey: 'customer',
  parentRelation: 'related',
  hideFromSidebar: true,
};

// ─── Weight ─────────────────────────────────────────────────────────────────

export const WEIGHT_RULE = `if(isEmpty(value) or (value > 0 and value < 200), null, "${label('error.weight')}")`;
export const MEASURED_NOT_FUTURE_RULE = `if(isEmpty(value) or dateDiff(value, today(), "days") <= 0, null, "${label('error.measured-future')}")`;

export const WEIGHT_SUMMARY =
  'if(isEmpty(measuredOn) or isEmpty(weightKg), null, concat(formatDate(measuredOn, "DD/MM/YYYY"), " · ", weightKg, " kg"))';

const WEIGHT_FIELDS: TemplateField[] = [
  { key: 'pet', label: label('weight.field.pet'), type: 'reference', refEntity: PETS, required: true, order: 0 },
  {
    key: 'measuredOn',
    label: label('weight.field.measured-on'),
    type: 'date',
    required: true,
    order: 1,
    showInList: true,
    logic: { validate: MEASURED_NOT_FUTURE_RULE },
  },
  {
    key: 'weightKg',
    label: label('weight.field.weight'),
    type: 'number',
    required: true,
    order: 2,
    showInList: true,
    listIcon: 'scales',
    logic: { validate: WEIGHT_RULE },
  },
  { key: 'notes', label: label('weight.field.notes'), type: 'textarea', required: false, order: 3 },
  {
    key: 'summary',
    label: label('weight.field.summary'),
    type: 'text',
    required: false,
    order: 4,
    // The record's name — "10/11/2026 · 3 kg". The platform names a record by a text or a reference field,
    // never by a date, so a weighing titled by its date read "Untitled". Computed on save from this record.
    hiddenInForm: true,
    logic: { compute: WEIGHT_SUMMARY },
  },
];

/** The weighing card: the day and the weight, each drawn by its own field — never a copied text. */
export const WEIGHT_CARD: CardTemplate = {
  body: [
    {
      type: 'row',
      justify: 'between',
      children: [
        { type: 'field', field: 'measuredOn', icon: 'calendar', variant: 'strong' },
        { type: 'field', field: 'weightKg', icon: 'scales', variant: 'strong', label: true },
      ],
    },
    { type: 'field', field: 'notes', variant: 'muted' },
    { type: 'actions', placement: 'hover' },
  ],
};

const WEIGHT_SCREEN: ScreenModuleTemplate = {
  key: WEIGHTS,
  sourceId: sourceIdOf(WEIGHTS),
  titleSingular: label('weight.singular'),
  titlePlural: label('weight.plural'),
  icon: 'scales',
  titleFieldKey: 'summary',
  subtitleFieldKey: 'notes',
  fields: WEIGHT_FIELDS,
  cardTemplate: WEIGHT_CARD,
  // A weighing exists because of its pet: a tab of the pet, no menu entry.
  parentEntity: PETS,
  parentFieldKey: 'pet',
  parentRelation: 'owned',
  hideFromSidebar: true,
};

/** The Pets list in the menu. `screen`, never `key`: a screen's key is not a tab key. */
export const PETS_NAV = nav({ screen: PETS, label: label('pet.plural'), icon: 'heart', order: 25 });

// ─── Package ────────────────────────────────────────────────────────────────

export const petshopPlugin: AuthoredPlugin = {
  manifest: {
    id: NAMESPACE,
    version: '3.7.3',
    kernel: '^2.106.0',
    name: label('extension.name'),
    description: label('extension.description'),
    publisher: { name: 'Microteia' },
    icon: 'userHeart',
    // The start of every name this extension creates. The gate checks it, and it never changes.
    prefix: 'pet',
    /**
     * The Calendar keeps its items in its own `calendar` collection, and this package writes them: that
     * collection has to exist, so Calendar is declared. The Dashboard needs no declaration — a surface is
     * a name, and its cards simply have nowhere to appear without it.
     */
    dependencies: { 'com.microteia.calendar': { version: '^1.8.0', collections: ['calendar'] } },
    contributes: [
      ...MESSAGES.map((bundle) => messageBundleContribution(bundle)),
      // Every pet of every customer, between Customers (20) and Breeds (30).
      PETS_NAV,
      ...VACCINE_CONTRIBUTIONS,
      ...APPOINTMENT_CONTRIBUTIONS,
      ...REPORT_CONTRIBUTIONS,
      ...DOCUMENT_CONTRIBUTIONS,
      ...PORTAL_CONTRIBUTIONS,
      ...CALENDAR_CONTRIBUTIONS,
    ],
  },
  summary: label('extension.summary'),
  screens: withPortal([CUSTOMER_SCREEN, PET_SCREEN, BREED_SCREEN, WEIGHT_SCREEN, ...VACCINE_SCREENS, ...APPOINTMENT_SCREENS]),
  lookups: [...LOOKUPS, ...VACCINE_LOOKUPS, ...APPOINTMENT_LOOKUPS],
  tagLists: TAG_LISTS,
  workflows: [...VACCINE_WORKFLOWS, ...APPOINTMENT_WORKFLOWS, ...PORTAL_WORKFLOWS, ...CALENDAR_WORKFLOWS],
  actions: [...APPOINTMENT_ACTIONS, INVITE_ACTION, ...CALENDAR_ACTIONS],
  reports: REPORTS,
};

export default petshopPlugin;

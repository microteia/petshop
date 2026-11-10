import type {
  ActionModuleTemplate,
  Contribution,
  MapStepConfig,
  ScreenModuleTemplate,
  WorkflowModuleTemplate,
} from '@microteia/sdk';
import { portalWidgetSpec } from '@microteia/sdk';
import { APPOINTMENT, VACCINATION_OVERDUE } from './catalog';
import {
  APPOINTMENT_ITEMS,
  APPOINTMENTS,
  CUSTOMERS,
  label,
  PACKAGES,
  PETS,
  VACCINATIONS,
  WEIGHTS,
} from './collections';

/**
 * The customer portal — what the owner of a pet sees from outside the shop.
 *
 * The CUSTOMER is the subject: an owner is invited to their own customer record and, through it, reaches
 * their pets (`parent`) and, through each pet, its vaccinations, weighings, packages and appointments
 * (`parent` again). Each screen says which fields LEAVE the shop — nothing else does: no notes, no tags,
 * no cancel reason, no internal count.
 *
 * What the owner may do there is declared too: request an appointment (`create`), confirm one (the
 * Confirm button, `actions`) and open the documents the shop shared — the vaccination card and the
 * receipts. A vaccine or a service is shown by its NAME only (`referenceTitles`): the catalogs themselves
 * stay inside.
 *
 * This whole file is the answer to "what does the portal expose?". The declarations are applied to the
 * screens by `withPortal`, so nothing about the portal is scattered elsewhere.
 */

type PortalDeclaration = NonNullable<ScreenModuleTemplate['portal']>;

export const PORTAL: Record<string, PortalDeclaration> = {
  [CUSTOMERS]: {
    subject: 'self',
    fields: ['name', 'phone', 'email'],
    // The Invite to the portal button below runs `portal-invite`; only the 'self' screen opens that door.
    invites: { automation: true },
  },
  [PETS]: {
    subject: 'parent',
    fields: ['name', 'species', 'breed', 'sex', 'size', 'birthDate', 'photo', 'currentWeightKg', 'weighedOn', 'overdueVaccines'],
    referenceTitles: ['breed'],
    // The vaccination card, once the shop shares it from the pet's Documents tab.
    documents: true,
  },
  [VACCINATIONS]: {
    subject: 'parent',
    fields: ['vaccine', 'appliedOn', 'nextDoseOn', 'status'],
    referenceTitles: ['vaccine'],
  },
  [WEIGHTS]: { subject: 'parent', fields: ['measuredOn', 'weightKg'] },
  [PACKAGES]: {
    subject: 'parent',
    fields: ['service', 'status', 'credits', 'creditsUsed', 'expiresOn'],
    referenceTitles: ['service'],
  },
  [APPOINTMENTS]: {
    subject: 'parent',
    fields: ['number', 'scheduledOn', 'time', 'status', 'total', 'confirmedByOwner', 'notes'],
    // The receipt, shared by the Finish button.
    documents: true,
    // A request: the day, the time and what the owner would like. The pet is set by the server from the
    // pet it is created under, and the shop's automation turns it into "Requested" for the staff to approve.
    create: { fields: ['scheduledOn', 'time', 'notes'] },
    actions: ['confirm'],
  },
  [APPOINTMENT_ITEMS]: { subject: 'parent', fields: ['service', 'price'], referenceTitles: ['service'] },
};

export const withPortal = (screens: ScreenModuleTemplate[]): ScreenModuleTemplate[] =>
  screens.map((screen) => (PORTAL[screen.key] ? { ...screen, portal: PORTAL[screen.key] } : screen));

// ─── Inviting the owner ─────────────────────────────────────────────────────

const INVITE_WORKFLOW = 'pet-customer-invite';

/**
 * Invites the customer's e-mail to the portal, to this customer record. Pressing it twice is one invitation:
 * nothing is written and no second e-mail goes out.
 */
const INVITE: WorkflowModuleTemplate = {
  templateId: INVITE_WORKFLOW,
  name: label('workflow.customer-invite'),
  description: label('workflow.customer-invite.description'),
  eventName: 'workflow.called',
  version: 1,
  condition: { kind: 'Expression', expression: 'not isEmpty(event.recordId.email)' },
  parameters: [{ key: 'recordId', label: label('customer.singular'), type: 'EntityReference', entityType: CUSTOMERS, required: true }],
  steps: [
    {
      id: 'invite',
      stepDefinitionId: 'portal-invite',
      type: 'Action',
      order: 0,
      enabled: true,
      configuration: {
        subjectCollection: { kind: 'Literal', value: CUSTOMERS },
        subjectRecordId: { kind: 'Event', path: 'recordId' },
        email: { kind: 'Expression', expression: 'event.recordId.email' },
        displayName: { kind: 'Expression', expression: 'event.recordId.name' },
      },
    },
    {
      id: 'answer',
      stepDefinitionId: 'map',
      type: 'Action',
      order: 1,
      enabled: true,
      configuration: {
        map: {
          kind: 'Literal',
          value: {
            fields: [
              { name: 'status', value: { kind: 'Literal', value: 'SUCCESS' } },
              { name: 'actions', value: { kind: 'Literal', value: ['refresh'] } },
            ],
          } satisfies MapStepConfig,
        },
      },
    },
  ],
};

export const INVITE_ACTION_ID = 'pet-customer-invite-action';

export const INVITE_ACTION: ActionModuleTemplate = {
  templateId: INVITE_ACTION_ID,
  key: 'invite-portal',
  title: label('action.invite-portal'),
  icon: 'mailSend',
  workflowId: INVITE_WORKFLOW,
  order: 0,
  enabled: true,
  danger: false,
  hiddenWhen: `not hasPermission("${CUSTOMERS}.update")`,
  disabledWhen: 'isEmpty(email)',
  confirmMessage: label('action.invite-portal.confirm'),
};

export const PORTAL_WORKFLOWS: WorkflowModuleTemplate[] = [INVITE];

// ─── The portal home ────────────────────────────────────────────────────────

export const UPCOMING = `status == "${APPOINTMENT.requested}" or status == "${APPOINTMENT.scheduled}" or status == "${APPOINTMENT.ready}"`;
export const OVERDUE = `status == "${VACCINATION_OVERDUE}"`;

export const PORTAL_CONTRIBUTIONS: Contribution[] = [
  portalWidgetSpec({ key: 'pet-upcoming', title: label('portal.upcoming'), order: 10 }, {
    body: [
      {
        type: 'records',
        collection: APPOINTMENTS,
        when: UPCOMING,
        orderBy: { field: 'scheduledOn', direction: 'asc' },
        limit: 5,
        empty: label('portal.upcoming.empty'),
        card: [
          { type: 'row', justify: 'between', children: [{ type: 'title' }, { type: 'field', field: 'status', variant: 'badge' }] },
          {
            type: 'row',
            children: [
              { type: 'field', field: 'scheduledOn', icon: 'calendar' },
              { type: 'field', field: 'time', icon: 'time' },
            ],
          },
        ],
      },
    ],
  }),
  portalWidgetSpec({ key: 'pet-overdue', title: label('portal.overdue'), order: 20 }, {
    body: [
      {
        type: 'row',
        gap: 'sm',
        children: [
          { type: 'count', collection: VACCINATIONS, when: OVERDUE, tone: 'danger' },
          { type: 'text', text: label('portal.overdue.caption'), tone: 'muted' },
        ],
      },
      {
        type: 'records',
        collection: VACCINATIONS,
        when: OVERDUE,
        orderBy: { field: 'nextDoseOn', direction: 'asc' },
        limit: 5,
        card: [
          { type: 'row', justify: 'between', children: [{ type: 'title' }, { type: 'field', field: 'nextDoseOn', icon: 'calendarClose' }] },
        ],
      },
    ],
  }),
];

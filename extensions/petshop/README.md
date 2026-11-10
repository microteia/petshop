# br.com.microteia.petshop — Pet Shop

A small, complete pet shop system, built to **study and demonstrate the Microteia platform**. It covers what
real pet shop software does — customers and pets, vaccines, bath and grooming appointments, packages, reports,
documents and a portal for the owners. Every piece is a **declaration**: no React views and no Cloud Functions.

It also shows how extensions **compose**. Pet Shop owns no dashboard and no agenda: it puts its cards on the
office **Dashboard** (`com.microteia.dashboard`) and its appointments and vaccines on the office **Calendar**
(`com.microteia.calendar`), the same way any other extension does.

## The business

A pet shop takes care of other people's animals. Its day revolves around three questions: *who is this animal
and who owns it*, *is it healthy enough to be handled*, and *what did we do to it, for how much*.

### Who uses it

| Person | What they do |
|---|---|
| **Reception** | Registers customers and pets, books appointments on the Calendar, checks pets in and out, sells packages |
| **Groomer / vet** | Sees the day's appointments, records vaccines and weight, marks a pet ready for pickup |
| **Manager** | Cancels appointments (a permission of its own), follows revenue and services on the Dashboard |
| **Pet owner** | Outside the shop: uses the **portal** to follow their pets, request and confirm visits, and download receipts and the vaccination card |

### A day in the shop

1. **Booking.** The owner calls, or requests a visit in the portal. Reception books an **appointment** for the
   pet on a day and time, with one or more **services** (bath, grooming, nail trim…). A request from the
   portal arrives as *Requested* and alerts the staff, who **Approve** it. Every appointment appears on the
   **Calendar**, and dragging it to another day **reschedules** it. The owner is then asked to confirm again.
2. **The evening before**, the owner gets an e-mail reminder and can **Confirm** in the portal.
3. **Arrival.** Reception presses **Check in**. If a booked service requires vaccines up to date (a bath does,
   a nail trim does not) and the pet has an **overdue vaccine**, the check-in is refused. A shop that
   handles many animals in one room cannot risk a contagion.
4. **Service.** The groomer works, may record the pet's **weight**, then presses **Ready for pickup**. The
   owner gets an e-mail: "Rex is ready".
5. **Pickup.** **Finish** closes the visit and attaches the **receipt** PDF, which the owner also sees in the
   portal. The total is the sum of the prices charged *that day*. A later price change never rewrites a
   past visit.
6. **Nobody came?** The next day the appointment becomes a **No-show** on its own. A cancelled appointment
   always says why.

### Health: vaccines

The shop registers the **vaccines** it applies and each **batch** it buys (lot number, expiry date, doses). A
batch past its expiry date is no longer offered. Each dose given to a pet is a **vaccination**, with the date
of the next dose:

- 2 days before the next dose (configurable), the staff get an alert and the owner an e-mail.
- From the day after the next dose, the vaccination is **Overdue**, and the pet shows "1 overdue vaccine" on
  its card.
- Registering the next dose marks the earlier one **Renewed**, and records which dose renewed it.

Every next dose also appears on the **Calendar**: yellow while it is coming, critical once it is overdue,
closed once it is renewed. Reception sees the week's vaccines next to the week's baths.

From any pet, **Generate document → Vaccination card** produces a PDF with every dose.

### Money: services and packages

Each **service** has a price and a duration, and the common ones come preloaded. Owners who come often buy a
**package**, for example "4 baths" for a better price. An appointment service paid with a package costs
nothing and uses one credit. The package shows the credits left, becomes **Used up** at zero, and
**Expires** on its date. Only the pet's active packages for that service are offered.

### The numbers

Pet Shop adds four cards to the office **Dashboard**, the screen that opens when someone enters the
organization: revenue by month (with the average ticket), the most requested services, pets by species, and
the vaccines due in the next 30 days with the owner's phone, so someone can call them. The office chooses
which cards appear, in what order and at what width (Settings › Dashboard). **Appointments by status** is in
Reports, to watch no-shows and cancellations.

### Not covered, on purpose

To stay simple: hotel and daycare (kennel capacity), product stock, point of sale and payments. **Overlapping
appointments are allowed.** A rule like "one groomer cannot have two visits at the same time" compares
time *ranges*, and a declared key only compares exact values. That is a platform gap, not a pet shop one,
and it is written down here rather than faked.

## What lives where

| Screen | In the menu | Inside |
|---|---|---|
| **Dashboard** *(Dashboard extension)* | yes, the start page | four Pet Shop cards, among the other extensions' |
| **Calendar** *(Calendar extension)* | yes | every appointment and every next dose, draggable to reschedule |
| **Appointments** | yes, with a badge counting open ones | a tab of the pet. Lines (services) are a tab of the appointment, plus a Documents tab with the receipt |
| **Customers** | yes | Pets, Notes, Documents and Tags tabs, and an *Invite to the portal* button |
| **Pets** | yes | Vaccinations, Appointments, Packages, Weight history, Notes, Documents and Tags tabs |
| **Services** | yes | seeded with 7 common services |
| **Breeds** | yes | seeded with common dog and cat breeds |
| **Vaccines** | yes | a Batches tab |

| File | What it holds |
|---|---|
| `plugin.ts` | customers, pets, breeds, weight, and the package that puts everything together |
| `vaccines.ts` | vaccines, batches, vaccinations, their statuses and reminders |
| `appointments.ts` | services, appointments, lines, packages, the buttons and their flows |
| `reports.ts` | the five reports, and four of them as cards on the Dashboard |
| `calendar.ts` | appointments and next doses on the Calendar, and rescheduling by dragging |
| `documents.ts` | the vaccination card and the receipt templates |
| `portal.ts` | **everything the portal exposes**, in one place |
| `catalog.ts` | seeded vocabulary: species, breeds, statuses, categories, services |
| `messages.ts` | every label, in English and Portuguese (pt-BR) |
| `domain-model.json` | the model — read it before changing a field |
| `business-rules.json` | each business rule and what it produced |

## The platform, feature by feature

Use this table as a study guide or a demo script: each row is one platform mechanism, and where to see it.

| Mechanism | Where in the Pet Shop |
|---|---|
| **Entities and references**, child tabs | customer → pets → vaccinations, appointments, packages, weight |
| **Option filter** on a picker | a pet's breed by species; a vaccination's batch (available, of that vaccine); a line's package (active, of that pet and service) |
| **Declared keys** (no duplicates) | breed per species, vaccine per laboratory, lot per vaccine, service name, one line per service per appointment |
| **Derived on read** (`derive`) | pet age; doses and credits left |
| **Aggregates** — `count`, `sum`, `latest` | appointment total; doses applied; credits used; overdue vaccines; current weight |
| **Declared snapshot** | the line price: frozen on the day, with the reason in the model |
| **Sequence** (`autoValue`) | appointment number `2026/00012`, reset every year |
| **Seeded records**, translated | breeds; services, whose names are written in the organization's language |
| **State machines** | batch, vaccination, appointment, package — status read-only, moved only by flows |
| **Record actions** + `disabledWhen` | Approve, Confirm, Check in, Ready, Finish, Cancel — greyed out exactly where the flow would not run |
| **A permission of its own** | `pet_petshopAppointments.cancel`, which requires `.update` |
| **A flow that refuses** | Check in answers with an error when vaccines block it |
| **Prompted parameters** | Cancel asks for the reason |
| **Clock: date reached** | batch and package expiry, vaccination overdue, reminders, no-show |
| **Query and Loop** | a new dose renews the earlier ones |
| **Notifications** | to staff (in-app, by type) and to the owner's e-mail (`contact` field, unsubscribe link) |
| **Reports** — summary, matrix, tabular, charts, prompt, `includeWhen`, computed measure | `reports.ts` |
| **A widget on another extension's surface** | four `report` cards on the `dashboard` surface — no dependency, no code |
| **Contributing to another extension's points** | `calendar.source` (how Pet Shop cards look) and `calendar.moveaction` (what a drag means) |
| **Writing another extension's collection**, with a declared dependency | the `calendar` items, kept in step on every save and delete |
| **Document templates** with datasets | vaccination card, receipt (generated by the Finish flow) |
| **Portal** — subject, exposed fields, `referenceTitles`, create, actions, documents, home cards, invite | `portal.ts` |
| **Two languages** | every label is a message reference, in `en` and `pt-BR` |

## Decisions worth knowing

- **Pet Shop has no dashboard or agenda of its own.** The Dashboard and the Calendar are places that any
  extension fills. A second dashboard menu would compete with the office one. Cards on it are switched on,
  ordered and sized by each office and each person.
- **A Calendar item is a mirror.** The appointment or the vaccination writes it, keeps it current and removes
  it. The Calendar only draws it and opens the record on click. Dragging writes nothing by itself: it runs
  Pet Shop's *Reschedule*, which moves the **appointment**, and the appointment's save then moves the item.
  Only a requested or scheduled appointment moves; a next dose does not move from the Calendar.
- **The Calendar is a dependency, the Dashboard is not.** Pet Shop writes the Calendar's collection, so the
  Calendar must be installed. A Dashboard card names a surface; without the Dashboard it simply does not show.
- **Breed is an entity, not an option list.** Each breed has a species, the shop adds its own, and a name
  cannot repeat within one species.
- **Age is derived, never stored**, so it never goes stale. It cannot be filtered on the server.
- **Statuses are stored and moved by automations**, because a picker filter and a portal filter compare
  values, and "expired" or "overdue" must be a value for them to filter by. Each status flow writes only when
  the status is wrong, so its own write finds nothing left to do.
- **The line price is a snapshot, the total is an aggregate.** The price is copied from the service when the
  line is saved, and kept if someone typed a discount. The kernel recomputes the total on every line written.
- **The check-in rule needs no query.** The appointment counts its lines that require vaccines, and the pet
  counts its overdue doses. Both are aggregates on the records in hand, so the button and the flow read
  them directly.
- **Keys are permanent.** Option keys (`dog`, `scheduled`, `overdue`) are what records store and flows
  compare. Labels can be renamed; keys must never change.
- **Vaccinations saved before 3.6.0** have no status until they are saved again or their next dose arrives.

## The gate

    npx tsc --noEmit
    npx microteia-plugin check petshop/plugin.ts
    npm test
    npx microteia-plugin build petshop/plugin.ts   # writes dist/br.com.microteia.petshop.json

Import `dist/br.com.microteia.petshop.json` on the **Extensions** screen. Every change raises
`manifest.version` and adds an entry at the top of `VERSIONS.md`. See `../AUTHORING.md`.

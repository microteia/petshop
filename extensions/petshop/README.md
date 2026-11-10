# br.com.microteia.petshop — Pet Shop

Customers and their pets, with a preloaded catalog of dog and cat breeds, and the pets' vaccines.

| What | Where it lives |
|---|---|
| **Customers** — name, phone, e-mail, notes; Notes, Documents and Tags tabs | screen `pet_petshopCustomers`, in the menu; tags in `pet_petshopCustomerTags` |
| **Pets** — name, owner, species, breed, sex, birth date, age, size, notes; Notes, Documents and Tags tabs | screen `pet_petshopPets`, a tab of the customer; tags in `pet_petshopPetTags` |
| **Breeds** — name, species | screen `pet_petshopBreeds`, in the menu; common dog and cat breeds seeded as records |
| **Vaccines** — name, laboratory, protects against | screen `pet_petshopVaccines`, in the menu |
| **Batches** — lot number (unique per vaccine), status, manufacture/expiry/purchase dates, doses purchased/applied/left | screen `pet_petshopVaccineBatches`, a tab of the vaccine |
| **Vaccinations** — pet, vaccine, batch, applied on/by, next dose, remind N days before | screen `pet_petshopVaccinations`, a tab of the pet |
| Species, sizes, laboratories, batch statuses | option lists, seeded on install, then the organization's to edit |

Files: `vaccines.ts` (the vaccine screens and automations), `collections.ts` (collection names), `domain-model.json` (the model — read it before changing a field), `business-rules.json` (what the
rule produced), `catalog.ts` (seeded vocabulary), `messages.ts` (en + pt-BR), `plugin.ts`.

## Two decisions worth knowing

- **Breed is an entity, not an option list.** Each breed has a species, the shop adds its own, and the
  same name cannot repeat within one species (a declared key). The pet's single `breed` reference uses
  `optionsFilter` to offer only breeds of the pet's species, and the platform clears it when the species
  changes. Needs kernel `^2.104.0` for the filter and `^2.106.0` for the seeded records.
- **Age is derived, never stored.** `ageYears` / `ageMonths` are computed from `birthDate` on every
  read, in the organization's time zone, so they never go stale. They cannot be filtered on the server.

## How vaccines work

- **"Valid" is a stored status.** A batch's `status` is `available` or `expired`, read-only in the form.
  Two workflows keep it in line with `expiryDate`: one on the kernel clock the day after the expiry date
  (`pet-batch-expires`), one on save for a batch registered late or whose date was corrected
  (`pet-batch-status-on-save`). It is stored because a picker filter only compares with `eq`/`in` and a
  field rule cannot read another record, so "not expired" must be a value on the batch.
- **The batch picker** on a vaccination offers only `available` batches of the chosen vaccine
  (`optionsFilter`). That is a form rule: a workflow, an import or the AI agent can still write any batch.
- **The reminder** (`pet-vaccine-reminder`) fires at 08:00 on `remindOn` = next dose − "Remind (days
  before)" (default 2, per vaccination; the shop can change the default in Form Design). It skips the
  alert when a later dose of the same vaccine exists for the pet, alerts everyone with
  `pet_petshopVaccinations.read` in the app (notification type "Vaccine due"), and e-mails the
  customer's contact e-mail when there is one.

## Keys are permanent

Every pet and breed stores the species option KEY (`dog`, `cat`). Breeds are seeded as records with
`seed: { mode: 'required' }`, keyed `<species>.<breed>` (`dog.labrador-retriever`): a breed added to
`catalog.ts` in a later version reaches organizations that already have the extension, and one they
renamed or deleted is never brought back. Seeded names are in English — a record is data, written once.

## The gate

    npx tsc --noEmit
    npx microteia-plugin check petshop/plugin.ts
    npm test
    npx microteia-plugin build petshop/plugin.ts   # writes dist/br.com.microteia.petshop.json

Import `dist/br.com.microteia.petshop.json` on the **Extensions** screen. Every change raises
`manifest.version` and adds an entry at the top of `VERSIONS.md`. See `../AUTHORING.md`.

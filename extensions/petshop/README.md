# br.com.microteia.petshop — Pet Shop

Customers and their pets, with a preloaded catalog of dog and cat breeds.

| What | Where it lives |
|---|---|
| **Customers** — name, phone, e-mail, notes; Notes, Documents and Tags tabs | screen `pet_petshopCustomers`, in the menu; tags in `pet_petshopCustomerTags` |
| **Pets** — name, owner, species, breed, sex, birth date, age, size, notes; Notes, Documents and Tags tabs | screen `pet_petshopPets`, a tab of the customer; tags in `pet_petshopPetTags` |
| **Breeds** — name, species | screen `pet_petshopBreeds`, in the menu; common dog and cat breeds seeded as records |
| Species, sizes | option lists, seeded on install, then the organization's to edit |

Files: `domain-model.json` (the model — read it before changing a field), `business-rules.json` (what the
rule produced), `catalog.ts` (seeded vocabulary), `messages.ts` (en + pt-BR), `plugin.ts`.

## Two decisions worth knowing

- **Breed is an entity, not an option list.** Each breed has a species, the shop adds its own, and the
  same name cannot repeat within one species (a declared key). The pet's single `breed` reference uses
  `optionsFilter` to offer only breeds of the pet's species, and the platform clears it when the species
  changes. Needs kernel `^2.104.0` for the filter and `^2.106.0` for the seeded records.
- **Age is derived, never stored.** `ageYears` / `ageMonths` are computed from `birthDate` on every
  read, in the organization's time zone, so they never go stale. They cannot be filtered on the server.

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

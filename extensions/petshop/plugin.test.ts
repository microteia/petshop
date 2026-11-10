import { describe, expect, it } from 'vitest';
import { buildPlugin } from '@microteia/sdk/node';
import { buildDomainCatalog, parseDomainModel, validateDomainModel } from '@microteia/sdk';
// The platform's own expression engine — the one the form and the server run. It is not part of the
// SDK's public surface, so this import is test-only and may need its path updated after an SDK upgrade.
import {
  evaluateFieldExpression,
  evaluateFieldValidation,
} from '../node_modules/@microteia/sdk/lib/domain/schema/fieldExpression.js';
import { matchesOptionsFilter, resolveOptionsFilter } from '../node_modules/@microteia/sdk/lib/domain/schema/optionsFilter.js';
import MODEL from './domain-model.json';
import { CAT_BREEDS, DOG_BREEDS, SEXES, SIZES, SPECIES, SPECIES_CAT, SPECIES_DOG } from './catalog';
import { MESSAGES, NAMESPACE } from './messages';
import { AGE_MONTHS, AGE_YEARS, BIRTH_DATE_RULE, BREED_BY_SPECIES, BREED_SEEDS, BREEDS, CUSTOMER_TAGS, CUSTOMERS, PET_TAGS, EMAIL_RULE, PET_CARD, PET_PHOTO_FILE, PETS, PETS_NAV, petshopPlugin } from './plugin';
import type { CardNode } from '@microteia/sdk';
import { fileConfigIsImageOnly } from '../node_modules/@microteia/sdk/lib/domain/schema/fieldRules.js';

/**
 * The same validation the platform runs on install, plus the rules that can be wrong without the
 * package being refused: the age arithmetic, the breed catalog and its filter by species, and the words.
 */
describe('br.com.microteia.petshop', () => {
  const built = buildPlugin({ entry: new URL('./plugin.ts', import.meta.url).pathname });

  it('has no problems the platform would refuse', () => {
    expect(built.issues).toEqual([]);
  });

  it('stays modelled', () => {
    const parsed = parseDomainModel(MODEL);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
    const issues = validateDomainModel(parsed.model, buildDomainCatalog()).issues;
    expect(issues.filter((one) => one.severity === 'error')).toEqual([]);
  });

  it('the Pets list has its own menu entry, between Customers and Breeds', () => {
    const contributes = petshopPlugin.manifest.contributes ?? [];
    expect(contributes).toContain(PETS_NAV);
    expect(PETS_NAV.metadata).toMatchObject({ screen: PETS, label: expect.stringMatching(/^@/), order: 25 });
  });

  it('pets stay findable in the command palette: the pet screen is a related child, never an owned one', () => {
    const pets = (petshopPlugin.screens ?? []).find((screen) => screen.key === PETS);
    expect(pets?.parentRelation).toBe('related');
    expect(pets?.hideRecordsFromCommandPalette).not.toBe(true);
    expect(pets?.fields.find((field) => field.key === 'customer')?.required).toBe(true);
  });

  it('a pet has an optional photo, images only, shown as the avatar of its card', () => {
    const pets = (petshopPlugin.screens ?? []).find((screen) => screen.key === PETS);
    const photo = pets?.fields.find((field) => field.key === 'photo');
    expect(photo).toMatchObject({ type: 'file', required: false, file: PET_PHOTO_FILE });
    expect(fileConfigIsImageOnly(PET_PHOTO_FILE)).toBe(true);
    expect(pets?.imageFieldKey).toBe('photo');
    const avatar = (PET_CARD.body ?? []).flatMap((node) => (node.type === 'row' ? node.children : [node]));
    expect(avatar.some((node) => node.type === 'avatar')).toBe(true);
  });

  it("the pet card shows its customer's name, through the reference and never a copied field", () => {
    const nodes = (PET_CARD.body ?? []).flatMap((node) => (node.type === 'row' ? node.children : [node]));
    expect(nodes).toContainEqual(expect.objectContaining({ type: 'field', field: 'customer' }));
    const pets = (petshopPlugin.screens ?? []).find((screen) => screen.key === PETS);
    expect(pets?.fields.find((field) => field.key === 'customer')).toMatchObject({ type: 'reference', refEntity: CUSTOMERS });
  });

  it('the photo is the last field, in a section of its own, so Identification keeps its pairs', () => {
    const fields = [...((petshopPlugin.screens ?? []).find((screen) => screen.key === PETS)?.fields ?? [])].sort((a, b) => a.order - b.order);
    const photo = fields.at(-1)!;
    expect(photo.key).toBe('photo');
    expect(fields.filter((field) => field.section === photo.section).map((field) => field.key)).toEqual(['photo']);
    expect(new Set(fields.map((field) => field.order)).size).toBe(fields.length);
  });

  it('the number of pets is not shown on the customer card or form', () => {
    const customers = (petshopPlugin.screens ?? []).find((screen) => screen.key === CUSTOMERS);
    const petCount = customers?.fields.find((field) => field.key === 'petCount');
    expect(petCount?.showInList).not.toBe(true);
    expect(petCount?.hiddenInForm).toBe(true);
  });

  it.each([
    [CUSTOMERS, CUSTOMER_TAGS],
    [PETS, PET_TAGS],
  ])('%s has the Notes, Documents and Tags tabs, with its own tag list', (key, tags) => {
    const screen = (petshopPlugin.screens ?? []).find((one) => one.key === key);
    expect(screen).toMatchObject({ hasNotes: true, hasDocuments: true, hasTags: true, tagCollection: tags });
    expect((petshopPlugin.tagLists ?? []).map((list) => list.collection)).toContain(tags);
  });

  it('the model gives a reason for every tab the screens turn on', () => {
    for (const name of ['Customer', 'Pet']) {
      const entity = MODEL.entities.find((one) => one.name === name) as { tabs?: { kind: string; because: string }[] };
      expect(entity.tabs?.map((tab) => tab.kind).sort(), name).toEqual(['documents', 'notes', 'tags']);
      for (const tab of entity.tabs ?? []) expect(tab.because.length, `${name}.${tab.kind}`).toBeGreaterThan(10);
    }
  });

  it('Breed stays without tabs: nothing asked for them', () => {
    const breeds = (petshopPlugin.screens ?? []).find((one) => one.key === BREEDS);
    expect(breeds?.hasNotes ?? false).toBe(false);
    expect(breeds?.hasDocuments ?? false).toBe(false);
    expect(breeds?.hasTags ?? false).toBe(false);
  });

  it('every screen field has a translatable label', () => {
    for (const screen of petshopPlugin.screens ?? []) {
      for (const field of screen.fields) {
        expect(field.label, field.key).toMatch(/^@/);
      }
    }
  });

  it('no field declares a list label, which the card would show untranslated', () => {
    for (const screen of petshopPlugin.screens ?? []) {
      for (const field of screen.fields) {
        expect(field.listLabel, `${screen.key}.${field.key}`).toBeUndefined();
      }
    }
  });

  it('the pet card shows the breed and labels no field', () => {
    const nodes: CardNode[] = [];
    const walk = (list: CardNode[]) =>
      list.forEach((node) => {
        nodes.push(node);
        if (node.type === 'row' || node.type === 'stack') walk(node.children);
      });
    walk(PET_CARD.body ?? []);
    const fields = nodes.filter((node) => node.type === 'field');
    expect(fields.map((node) => node.field)).toContain('breed');
    expect(fields.filter((node) => node.label !== undefined)).toEqual([]);
  });

  describe('words', () => {
    const en = MESSAGES.find((bundle) => bundle.locale === 'en')!.messages;
    const ptBR = MESSAGES.find((bundle) => bundle.locale === 'pt-BR')!.messages;

    it('ships the same keys in English and Portuguese', () => {
      expect(Object.keys(ptBR).sort()).toEqual(Object.keys(en).sort());
    });

    it('every message reference in the package resolves in both languages', () => {
      const json = built.json;
      const refs = new Set([...json.matchAll(new RegExp(`@${NAMESPACE.replace(/\./g, '\\.')}/([A-Za-z0-9.-]+)`, 'g'))].map((m) => m[1]));
      expect(refs.size).toBeGreaterThan(0);
      for (const key of refs) {
        expect(en[key], `en: ${key}`).toBeTruthy();
        expect(ptBR[key], `pt-BR: ${key}`).toBeTruthy();
      }
    });
  });

  describe('vocabulary', () => {
    it.each([
      ['species', SPECIES],
      ['sizes', SIZES],
      ['sexes', SEXES],
      ['dog breeds', DOG_BREEDS],
      ['cat breeds', CAT_BREEDS],
      ['breed seeds', BREED_SEEDS],
    ])('%s have unique keys', (_name, terms) => {
      const keys = terms.map((term) => term.key);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it('carries the species of the preloaded breeds', () => {
      const keys = SPECIES.map((term) => term.key);
      expect(keys).toContain(SPECIES_DOG);
      expect(keys).toContain(SPECIES_CAT);
    });
  });

  describe('breeds', () => {
    const screens = Object.fromEntries((petshopPlugin.screens ?? []).map((screen) => [screen.key, screen]));
    const breedScreen = screens[BREEDS];
    const breedField = screens[PETS].fields.find((field) => field.key === 'breed')!;

    it('preloads the common dog and cat breeds, in English', () => {
      expect(breedScreen.seed?.mode).toBe('required');
      expect(breedScreen.seed?.records).toBe(BREED_SEEDS);
      expect(BREED_SEEDS.length).toBe(DOG_BREEDS.length + CAT_BREEDS.length);
      expect(DOG_BREEDS.length).toBeGreaterThanOrEqual(30);
      expect(CAT_BREEDS.length).toBeGreaterThanOrEqual(20);
      const labrador = BREED_SEEDS.find((seed) => seed.key === 'dog.labrador-retriever');
      expect(labrador?.data).toEqual({ name: 'Labrador Retriever', species: SPECIES_DOG });
      const persian = BREED_SEEDS.find((seed) => seed.key === 'cat.persian');
      expect(persian?.data).toEqual({ name: 'Persian', species: SPECIES_CAT });
    });

    it('lets the shop add its own breeds from the menu', () => {
      expect(breedScreen.hideFromSidebar).not.toBe(true);
      expect(breedScreen.parentEntity ?? null).toBeNull();
    });

    it('lets people add a species from the breed and pet forms', () => {
      for (const key of [BREEDS, PETS]) {
        const species = screens[key].fields.find((field) => field.key === 'species')!;
        expect(species.optionsAllowUserAdd, key).toBe(true);
      }
    });

    it('refuses the same breed name twice within one species, whatever the case', () => {
      expect(breedScreen.keys).toEqual([
        expect.objectContaining({ kind: 'unique', fields: ['species', 'name'], normalize: { caseInsensitive: true } }),
      ]);
    });

    it('the pet has one breed field, a reference to Breed filtered by species', () => {
      const pet = screens[PETS];
      expect(pet.fields.filter((field) => /breed/i.test(field.key)).map((field) => field.key)).toEqual(['breed']);
      expect(breedField.type).toBe('reference');
      expect(breedField.refEntity).toBe(BREEDS);
      expect(breedField.optionsFilter).toEqual(BREED_BY_SPECIES);
    });

    describe('the breed picker', () => {
      const offered = (species: string | null) => {
        const filter = resolveOptionsFilter(BREED_BY_SPECIES, { species });
        return BREED_SEEDS.filter((seed) => filter !== null && !filter.blocked && matchesOptionsFilter(seed.data, filter)).map(
          (seed) => seed.key,
        );
      };

      it('offers only dog breeds for a dog', () => {
        const keys = offered(SPECIES_DOG);
        expect(keys).toHaveLength(DOG_BREEDS.length);
        expect(keys.every((key) => key.startsWith('dog.'))).toBe(true);
      });

      it('offers only cat breeds for a cat', () => {
        const keys = offered(SPECIES_CAT);
        expect(keys).toHaveLength(CAT_BREEDS.length);
        expect(keys.every((key) => key.startsWith('cat.'))).toBe(true);
      });

      it('offers nothing while the species is empty', () => {
        expect(offered(null)).toEqual([]);
      });
    });
  });

  describe('age', () => {
    // 9 Nov 2026, 15:00 in São Paulo.
    const at = new Date('2026-11-09T18:00:00Z');
    const timeZone = 'America/Sao_Paulo';
    // A date field reaches the expression as that day at noon UTC.
    const day = (text: string) => new Date(`${text}T12:00:00Z`);
    const age = (birthDate: unknown) => ({
      years: evaluateFieldExpression(AGE_YEARS, { value: null, data: { birthDate }, at, timeZone }),
      months: evaluateFieldExpression(AGE_MONTHS, { value: null, data: { birthDate }, at, timeZone }),
    });

    it.each([
      ['2020-03-15', 6, 7],
      ['2025-11-09', 1, 0],
      ['2025-11-10', 0, 11],
      ['2026-10-09', 0, 1],
      ['2026-11-09', 0, 0],
    ])('born %s is %i years and %i months old', (birth, years, months) => {
      expect(age(day(birth))).toEqual({ years, months });
      expect(age(birth)).toEqual({ years, months });
    });

    it('is empty without a birth date', () => {
      expect(age(null)).toEqual({ years: null, months: null });
    });

    it('refuses a birth date in the future, and only that', () => {
      const check = (value: unknown) => evaluateFieldValidation(BIRTH_DATE_RULE, { value, data: { birthDate: value }, at, timeZone });
      expect(check(day('2026-11-10'))).toBe(`@${NAMESPACE}/error.birth-date-future`);
      expect(check(day('2026-11-09'))).toBeNull();
      expect(check(day('2019-01-01'))).toBeNull();
      expect(check('2026-11-09')).toBeNull();
      expect(check(null)).toBeNull();
    });
  });

  it('accepts an empty or valid e-mail and refuses anything else', () => {
    const check = (value: string | null) => evaluateFieldValidation(EMAIL_RULE, { value, data: { email: value } });
    expect(check(null)).toBeNull();
    expect(check('ana@example.com')).toBeNull();
    expect(check('not-an-email')).toBe(`@${NAMESPACE}/error.email`);
  });
});

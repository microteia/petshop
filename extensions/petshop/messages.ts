import type { MessageBundle } from '@microteia/sdk';
import { TERM_GROUPS, termMessageKey, type Term } from './catalog';

/**
 * Every label this extension shows. The kernel does not translate an extension's vocabulary — the
 * extension that declares a word answers for it. 'en' always ships; 'pt-BR' follows it key by key.
 */
export const NAMESPACE = 'br.com.microteia.petshop';

const EN: Record<string, string> = {
  'extension.name': 'Pet Shop',
  'extension.description': 'Customers and their pets, with a ready-made catalog of dog and cat breeds that the shop can extend.',
  'extension.summary': 'Register customers and their pets — species, breed, sex, age, size and notes.',

  'customer.singular': 'Customer',
  'customer.plural': 'Customers',
  'customer.field.name': 'Name',
  'customer.field.phone': 'Phone',
  'customer.field.email': 'E-mail',
  'customer.field.notes': 'Notes',
  'customer.field.pet-count': 'Pets',

  'pet.singular': 'Pet',
  'pet.plural': 'Pets',
  'pet.section.identification': 'Identification',
  'pet.section.age': 'Age',
  'pet.section.notes': 'Notes',
  'pet.field.name': 'Name',
  'pet.field.customer': 'Owner',
  'pet.field.species': 'Species',
  'pet.field.breed': 'Breed',
  'pet.field.sex': 'Sex',
  'pet.field.birth-date': 'Birth date (estimated)',
  'pet.field.age-years': 'Years',
  'pet.field.age-months': 'Months',
  'pet.field.size': 'Size',
  'pet.field.notes': 'Notes',

  'lookup.species': 'Pet species',
  'lookup.sizes': 'Pet sizes',
  'tags.customers': 'Customer tags',
  'tags.pets': 'Pet tags',

  'breed.singular': 'Breed',
  'breed.plural': 'Breeds',
  'breed.field.name': 'Name',
  'breed.field.species': 'Species',
  'breed.key.species-name': 'This species already has a breed with this name.',

  'error.email': 'Enter a valid e-mail address.',
  'error.birth-date-future': 'The birth date cannot be in the future.',
};

const PT_BR: Record<string, string> = {
  'extension.name': 'Pet Shop',
  'extension.description': 'Clientes e seus pets, com um catálogo pronto de raças de cães e gatos que a loja pode ampliar.',
  'extension.summary': 'Cadastre clientes e seus pets — espécie, raça, sexo, idade, porte e observações.',

  'customer.singular': 'Cliente',
  'customer.plural': 'Clientes',
  'customer.field.name': 'Nome',
  'customer.field.phone': 'Telefone',
  'customer.field.email': 'E-mail',
  'customer.field.notes': 'Observações',
  'customer.field.pet-count': 'Pets',

  'pet.singular': 'Pet',
  'pet.plural': 'Pets',
  'pet.section.identification': 'Identificação',
  'pet.section.age': 'Idade',
  'pet.section.notes': 'Observações',
  'pet.field.name': 'Nome',
  'pet.field.customer': 'Tutor',
  'pet.field.species': 'Espécie',
  'pet.field.breed': 'Raça',
  'pet.field.sex': 'Sexo',
  'pet.field.birth-date': 'Data de nascimento (estimada)',
  'pet.field.age-years': 'Anos',
  'pet.field.age-months': 'Meses',
  'pet.field.size': 'Porte',
  'pet.field.notes': 'Observações',

  'lookup.species': 'Espécies de pets',
  'lookup.sizes': 'Portes de pets',
  'tags.customers': 'Tags de clientes',
  'tags.pets': 'Tags de pets',

  'breed.singular': 'Raça',
  'breed.plural': 'Raças',
  'breed.field.name': 'Nome',
  'breed.field.species': 'Espécie',
  'breed.key.species-name': 'Esta espécie já tem uma raça com este nome.',

  'error.email': 'Informe um e-mail válido.',
  'error.birth-date-future': 'A data de nascimento não pode estar no futuro.',
};

const termMessages = (pick: (term: Term) => string): Record<string, string> =>
  Object.fromEntries(
    TERM_GROUPS.flatMap(({ prefix, terms }) => terms.map((term) => [termMessageKey(prefix, term.key), pick(term)])),
  );

export const MESSAGES: MessageBundle[] = [
  { locale: 'en', namespace: NAMESPACE, messages: { ...EN, ...termMessages((term) => term.en) } },
  { locale: 'pt-BR', namespace: NAMESPACE, messages: { ...PT_BR, ...termMessages((term) => term.ptBR) } },
];

/**
 * The vocabulary this extension seeds: species, sizes and sex go into option lists; the most common dog
 * and cat breeds are preloaded as records of the Breed screen. Each entry has a stable KEY and its name
 * in each language. Once installed, options and breed records are the organization's data — it renames,
 * removes and adds to them — so a key here must never change.
 *
 * Breeds are seeded with their ENGLISH name (`en`): a seeded record is data, written once, and the
 * organization chose English. The Portuguese names are kept so switching the seed to message references
 * — which the platform resolves into the organization's language when it writes the record — stays a
 * one-line change.
 */
export interface Term {
  key: string;
  en: string;
  ptBR: string;
}

/** `dog` and `cat` are the species of the preloaded breeds. Never rename them. */
export const SPECIES: Term[] = [
  { key: 'dog', en: 'Dog', ptBR: 'Cachorro' },
  { key: 'cat', en: 'Cat', ptBR: 'Gato' },
  { key: 'bird', en: 'Bird', ptBR: 'Ave' },
  { key: 'rabbit', en: 'Rabbit', ptBR: 'Coelho' },
  { key: 'rodent', en: 'Rodent', ptBR: 'Roedor' },
  { key: 'reptile', en: 'Reptile', ptBR: 'Réptil' },
  { key: 'fish', en: 'Fish', ptBR: 'Peixe' },
  { key: 'other', en: 'Other', ptBR: 'Outro' },
];

export const SPECIES_DOG = 'dog';
export const SPECIES_CAT = 'cat';

export const SIZES: Term[] = [
  { key: 'mini', en: 'Mini', ptBR: 'Mini' },
  { key: 'small', en: 'Small', ptBR: 'Pequeno' },
  { key: 'medium', en: 'Medium', ptBR: 'Médio' },
  { key: 'large', en: 'Large', ptBR: 'Grande' },
  { key: 'giant', en: 'Giant', ptBR: 'Gigante' },
];

export const SEXES: Term[] = [
  { key: 'male', en: 'Male', ptBR: 'Macho' },
  { key: 'female', en: 'Female', ptBR: 'Fêmea' },
];

export const DOG_BREEDS: Term[] = [
  { key: 'mixed', en: 'Mixed breed', ptBR: 'SRD (sem raça definida)' },
  { key: 'akita', en: 'Akita', ptBR: 'Akita' },
  { key: 'american-pit-bull-terrier', en: 'American Pit Bull Terrier', ptBR: 'Pit Bull' },
  { key: 'australian-shepherd', en: 'Australian Shepherd', ptBR: 'Pastor Australiano' },
  { key: 'beagle', en: 'Beagle', ptBR: 'Beagle' },
  { key: 'belgian-malinois', en: 'Belgian Malinois', ptBR: 'Pastor Belga Malinois' },
  { key: 'bernese-mountain-dog', en: 'Bernese Mountain Dog', ptBR: 'Boiadeiro Bernês' },
  { key: 'bichon-frise', en: 'Bichon Frisé', ptBR: 'Bichon Frisé' },
  { key: 'border-collie', en: 'Border Collie', ptBR: 'Border Collie' },
  { key: 'boxer', en: 'Boxer', ptBR: 'Boxer' },
  { key: 'cavalier-king-charles-spaniel', en: 'Cavalier King Charles Spaniel', ptBR: 'Cavalier King Charles Spaniel' },
  { key: 'chihuahua', en: 'Chihuahua', ptBR: 'Chihuahua' },
  { key: 'chow-chow', en: 'Chow Chow', ptBR: 'Chow Chow' },
  { key: 'cocker-spaniel', en: 'English Cocker Spaniel', ptBR: 'Cocker Spaniel Inglês' },
  { key: 'dachshund', en: 'Dachshund', ptBR: 'Dachshund (Salsicha)' },
  { key: 'dobermann', en: 'Dobermann', ptBR: 'Dobermann' },
  { key: 'english-bulldog', en: 'English Bulldog', ptBR: 'Buldogue Inglês' },
  { key: 'french-bulldog', en: 'French Bulldog', ptBR: 'Buldogue Francês' },
  { key: 'german-shepherd', en: 'German Shepherd', ptBR: 'Pastor Alemão' },
  { key: 'golden-retriever', en: 'Golden Retriever', ptBR: 'Golden Retriever' },
  { key: 'great-dane', en: 'Great Dane', ptBR: 'Dogue Alemão' },
  { key: 'jack-russell-terrier', en: 'Jack Russell Terrier', ptBR: 'Jack Russell Terrier' },
  { key: 'labrador-retriever', en: 'Labrador Retriever', ptBR: 'Labrador Retriever' },
  { key: 'lhasa-apso', en: 'Lhasa Apso', ptBR: 'Lhasa Apso' },
  { key: 'maltese', en: 'Maltese', ptBR: 'Maltês' },
  { key: 'miniature-pinscher', en: 'Miniature Pinscher', ptBR: 'Pinscher Miniatura' },
  { key: 'miniature-schnauzer', en: 'Miniature Schnauzer', ptBR: 'Schnauzer Miniatura' },
  { key: 'pomeranian', en: 'Pomeranian', ptBR: 'Lulu da Pomerânia' },
  { key: 'poodle', en: 'Poodle', ptBR: 'Poodle' },
  { key: 'pug', en: 'Pug', ptBR: 'Pug' },
  { key: 'rottweiler', en: 'Rottweiler', ptBR: 'Rottweiler' },
  { key: 'shih-tzu', en: 'Shih Tzu', ptBR: 'Shih Tzu' },
  { key: 'siberian-husky', en: 'Siberian Husky', ptBR: 'Husky Siberiano' },
  { key: 'weimaraner', en: 'Weimaraner', ptBR: 'Weimaraner' },
  { key: 'yorkshire-terrier', en: 'Yorkshire Terrier', ptBR: 'Yorkshire Terrier' },
];

export const CAT_BREEDS: Term[] = [
  { key: 'mixed', en: 'Mixed breed', ptBR: 'SRD (sem raça definida)' },
  { key: 'abyssinian', en: 'Abyssinian', ptBR: 'Abissínio' },
  { key: 'american-shorthair', en: 'American Shorthair', ptBR: 'Pelo Curto Americano' },
  { key: 'bengal', en: 'Bengal', ptBR: 'Bengal' },
  { key: 'birman', en: 'Birman', ptBR: 'Sagrado da Birmânia' },
  { key: 'british-shorthair', en: 'British Shorthair', ptBR: 'Pelo Curto Britânico' },
  { key: 'burmese', en: 'Burmese', ptBR: 'Burmês' },
  { key: 'devon-rex', en: 'Devon Rex', ptBR: 'Devon Rex' },
  { key: 'exotic-shorthair', en: 'Exotic Shorthair', ptBR: 'Exótico de Pelo Curto' },
  { key: 'himalayan', en: 'Himalayan', ptBR: 'Himalaio' },
  { key: 'maine-coon', en: 'Maine Coon', ptBR: 'Maine Coon' },
  { key: 'norwegian-forest-cat', en: 'Norwegian Forest Cat', ptBR: 'Norueguês da Floresta' },
  { key: 'persian', en: 'Persian', ptBR: 'Persa' },
  { key: 'ragdoll', en: 'Ragdoll', ptBR: 'Ragdoll' },
  { key: 'russian-blue', en: 'Russian Blue', ptBR: 'Azul Russo' },
  { key: 'savannah', en: 'Savannah', ptBR: 'Savannah' },
  { key: 'scottish-fold', en: 'Scottish Fold', ptBR: 'Scottish Fold' },
  { key: 'siamese', en: 'Siamese', ptBR: 'Siamês' },
  { key: 'siberian', en: 'Siberian', ptBR: 'Siberiano' },
  { key: 'sphynx', en: 'Sphynx', ptBR: 'Sphynx' },
  { key: 'turkish-angora', en: 'Turkish Angora', ptBR: 'Angorá Turco' },
];

/** Message keys of each option-list term, grouped so the plugin and the bundles derive them the same way. */
export const TERM_GROUPS: { prefix: string; terms: Term[] }[] = [
  { prefix: 'species', terms: SPECIES },
  { prefix: 'size', terms: SIZES },
  { prefix: 'sex', terms: SEXES },
];

export const termMessageKey = (prefix: string, key: string): string => `${prefix}.${key}`;

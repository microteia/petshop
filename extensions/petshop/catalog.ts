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

/**
 * The laboratories that make most of the dog and cat vaccines sold in Brazil. The shop adds any other
 * right from the vaccine form.
 */
export const LABORATORIES: Term[] = [
  { key: 'zoetis', en: 'Zoetis', ptBR: 'Zoetis' },
  { key: 'msd', en: 'MSD Animal Health', ptBR: 'MSD Saúde Animal' },
  { key: 'boehringer-ingelheim', en: 'Boehringer Ingelheim', ptBR: 'Boehringer Ingelheim' },
  { key: 'elanco', en: 'Elanco', ptBR: 'Elanco' },
  { key: 'ceva', en: 'Ceva', ptBR: 'Ceva' },
  { key: 'virbac', en: 'Virbac', ptBR: 'Virbac' },
  { key: 'ourofino', en: 'Ourofino', ptBR: 'Ourofino' },
  { key: 'vetoquinol', en: 'Vetoquinol', ptBR: 'Vetoquinol' },
];

/**
 * The states of a vaccine batch. The automations compare these KEYS — never rename them. A batch is
 * born available and becomes expired the day after its expiry date.
 */
export const BATCH_AVAILABLE = 'available';
export const BATCH_EXPIRED = 'expired';

export const BATCH_STATUSES: Term[] = [
  { key: BATCH_AVAILABLE, en: 'Available', ptBR: 'Disponível' },
  { key: BATCH_EXPIRED, en: 'Expired', ptBR: 'Vencido' },
];

/**
 * The states of a vaccination. A dose is current until the day after its next dose, then overdue; a
 * later dose of the same vaccine for the same pet renews it. The automations compare these KEYS.
 */
export const VACCINATION_CURRENT = 'current';
export const VACCINATION_OVERDUE = 'overdue';
export const VACCINATION_RENEWED = 'renewed';

export const VACCINATION_STATUSES: Term[] = [
  { key: VACCINATION_CURRENT, en: 'Current', ptBR: 'Em dia' },
  { key: VACCINATION_OVERDUE, en: 'Overdue', ptBR: 'Atrasada' },
  { key: VACCINATION_RENEWED, en: 'Renewed', ptBR: 'Renovada' },
];

/** The kinds of service the shop offers. The shop adds its own from the service form. */
export const SERVICE_CATEGORIES: Term[] = [
  { key: 'bath', en: 'Bath', ptBR: 'Banho' },
  { key: 'grooming', en: 'Grooming', ptBR: 'Tosa' },
  { key: 'hygiene', en: 'Hygiene and care', ptBR: 'Higiene e cuidados' },
];

/**
 * The life of an appointment. Born `scheduled` (or `requested`, when the owner asks for it in the portal);
 * `done`, `cancelled` and `no-show` are the end. The flows and the buttons compare these KEYS.
 */
export const APPOINTMENT = {
  requested: 'requested',
  scheduled: 'scheduled',
  inService: 'in-service',
  ready: 'ready',
  done: 'done',
  cancelled: 'cancelled',
  noShow: 'no-show',
} as const;

export const APPOINTMENT_STATUSES: Term[] = [
  { key: APPOINTMENT.requested, en: 'Requested', ptBR: 'Solicitado' },
  { key: APPOINTMENT.scheduled, en: 'Scheduled', ptBR: 'Agendado' },
  { key: APPOINTMENT.inService, en: 'In service', ptBR: 'Em atendimento' },
  { key: APPOINTMENT.ready, en: 'Ready for pickup', ptBR: 'Pronto para retirada' },
  { key: APPOINTMENT.done, en: 'Done', ptBR: 'Concluído' },
  { key: APPOINTMENT.cancelled, en: 'Cancelled', ptBR: 'Cancelado' },
  { key: APPOINTMENT.noShow, en: 'No-show', ptBR: 'Não compareceu' },
];

/** The states of a package of credits. Moved only by the automations, from its credits and its date. */
export const PACKAGE_ACTIVE = 'active';
export const PACKAGE_USED_UP = 'used-up';
export const PACKAGE_EXPIRED = 'expired';

export const PACKAGE_STATUSES: Term[] = [
  { key: PACKAGE_ACTIVE, en: 'Active', ptBR: 'Ativo' },
  { key: PACKAGE_USED_UP, en: 'Used up', ptBR: 'Esgotado' },
  { key: PACKAGE_EXPIRED, en: 'Expired', ptBR: 'Vencido' },
];

/**
 * The services a new shop starts with. Their names are message references, written into the record in the
 * organization's language when it is seeded; from then on they are the shop's data, prices included.
 */
export interface ServiceSeed {
  key: string;
  en: string;
  ptBR: string;
  category: string;
  price: number;
  durationMinutes: number;
  requiresVaccines: boolean;
}

export const SERVICE_SEEDS: ServiceSeed[] = [
  { key: 'bath', en: 'Bath', ptBR: 'Banho', category: 'bath', price: 60, durationMinutes: 60, requiresVaccines: true },
  { key: 'flea-bath', en: 'Flea and tick bath', ptBR: 'Banho antipulgas', category: 'bath', price: 80, durationMinutes: 75, requiresVaccines: true },
  { key: 'bath-grooming', en: 'Bath and full grooming', ptBR: 'Banho e tosa completa', category: 'grooming', price: 110, durationMinutes: 120, requiresVaccines: true },
  { key: 'hygienic-trim', en: 'Hygienic trim', ptBR: 'Tosa higiênica', category: 'grooming', price: 45, durationMinutes: 30, requiresVaccines: true },
  { key: 'nail-trim', en: 'Nail trim', ptBR: 'Corte de unhas', category: 'hygiene', price: 25, durationMinutes: 15, requiresVaccines: false },
  { key: 'ear-cleaning', en: 'Ear cleaning', ptBR: 'Limpeza de ouvidos', category: 'hygiene', price: 25, durationMinutes: 15, requiresVaccines: false },
  { key: 'teeth-brushing', en: 'Teeth brushing', ptBR: 'Escovação de dentes', category: 'hygiene', price: 20, durationMinutes: 15, requiresVaccines: false },
];

/** Message keys of each option-list term, grouped so the plugin and the bundles derive them the same way. */
export const TERM_GROUPS: { prefix: string; terms: Term[] }[] = [
  { prefix: 'species', terms: SPECIES },
  { prefix: 'size', terms: SIZES },
  { prefix: 'sex', terms: SEXES },
  { prefix: 'laboratory', terms: LABORATORIES },
  { prefix: 'batch-status', terms: BATCH_STATUSES },
  { prefix: 'vaccination-status', terms: VACCINATION_STATUSES },
  { prefix: 'service-category', terms: SERVICE_CATEGORIES },
  { prefix: 'appointment-status', terms: APPOINTMENT_STATUSES },
  { prefix: 'package-status', terms: PACKAGE_STATUSES },
  { prefix: 'service.seed', terms: SERVICE_SEEDS },
];

export const termMessageKey = (prefix: string, key: string): string => `${prefix}.${key}`;

import { NAMESPACE } from './messages';

/**
 * Every collection this extension creates, in one place so plugin.ts and vaccines.ts share them without
 * importing each other. A collection name is permanent: renaming one leaves the records behind.
 */
export const CUSTOMERS = 'pet_petshopCustomers';
export const PETS = 'pet_petshopPets';
export const BREEDS = 'pet_petshopBreeds';
export const SPECIES_LIST = 'pet_petshopSpecies';
export const SIZE_LIST = 'pet_petshopPetSizes';
export const CUSTOMER_TAGS = 'pet_petshopCustomerTags';
export const PET_TAGS = 'pet_petshopPetTags';

export const VACCINES = 'pet_petshopVaccines';
export const VACCINE_BATCHES = 'pet_petshopVaccineBatches';
export const VACCINATIONS = 'pet_petshopVaccinations';
export const LABORATORY_LIST = 'pet_petshopLaboratories';
export const BATCH_STATUS_LIST = 'pet_petshopVaccineBatchStatuses';

/** A message reference, resolved against the bundles in messages.ts. */
export const label = (key: string): string => `@${NAMESPACE}/${key}`;

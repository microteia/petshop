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
export const VACCINATION_STATUS_LIST = 'pet_petshopVaccinationStatuses';

export const SERVICES = 'pet_petshopServices';
export const SERVICE_CATEGORY_LIST = 'pet_petshopServiceCategories';
export const APPOINTMENTS = 'pet_petshopAppointments';
export const APPOINTMENT_ITEMS = 'pet_petshopAppointmentItems';
export const APPOINTMENT_STATUS_LIST = 'pet_petshopAppointmentStatuses';
export const PACKAGES = 'pet_petshopPackages';
export const PACKAGE_STATUS_LIST = 'pet_petshopPackageStatuses';
export const WEIGHTS = 'pet_petshopWeights';

/** The universal identity of a screen of this extension. It never changes: see business-rules.json. */
export const sourceIdOf = (collection: string): string => `${NAMESPACE}:${collection}`;

/** A message reference, resolved against the bundles in messages.ts. */
export const label = (key: string): string => `@${NAMESPACE}/${key}`;

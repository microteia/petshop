# Release notes — Pet Shop

> What changed in this extension, in the words of someone who uses it. The technical history is in
> your commits; this file is not.

Each entry matches `manifest.version` in `plugin.ts`. The newest one goes on top.

<!-- A new entry goes here, above the previous ones:

#### [1.0.1] — YYYY-MM-DD

- What a person will notice, in one plain sentence.
-->

#### [3.7.3] — 2026-11-10

- Weighings in a pet's Weight history show their date and weight instead of "Untitled".

#### [3.7.2] — 2026-11-10

- The pet card no longer says "0 overdue vaccine(s)": the warning appears only when a vaccine is overdue.
- Pet Shop appointments on the Calendar show their time once instead of twice.

#### [3.7.1] — 2026-11-10

- Appointment cards are titled with the appointment number and show the pet's name below it, instead of a code.

#### [3.7.0] — 2026-11-10

- Pet Shop no longer has a Dashboard menu of its own: its four cards — revenue by month, most requested services, pets by species and vaccines due in 30 days — now appear on the office Dashboard, where you choose which ones to show, in what order and at what width.
- Every appointment appears on the Calendar on its day and time, and dragging it to another day reschedules it and asks the owner to confirm again. Only requested and scheduled appointments can be moved.
- Every next vaccine dose appears on the Calendar, marked critical once it is overdue and closed once it is renewed.
- Pet Shop now requires the Calendar extension.

#### [3.6.0] — 2026-11-10

- A new Services screen lists what the shop offers — bath, grooming, nail trim and more, already filled in — each with its category, price, duration and whether it requires the pet's vaccines to be up to date.
- A new Appointments screen, also a tab of each pet, books a visit for a day and time with one or more services. Each appointment gets a number per year, and its total adds up the prices charged that day.
- Appointments move through buttons: Check in, Ready for pickup and Finish. A scheduled appointment nobody checked in becomes a no-show the next day. Cancelling asks for the reason and is only offered to people who have the new "Cancel appointments" permission.
- Check in is refused when a service requires vaccines up to date and the pet has an overdue one.
- The owner gets an e-mail the evening before the appointment, and another when the pet is ready for pickup.
- Each vaccination now shows whether it is current, overdue (from the day after the next dose) or renewed (once a later dose is registered). The pet shows how many vaccines are overdue.
- Each pet has a Packages tab: sell a number of credits of a service ("4 baths"). An appointment service paid with a package costs nothing and uses one credit, and the package shows the credits left until it is used up or expires.
- Each pet has a Weight history tab, and the pet shows its latest weight.
- A Dashboard opens when you enter the organization, with revenue by month, the most requested services, pets by species and the vaccines due in the next 30 days. Appointments by status is available in Reports.
- Generate a vaccination card PDF from any pet. Finishing an appointment attaches its receipt.
- Customers can use the portal: invite them from their record, and they see their pets, vaccinations, weight, packages, appointments and receipts, request an appointment and confirm one. A requested appointment alerts the staff to approve it.

#### [3.5.0] — 2026-11-10

- A new Vaccines screen in the menu lists the vaccines the shop uses, each with its laboratory and what it protects against; the common laboratories are already on the list.
- Each vaccine has a Batches tab for every lot you buy: lot number, manufacture and expiry dates, and doses purchased, applied and left. The same lot number cannot be registered twice for one vaccine.
- A batch is marked Expired the day after its expiry date, and from then on it is no longer offered when registering a vaccination.
- Each pet has a Vaccinations tab: choose the vaccine, then one of its available batches, and record the date applied, who applied it and the date of the next dose.
- Before the next dose — 2 days by default, adjustable on each vaccination — the staff get an alert in the app and the owner gets an e-mail. No reminder is sent if the pet already took a later dose of that vaccine.

#### [3.4.0] — 2026-11-10

- Each pet's card in the Pets list shows the name of its customer.

#### [3.3.1] — 2026-11-10

- The pet's photo is uploaded in its own Photo section at the end of the form, so Identification reads in clean pairs again.

#### [3.3.0] — 2026-11-10

- Pets have a photo: upload a picture of the animal (JPG, PNG or WebP, up to 5 MB) and it appears on the pet's card in the list.

#### [3.2.0] — 2026-11-10

- Customers and pets have Notes, Documents and Tags tabs: keep a dated log, attach files such as vaccination cards, and label each one with your own tags.
- Customers and pets have separate tag lists, so a pet's tags are never offered on a customer, nor the reverse.

#### [3.1.0] — 2026-11-10

- Pets has its own entry in the menu, listing every pet of every customer.
- Pets can be found by name in the command palette (⌘K).
- The customer list and form no longer show the number of pets; the customer's Pets tab lists them.

#### [3.0.0] — 2026-11-10

- Pet Shop is now published by Microteia and installs as a new extension: customers, pets and breeds registered with an earlier version are not carried over.

#### [2.0.1] — 2026-11-10

- A species that is not on the list yet can be added straight from the Species field of the breed and pet forms.

#### [2.0.0] — 2026-11-10

- Breeds now have their own Breeds screen in the menu, preloaded with the most common dog and cat breeds, where the shop can add breeds of any species.
- A pet has a single Breed field that offers only the breeds of the pet's species, and clears itself when the species changes.
- The separate dog, cat and "other" breed fields, and the dog and cat breed option lists, are gone.

#### [1.0.1] — 2026-11-09

- The pet card shows the pet's species, breed, size and sex cleanly, without untranslated labels or empty breed lines.

#### [1.0.0] — 2026-11-09

- Register customers with their phone, e-mail and notes, and see how many pets each one has.
- Register each customer's pets — name, species, breed, sex, birth date, size and notes — on a Pets tab inside the customer.
- A pet's age is worked out from its birth date and is always current.
- The dog and cat breed lists come preloaded with the most common breeds, and a missing breed can be added straight from the pet form.
- Available in English and Portuguese.

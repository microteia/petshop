# Extensions — demo

The extensions this organization writes. Each one is a folder.

    npm run create                               # guided: asks what the extension should carry
    npx tsc --noEmit                             # types
    npx microteia-plugin check <folder>/plugin.ts    # the gate
    npx microteia-plugin build <folder>/plugin.ts    # writes dist/<id>.json
    npm run build:all                            # every extension here, examples/ left out

Then import the `.json` from `dist/` on the **Extensions** screen of your Microteia.

## Why TypeScript, when the platform reads JSON

The `.json` is the artifact; this directory is the source. Writing the source in TypeScript is what
gives you types, autocomplete and unit tests — and it lets an AI assistant do the work and be *checked*
before anything is installed. Hand-editing a generated `.json` still works: it is the final result.

## One folder per extension

    <folder>/
      plugin.ts        the declaration — this is the source
      messages.ts      every label it shows, so all of them can be translated
      VERSIONS.md      what changed in each version, for whoever uses the extension
      plugin.test.ts   runs the platform's own validation against the built package
      views/*.tsx      its pages, as real files the compiler checks
      functions/       its own Cloud Functions (optional)

What `build` writes goes to `dist/<id>.json`, beside `package.json` — one folder for every
extension here. It is GENERATED: do not hand-edit it, do not commit it.

## Every change raises the version

Raise `manifest.version` in `plugin.ts` and add an entry at the top of that extension's
`VERSIONS.md`, in the same change — semver, and the entry written for whoever *uses* the extension.
The version is how an installed extension recognises an update: changed without one, it never reaches
the people who already have it.

Run the tests before calling anything finished:

    npm test

## Cloud Functions

A function that belongs to one extension goes in `<folder>/functions/`. One shared by several goes in
`../functions/`, next to `microteia.yaml`. Either way the directory is read through its `index.ts`,
and what it exports is what gets deployed.

    npm run create:function        # adds one to an extension that already exists

Where it goes decides WHEN it is deployed, and that is the whole difference:

| | |
|---|---|
| `<folder>/functions/` | it has an owner. Name it in `manifest.backend.functions`, and `microteia provision` deploys it only where that extension is installed |
| `../functions/` | nobody owns it, so nothing can claim it. It goes up with every `microteia deploy` |

**Deployed where the extension is installed is not the same as RUNNING only there.** A Cloud Function
belongs to the project; an installation belongs to an organization. A Firestore trigger of yours fires
for every organization in the project unless you wrap its handler:

    import { forInstalledExtension } from 'microteia-functions/office';

    export const acmeOnSave = onDocumentWritten(
      { document: 'tenants/{tenantId}/invoices/{id}', region },
      forInstalledExtension('com.acme.crm', async (event) => { /* ... */ }),
    );

`npm run create:function` writes that for you when you say the function reacts to a saved record. A
callable does not need it — only a screen of your extension calls one. `AUTHORING.md` §14 has the why.

An npm package the platform does not carry goes in `dependencies` in that directory's own
`package.json`. Two extensions asking for different ranges of the same package is refused — one
installation has one `node_modules` — and a range the platform already pins is kept.

A credential or setting is a `defineString('NAME')` plus `'NAME'` in `manifest.backend.parameters`.
Every one found is written into `.env.<projectId>`, empty, for whoever installs to fill in: a
`defineString` with no value refuses the deploy of *every* function in the project, not only yours.

They compile against `firebase-functions` and `firebase-admin`. Both are added to `package.json`
— at the versions this installation runs — as soon as any `functions/` directory exists here,
`examples/` included, and `npm install` brings them.

## examples/

Every extension that ships with Microteia, in **source** form — one folder each, exactly as you would
write your own. This is the most useful reference here: build any of them and you get the same `.json`
the platform installs.

    npx microteia-plugin build examples/access-example/plugin.ts
    npm run build:all -- --examples              # all of yours, and every example with them

`build:all` alone leaves `examples/` out: they are not this organization's, and their `.json` would
sit in `dist/` among the ones you mean to import.

Present when this directory was created:

- `examples/access-example/`
- `examples/agent/`
- `examples/auth-example/`
- `examples/automation-example/`
- `examples/backend-example/`
- `examples/brasil/`
- `examples/business-days/`
- `examples/calendar/`
- `examples/command-example/`
- `examples/consumer-example/`
- `examples/dashboard/`
- `examples/document-example/`
- `examples/library-example/`
- `examples/locale-pt-br/`
- `examples/news/`
- `examples/patch-example/`
- `examples/portal-example/`
- `examples/record-tab-example/`
- `examples/report-example/`
- `examples/settings-example/`
- `examples/theme-example/`
- `examples/widget-example/`

They are replaced whenever the installation takes a new platform version, so read them there rather
than from this list.

## Which files are yours

| | Policy |
|---|---|
| `CLAUDE.md`, `README.md` | **yours.** Created once, never rewritten — notes about this organization go here |
| `AUTHORING.md` — the contract: package anatomy, extension points, the curated API, code trust | **rewritten whole** |
| `AGENTS.md` — the operating rules, for you and for an AI assistant | **rewritten whole** |
| `examples/` — the first-party extensions, as reference | **replaced** |
| `tsconfig.json`, `.mcp.json`, `.gitignore`, `package.json` | **yours to edit**, and completed |

The two documents are rewritten whole, because the platform's capabilities change with each version and
the text has to follow — so write in `CLAUDE.md`, not in them.

The config files are different: you are meant to edit them. Add a `path` for a library of your own,
register another MCP server, ignore another file — all of it survives. `sync` only **adds** what the
platform needs and is missing, and when a setting disagrees with what the platform needs it says so and
**leaves it alone**: the choice is yours to make, and a tool that silently corrected it would be
undoing your work.

## After taking a new platform version

    microteia unpack --version latest

refreshes the SDK here and rewrites the generated files above, so they describe the platform you now
have. (`--kernel <package>.tgz` does the same from a file, on a machine that cannot reach the
published catalog.) If you ever need to do it by hand — you synchronised on one machine and are compiling on
another — it is:

    npm run sdk:refresh

Not `npm install`: that one keeps the SDK you already have. The tarball path carries no version number
(so a new platform version never makes you edit `package.json`), and `package-lock.json` records the
version and checksum of what was installed; to npm, a new tarball at the same path looks like nothing
changed. `sdk:refresh` installs it by path, which forces the resolution, and then syncs.

The symptom of skipping it is silence: your extensions keep compiling, against a contract the
installation no longer has.

Extension contract when this directory was created: 2.100.0.

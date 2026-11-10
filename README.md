# demo

This directory is a **Microteia** installation: a multi-tenant business platform where the applications
are built by *declaration* — screens, automations, actions and pages arrive as extensions, and the
platform itself is never modified.

It is yours. Rename it, describe your business in it, delete what you do not use. Nothing rewrites this
file. The reference that has to stay current lives in **[MICROTEIA.md](./MICROTEIA.md)**, which is
replaced on every `microteia unpack` — read that one for commands, paths and version detail. Beside it,
**[KERNEL-VERSIONS.md](./KERNEL-VERSIONS.md)** and **[CONSOLE-VERSIONS.md](./CONSOLE-VERSIONS.md)** say
what changed in each version of the platform and of the Console.

## The shape of this directory

    microteia.yaml         this installation: name, Firebase project, region, kernel version
    .env.<projectId>       your backend settings. Credentials — gitignored
    KERNEL-VERSIONS.md     what changed in each version of the platform
    CONSOLE-VERSIONS.md    what changed in each version of the Console that installs it
    extensions/            the extensions you write
    functions/             Cloud Functions shared by more than one extension
    .microteia/            the unpacked platform. DISPOSABLE — nothing of yours lives here

The line that explains the rest: **nothing you write lives in `.microteia/`.** That directory is
replaced whole on every upgrade. Everything of yours sits beside this file.

## Day to day

    microteia unpack --version latest   # take the newest published platform version
    microteia deploy                    # publish it — or --only hosting, --only functions
    microteia provision                 # apply what installed extensions need

`unpack --version` reads the published catalog, downloads the version and checks its sha256 before
touching what is installed here. On a machine that cannot reach the catalog, name a file instead:
`microteia unpack --kernel <package>.tgz`. And `microteia --version` says when a newer one is out.

## Building your own extensions

An extension is a declaration the platform installs — a screen with its fields, an automation, a page.
You write it in TypeScript and a compiler produces the `.json` that gets installed:

    cd extensions
    npx microteia-plugin create        # guided: asks what the extension should carry
    npx microteia-plugin check <folder>/plugin.ts
    npx microteia-plugin build <folder>/plugin.ts

`extensions/examples/` holds every extension that ships with Microteia, in source form — the best
reference there is. `extensions/AUTHORING.md` is the contract: extension points, the API a page may
use, translation rules, size limits.

## Working with an AI assistant

`extensions/` registers an MCP server (`.mcp.json`), so an assistant in your editor can ask **this**
installation what it offers — the extension points it has, what a page may import, and whether what it
just wrote would be accepted — instead of guessing from documentation. `extensions/AGENTS.md` holds the
rules it should follow.

The point of that is not novelty: it is that the assistant's answer can be *checked* before anything is
installed, by the same validation the platform runs.

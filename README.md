# nandorszentpeteri.dev

A portfolio site with two front doors:

- **Terminal view (`/`)** — a real, tiny shell you can type into, pinned to the
  viewport so it always fills the page and never scrolls the window. `ls`, `cd`,
  `cat`, `less`, `tree`, tab-completion and command history all work over a
  virtual filesystem whose files are the actual content of the site.
- **Classic view (`/classic`)** — a plain, scroll-friendly CV (with a
  downloadable PDF) for anyone who'd rather not touch a keyboard prompt. It
  renders the *same* markdown files the terminal serves.

Built with Next.js (App Router) and exported as a fully static site, so it
deploys anywhere — Vercel, Netlify, GitHub Pages, an S3 bucket.

The visual design was imported from Claude Design and rebuilt as a proper
Next.js app.

## Quick start

```bash
npm install
npm run dev      # http://localhost:3000
```

```bash
npm test         # run the unit tests (Vitest)
npm run build    # static export to ./out
```

## How it works

### Content lives in markdown

Everything the terminal shows comes from real files under [`content/`](content).
There's no giant `switch` statement of hard-coded strings — the files *are* the
filesystem.

```
content/
  README.md              ~/README.md              (about)
  work.md                ~/work.md                (full employment history)
  skills.md              ~/skills.md
  education.md           ~/education.md
  languages.md           ~/languages.md
  interests.md           ~/interests.md
  contact.md             ~/contact.md
  writings/              ~/writings/              (a real folder — currently hidden)
    README.md            ~/writings/README.md     (index)
    agentic-ai-field-notes.md
    webrtc-in-production.md
    pi-zero-vpn-gateway.md
```

> **Writings are temporarily switched off.** The markdown stays on disk, but
> `WRITINGS_ENABLED` in [`modules/features.ts`](modules/features.ts) is `false`, so the
> folder isn't mounted, the `writings` / `writing` / `blog` aliases are gone and
> the classic page drops its WRITING section. Flip the flag to bring it all back.

At build time, [`modules/content.ts`](modules/content.ts) reads `content/` and
[`modules/vfs.ts`](modules/vfs.ts) mounts every file under the home directory
(`/home/nandor`). The browser only ever receives the resulting tree — no
filesystem access happens at runtime.

**Both views read these same files, so they never drift apart.** The terminal
syntax-highlights them for `cat` / `less`; the classic page renders them as HTML
with [`react-markdown`](layout/Markdown.tsx). Add a file under `content/` and it
appears in `ls`, `tree`, `cat` and `less` immediately — no code changes needed.

**Keep each paragraph on one line — don't hard-wrap prose.** `cat` and `less`
show the file as it is on disk, so a paragraph wrapped at 80 columns wraps
*again* on a phone that only fits 40, and every other line comes out short. One
long line reflows to whatever width it's given. It also keeps `**bold runs**`
from being split across a line break, where the inline highlighter can't see
them as one token.

### The shell

[`modules/commands.ts`](modules/commands.ts) is a pure command evaluator: given the
filesystem, the current directory and a line of input, it returns output lines
plus any side-effect signals (clear the screen, open the pager, navigate). No
React, no DOM — which is why it's thoroughly unit-tested.

Supported commands:

| command        | what it does                                       |
| -------------- | -------------------------------------------------- |
| `help`         | list commands                                      |
| `whoami`       | a short bespoke intro                              |
| `ls [path]`    | list a directory                                   |
| `cd [path]`    | change directory (`cd ..`, `cd ~`, `cd -`)         |
| `cat <file>`   | dump a file — highlighted markdown *source* (markers kept) |
| `less <file>`  | page through the *rendered* file (`q` to quit, arrows / space) |
| `tree [path]`  | print the directory tree                           |
| `pwd`          | print the working directory                        |
| `contact-me`   | print contact details                              |
| `echo <text>`  | echo text                                          |
| `aliases` / `alias` | list the friendly shortcuts                   |
| `clear`        | wipe the screen (also `Ctrl-L`)                    |
| `gui`          | jump to the classic view                            |

Plus **aliases** for people who'd rather not think in paths — `work`, `skills`,
`education`, `languages`, `interests`, `contact`, `about`. Each alias
just `cat`s a file; run `aliases` to see the mapping. (And there may be a hidden
command or two.)

Tab completes commands and paths; `↑` / `↓` walk history.

### Project layout

```
app/
  layout.tsx          fonts + metadata
  page.tsx            terminal view  (pinned full-height, reads content)
  classic/page.tsx    classic view   (renders content/*.md via react-markdown)
  globals.css         theme + keyframes + markdown styles
components/           the interactive terminal
  Terminal.tsx        the terminal (input, history, tab-complete)
  Less.tsx            the `less` pager overlay
  TerminalLine.tsx    renders one (optionally highlighted) line
layout/               presentational pieces, shared by both views
  NeonBackground.tsx  orbs + animated grid floor
  TypedRole.tsx       the self-typing headline
  ViewToggle.tsx      terminal | classic switch
  Markdown.tsx        styled react-markdown renderer (classic view)
modules/
  vfs.ts              virtual filesystem + path resolution
  commands.ts         the shell + markdown highlighter (pure)
  content.ts          build-time markdown reader (server only)
  theme.ts            shared palette
content/              the site, as markdown
public/               downloadable CV (PDF)
tests/                Vitest suites
```

Components are named for what they are — `Less` is the `less` pager, not a
generic "Pager".

## Testing

```bash
npm test              # run once
npm run test:watch    # watch mode
npm run test:coverage # with coverage
```

The suites cover the filesystem (`buildVfs`, path resolution, lookups), the
shell (every command, aliases, tab-completion, markdown syntax highlighting and
inline parsing), an integration test that mounts the *real* `content/` files,
and the `<Terminal>` component (typing, running commands, history, `clear`).

## Deploying

It's a static export (`output: "export"` in `next.config.mjs`), so `npm run
build` produces a self-contained `out/` directory.

**Vercel:** import the repo — the framework preset handles it (build
`next build`, output `out`). No server, no environment variables.

**Anything else:** serve `out/` as static files.

```bash
npm run build
npx serve out        # preview the exported site locally
```

## Notes

- Fonts (Space Grotesk, IBM Plex Mono) load from Google Fonts with system
  fallbacks, so the build works offline.
- `npm audit` flags a few advisories in Next's own build toolchain (`postcss`,
  `sharp`). These run only at build time on local inputs and ship nothing to the
  static output; image optimization is disabled (`images.unoptimized`). Next
  itself is pinned to a patched release.
- Respects `prefers-reduced-motion` — the cursor blink, grid and scanlines stop.

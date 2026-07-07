# Bootstrap → Tailwind token equivalents: spacing & font-size

Companion to [`tailwind-migration-plan.md`](./tailwind-migration-plan.md) (PR1, commits 3–5:
the `bs-tw-map.js` codemod). That doc has the *decisions*; this doc has the *derivation* — every
value below was checked against this project's actual compiled CSS, not generic Bootstrap
defaults, because SN overrides `$font-size-base` and a few other variables that shift the scale.

> **Status (2026-07-06): historical reference.** The native-first strategy revision dropped
> value-exact parity — the live map (`scripts/codemods/bs-tw-map.js`) now emits nearest-native
> classes (`text-base`/`text-lg`, `rounded-md`, `font-mono`…), and the one deliberate type token
> is `--text-base: .93rem` in `styles/tailwind.css`. Use this doc to judge what "nearest" means,
> not as a target. In particular, the font-size section's "always use arbitrary brackets"
> guidance and the `leading-[1.2]` heading advice are superseded.
>
> **Second life (2026-07-07):** promoted to a census input for the master plan's **PR4 — SN
> identity reconciliation** — the post-parity pass that reviews every Bootstrap-era custom value
> and ports the keepers as `@theme` tokens. The derivation tables below are the record of what
> Bootstrap actually painted; don't delete this doc when PR3 removes the sass toolchain.

**How these numbers were produced:** compiled `styles/globals.scss` directly with the `sass` JS
API (`sass.compile('styles/globals.scss', { loadPaths: ['node_modules'] })`) and read the
generated rules for `.m-*`/`.p-*`/`.gap-*`, `.fs-*`, and `h1`–`h6`. `$spacer` is untouched
(Bootstrap default `1rem`); `$font-size-base: .93rem` and `$enable-responsive-font-sizes: true`
are both overridden in `styles/globals.scss`, which is why the font-size numbers below don't
match stock Bootstrap docs.

---

## Spacing

### The scale

Bootstrap's spacer step and Tailwind's spacing number are **different numbering systems that
happen to overlap** — this is the #1 risk in the migration plan (top risk #1: "same-name/
different-value collisions"). Never copy a bare numeral across; always translate it.

| BS step | rem / px (compiled) | → TW step | rem / px (Tailwind default) |
|---|---|---|---|
| `0` | 0 | `0` | 0 |
| `1` | .25rem / 4px | `1` | .25rem / 4px |
| `2` | .5rem / 8px | `2` | .5rem / 8px |
| `3` | **1rem / 16px** | `4` | **1rem / 16px** |
| `4` | **1.5rem / 24px** | `6` | **1.5rem / 24px** |
| `5` | 3rem / 48px | `12` | 3rem / 48px |
| `auto` | auto | `auto` | auto |

The trap: Tailwind's own `3` and `4` exist and mean something else. TW `3` = .75rem/12px (no BS
equivalent at all). TW `4` = 1rem/16px — which is BS's `3`, not BS's `4`. So `mt-3` → `mt-4` is
correct and `mt-4` → `mt-6` is correct, but a naive find-replace that skips numerals it doesn't
recognize will silently leave `mt-4` alone and produce a **1.5rem → 1rem regression**. This is
exactly why the codemod is a frozen literal map, not a formula.

### Prefixes (unchanged between BS and TW)

`m`, `p`, `mt`/`pt`, `mb`/`pb`, `mx`/`px`, `my`/`py`, `gap` all carry over as-is — only the
numeral changes. `ms`/`me`/`ps`/`pe` stay logical properties in both frameworks (`margin-inline-
start` etc.) and keep their names unchanged too.

### Responsive infix → prefix

Breakpoints are token-identical by design (`@theme` in `styles/tailwind.css` copies Bootstrap's
sm/md/lg/xl/2xl px values exactly), so only the position of the modifier moves:

```
mt-md-3   →   md:mt-4
px-sm-0   →   sm:px-0
```

### Special-cased, not a spacing value

`pe-none` → `pointer-events-none`. It matches the `pe-` prefix pattern but isn't padding —
must be excluded from the numeral-rewrite pass before the generic rule runs (already called out
in the migration plan's codemod-scope section).

### What's actually in use (from `bootstrap-usage-audit.md` + a direct `wallets/` grep)

The audit undercounts spacing because it didn't scan `wallets/`. Real numbers, worth using as
the smoke-test set when running the codemod:

| Class | Uses (audit, `components/pages/lib/svgs`) |
|---|---:|
| `p-0` | 45 |
| `mt-3` | 36 |
| `ms-1` | 32 |
| `mb-2` / `mt-2` | 30 each |
| `ms-2` | 29 |
| `mb-3` | 24 |

Plus `gap-*`, absent from the audit's spacing table entirely (it was scanned but zero hits
suggests the tokenizer missed it, or usage is concentrated in `wallets/`) — direct grep across
`components pages lib svgs wallets` finds: `gap-2`×17, `gap-3`×13, `gap-4`×4, `gap-1`×4. Same
scale, same rule (`gap-2`→`gap-2`, `gap-3`→`gap-4`).

---

## Font sizes

Two independent things get called "font size" here — don't conflate them:

1. **`$font-size-base` (.93rem)** — the body-copy base. It's inherited from Bootstrap's `body`
   rule in PR1/PR2 (globals.scss still owns it) and isn't itself a utility class.
2. **`.fs-1`–`.fs-6` utilities + raw `h1`–`h6` elements** — both driven off the same
   `$font-sizes` map, and both go through RFS (Responsive Font Sizes, enabled here) above a
   ~1.25rem threshold.

### Why Tailwind's named scale doesn't apply

Tailwind's default `text-*` scale doesn't line up with any of SN's compiled values — not even
close enough to round to. This is why the migration plan uses arbitrary-value brackets
(`text-[0.93rem]`) instead of named utilities (`text-sm`) for every one of these:

| Tailwind name | Value | Nearest BS value | Gap |
|---|---|---|---|
| `text-xs` | .75rem | — | no BS equivalent |
| `text-sm` | .875rem | `fs-6` / `$font-size-base` .93rem | 0.055rem / ~0.9px off |
| `text-base` | 1rem | — | no BS equivalent |
| `text-lg` | 1.125rem | `fs-5` 1.1625rem | 0.0375rem / ~0.6px off |
| `text-xl` | 1.25rem | — | no BS equivalent |

Sub-pixel gaps like these are exactly what breaks the "pixel-identical to master" requirement,
so `fs-*`/heading sizes always get an arbitrary bracket value, never a named Tailwind size.

### The scale itself (compiled, verified)

RFS makes `fs-1`–`fs-4` fluid (`calc()` + a `min-width: 1200px` media query that pins the cap);
`fs-5`/`fs-6` fall below RFS's activation threshold and compile to flat static values.

| BS class / element | Compiled Bootstrap CSS | Tailwind arbitrary-value equivalent | Actually used? |
|---|---|---|---|
| `.fs-1` / `h1` | `calc(1.3575rem + 1.29vw)`, capped `2.325rem` @≥1200px | `text-[clamp(1.3575rem,_1.3575rem_+_1.29vw,_2.325rem)]` | no direct utility use; powers raw `h1` in rendered markdown |
| `.fs-2` / `h2` | `calc(1.311rem + 0.732vw)`, capped `1.86rem` | `text-[clamp(1.311rem,_1.311rem_+_0.732vw,_1.86rem)]` | same |
| `.fs-3` / `h3` | `calc(1.28775rem + 0.453vw)`, capped `1.6275rem` | `text-[clamp(1.28775rem,_1.28775rem_+_0.453vw,_1.6275rem)]` | same |
| `.fs-4` / `h4` | `calc(1.2645rem + 0.174vw)`, capped `1.395rem` | `text-[clamp(1.2645rem,_1.2645rem_+_0.174vw,_1.395rem)]` | same |
| `.fs-5` / `h5` | `1.1625rem` (static, below RFS threshold) | `text-[1.1625rem]` | **yes** — `fs-5`×7 uses / 2 files |
| `.fs-6` / `h6` | `0.93rem` (static, below RFS threshold — equals `$font-size-base`) | `text-[0.93rem]` | **yes** — `fs-6`×1 use / 1 file |

**Collapsing calc+media-query into `clamp()`:** Bootstrap emits RFS as a `calc()` plus a
`@media (min-width: 1200px)` override that pins the ceiling. A single native CSS `clamp(min,
calc(...), max)` is equivalent and collapses to one declaration — same floor, same slope, same
ceiling — so it's the natural shape for a one-line Tailwind arbitrary value instead of carrying
the media query separately.

**Tailwind arbitrary-value syntax trap:** spaces inside `[...]` must be encoded as `_`
(Tailwind rewrites literal underscores back to spaces at build time). Copy the bracket values
above verbatim — `text-[clamp(1.1625rem 1.29vw)]` (with real spaces) silently fails to compile
as a single utility.

~~Since `fs-1`–`fs-4` have zero direct utility-class usage today~~ **Correction (2026-07-03):
`fs-4` has one live use** — `wallets/client/components/layout.js` (this doc inherited the
audit's blind spot: it never scanned `wallets/`). The codemod map therefore carries all six
`fs-*` entries, clamp forms included. The `clamp()` forms also matter for PR3's `base.css`
(raw `h1`–`h6` in rendered post/comment markdown).

## Line-height

Neither table above says anything about line-height — worth covering explicitly, because
Tailwind's arbitrary bracket syntax behaves differently from its *named* scale in a way that
happens to split cleanly along the same `fs-*` vs `h1`–`h6` line as the font-size table:

- **Named utilities** (`text-lg`, `text-2xl`, …) carry a default line-height from Tailwind's
  theme (`--text-lg--line-height`, etc.) — font-size and line-height arrive together whether
  you asked for the second one or not.
- **Arbitrary-value utilities** (`text-[0.93rem]`, `text-[clamp(...)]`) set *only* the property
  named in the brackets. No line-height is emitted unless a separate `leading-*` utility is
  added alongside it.

Every value in the font-size table above is an arbitrary bracket (SN's real numbers never land
on a named Tailwind step), so the second behavior is what applies — and it maps directly onto
two different Bootstrap behaviors:

### `fs-1`–`fs-6`: add nothing — let it inherit

Bootstrap's `fs-*` utility only ever sets `font-size`; it never touches `line-height`, so
whatever the element already inherits (body's `$line-height-base: 1.75` in most places, or a
locally overridden value inside some `.module.css`) keeps applying. Tailwind's arbitrary syntax
already inherits by default, so **`text-[0.93rem]` alone reproduces this exactly** — no `/N`
modifier, no `leading-*` utility, nothing to compute.

This refines an idea from an external BS→TW table a user shared for comparison: that table
hardcoded every `fs-*` row's line-height to a flat 1.5× the font-size (stock Bootstrap's default
`$line-height-base: 1.5`). Baking in *any* fixed multiplier is both unnecessary and wrong for
SN — SN's real base is 1.75, not 1.5, and a hardcoded ratio stops matching Bootstrap's actual
cascade the moment `fs-*` is used somewhere with a different ambient line-height. Letting it
inherit costs nothing and is correct in every context, not just the common one.

### `h1`–`h6`: add `leading-[1.2]` explicitly

Unlike `fs-*`, Bootstrap's headings *do* override line-height — `$headings-line-height: 1.2`,
confirmed in SN's own compiled output (`line-height: 1.2` on the shared `h1..h6` rule). Because
it's a unitless ratio, it scales exactly with font-size at every viewport width, including
through `h1`–`h4`'s RFS `clamp()` fluid range, with zero seams. Reach for the unitless arbitrary
value, applied as a separate utility alongside the font-size one, not a fixed-rem `leading-N`
step:

```
text-[clamp(1.3575rem,_1.3575rem_+_1.29vw,_2.325rem)] leading-[1.2]
```

A per-step `leading-N` snapped to Tailwind's quarter-rem grid (e.g. the external table's
`text-2xl/7`) only lands near 1.2× at the discrete named sizes it was built around — it can't
track a `clamp()` value that's continuously changing between those sizes, so it would
reintroduce exactly the kind of sub-pixel drift PR1 is trying to eliminate.

### Heading weight + margin (reusable as-is)

The rest of Bootstrap's heading defaults aren't SN-specific and match exactly what SN's own
compiled CSS already shows:

| Bootstrap default | Tailwind equivalent | Verified against |
|---|---|---|
| `$headings-font-weight: 500` | `font-medium` | SN compiled: `font-weight: 500` |
| `$headings-margin-bottom: .5rem` | `mb-2` (2 × .25rem = .5rem) | SN compiled: `margin-bottom: 0.5rem` |

Both are plain Bootstrap defaults, untouched by SN's `$font-size-base`/RFS overrides, so they
carry over unchanged. Note `mb-2` here is a literal Tailwind rem match, not a Bootstrap
spacer-index translation — don't confuse it with the `mb-*` spacing-scale rules earlier in this
doc, where the numeral does need to change (`mb-3`→`mb-4`, not `mb-3`→`mb-3`).

### Adjacent, already decided elsewhere (not re-litigated here)

Font *weight*/*style* utilities (`fw-bold`→`font-bold`, `fw-bolder`→`font-bolder` custom
token, `fst-italic`→`italic`, `font-monospace`→`font-mono`) live in the migration plan's
codemod mapping table, not here — this doc is scoped to size only, per the PR1 plan's spacing
+ font-size split.

// Frozen literal Bootstrap → Tailwind class map (PR1, commits 3–5).
//
// Derivations for every non-obvious value live in docs/dev/bootstrap-tailwind-tokens.md
// (spacing scale, fs-* RFS values) and docs/dev/tailwind-migration-plan.md (mapping table).
// This is deliberately a frozen lookup table, not a formula: Bootstrap and Tailwind both
// have `mt-3`/`mt-4`/`gap-3` with DIFFERENT values, so any digit math at runtime risks
// silent same-name/different-value regressions (top risk #1 in the migration plan).
//
// Token resolution order (implemented in bs-to-tw.js):
//   1. DELETE            — dead classes, removed outright
//   2. MAP               — exact-token rename (may expand to multiple tokens)
//   3. IDENTITY          — same name + same computed value in both frameworks; untouched
//   4. DEFERRED          — Bootstrap-only classes that Bootstrap CSS keeps owning during
//                          PR1 coexistence; resolved in PR2/PR3. Untouched, not an error.
//   5. responsive infix  — `X-{sm|md|lg|xl|xxl}-Y` decomposes to base `X-Y`, resolved via
//                          1–4, re-prefixed `{bp}:` (xxl → 2xl). Breakpoints are
//                          token-identical by design (@theme in styles/tailwind.css).
//   6. anything else     — left alone; bs-utility-check.js decides if it's a leftover.

// ---------------------------------------------------------------------------
// Dead classes: no styling in Bootstrap 5, delete the token.
// ---------------------------------------------------------------------------
const DELETE = new Set([
  'text-left', // Bootstrap v4 name; v5 renamed it text-start, so this styles nothing
  'flex-shrink', // not a Bootstrap 5 class (only flex-shrink-0/1 exist); styles nothing
  'd-flex-inline', // typo'd class (real one is d-inline-flex); styles nothing
  'font-weight-light', // Bootstrap v4 name (v5: fw-light); styles nothing
  'no-gutters', // Bootstrap v4 Row modifier (v5: g-0); styles nothing
  // DANGER: dead today (defined in no stylesheet) but a VALID Tailwind name —
  // leaving it would make Tailwind's scanner activate it and change rendering.
  // Deleting preserves master's pixels; add back deliberately if wanted.
  'pr-4', // Bootstrap v4 name; in Tailwind this is padding-right: 1rem
  // used in JSX but defined in NO stylesheet (checked all scss/css incl. modules)
  'text-small',
  'vertical-align-middle'
])

const MAP = {
  // -------------------------------------------------------------------------
  // Spacing — BS spacer step → TW spacing step (see tokens doc: 3→4, 4→6, 5→12).
  // Steps 0/1/2/auto are value-identical and live in IDENTITY below.
  // -------------------------------------------------------------------------
  'm-3': 'm-4',
  'm-4': 'm-6',
  'm-5': 'm-12',
  'mt-3': 'mt-4',
  'mt-4': 'mt-6',
  'mt-5': 'mt-12',
  'mb-3': 'mb-4',
  'mb-4': 'mb-6',
  'mb-5': 'mb-12',
  'ms-3': 'ms-4',
  'ms-4': 'ms-6',
  'ms-5': 'ms-12',
  'me-3': 'me-4',
  'me-4': 'me-6',
  'me-5': 'me-12',
  'mx-3': 'mx-4',
  'mx-4': 'mx-6',
  'mx-5': 'mx-12',
  'my-3': 'my-4',
  'my-4': 'my-6',
  'my-5': 'my-12',
  'p-3': 'p-4',
  'p-4': 'p-6',
  'p-5': 'p-12',
  'pt-3': 'pt-4',
  'pt-4': 'pt-6',
  'pt-5': 'pt-12',
  'pb-3': 'pb-4',
  'pb-4': 'pb-6',
  'pb-5': 'pb-12',
  'ps-3': 'ps-4',
  'ps-4': 'ps-6',
  'ps-5': 'ps-12',
  'pe-3': 'pe-4',
  'pe-4': 'pe-6',
  'pe-5': 'pe-12',
  'px-3': 'px-4',
  'px-4': 'px-6',
  'px-5': 'px-12',
  'py-3': 'py-4',
  'py-4': 'py-6',
  'py-5': 'py-12',
  'gap-3': 'gap-4',
  'gap-4': 'gap-6',
  'gap-5': 'gap-12',
  // row-gap/column-gap rename entirely, so every step needs an entry
  'row-gap-0': 'gap-y-0',
  'row-gap-1': 'gap-y-1',
  'row-gap-2': 'gap-y-2',
  'row-gap-3': 'gap-y-4',
  'row-gap-4': 'gap-y-6',
  'row-gap-5': 'gap-y-12',
  'column-gap-0': 'gap-x-0',
  'column-gap-1': 'gap-x-1',
  'column-gap-2': 'gap-x-2',
  'column-gap-3': 'gap-x-4',
  'column-gap-4': 'gap-x-6',
  'column-gap-5': 'gap-x-12',

  // -------------------------------------------------------------------------
  // Pointer events — matches the pe-* padding prefix but isn't padding; exact-token
  // lookup means there's no ordering hazard (pe-none/pe-auto aren't spacing keys).
  // -------------------------------------------------------------------------
  'pe-none': 'pointer-events-none',
  'pe-auto': 'pointer-events-auto',

  // -------------------------------------------------------------------------
  // Display
  // -------------------------------------------------------------------------
  'd-none': 'hidden',
  'd-inline': 'inline',
  'd-inline-block': 'inline-block',
  'd-block': 'block',
  'd-grid': 'grid',
  'd-inline-grid': 'inline-grid',
  'd-flex': 'flex',
  'd-inline-flex': 'inline-flex',

  // -------------------------------------------------------------------------
  // Flex
  // -------------------------------------------------------------------------
  'flex-column': 'flex-col',
  'flex-column-reverse': 'flex-col-reverse',
  'flex-fill': 'flex-auto', // flex: 1 1 auto — NOT flex-1 (1 1 0%)
  'flex-grow-0': 'grow-0',
  'flex-grow-1': 'grow',
  'flex-shrink-0': 'shrink-0',
  'flex-shrink-1': 'shrink',
  'justify-content-start': 'justify-start',
  'justify-content-end': 'justify-end',
  'justify-content-center': 'justify-center',
  'justify-content-between': 'justify-between',
  'justify-content-around': 'justify-around',
  'justify-content-evenly': 'justify-evenly',
  'align-items-start': 'items-start',
  'align-items-end': 'items-end',
  'align-items-center': 'items-center',
  'align-items-baseline': 'items-baseline',
  'align-items-stretch': 'items-stretch',
  'align-self-auto': 'self-auto',
  'align-self-start': 'self-start',
  'align-self-end': 'self-end',
  'align-self-center': 'self-center',
  'align-self-baseline': 'self-baseline',
  'align-self-stretch': 'self-stretch',
  'align-content-start': 'content-start',
  'align-content-end': 'content-end',
  'align-content-center': 'content-center',
  'align-content-between': 'content-between',
  'align-content-around': 'content-around',
  'align-content-stretch': 'content-stretch',

  // -------------------------------------------------------------------------
  // Font — weights match numerically (bold 700, semibold 600, medium 500,
  // normal 400, light 300); bolder uses the custom --font-weight-bolder token
  // (CSS keyword `bolder`, not numeric 800) from styles/tailwind.css.
  // -------------------------------------------------------------------------
  'fw-bold': 'font-bold',
  'fw-bolder': 'font-bolder',
  'fw-semibold': 'font-semibold',
  'fw-medium': 'font-medium',
  'fw-normal': 'font-normal',
  'fw-light': 'font-light',
  'fst-italic': 'italic',
  'fst-normal': 'not-italic',
  'font-monospace': 'font-mono', // --font-mono in styles/tailwind.css = Bootstrap's stack

  // -------------------------------------------------------------------------
  // Line height — Tailwind's named leading-* values match Bootstrap's lh-*
  // exactly (1 / 1.25 / 1.5 / 2)
  // -------------------------------------------------------------------------
  'lh-1': 'leading-none',
  'lh-sm': 'leading-tight',
  'lh-base': 'leading-normal',
  'lh-lg': 'leading-loose',

  // -------------------------------------------------------------------------
  // Font sizes — 2026-07-06 native-first revision: nearest native steps replace
  // the RFS clamps / Bootstrap-exact arbitrary values (fs-1..4 matched on their
  // desktop caps; text-base is SN's .93rem @theme token in styles/tailwind.css).
  // Unlike the old arbitrary values, named steps also carry their paired
  // line-height token — an intended delta.
  // -------------------------------------------------------------------------
  'fs-1': 'text-4xl',
  'fs-2': 'text-3xl',
  'fs-3': 'text-2xl',
  'fs-4': 'text-xl',
  'fs-5': 'text-lg',
  'fs-6': 'text-base',

  // -------------------------------------------------------------------------
  // Text — note text-nowrap must NOT map to Tailwind's text-nowrap
  // (text-wrap: nowrap); Bootstrap's sets white-space: nowrap.
  // -------------------------------------------------------------------------
  'text-nowrap': 'whitespace-nowrap',
  'text-wrap': 'whitespace-normal',
  'text-truncate': 'truncate',
  'text-break': 'break-words',
  'text-uppercase': 'uppercase',
  'text-lowercase': 'lowercase',
  'text-capitalize': 'capitalize',
  'text-decoration-underline': 'underline',
  'text-decoration-none': 'no-underline',
  'text-decoration-line-through': 'line-through',

  // -------------------------------------------------------------------------
  // Sizing
  // -------------------------------------------------------------------------
  'w-100': 'w-full',
  'w-75': 'w-3/4',
  'w-50': 'w-1/2',
  'w-25': 'w-1/4',
  'h-100': 'h-full',
  'h-75': 'h-3/4',
  'h-50': 'h-1/2',
  'h-25': 'h-1/4',
  'mw-100': 'max-w-full',
  'mh-100': 'max-h-full',
  'vw-100': 'w-screen',
  'vh-100': 'h-screen',
  'min-vw-100': 'min-w-[100vw]',
  'min-vh-100': 'min-h-screen',

  // -------------------------------------------------------------------------
  // Position
  // -------------------------------------------------------------------------
  'position-static': 'static',
  'position-relative': 'relative',
  'position-absolute': 'absolute',
  'position-fixed': 'fixed',
  'position-sticky': 'sticky',
  // globals.scss overrides $zindex-sticky to 900 (not Bootstrap's 1020).
  // sticky-lg-top (in use) resolves via responsive-infix decomposition of this.
  'sticky-top': 'sticky top-0 z-[900]',
  'sticky-bottom': 'sticky bottom-0 z-[900]',

  // -------------------------------------------------------------------------
  // Border radius — SN's $border-radius override is .4rem; rounded-md (.375rem)
  // is the nearest native step (2026-07-06 revision — the --radius-sn token is
  // gone). $border-radius-sm (.25rem) and -lg (.5rem) are stock and match
  // Tailwind's rounded-sm/rounded-lg exactly. Tailwind v4 has no bare `rounded`.
  // -------------------------------------------------------------------------
  rounded: 'rounded-md',
  'rounded-0': 'rounded-none',
  'rounded-1': 'rounded-sm',
  'rounded-2': 'rounded-md',
  'rounded-3': 'rounded-lg',
  'rounded-4': 'rounded-2xl', // BS $border-radius-xl 1rem = TW rounded-2xl exactly
  'rounded-5': 'rounded-4xl', // BS $border-radius-xxl 2rem = TW rounded-4xl exactly
  'rounded-circle': 'rounded-full',
  'rounded-pill': 'rounded-full',

  // -------------------------------------------------------------------------
  // Accessibility — visually-hidden-focusable's BS selector is
  // :not(:focus):not(:focus-within); :focus-within already matches the focused
  // element itself, so focus-within:not-sr-only alone is an exact equivalent.
  // -------------------------------------------------------------------------
  'visually-hidden': 'sr-only',
  'visually-hidden-focusable': 'sr-only focus-within:not-sr-only',

  // -------------------------------------------------------------------------
  // OPTIONAL: SN custom utilities from globals.scss → native Tailwind.
  // Not Bootstrap classes — delete this block to keep PR1 strictly Bootstrap-
  // scoped. Every replacement below is value-exact against the compiled
  // Tailwind 4.3.2 output (verified 2026-07-03); the globals.scss definitions
  // become dead rules and get removed in PR3.
  // NOTE `pointer` (17 uses) is deliberately NOT here:
  // link-to-context.module.css targets `:global(.pointer)` to re-enable
  // pointer-events inside the click-to-context overlay — rename both together
  // in PR3 (PR1 doesn't touch module.css).
  // -------------------------------------------------------------------------
  'ms-xs': 'ms-0.5', // globals: margin-left .125rem; inline-start ≡ left (LTR-only app)
  'line-height-1': 'leading-none', // 1
  'line-height-sm': 'leading-tight', // 1.25
  'line-height-md': 'leading-normal', // 1.5
  'w-fit-content': 'w-fit',
  'text-monospace': 'font-mono', // native stack adopted 2026-07-06 (globals' bare `monospace` parity dropped)
  'text-underline': 'underline'
}

// ---------------------------------------------------------------------------
// Same class name, same computed value in both frameworks. Tailwind generates
// these (important-flagged, layered → wins over Bootstrap's copy) or Bootstrap
// keeps serving them — either way pixel-identical, so the codemod leaves them.
// text-muted/-primary/etc. work because styles/tailwind.css wires
// --color-* → var(--sn-*) → live --bs-*/--theme-* vars.
// ---------------------------------------------------------------------------
const IDENTITY = new Set([
  // spacing steps 0/1/2/auto (.25rem grid aligns exactly)
  'm-0', 'm-1', 'm-2', 'm-auto',
  'mt-0', 'mt-1', 'mt-2', 'mt-auto',
  'mb-0', 'mb-1', 'mb-2', 'mb-auto',
  'ms-0', 'ms-1', 'ms-2', 'ms-auto',
  'me-0', 'me-1', 'me-2', 'me-auto',
  'mx-0', 'mx-1', 'mx-2', 'mx-auto',
  'my-0', 'my-1', 'my-2', 'my-auto',
  'p-0', 'p-1', 'p-2',
  'pt-0', 'pt-1', 'pt-2',
  'pb-0', 'pb-1', 'pb-2',
  'ps-0', 'ps-1', 'ps-2',
  'pe-0', 'pe-1', 'pe-2',
  'px-0', 'px-1', 'px-2',
  'py-0', 'py-1', 'py-2',
  'gap-0', 'gap-1', 'gap-2',
  // flex
  'flex-row', 'flex-row-reverse', 'flex-wrap', 'flex-nowrap', 'flex-wrap-reverse',
  // SN custom in globals.scss with the same name AND declaration as the
  // Tailwind utility (justify-self: center) — Tailwind takes over seamlessly
  'justify-self-center',
  // text alignment (text-start/end: BS emits left/right, TW emits logical
  // start/end — identical rendering in this LTR-only app)
  'text-center', 'text-start', 'text-end',
  // colors wired as Tailwind tokens in styles/tailwind.css @theme inline
  'text-muted', 'text-reset', 'text-primary', 'text-secondary', 'text-danger',
  'text-info', 'text-success', 'text-boost', 'text-nostr',
  // vertical alignment
  'align-middle', 'align-top', 'align-bottom', 'align-baseline',
  'align-text-top', 'align-text-bottom',
  // sizing / overflow / visibility / opacity / effects
  'w-auto', 'h-auto',
  'overflow-hidden', 'overflow-auto', 'overflow-scroll', 'overflow-visible',
  // BS border-N is N px = Tailwind's border-<number>; bare `border` is NOT
  // identity (BS adds --bs-border-color; Tailwind inherits currentColor)
  'border-1', 'border-2', 'border-3', 'border-4', 'border-5',
  'visible', 'invisible',
  'opacity-0', 'opacity-25', 'opacity-50', 'opacity-75', 'opacity-100',
  'shadow-none',
  // placement zeros (BS top-50/start-50 etc. are % and would NOT be identity)
  'top-0', 'bottom-0', 'start-0', 'end-0'
])

// ---------------------------------------------------------------------------
// Bootstrap-only utilities deliberately left alone in PR1. Bootstrap's CSS
// still owns them during coexistence; they get resolved in PR2 (component
// recipes) or PR3 (token wiring / app.css survivors). The checker reports them
// as "deferred", not as errors.
//   - warning/light/dark/grey*/twitter color utilities: NOT wired as Tailwind
//     tokens (see the exclusion note in styles/tailwind.css @theme inline).
//   - bg-opacity-*: modifies Bootstrap's .bg-* var; no Tailwind v4 equivalent.
//   - small: Bootstrap's .small (font-size .875em) — PR3 app.css decision.
// ---------------------------------------------------------------------------
const DEFERRED = new Set([
  'text-warning', 'text-light', 'text-dark', 'text-white', 'text-black',
  'text-twitter', 'text-grey', 'text-grey-medium', 'text-grey-darkmode',
  'text-body', 'text-body-secondary', 'text-body-emphasis',
  'bg-primary', 'bg-secondary', 'bg-danger', 'bg-warning', 'bg-info',
  'bg-success', 'bg-light', 'bg-dark', 'bg-white', 'bg-black', 'bg-boost',
  'bg-nostr', 'bg-twitter', 'bg-grey', 'bg-grey-medium', 'bg-grey-darkmode',
  'bg-body', 'bg-transparent',
  'bg-opacity-10', 'bg-opacity-25', 'bg-opacity-50', 'bg-opacity-75',
  'small', 'list-unstyled'
])

// ---------------------------------------------------------------------------
// stacker.news custom classes commonly mixed into the same className strings
// (globals.scss / *.module.css). Never Bootstrap's, never touched; listed so
// inventory output classifies them instead of showing them as unknown.
// fill-* and line-height-* are matched by prefix in the scripts.
// ---------------------------------------------------------------------------
const SN_CUSTOM = new Set([
  // `pointer` and `upvoteParent` are pinned by link-to-context.module.css
  // `:global(...)` selectors — never rename before PR3
  'pointer', 'upvoteParent',
  'clouds', 'spin', 'theme', 'outline-it', 'clickToContext',
  'topLevel', 'standalone', 'firstItem', 'lastItem',
  'pulse', 'snow', 'hide-spinners'
])

// BS responsive infix → TW variant prefix (breakpoints token-identical by design)
const BREAKPOINTS = { sm: 'sm', md: 'md', lg: 'lg', xl: 'xl', xxl: '2xl' }

// MAP keys that are also possible codemod OUTPUTS: BS mt-3 → TW mt-4 while BS
// mt-4 is itself a key (the *-4 spacing family). After the one-shot run these
// names are Tailwind-intent and must never be re-transformed:
//   - bs-to-tw.js uses this set to refuse an accidental second --write
//   - bs-utility-check.js skips them (the documented residual of migration
//     plan top risk #1 — the cascade makes any stray duplicate resolve to the
//     Tailwind value anyway)
const AMBIGUOUS = new Set()
{
  const outputs = new Set(Object.values(MAP).flatMap(v => v.split(' ')))
  for (const key of Object.keys(MAP)) {
    if (outputs.has(key)) AMBIGUOUS.add(key)
  }
}

module.exports = { MAP, IDENTITY, DEFERRED, DELETE, SN_CUSTOM, BREAKPOINTS, AMBIGUOUS }

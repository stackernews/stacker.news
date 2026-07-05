# Styling architecture

How styling works after the redesign: Tailwind v4 utilities for layout and metrics,
CSS modules for paint and state, Base UI for behavior. Code comments state the local
fact in a line or two; the longer mechanisms live here.

## 1. Cascade contract

During the migration Bootstrap is still installed. Bootstrap ships its utilities
unlayered with `!important`. We import Tailwind's utilities into a CSS layer with
the `important` flag. The cascade inverts important layer order, so the precedence
is: layered important, then unlayered important, then unlayered normal, then
layered normal. A Tailwind utility therefore always beats the same named Bootstrap
utility while both stylesheets are live. This is what made the codemod rename safe:
the new value takes effect immediately. The contract holds until PR3 removes
Bootstrap.

Two practical consequences:

- Module CSS cannot beat a utility. When a call site needs different geometry than
  a recipe emits, it passes its own utility and `twMerge` drops the recipe's
  conflicting class. Never fight a utility from a module.
- Class merging only works for classes `twMerge` understands. Every custom token
  added to `@theme` in `styles/tailwind.css` needs a matching entry in `lib/cn.js`,
  or overrides of that token silently stop merging and stylesheet order picks the
  winner.

## 2. Ownership rules

One property, one source, per component.

- Recipes (the class builders in `components/ui/*.js` and `components/form/field.js`)
  own metrics and layout: display, padding, border radius, font size, font weight.
- Modules (`*.module.css`) own paint: colors, state styles, border colors, motion.
- Call sites own one-off geometry, passed as utilities so `twMerge` arbitrates.

A module className handed to a Button must not declare recipe owned properties.
They lose to the important utilities and read as intent they don't have. The poll
pill is the reference example: its geometry (`block rounded-4xl px-[1.1rem]
py-[.4rem] leading-4`) rides the call site, and the module keeps only what the
recipe never emits (margin, border, width, text-transform).

## 3. Tokens

`styles/tailwind.css` defines the `--sn-*` token bridge. The tokens point at the
live Bootstrap and theme variables, so territory branding (`custom-css.js` rewrites
`--bs-primary` and friends at runtime) and dark mode flow through to the `text-*`,
`bg-*`, `border-*` and `fill-*` utilities. PR3 flips the aliases to canonical
literals.

The z-index ladder is the single stacking authority. It is Bootstrap's compiled
scale with SN's sticky override at 900. Every popup portals to `body` and takes its
z from the ladder variables, never a literal. Menus sit above the modal pair
because our menus portal to `body` (Bootstrap's dropdowns never did), and below
popovers because no menu opens from a popover.

Breakpoints are token identical to Bootstrap's on purpose, so `md:flex` paints
exactly like the old `d-md-flex`.

## 4. Popup family

Every popup (tooltip, popover, preview card, menu, dialog, drawer, toast) portals
to `body` and rides the ladder.

### The arrow

One shared module, `components/ui/arrow.module.css`, used by tooltip, popover and
preview card. The construction comes from the Base UI docs:

- The arrow element is a half height clip window. The visible diamond is a square
  drawn by the `::before`, carrying a full border, rotated so only its two outward
  faces show through the window. Every side rule is just an offset plus a rotation
  of that one shape.
- The offsets are the docs' plain values. The popup is `position: relative`, so
  the offsets resolve against its padding box, which sits one border width inside
  the visible edge. A bordered popup therefore gets the arrow fill overlapping its
  border in the notch automatically, with no hairline; a borderless popup (the
  tooltip) sits flush. Do not add border terms to the offsets.
- Size semantics: `--arrow-size` is the drawn base width. The tip height is half
  the size minus the popup border. The default 16px draws roughly Bootstrap's
  native popover arrow (1rem by .5rem); the tooltip overrides down to 12px.
- Flush placement against a popup edge is minus three quarters of the size, not
  half, because the rotated square keeps its unrotated layout box.
- `data-side` reports the popup's side, so `side="bottom"` styles the arrow on the
  popup's top edge.

The popup rule that pins a transform (see `popover.module.css`) exists for the
arrow: while the open and close scale transition runs, the transform makes the
popup the arrow's containing block, and the moment the transform returns to none
the arrow would re-anchor to the positioner and visibly jump. Keeping a transform
on the popup at rest keeps the containing block stable.

### Focus

- Both Bootstrap and Base UI focus popup containers programmatically. Bootstrap's
  CSS shipped the ring suppression, so it never painted. Ours must too: every
  popup surface with `tabindex="-1"` gets `outline: 0` in its module the day it is
  born. Whether a browser paints a ring for script focus is heuristic dependent,
  so a miss hides easily.
- Bootstrap paired `:hover` with `:focus` on links and nav elements. The house
  reading is `:focus-visible`: mouse clicks no longer leave sticky hover paint,
  keyboard focus still shows.

## 5. Buttons and forms

### Button skin math

Hover and active states follow Bootstrap's baked formulas, verified value exact
against the compiled CSS. Hover mixes 15 percent of `--sn-btn-mix` into the base
background, active mixes 20 percent. White text variants mix toward black, which
is the shade direction and the default. Black text variants set `--sn-btn-mix:
#fff` to tint instead. `primary` and `secondary` keep black even with black text
because SN's brand button mixin shades regardless of text color. Variants the
formula doesn't fit (the outlines, `link`) pin explicit variables, which win
through the fallback chain. The brandable pair reads the live variables, so a
territory retint recomputes the mixes at paint time.

### The load bearing transparent border

Every `.btn` carries `border: 1px solid transparent` in the module, Bootstrap's
exact line. Buttons must measure the same 40px as 1px bordered inputs or input
groups misalign. Outline variants recolor that border. Border widths beyond 1px
are call site utilities while the colors stay in the skin, because a border width
utility with the important flag would also beat the pinned colors.

### Input group corners

Corner joining is structural CSS in `form/field.module.css`. Every real group
member's radius is a plain module declaration, so the first child and last child
rules win on specificity alone, with no layer fight. React fragments don't create
DOM nodes, so the rules see the flattened members as real siblings. Members must
not carry radius utilities; corner overrides happen at the call site, like the
copy button's `rounded-s-none`.

Radius theming rides a custom property: members read
`var(--sn-input-radius, .375rem)`. A consumer sets the variable on the form
element, the members' common ancestor, never on the input rule, because custom
properties inherit downward and an addon is the input's sibling, not its child.
The wallets capability card is the reference consumer.

### Sizes

`inputClasses` and `buttonClasses` carry paired size maps. Both sides of an input
group must use the same size or the row misaligns, because the group stretches
items to the tallest member. The 16px mobile font size that stops iOS zooming
rides both maps.

## 6. Motion

The house pattern is a 150ms ease-out fade in and a snap close. Exit animations
exist only where the primitive defers unmount for them (the drawer).

Parent opacity fades stay on small surfaces. Animating opacity composites the
subtree, text loses subpixel antialiasing during the fade, and it visibly pops
back when the transition ends. That is loud on text heavy panels and invisible on
small chrome. `will-change: opacity` makes the degraded antialiasing permanent,
which is worse. For big text surfaces, snapping open is the honest choice.

## 7. Migration tooling and PR3 prep

- The Bootstrap to Tailwind utility rename was done by a one shot codemod
  driven by a frozen name map, kept outside the repo with the migration notes.
  The map is a lookup table and not a formula because both frameworks use
  names like `mt-3` and `mt-4` with different values; digit math would produce
  silent same name regressions.
- A leftover checker kept with the codemod gates the result. The codemod's
  output never contains spacing steps 3 or 5, so a surviving `mt-3` or `gap-5`
  in a tracked file means a missed transform (or a hand written Tailwind value
  that should move module side or to another step). Its component class
  blocklist gates the Bootstrap families whose replacements have all landed.
- Forward work is marked in code with comments containing the literal string
  "PR3". Prep for PR3 by grepping `PR3` across `components`, `styles`, `lib`,
  `wallets`, `svgs` and `scripts`.

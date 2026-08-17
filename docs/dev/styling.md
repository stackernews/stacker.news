# Styling architecture

Stacker News uses Tailwind utilities for layout and metrics, CSS modules for
component paint and state, and Base UI for interactive behavior. Runtime comments
should explain local constraints. Cross-cutting rules belong in this document.

## Cascade contract

`styles/tailwind.css` declares this layer order:

1. `theme`
2. `base`
3. `components`
4. `utilities`

Tailwind imports its theme, preflight, and utilities into those layers.
`styles/base.css` adds application element defaults after preflight. Every tracked
`*.module.css` file has one top-level `@layer components` block, enforced by
`npm run check:module-layers`.

Normal utility declarations therefore beat normal module declarations regardless
of selector specificity. Modules define component defaults and call sites use
utilities to customize an instance.

`styles/app.css`, `styles/text.css`, KaTeX, and other third-party stylesheets are
unlayered. Unlayered declarations outrank every normal layered declaration,
including utilities. Keep application rules in that tier only when their priority
is part of the global contract.

An important declaration reverses the layer order and can also prevent call-site
customization. Use one only when a component must beat an unlayered or third-party
declaration. Do not use it to arbitrate between a module and a utility.

`cn()` combines conditional class names and resolves Tailwind conflicts. Standard
Tailwind groups already understand theme-backed classes such as `text-primary`.
Extend `tailwind-merge` only for custom utility names that it cannot classify, such
as `text-reset` or `font-bolder`.

## Ownership rules

Each property should have one owner within a component:

- Recipes in `components/ui/*.js` and `components/form/field.js` own metrics and
  layout, including display, padding, radius, font size, and font weight.
- CSS modules own paint and state, including colors, borders, focus treatment,
  and motion.
- Call sites own one-off geometry through utilities.

When a call site overrides a recipe utility, `cn()` keeps the last class in the
same group. A module should not also declare that property because its declaration
cannot win the normal layer order and communicates ownership it does not have.

## Tokens and themes

`styles/tokens.css` is the canonical token sheet. Light defaults live on `:root`
and `[data-theme=light]`; dark values live on `[data-theme=dark]`.

`styles/tailwind.css` maps reusable color tokens through `@theme inline`, so
generated text, background, border, and fill utilities read the live `--sn-*`
values. Territory branding uses `lib/domains/custom-css.js` to redefine brand and
contrast tokens with greater specificity at runtime.

Only values that have the same meaning across Tailwind property families belong
in `@theme inline`. Global fill classes can intentionally use different values
from text colors, so those names remain outside the Tailwind color map.

Portaled overlays share the z-index ladder in `styles/tokens.css`. Components use
the ladder tokens instead of local numeric values. The supported order is sticky
content, fixed content, drawers, modals, menus, popovers, tooltips, then toasts.
Menus clear modals and remain below popovers.

Breakpoints are application-wide layout thresholds. Changing one is a responsive
design change, not a local component adjustment.

## Popup family

Tooltip, popover, preview card, menu, dialog, drawer, and toast surfaces portal to
`body`. Their modules own paint and motion while Base UI owns focus, dismissal,
keyboard navigation, and deferred unmounting where supported.

### Shared arrows

Tooltip, popover, and preview card use `components/ui/arrow.module.css`.

- The arrow element is a half-height clipping window.
- Its `::before` pseudo-element draws and rotates a bordered square.
- Side-specific rules position the same shape rather than redrawing it.
- `--arrow-size` controls the base width; the visible tip is half that height.
- `data-side` reports the popup side, so a bottom popup places its arrow on the
  top edge.

Popover keeps a transform at rest because the transform establishes the arrow's
containing block. Removing it after the opening transition would let the arrow
re-anchor to the positioner and jump.

### Focus

Popup surfaces that receive programmatic focus suppress the browser's container
outline in their modules. Interactive descendants retain their own visible focus
treatment. Navigation links use `:focus-visible` so keyboard focus is visible
without leaving hover paint after pointer clicks.

## Buttons and forms

### Button state

Filled button variants derive hover and active backgrounds from live color
variables. Hover mixes 15 percent of `--sn-btn-mix` into the base color and active
mixes 20 percent. Variants that need a fixed state color provide explicit custom
properties instead.

Every button has a transparent one-pixel border so it aligns with bordered form
controls. Outline variants recolor that border. A call site can choose a wider
border while the variant continues to own its color.

### Input group corners

`components/form/field.module.css` joins input group corners through sibling
selectors. React fragments do not create DOM nodes, so the selectors see their
members as direct siblings. Members should not carry competing radius utilities;
an intentional exception belongs at its call site.

Input radius theming uses `--sn-input-radius`. Set it on the common form ancestor
so inputs and adjacent addons inherit the same value.

### Sizes

`inputClasses()` and `buttonClasses()` provide paired size maps. Controls within
one input group must use matching sizes so their heights align. Mobile input text
stays at least 1rem to prevent automatic zoom on iOS.

## Motion

Small popup surfaces use short ease-out entrance motion. Exit motion is used only
when the primitive defers unmounting long enough for it to render.

Avoid animating opacity across large text surfaces. Subtree compositing can change
text antialiasing during the transition and produce a visible snap at the end.

## Stylesheet inventory

`pages/_app.js` imports global styles in this order:

- `styles/tokens.css`: light and dark design tokens.
- `styles/tailwind.css`: layer order, Tailwind imports, sources, theme mapping,
  and the dark variant.
- `styles/base.css`: application element defaults in the base layer.
- `styles/app.css`: unlayered global behavior, compatibility classes,
  animations, and third-party integration styles.
- `katex/dist/katex.min.css`: KaTeX styling with its font URLs intact.
- `styles/text.css`: unlayered rendered-content and editor styles.

Component paint lives beside its component in `*.module.css`. Recipes that build
utility strings live in the corresponding JavaScript modules.

# Styling architecture

This branch is a transitional styling stack. Bootstrap still owns element
defaults and remaining legacy components. Tailwind owns converted utility
classes. Base UI supplies behavior for the house component library.

Runtime comments should explain local constraints. Cross-cutting rules belong
in this document.

## Cascade contract

`styles/tailwind.css` imports Tailwind theme and utility layers without
preflight. Bootstrap continues to provide the element reset while both systems
are installed.

Tailwind utilities are emitted as important declarations. Bootstrap utilities
are unlayered and important, so the reversed important-layer order lets the
Tailwind declaration win when both frameworks expose the same class name.

The scanner blocklists `container`, `collapse`, and `table`. Those class names
still belong to React Bootstrap components at this stage and their Tailwind
counterparts have incompatible behavior.

`cn()` combines conditional class names and resolves Tailwind conflicts.
Standard Tailwind groups already understand theme-backed classes such as
`text-primary`. Extend `tailwind-merge` only for custom utility names that it
cannot classify, such as `text-reset` or `font-bolder`.

## Ownership rules

Each house component has three styling owners:

- Recipes in `components/ui/*.js` and `components/form/field.js` own metrics
  and layout.
- CSS modules own paint, state, borders, and motion.
- Call sites own one-off geometry through utilities.

Important Tailwind utilities beat module declarations in this transitional
stack. A module should not declare geometry that a recipe or call site utility
already owns.

## Theme bridge

The `--sn-*` values in `styles/tailwind.css` bridge Tailwind utilities to the
active Bootstrap and application theme variables. Territory branding and dark
mode therefore continue to update the utility-backed components at runtime.

Only values with the same meaning across Tailwind property families belong in
`@theme inline`. Fill colors that intentionally differ from text colors remain
outside the Tailwind color map.

Breakpoints are application-wide layout thresholds. Changing one is a
responsive design change, not a local component adjustment.

## Component behavior

House wrappers under `components/ui/` preserve the application-facing APIs.
Base UI owns keyboard behavior, focus management, dismissal, gestures, and
portals. CSS modules own their visual state.

Tooltip, popover, preview card, menu, dialog, drawer, and toast surfaces portal
to `body`. They share the z-index ladder in `styles/tailwind.css` rather than
introducing local numeric values.

Menus do not lock page scroll. Dialogs and drawers do. Popup surfaces that
receive programmatic focus suppress the container outline while interactive
descendants retain visible focus treatment.

Tooltip, popover, and preview card use
`components/ui/arrow.module.css`. The arrow element clips a rotated square and
uses `data-side` to place the same shape against each popup edge.

## Buttons and forms

Filled button variants derive hover and active paint from live variables.
Every button keeps a transparent one-pixel border so it aligns with bordered
form controls. Outline variants recolor that border.

`inputClasses()` and `buttonClasses()` provide paired size maps. Controls in
one input group need matching sizes so their heights align. Mobile input text
stays at least 1rem to prevent automatic zoom on iOS.

Input groups join corners through sibling selectors in
`components/form/field.module.css`. React fragments do not create DOM nodes,
so those selectors see the rendered controls as direct siblings.

## Global stylesheet order

`pages/_app.js` imports:

1. `styles/globals.scss`
2. `styles/tailwind.css`
3. `katex/dist/katex.min.css`
4. `styles/text.scss`

KaTeX stays separate so PostCSS does not rewrite its relative font URLs.
Rendered-content styles follow it and own the final local text rules.

# Styling

We use Tailwind utilities for layout and sizing, CSS modules for component
appearance and state, and Base UI for interactive behavior.

## Cascade layers

`styles/tailwind.css` declares this layer order:

1. `theme`
2. `base`
3. `components`
4. `utilities`

Tailwind imports its theme, preflight, and utilities into those layers.
`styles/base.css` adds application element defaults after preflight. Every tracked
`*.module.css` file has one top-level `@layer components` block, enforced by
`npm run check:module-layers`.

Normal utility declarations override normal module declarations regardless of
selector specificity. Modules define component defaults, and utilities customize
individual instances.

`styles/app.css`, `styles/text.css`, KaTeX, and other third-party stylesheets are
unlayered. Their normal declarations override normal declarations in any layer,
including utilities. Only keep application rules unlayered when they need this
priority across the app.

`!important` reverses the layer order and can prevent utilities from overriding
component styles. Use it only when a component must override an unlayered or
third-party declaration. Don't use it to resolve conflicts between modules and
utilities.

`cn()` combines conditional class names and resolves Tailwind conflicts. Standard
Tailwind groups already recognize theme classes such as `text-primary`.
Extend `tailwind-merge` only for custom utility names that it cannot classify, such
as `text-reset` or `font-bolder`.

## Where styles belong

Define each property in one place within a component:

- Class helpers in `components/ui/*.js` and `components/form/field.js` define
  layout and sizing, including display, padding, radius, font size, and font weight.
- CSS modules define appearance and state, including colors, borders, focus
  styles, and transitions.
- Use utilities at the call site for layout adjustments specific to that instance.

When a call site overrides a utility from a class helper, `cn()` keeps the last
class in the same group. Don't also declare that property in a module: the utility
overrides it, leaving a declaration that has no effect.

## Tokens and themes

`styles/tokens.css` defines our shared tokens. Light defaults are set on `:root`
and `[data-theme=light]`; dark values are set on `[data-theme=dark]`. Token names
use kebab-case.

Use `--sn-focus-ring` for focus styles, with its danger and success variants where
needed. Apply it with `:focus-visible` so the browser shows it for keyboard focus
and text entry without adding a focus ring to every click.

`styles/tailwind.css` maps reusable color tokens through `@theme inline`, so
generated text, background, border, and fill utilities read the live `--sn-*`
values. Territory branding uses `lib/domains/custom-css.js` to redefine brand and
contrast tokens with greater specificity at runtime.

Only add color tokens to `@theme inline` if they have the same meaning for text,
backgrounds, borders, and fills.

`styles/base.css` sets SVG fill to `currentColor`, so icons use the surrounding
text color by default. To give an icon a different color, add a generated `fill-*`
utility to the SVG itself.

Overlays rendered through portals share the z-index tokens in `styles/tokens.css`.
Use these tokens instead of local numeric values. From lowest to highest, the
order is sticky content, fixed content, drawers, modals, menus, popovers, tooltips,
then toasts. Menus appear above modals and below popovers.

Breakpoints apply across the app. Changing one affects responsive layouts beyond
the component you're working on.

## Popups

Tooltips, popovers, preview cards, menus, dialogs, drawers, and toasts render into
`body` through portals. Their modules define appearance and transitions. Base UI
handles focus, dismissal, keyboard navigation, and delayed unmounting where
supported. Close buttons use `closeClasses()` from `components/ui/close.js`.

### Shared arrows

Tooltips, popovers, and preview cards use `components/ui/arrow.module.css`.

- The arrow element clips the shape to half its height.
- Its `::before` pseudo-element draws and rotates a bordered square.
- Rules for each side position the same shape.
- `--arrow-size` controls the base width; the visible tip is half that height.
- `data-side` reports the popup side, so a bottom popup places its arrow on the
  top edge.

The popover keeps a transform after its opening transition because it establishes
the arrow's containing block. Removing the transform would anchor the arrow to
the positioner instead, making it jump.

### Focus

Popups that receive programmatic focus remove the browser's outline from the
container in their modules. Interactive elements inside keep their own focus
styles. Navigation links use `:focus-visible` so keyboard focus stays visible
without leaving hover styles after a click.

## Buttons and forms

### Button state

Filled button variants derive hover and active backgrounds from live color
variables. Hover mixes 15% of `--sn-btn-mix` into the base color and active
mixes 20%. Variants that need a fixed state color provide explicit custom
properties instead.

Every button has a transparent one-pixel border so it aligns with bordered form
controls. Outline variants change that border's color. A call site can set a wider
border while keeping the variant's color.

### Invalid state

Form controls use Base UI's `data-invalid` attribute for validation errors, set by
`Field.Root` or by the component itself. In modules, style invalid state only with
`[data-invalid]`.

### Input group corners

`components/form/field.module.css` joins input group corners through sibling
selectors. React fragments do not create DOM nodes, so the selectors see their
children as direct siblings. Avoid radius utilities on group members unless a
specific instance needs an override at its call site.

Use `--sn-input-radius` to customize input corners. Set it on a shared form ancestor
so inputs and adjacent addons inherit the same value.

### Sizes

`inputClasses()` and `buttonClasses()` provide matching sizes. Use the same size
for controls in an input group so their heights align. Keep mobile input text at
least 1rem to prevent automatic zoom on iOS.

## Transitions

Small popups use short ease-out transitions when opening. Only use exit
transitions when the Base UI component delays unmounting long enough to show them.

Avoid animating opacity on large blocks of text. The browser can render text
differently during the transition, causing a visible change in antialiasing when
it ends.

## Stylesheets

`pages/_app.js` imports global styles in this order:

- `styles/tokens.css`: light and dark design tokens.
- `styles/tailwind.css`: layer order, Tailwind imports, sources, theme mapping,
  and the dark variant.
- `styles/base.css`: application element defaults in the base layer.
- `styles/app.css`: unlayered global behavior, compatibility classes,
  animations, and third-party integration styles.
- `katex/dist/katex.min.css`: KaTeX styling with its font URLs intact.
- `styles/text.css`: unlayered rendered-content and editor styles.

Component styles live beside their components in `*.module.css`. Class helpers
that combine utilities live in the corresponding JavaScript modules.

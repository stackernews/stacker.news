# PR2 — Base UI components: executable plan

Expands the PR2 section of [tailwind-migration-plan.md](./tailwind-migration-plan.md). Goal (revised 2026-07-06): **zero react-bootstrap imports** after this PR, all interaction behavior preserved; the visual target is **nearest-native Tailwind/Base UI**, no longer pixel-identical — see the master plan's §Strategy revision. Where a spec below quotes an arbitrary bracket value or a sass-exact formula obligation, the revision supersedes it: build the nearest-native equivalent (censuses, site lists, APIs, and interaction requirements remain authoritative). Everything here was re-verified against the codebase and Base UI's live docs on 2026-07-03.

Scope decisions locked with sox:
1. This dedicated doc; the master plan's PR2 section is a summary + link.
2. **Broad Base UI adoption** — beyond replacing react-bootstrap, hand-rolled components with a matching Base UI primitive get rebuilt too (Table B).
3. `ui/button.js` builds on **Base UI Button** (render prop, `focusableWhenDisabled`, `[data-disabled]`), not a bare `<button>`.

## 0. Progress track

- **🔄 Strategy revision 2026-07-06 (read first — supersedes value specs below).** Decided with sox: native-first, no pixel parity (master plan §Strategy revision). Locked: hybrid module skins **stay** (keystone 6, now with a native-values rule); `@theme` gets `--text-base: .93rem` + `--text-base--line-height: 1.75` (type identity as a token); subtle ~150ms native transitions **adopted** (keystone 5 rewritten — affects C3+ popup chrome; write `data-starting-style` CSS now, with `prefers-reduced-motion` off-switch); `rounded-sn` → stock `rounded-md` (drop token + cn.js classGroup); Container → single `max-w-4xl`.
  **C2.5 native-value rework ✅ done (2026-07-06, same day; sox eyeball QA passed 2026-07-07 — "really nice and almost exact" at nearest-native).** As landed:
  - **Tokens**: `@theme` gains `--text-base: .93rem` + `--text-base--line-height: 1.75` (pre-landing grep confirmed 0 existing `text-base` uses); `--sn-radius`/`--radius-sn` deleted (zero consumers outside tailwind.css); `lib/cn.js` drops the `rounded-sn` classGroup (`font-bolder`/`text-reset` stay — in use).
  - **Button**: BASE `text-base rounded-md` (line-height rides the token pair); sm `px-2 py-1 text-sm rounded-sm` (paddings were already native), md `px-4 py-1.5` (nearest steps to .42rem/1.1rem), lg `px-4 py-2 text-lg rounded-lg`; the 14 module skins untouched. ⚠️ **C9a**: inputs must use md's `px-4 py-1.5` or InputGroups misalign (comment carried in button.js).
  - **Badge**: `px-2 py-0.5 text-xs rounded-md` (em-scaling dropped); call-site nudges: `ms-[0.1rem]`→`ms-0.5` (kept — badges would touch preceding text without), all `-mt-px` vertical nudges deleted. `leading-none` still wins over text-xs's paired line-height (verified in compiled output order).
  - **Alert**: `Alert.Heading` fluid clamp → `text-xl leading-tight`. **Container**: `max-w-4xl` (896px; the 540/720 tablet tiers are gone — 576–992px viewports gain width).
  - **Sweep**: `text-[1.1625rem]`→`text-lg` ×8 consumer sites, `text-[0.93rem]`→`text-base` ×1, fs-4 clamp→`text-xl` ×1 (wallets layout), `font-[monospace]`→`font-mono` ×29/16 files (**intended delta**: renders the Menlo/SFMono `--font-mono` stack now, not browser-default monospace), `rounded-sn`→`rounded-md` ×6 sites.
  - **Codemod map**: fs-1..6 → `text-4xl/3xl/2xl/xl/lg/base` (fs-1..4 matched on desktop caps; named steps now carry paired line-heights — intended), `rounded`/`rounded-2`→`rounded-md`, `rounded-4`/`-5`→`rounded-2xl`/`rounded-4xl` (exact 1rem/2rem), `text-monospace`→`font-mono`.
  - **Left as deliberate one-offs**: `lg:z-[900]` (rewards page; rewire to `var(--sn-z-sticky)` at PR3), playground `max-w-[1100px]`, badge `[--sn-badge-opacity:0.75]` (a var write, not a value), alert module's hand-drawn border-radius.
  - **Gates**: residue grep 0 across components/pages/wallets/lib/scripts; `npx standard` clean on all 36 touched files; compiled-CSS check (standalone CLI 4.3.1 — host node_modules lacks the darwin lightningcss binary, app builds in Docker) confirms `.text-base` emits the .93rem/1.75 tokens and `rounded-sn`/`--radius-sn` are gone from output.
- **C0 ✅ done (2026-07-05).** `@base-ui/react@1.6.0` + `tailwind-merge@3.6.0` installed. `lib/cn.js` ships `extendTailwindMerge` teaching it our custom tokens (`rounded-sn`, `font-bolder`, `text-reset`) — **every future custom theme token needs a matching classGroups entry or overrides silently stop merging** (unknown `text-*` is misclassified as a color). z-ladder landed with one addition over plan: `--sn-z-drawer-backdrop: 1040` (Drawer.Backdrop must sit under the modal backdrop, per compiled `$zindex-offcanvas-backdrop`). Four aliases added to `:root`: `--sn-primary-text`, `--sn-secondary-text`, `--sn-link-color`, `--sn-link-hover-color` (link pair deliberately NOT named `--sn-link` — dodges the PR3 `--theme-link` rename collision).
- **C1 ✅ done (2026-07-05, QA passed same day: per-variant hover parity, branded-territory retint light+dark, link weight/dark-mode color, notifications retry, post buttons, ots `<a>` downloads).** `ui/button.js` (Base UI Button; `buttonClasses({ variant, size, className })` cva-shape recipe; `href`/`as` render shim) + `button.module.css` with **14 variant skins** — the census said 12, but `outline-warning` (notifications.js) and `outline-grey` (territory-header.js ×2) were hidden inside stuffed `variant` props (utilities smuggled into the prop string — all 3 PR1-flagged sites now unstuffed). Skin design: hover/active hoisted into one `color-mix` formula (verified value-exact vs compiled CSS; `--sn-btn-mix` flips shade/tint), variant class names = variant strings (`styles[variant]`, Next's `exportLocalsConvention: 'asIs'`). Swept: 28/35 import swaps, all §4b `btn btn-*` string sites, all §4c link-Buttons (post.js was 9 nested sites, not 6), notifications inline `--bs-btn-*` → `--sn-btn-hover-color`, `size='md'` confirmed a phantom (no `.btn-md` ever existed — `md` ≡ default, keep it that way). Deferred whole-file per risk 7a: `user-header.js`, `item-act.js`, `pages/settings/index.js`, `pages/rewards/index.js`, `wallets/.../home/actions.js`, `form.js` → C9a; `login-button.js` → C5 (ButtonGroup = same corner-joining trap). **Note:** the Button `href`/`as` shim now has zero consumers — when C9a converts `actions.js:55`, decide whether to drop it. **Correction 2026-07-07 (sox QA):** the unstuffing dropped the stuffed `rounded` utility at the two territory-header sites (notifications kept its as `rounded-md`) — under Bootstrap that `rounded` (0.4rem, `!important` utility) beat `.btn-sm`'s 0.25rem, so those sm buttons matched the md radius; without it they fell to the recipe's `rounded-sm` and visibly changed. Restored as call-site `rounded-md` (the codemod-map value for BS `rounded`; className beats the size recipe via twMerge). Every other `size='sm'` site (~24) was a true `.btn-sm` painting 0.25rem, so the recipe's `rounded-sm` is exact parity there — verified end-to-end at runtime (headless render of /dev/playground: BS sm and SN sm both compute 0.25rem).
- **C2 ✅ done (2026-07-07).** Spec expanded in §11 (censused 2026-07-05): Badge 16 sites/7 files (§4b's "~14 raw badge strings" was a miscount — zero raw strings exist), Alert 11 sites/9 files (`info`/`danger`/`warning` only), Container 10 sites/9 files, Row/Col 8 files, Image 8 sites/5 files. Key design call in §11.0: badge/alert **colors stay module-side** because layered-`!important` utilities would beat even the consumers' `!important` module skins.
  - **Badge ✅ done 2026-07-06** per §11.1 (as revised): `ui/badge.js` + 7 variants incl. `.grey`, which absorbs the `item.module.css .newComment` + `notifications.module.css .badge` shout-skins (deleted, along with item `.badge` + comment `.op`); all 16 sites swapped; gates pass (react-bootstrap Badge grep 0, `bg-opacity` grep 0, standard clean). Visual QA passed 2026-07-06.
  - **Alert ✅ done 2026-07-06** per §11.2, with the devtools check done by direct sass compile instead (same method as the tokens doc): all six light/dark color-mix values verified value-exact against emitted CSS, and both §11.2 open questions resolved — `$btn-close-bg: none` (globals.scss:96) already kills Bootstrap's svg, but `opacity: .5`/hover `.75` ARE painted. So `.close` **deviates from the §11.2 sketch by design**: `color: #000` + `.5`/`.75` opacities + gold focus ring `rgba(250,218,94,.25)` + dark `color: #fff` (≡ today's `invert(1)` filter on #000), NOT `color: inherit`. All 11 sites/9 files swapped (import-only); globals `.btn-close` rules kept — offcanvas still consumes them until Drawer (C4). Gates pass (react-bootstrap Alert grep 0, standard clean). Visual QA passed 2026-07-06.
  - **Container ✅ done 2026-07-06** per §11.3, verbatim from the sketch: `ui/container.js` Tailwind-only recipe (`w-full mx-auto px-4 sm:max-w-[540px] md:max-w-[720px] lg:max-w-[900px]` — as first landed; C2.5 replaced the tiers with a single `max-w-4xl` the same day, see §11.3), polymorphic `as`, no `fluid`. All 10 sites/9 files swapped (import-only; JSX untouched — sticky-bar.js and static.js keep `{ Nav, Navbar }` rb imports). §11.3's open question resolved: PullToRefresh **does** forward `className` onto its `<main>` (pull-to-refresh.js:80) — it doesn't spread other props, but layout.js passes only `className`+children so nothing is dropped. Also verified: no SN stylesheet keys off the `.container` selector (logger.module.css's `.container` is a scoped local class), so the class name vanishing from the DOM breaks nothing; the tailwind.css:41 `container` blocklist stays until PR3 but is no longer load-bearing. Gates pass (react-bootstrap Container grep 0, standard clean). Visual QA passed 2026-07-06.
  - **Row/Col ✅ done 2026-07-07** per the revised §11.4 (native gap/grid — see there for the full revision rationale and per-site map). All 8 files + 1 caller (settings/logins.js) swapped; `md`/`lg` → `stacked` on LightningExplainer/LightningAuthWithExplainer; QR columns use `max-w-75` (TW4 dynamic spacing ≡ 300px, no `--spacing` override exists). Gates pass (react-bootstrap Row|Col grep → 0 across components/pages/wallets/lib; standard clean on all 9 touched files). Visual QA passed 2026-07-07 (sox; the intended §11.4 deltas accepted).
  - **Image ✅ done 2026-07-07** per §11.5, verbatim from the sketch: all 8 sites/5 files are plain `<img>` tag swaps (props kept as-is), incl. the §11.8 deferred-file site user-header.js:102; job-form.js:45 `roundedCircle` → `className='rounded-full'` is the one non-verbatim swap. No wrapper, no module. Import lines dropped where Image was the only rb import (item-job.js, job-form.js, user-list.js); user-header.js keeps Button/InputGroup/Nav (C9a) and offcanvas.js keeps Dropdown/Nav/Navbar/Offcanvas (C4/C6), each just losing the Image specifier. Gates pass (react-bootstrap Image grep 0, `roundedCircle` grep 0, standard clean on all 5 files). Visual QA passed 2026-07-07 (sox).
  - **Table ✅ done 2026-07-07** per §11.6, verbatim from the sketch: fee-button.js Receipt is a plain `<table className={styles.receipt}>` (`borderless`/`size='sm'` dropped, `align='right'` tds kept); both load-bearing module additions landed (`.receipt { border-collapse: collapse }`, `.receipt td { line-height: 1.2rem; vertical-align: top }`). Import line dropped (Table was the only rb import). Gates pass (react-bootstrap Table grep 0, standard clean). Visual QA passed 2026-07-07 (sox).
  - **CardFooter ✅ done 2026-07-07** — but NOT per the §11.7 sketch: the pre-flight check (the one open devtools question) found the sketched skin was chasing paint that doesn't exist. Bootstrap 5.3's `.card-footer` rules are all `var(--bs-card-*)`-based and those vars are defined **only on `.card`** — a class SN never renders (zero rb `Card` imports, no raw `card` class strings; this footer's ancestors are `.accordion-body` / popover / modal). Every declaration — padding, bg, border-top, the `:last-child` radius — is invalid at computed-value time ⇒ today's footer paints **nothing** from the class. So the swap is a pure class-drop: `<CardFooter className={'py-1 ' + styles.other}>` → `<div>` same className; **no** item.module.css addition, **no** `px-4` (painted padding-x today is 0). §11.7 rewritten as-built; §11.11 handoff shrank (card footer consumes zero `--bs-*` vars). Gates pass (react-bootstrap CardFooter grep 0, standard clean). Visual QA passed 2026-07-07 (sox — footer unchanged).
  - **C2 closed 2026-07-07** — all seven families landed; §11.9 mechanical gates pass (import grep → 0, `bg-opacity` grep → 0, sole hits = the exempted `pages/dev/playground.js`; alert color parity verified by sass compile, see Alert entry); visual-diff pass done by sox 2026-07-07 (all four pending families + C2.5 eyeball QA — verdict "really nice and almost exact"). **Next: C3.** Working pattern established by Badge/Alert/Container, for reuse in C3+: recipe lives in `components/ui/<name>.js` (+ `<name>.module.css` only when colors/state need a skin, per §11.0), consumers import from `@/components/ui/<name>`, JSX prop surfaces stay verbatim; per-family gates = import grep → 0 + `npx standard` on touched files; log each family here with date, deviations, gates, QA status.
- **C3 ✅ done 2026-07-08 (implemented 2026-07-07; sox visual QA passed 2026-07-08).** QA verdicts: playground/bolt-scroll/keyboard/fee-button-formik/real-toolbar/real-iOS all good; grouping "not glitchy at all, really good" (kept — **cite as betterment in commit**, with the scroll robustness); badge clipping confirmed → **OQ1 resolved: `COLLISIONS_OFF` deleted 2026-07-08** (flip+shift everywhere, edge-shift verified headless, full QA suite re-run green — cite in commit); OQ2 arrow confirmed; OQ5 → accept at C3, **C4 owes badges a mobile Popover (§6.13)**. **Deferred QA (couldn't run 2026-07-08, low-risk):** poll `side='left'` (same ActionTooltip path as verified sites) and the login `multiAuth` flow (disabled-prop path verified via playground row) — spot-check when next in those flows. Scratch page deleted; playground Tooltip section added 2026-07-07 (incl. both rb population replicas — rb imports there are gate-exempt as always). As landed: `ui/tooltip.js` + `tooltip.module.css` (scale 0.98 from docs, 150ms ease-out, `sideOffset={6}` confirmed by measurement), `TooltipProvider` in `_app.js` (inside outer ErrorBoundary), ActionTooltip internals swapped (§12.2 verbatim), badge.js + login.js ×2 (§12.3 verbatim). **One deviation from the §12.1 sketch**: Provider carries NO delay props; `delay={delay ?? 0}` moved onto the Trigger — a `Provider delay={0}` permanently flattens per-site delays via the `groupOpenValue === 0` short-circuit (§12.0 correction; caught by headless QA when the toolbar replica ignored its 500ms). Gates: rb Tooltip grep 0, barrel grep 0, OverlayTrigger residue = exactly footer.js + hoverable-popover.js, standard clean ×6 files. Headless QA green: bolt fades 150ms in/out at gap 6.0px with all nearest-native values painted, no legacy `.tooltip` DOM; risk-1 replica (rb Dropdown as Trigger child) fully works incl. 500ms delay + suppress-while-open; grouping `data-instant` ✓; Escape ✓; reduced-motion ✓; touch taps open nothing ✓; /login 200. Remaining for sox: §12.6 visual pass (esp. fee-button formik hide on submit, real toolbar in a post form, badge near viewport edge → open question 1, mobile badge access → open question 5, real-iOS touch). Scratch page `pages/dev/tooltip-preflight.js` + `scripts` in session scratchpad stay until QA closes, then delete. Spec'd 2026-07-07 (§12, fresh census same day). Census corrections vs Table A: OverlayTrigger dies in **3** files here, not 5 — footer.js (×4 sites) + hoverable-popover.js are click/hover **Popover** overlays and ride C4; rb Tooltip = 4 sites / 3 files (action-tooltip.js, badge.js, login.js ×2); ActionTooltip consumers = 8 files / 12 sites (internals swap, consumers untouched). Two tooltip populations exist today (§12.0): ActionTooltip sites snap (no fade, opacity .9, popper collisions off + `position:fixed` hack), badge/login sites fade 0.15s (rb `Overlay` defaults `transition=Fade`; opacity 1, popper collisions ON). First application of revised keystone 5: ~150ms `data-starting-style`/`data-ending-style` motion in tooltip.module.css with the `prefers-reduced-motion` off-switch — supersedes the old "fadeIn = only surviving popup animation" gate; the globals `fadeIn` keyframe + `.fade.tooltip` become PR3 deletions (§12.4/§12.8; its only other consumer `.spin.fade-in` is already dead in JSX). Verified in Base UI 1.6.0 source during spec: `delay`/`closeDelay` live on **Trigger** (default 600/0), and `Tooltip.Provider`'s values cascade (`delay ?? providerDelay ?? 600`) — the `_app.js` Provider carries `delay={0} closeDelay={0}` for OverlayTrigger parity.
- **C4+ ⬜ not started.**

## 1. Ground rules

All six master-plan keystones bind. The two that component commits trip over most:

- **Subtle native motion** (keystone 5, revised 2026-07-06): popups (menu, tooltip, popover, dialog, drawer, collapsible) get ~150ms ease-out fade (+slight scale where Base UI's docs examples use it) via `data-starting-style`/`data-ending-style` CSS in their chrome modules, disabled under `@media (prefers-reduced-motion: reduce)`. Toast slide/progress keeps its keyframes; Drawer's 450ms default is shortened into the ~150ms family, not zeroed.
- **Hybrid styling** (keystone 6): module.css answers "what does this look like in each state" (variant skins via `data-variant` + `var(--sn-*)`, state via Base UI data attributes, popup chrome/shadow/z-index); Tailwind answers "how is this instance arranged" (layout, spacing, consumer overrides). Recipe shape: `cn(styles.root, styles[variant], '<layout utilities>', className)` with `cn = (...args) => twMerge(classNames(...args))` from `lib/cn.js`. One property, one source — never declare the same CSS property in both the module skin and the utility string. Two failure modes when violated: `twMerge` is blind to module classes, so it can't resolve the conflict; and worse, a layered-`!important` utility beats the module's *state* rules too — `:hover`, `[data-highlighted]`, `[data-disabled]` selectors are just as unlayered as the base rule — so a stray `bg-*`/`p-*` in a recipe silently freezes hover retint and disabled styling in every state while the default state looks fine. **Values rule (2026-07-06):** recipe strings and new module declarations use native-scale classes or brand tokens only — no arbitrary brackets except deliberate SN one-offs (alert border-radius); nearest-native supersedes value-exact.

**File-placement rule:** a `components/ui/x.js` file exists only when there are ≥2 consumers or a react-bootstrap prop-shim is needed. Single-consumer adoptions use `@base-ui/react/*` parts inline at the call site, skins in the nearest existing module.css. Keeps `ui/` from becoming a re-export museum.

**State-attribute glossary** (so commits don't re-derive it): `[data-popup-open]` `[data-highlighted]` `[data-checked]` `[data-pressed]` `[data-selected]` `[data-disabled]` `[data-invalid]` `[data-panel-open]`. (`[data-starting-style]`/`[data-ending-style]` exist but stay unused — no animations.)

## 2. Commit 0 — dependencies & infra ✅ shipped

As-built log in §0. Standing decisions that outlive C0: the `--sn-z-*` ladder in `styles/tailwind.css` is the **single stacking authority** (Base UI portals every popup to `<body>`; popup-chrome modules consume the vars, never literal z-indexes); **Menu/dropdowns are `modal={false}` everywhere** while Dialog and Drawer stay modal (state this in the PR description); no Base UI Toast viewport ever (D2); `Tooltip.Provider` lands in C3.

## 3. Directory & file layout

```
lib/cn.js
components/ui/
  button.js + button.module.css      # Base UI Button; 14 variant skins (12 census + outline-warning/outline-grey
                                     # found in stuffed variant props), CSS-var indirection per master plan;
                                     # ALSO exports buttonClasses() for link-as-button sites (§4b/§4c) and Toggle/Menu triggers
  alert.js  + alert.module.css       # color variants + lightning-font X dismiss
  badge.js  + badge.module.css       # color variants
  container.js                       # Tailwind-only; single max-w-4xl cap (C2.5 — the 540/720/900 tiers are gone)
  tooltip.js + tooltip.module.css    # green chrome + keystone-5 starting/ending-style motion
                                     # (globals' fadeIn keyframe dies at PR3 — §12.4)
  popover.js + popover.module.css    # chrome + arrow; shared by hoverable-popover, upvote, ToC, link editor
  dropdown.js + dropdown.module.css  # Menu-based; .dropdown-menu/.dropdown-item chrome duplicated under local names
  drawer.js  + drawer.module.css     # placements: end | bottom; backdrop; zero transitions
  nav.js     + nav.module.css        # plain markup + active-key context; .nav-link colors duplicated
  tabs.js                            # thin Base UI Tabs structural wrapper (skin stays consumer-side)
  collapsible.js                     # thin wrapper with no-animation defaults (AccordianItem + pills share it)
components/form/                     # form.js becomes a barrel over this dir
  index.js  use-formik-field.js  use-field-draft.js  field.js  form.js
  input.js  input-group.js  checkbox.js  checkbox-group.js  select.js
  range.js (Slider+NumberField)  multi-input.js (OTP Field)  password-input.js
  copy.js  variable-input.js  submit-button.js  suggest.js  sn-input.js
  date-picker.js  multi-select.js (react-select until C13)
components/form.js                   # barrel: re-exports ./form/index — webpack resolves form.js
                                     # before form/, so zero consumer import changes
```

- **Inline adoptions (no `ui/` file):** Toggle Group in `components/item-act.js`; Switch in `wallets/client/components/form/capability-test-ui.js`; Toolbar/Separator/Menu in `components/editor/plugins/toolbar/index.js`; Popover in `components/editor/plugins/link/editor.js`; Collapsible in `components/payIn/bolt11-info.js` and `wallets/client/components/send/max-fee-field.js` (via `ui/collapsible.js`).
- **Wrappers keep paths + public APIs** (internals only): `components/modal.js` (+ new `modal.module.css` with the `.modal-*` chrome duplicated from globals), `toast.js`, `action-dropdown.js`, `action-tooltip.js`, `hoverable-popover.js`, `accordian-item.js`, `table-of-contents.js`, `login-button.js`, `long-pressable.js`.
- Existing `components/dropdown.module.css` (`dropdownExtra*` skins used by editor toolbar + login-button) stays — SN-custom, not Bootstrap; its `.active` selectors gain `[data-highlighted]` equivalents where Bootstrap drove them.
- **`components/form.js` export surface that must survive the barrel (25):** `Form, Input, ClientInput, VariableInput, Checkbox, ClientCheckbox, CheckboxGroup, Select, Range, DatePicker, DateTimeInput, PasswordInput, MultiInput, SubmitButton, CopyButton, CopyInput, SNInput, BaseSuggest, InputUserSuggest, InputTerritorySuggest, DualAutocompleteWrapper, useDualAutocomplete, MultiSelect (re-export), SessionRequiredError, StorageKeyPrefixContext`.

## 4. Table A — react-bootstrap → replacement

Fresh sweep 2026-07-03: **96 files** import react-bootstrap (the older audit missed `wallets/` and the editor plugins).

| react-bootstrap | Fresh count | Replacement | Commit |
|---|---|---|---|
| Button | 35 files | `ui/button.js` on **Base UI Button** — `render` replaces `as=`, `focusableWhenDisabled`, `[data-disabled]` skin; variant module with CSS-var indirection + `color-mix` hover copied from the Sass mixins (territory retint survives) | C1 |
| Badge ×7 / Alert ×9 / Image ×5 / Row ×8 / Col ×8 / Table ×1 (`fee-button.js`) / CardFooter ×1 (`territory-header.js`) | ~30 | plain markup + Tailwind recipes; `ui/badge.js`, `ui/alert.js`; no wrapper for Image/Row/Col/Table/CardFooter | C2 |
| Container ×9 | 9 | `ui/container.js`, compiled max-widths (globals.scss overrides Bootstrap's map) | C2 |
| Tooltip ×3 + OverlayTrigger ×5 | 8 | `ui/tooltip.js` on Base UI Tooltip; `Tooltip.Provider` in `_app.js`; `side='bottom'` default, collisions off (popper parity), touch-disabled by design; `action-tooltip.js` internals swap | C3 |
| Popover ×3 + Overlay ×1 (`upvote.js`) | 4 | `ui/popover.js`; hover cards → **Preview Card** `delay=500 closeDelay=300` via `hoverable-popover.js` internals; upvote = detached-anchor controlled Popover (§6.9) | C4 |
| Dropdown ×20 (Item ×77, Menu ×16, Toggle ×12, Divider ×7) | 20 | `ui/dropdown.js` on Menu — `modal={false}` mandatory, `align='start'`, sideOffset 2, dual-mode `Dropdown.Item` (context-check: in-menu → `Menu.Item`, outside → plain styled element); incl. split login (§6.8), ToC (§6.5), mentions render swap (§6.4) | C5 |
| Modal — 1 wrapper, ~25 consumers via `useShowModal` | 1 | single controlled `Dialog.Root`, content-swap in one popup; ALL stack/back/keepOpen/persistOnNavigate/fullScreen/overflow logic stays in `modal.js` (`keepOpen` = ignore `onOpenChange(false)`) | C6 |
| Toast — 1 wrapper, ~42 consumers via `useToast` | 1 | deviation D2: state machine byte-for-byte, render plain divs `role='status'` | C7 |
| Form (direct) ×7 (`.Control`×16 `.Text`×18 `.Label`×8 `.Group`×6 `.Check`×6 `.Select`×2 `.Range`×2) + FormControl ×1 (`table-of-contents.js`) | 8 | `components/form/*`: Base UI `Field`/`Input`/`Checkbox`/`Radio` via `useFormikField`; native `<select>` styled to `.form-select` spec (D6) | C9a/C9b |
| InputGroup ×16 (`.Text` ×62) | 16 | `form/input-group.js` flex composition, compound API preserved | C9a |
| Nav ×14 / Navbar ×10 (`Nav.Link`×46, `Nav.Item`×44) | ~22 | `ui/nav.js` plain markup + active-key context (editor mode switch leaves this set in C8a) | C10 |
| Offcanvas ×2 — `nav/mobile/offcanvas.js` (`placement='end'`) **and** `wallets/client/components/home/index.js` (`placement='bottom'`, a bottom sheet) | 2 | `ui/drawer.js` on Base UI **Drawer** (Root/Portal/Backdrop/Viewport/Popup), controlled, swipe off, transitions zeroed, **both placements** | C10 |
| Accordion — 1 wrapper (`accordian-item.js`), 16 consumers | 1 | Base UI **Collapsible** via `ui/collapsible.js`; kills `useAccordionButton`+`AccordionContext` toggle | C11 |
| ButtonGroup ×1 (`login-button.js` split button) | 1 | flex-group Tailwind recipe + Menu (§6.8) | C5 |

Files the old plan missed, now in scope: `components/editor/plugins/mentions.js`, `components/editor/plugins/toolbar/index.js`, `components/editor/plugins/toolbar/switch.js`, `components/table-of-contents.js`, ~9 `wallets/client/**` files (Button ×3, Alert, InputGroup ×4, Form, Offcanvas). Wallets files ride their component-family commits — no separate wallets commit; C11's grep is the backstop.

### 4b. Raw Bootstrap class strings in JSX (the import sweep is blind to these)

~25 files put Bootstrap (or globals.scss-defined) *component classes* directly in `className` strings — no react-bootstrap import involved, so neither the 96-file sweep nor the `grep react-bootstrap` gate sees them. PR3 deletes the globals.scss blocks that style them (each deletion is gated on the class being gone from JSX), so **every one of these must die in PR2** with its component family. Census 2026-07-04 (token counts approximate — some hits are `styles.*` false positives):

| Class family | ~Count | Where | Dies in |
|---|---|---|---|
| `btn btn-*` on `Link`s | 5 sites + 1 dynamic | `pages/wallets/[id]/receive.js`, `wallets/client/components/layout.js`, `wallets/.../form/index.js`, `wallets/.../send/send-success.js`; **dynamic `btn-${isLurker ? 'grey' : 'primary'}` at `nav/common.js:400`** (PR1 deferred it here) | C1 — swap to `buttonClasses({ variant, size })`; the dynamic site becomes a variant ternary |
| `badge` | **0** (census corrected 2026-07-05) | no raw `badge` class strings exist — the ~14 were react-bootstrap `<Badge>` sites (16, Table A) plus 4 CSS-module skins (`styles.badge`/`styles.newComment`, which stay). The one raw Bootstrap *utility* riding a badge is `bg-opacity-75` (`comment.js:252`) | C2 — §11.1 |
| `btn-close`, `alert-dismissible` | 2+2 | `upvote.js` popover headers | C4 — popover close chrome moves into `ui/popover.module.css` under local names |
| `dropdown-item`, `dropdown-divider` | 4+8 | `item-info.js` Links inside menus, nav | C5 — dual-mode `Dropdown.Item` / local divider class |
| `modal-btn`, `modal-back`, `modal-close`, `modal-overflow` | 8 | `modal.js` chrome (SN-custom, defined in globals.scss `.modal-*` blocks) | C6 — move into `modal.module.css` as `styles.*` |
| `form-label` | ~9 | `territory-branding.js`, `job-form.js` raw `<label>`s | C9a — `field.js` label recipe class |
| `form-control` | 4 | `form.js`: Range ∞ chip (:797), clouds skeleton (:982), DateTimeInput (:1062, :1107) | C9a/C9b — Input recipe class |
| `invalid-feedback` | 2 | `form.js:692` (CheckboxGroup feedback) | C9a/C9b — `field.js` error recipe |
| `nav-link` | ~34 | `footer.js` (bulk), `footer-rewards.js`, `cancel-button.js` | C10 — `ui/nav.module.css` local class, mechanical swap |

**Gate (C11, second gate alongside the import grep):** extend PR1's AST-based `scripts/codemods/bs-utility-check.js` with a component-class blocklist (`btn`, `btn-*`, `form-control`, `form-select`, `form-label`, `form-check*`, `invalid-feedback`, `dropdown-item`, `dropdown-divider`, `nav-link`, `modal-*`, `alert-*`, `btn-close`, `badge`, `input-group*`) and require zero hits — it already tokenizes string literals, template chunks, and `classNames()` calls correctly, which a plain grep can't (must not flag `styles.badge` etc.).

### 4c. `Button` used as a link ✅ done in C1 (2026-07-05)

Base UI's `Button` has no link semantics, so every `<Button href>`, `<Button as={Link}>`, and Button-nested-in-Link site (invalid HTML nesting anyway) became a plain `Link`/`<a>` styled with `buttonClasses({ variant, size })`. Census corrections logged: post.js had **9** nested sites, not 6; `onClick={checkSession}` moved onto the Links; `territory-header.js:131` doubled as a stuffed-variant site, unstuffed to `variant='outline-grey'` + utilities in `className`. Still open: `wallets/.../home/actions.js:55` rides C9a with its deferred file — **last consumer of Button's `href`/`as` shim; drop the shim then**.

## 5. Table B — hand-rolled → Base UI (broad adoption)

| Hand-rolled today | File | Base UI parts | What dies | Commit |
|---|---|---|---|---|
| `ToolbarDropdown` (`Dropdown drop='up'` + `MenuAlternateDimension` portal-to-body hack) | `components/editor/plugins/toolbar/index.js` | `Toolbar.Root/Button` + `Menu.Root > Portal > Positioner side='top' > Popup > Item`; trigger composed `Toolbar.Button render={<Menu.Trigger/>}` | `MenuAlternateDimension`, `useIsClient` guard, manual `show`/`onToggle` | C8b |
| toolbar dividers (`<span className={styles.divider}/>`) | same | `Toolbar.Separator` (keeps `styles.divider`) | nothing — gains `role='separator'` | C8b |
| mode switch (`Nav variant='tabs'` write/compose) | `components/editor/plugins/toolbar/switch.js` | `Tabs.Root value onValueChange` + `Tabs.List > Tabs.Tab` (no Panels — the editor body is the panel) | `eventKey`/`onSelect`, `disabled={active}` hack | C8a |
| Lexical link editor (getBoundingClientRect + rAF repositioning + focusout pair + Escape) | `components/editor/plugins/link/editor.js` | controlled `Popover.Root modal={false}` + `Positioner anchor={() => editor.getElementByKey(nodeKey)}` + `Popup initialFocus={false}` | `setFloatingElemPosition` calls, rAF/scroll/resize listeners, manual focusout pair | C8c |
| capability switch (`<label><input role='switch'>` + track) | `wallets/client/components/form/capability-test-ui.js` | `Switch.Root checked onCheckedChange` + `Switch.Thumb`; re-target `wallet.module.css` `:checked` → `[data-checked]` | manual role/track markup | C12 |
| `CheckboxGroup` (feedback-only wrapper) | `components/form.js` (consumer: `territory-form.js` postTypes) | `CheckboxGroup value onValueChange` + child `Checkbox.Root value` reading group context | per-checkbox Formik array plumbing | C9b |
| `Range` (native range + synced number input + ∞ sentinel) | `components/form.js:753` | `Slider.Root/Control/Track/Indicator/Thumb` + `NumberField.Root/Group/Input` (§6.6) | native range styling, `hide-spinners` hack, hand-rolled blur-clamp | C9b |
| `MultiInput` (OTP-style segmented code input) | `components/form.js:1293` (sole consumer: `pages/email.js`) | `OTPField.Root(length, value, onValueChange, validationType)/Input` | ~80 lines of paste/backspace/arrow focus bookkeeping | C9b |
| `ExpandableDetailPill` + more/less chips | `components/payIn/bolt11-info.js` | `Collapsible.Root/Trigger/Panel` (§6.7) | manual `aria-expanded`, `{open && …}` | C12 |
| max-fee toggle | `wallets/client/components/send/max-fee-field.js` | `Collapsible` (controlled — icon swap reads the state) | manual `aria-expanded` | C12 |
| zap `Tips` chips | `components/item-act.js:23` | `ToggleGroup` + `Toggle render={<button className={buttonClasses({size:'sm'})}>}` (§6.12) | nothing removed — **adds** pressed-state affordance (D9) | C12 |
| `LongPressable` (class component) | `components/long-pressable.js` | none — functional rewrite, same props | `React.PureComponent`, PropTypes | C11 |

## 6. Per-component design notes (new-scope specifics)

Existing-scope components (Dialog/modal stack, Toast render layer, dual-mode Dropdown.Item, Tooltip defaults, Preview Card delays, Container widths, native select, Drawer parity) follow the master plan's notes. New scope:

### 6.1 Editor toolbar (C8b)
`Toolbar.Root` wraps the `styles.toolbarFormatting` row — the `toolbarRef` overflow ResizeObserver and `showToolbar` logic stay untouched. Each `ToolbarButton` → `Toolbar.Button` with the `styles.toolbarItem` skin. **Keep `onPointerDown={e => e.preventDefault()}` on every trigger and item** — that's what preserves the Lexical selection today. `ToolbarDropdown` → `Menu.Root modal={false}` with `dropdownOpen` state kept only to feed `ActionTooltip disable`; `Menu.Positioner side='top' align='start' sideOffset={2}`; popup + items keep the `dropdownExtra*` skins; toolbar state drives item active styling (not Menu highlight). Risks: verify the editor selection survives a menu-driven block format (pointer-down prevention should carry it — test explicitly); Toolbar's roving tabindex is a deliberate a11y upgrade over today's keyboard-inert spans (D8).

### 6.2 Mode switch (C8a)
`Tabs.Root value={mode} onValueChange={v => editor.dispatchCommand(TOGGLE_MODE_COMMAND, v)}` + `Tabs.List > Tabs.Tab`. Keep `onMouseDown preventDefault` on the list. Drop the `disabled={activeTab}` hack (the command handler already no-ops same-mode). Selected styling via `[data-selected]` re-targeting the active rules in `lib/lexical/theme/editor.module.css`.

### 6.3 Link editor (C8c)
Controlled `Popover.Root open modal={false}` per nodeKey. `Positioner anchor={() => editor.getElementByKey(nodeKey)} side='bottom' align='start' sideOffset={8}` — floating-ui auto-updates on scroll/resize, killing the rAF machinery. `Popup initialFocus={false}` — view mode must NOT steal editor focus; the edit-mode `inputRef.focus()/select()` effect stays. Map `onOpenChange(false, details)` reasons (`outside-press`, `escape-key`) to the existing `handleCancel()` (which still strips empty/default-URL links via `TOGGLE_LINK_COMMAND null`). **Keep** the Lexical `KEY_ESCAPE_COMMAND` handler — the Popover only sees Escape when focus is inside the popup. All `$updateLink`/autolink-conversion logic stays. `linkeditor.module.css` keeps skins minus positioning/opacity rules. Risk: verify the popup's focus guards don't fire Lexical's `BLUR_COMMAND` (the mentions plugin closes on blur).

### 6.4 Mentions (C5 — deviation D4)
NOT Base UI Menu: `LexicalTypeaheadMenuPlugin` owns the anchor rect and keyboard (arrows/Enter flow through editor commands); Menu would double-manage focus. Swap the `<Dropdown show>` shell for `div[role='listbox']` + `div[role='option'] aria-selected` styled by the dropdown chrome module + existing `styles.suggestionsMenu`; keep `createPortal(…, anchorElementRef.current)`, `onMouseDown preventDefault`, z via `var(--sn-z-dropdown)`.

### 6.5 Table of contents (C5 — deviation D5)
Popover, not Menu — Menu's typeahead eats printable keys and an `<input>` inside `Menu.Popup` fights item highlight (master risk 5). `Popover.Trigger render={<a>}` kills the forwardRef `CustomToggle`; the popup is an SN `Input`-recipe filter field + a plain list of heading links (kills `CustomMenu`); controlled `open` so a heading click closes before emitting navigation.

### 6.6 Range → Slider + Number Field (C9b)
Formik stays the single source of truth; both widgets are controlled from `field.value`. Slider: `min={allOption ? min - step : min}`; `value={isAll ? sliderMin : field.value}`; `onValueChange` maps `v <= sliderMin → setValue(null)` — the ∞ sentinel transfers verbatim (`null` ⇒ thumb pinned one step below min ⇒ ∞ chip rendered instead of the number field, exactly as today). NumberField: `min/max/step`, **`format={{ useGrouping: false }}`** (Intl grouping would print `1,000` where the old input printed `1000`), clamp-on-blur is native (replaces the hand-rolled handler). The `hide-spinners` hack dies (NumberField.Input is a text input). Tick-label percent math stays under `Slider.Control`. Only write Formik from user events — never sync widget→widget (echo-loop risk 3). Consumers: `territory-form.js`, `pages/settings/index.js`.

### 6.7 Collapsible pills (C12)
`ExpandableDetailPill`: uncontrolled `Collapsible.Root` + `Trigger render={<button>}` (free `aria-expanded`; the `+/-` indicator flips via `[data-panel-open]` CSS). The more/less chip row: controlled `Collapsible.Root` with the chip as Trigger and **`Collapsible.Panel className='contents'`** so the panel div doesn't break the flex-wrap chip row. No height animation (keystone 5). Same recipe for `max-fee-field.js`.

### 6.8 Split login button (C5)
`inline-flex w-full` group: [SN Button `variant='success'` grow `rounded-e-none`] + `Menu.Root modal={false}` with `Menu.Trigger render={<button className={cn(buttonClasses({ variant: 'success' }), 'rounded-s-none max-w-[42px]')}>}`. Replicate Bootstrap's `.btn-group > .btn` −1px border collapse with `-ms-px` if the compiled skin has borders. Menu items keep the `dropdownExtraItem` skins. Kills the last `ButtonGroup` import.

### 6.9 Upvote walkthrough popovers (C4/C5)
`UpvotePopover`/`TipPopover` → controlled `Popover.Root open={show} onOpenChange={o => !o && handleClose()} modal={false}` with **no Trigger**; `Positioner anchor={target.current} side='right'` (matches `Overlay placement='right'`); `Popup` reuses `ui/popover.module.css` chrome + the existing lightning-X close button. The file's `Dropdown` import swaps in C5 (file completes there).

### 6.10 Radios (C9a)
SN's `Checkbox` supports `type='radio'` — sole consumer is `territory-form.js` (billingType ×3, shared `name`). Keep the public API. Implementation choice at C9a: (a) native `<input type='radio'>` styled to the compiled `.form-check-input` spec — zero consumer diffs, Formik's native radio semantics and browser arrow-key group nav for free (same pragmatism as native `<select>`, D6); or (b) Base UI `Radio.Root`/`Radio.Indicator` under a `RadioGroup` bound once to the shared field — data-attribute styling consistency, but the one consumer needs a group wrapper. Default to (a) unless the checkbox skin work makes (b) free.

### 6.11 Nav Indicator (C10)
`nav/common.js:165` composes `` bg-${variant} `` at runtime (reachable: `secondary`, `danger`) — invisible to Tailwind's scanner, currently served by Bootstrap's CSS. C10 rewrites it as a literal ternary (`variant === 'danger' ? 'bg-danger' : 'bg-secondary'`) so the scanner sees full class names; this removes both from PR3's runtime-class safelist burden (PR3 §8b then only carries the `text-*` family).

### 6.12 Tips → Toggle Group (C12)
Selection is **derived, not stored**: `const [{ value: amount }] = useField('amount')` inside `Tips` (it renders within the ItemAct form). `ToggleGroup value={tips.includes(Number(amount)) ? [String(amount)] : []} onValueChange={v => v.length && setOValue(Number(v[0]))}` — ignore empty arrays so clicking the pressed chip is a visual no-op. Typing a custom amount naturally clears the pressed state; typing a preset amount lights its chip. `[data-pressed]` skin is a deliberate new affordance (D9). localStorage custom-tips logic untouched.

### 6.13 Badge tooltips on mobile → Popover (C4, from C3's §12.5 OQ5)
Decided with sox 2026-07-08: C3 removed touch access to badge tooltips (Base UI Tooltip is hover/focus-only; pre-C3, taps opened population B via a specificity accident — that's how phones showed cowboy-streak day counts). **C4 gives badges a tap-openable Popover on touch** (Base UI's own guidance: tap-visible hints are Popover territory). Scope when speccing C4: badge.js's `BadgeTooltip` is the seam — swap its internals to a Popover on coarse pointers (or unconditionally) without touching the 16 badge call sites; login.js's two sites don't need it (their tooltip is disabled-state explanation, not content).

## 7. Table C — deliberate deviations

| # | Thing | Decision | Why |
|---|---|---|---|
| D1 | modal stack | one controlled `Dialog.Root`, content swap | nested Dialogs can't express back/keepOpen/overflow semantics (modal.js:39–42 ordering comment is load-bearing) |
| D2 | toast | state machine byte-for-byte; plain divs `role='status'` | Base UI Toast lacks tag-dedup "(N) msg", progress `animationDelay` resync, persistOnNavigate |
| D3 | BaseSuggest @/~ | logic 100%; render → caret-anchored `role='listbox'` | Base UI Autocomplete can't anchor to a textarea caret with foreign focus; kills the `opacity !important` workaround |
| D4 | mentions menu | plain listbox inside Lexical typeahead | Lexical owns keyboard + anchor; Menu would double-manage focus |
| D5 | table of contents | Popover + filter input, not Menu | Menu typeahead steals printable keys from the filter field |
| D6 | Form.Select | native `<select>` styled to `.form-select` spec | optgroups + native mobile picker parity |
| D7 | react-datepicker, qr-scanner, countdown, carousel, pull-to-refresh, comment collapse, `useOverflow`, dark-mode hook | untouched | no Base UI equivalent / localStorage- or hardware-coupled |
| D8 | toolbar keyboard nav | Toolbar roving focus added | strict a11y upgrade over keyboard-inert spans — intended delta |
| D9 | Tips pressed state | `[data-pressed]` visual added | intended affordance upgrade (locked decision) |
| D10 | MultiSelect | react-select until optional C13 (Combobox `multiple`) | droppable, doesn't block PR3 |

## 8. Commit order (each leaves the app shippable)

| # | Commit | Contents | Gate |
|---|---|---|---|
| C0 ✅ | infra | `npm i @base-ui/react@^1.6.0 tailwind-merge`; `lib/cn.js`; `--sn-z-*` ladder; conventions in PR description | build passes |
| C1 ✅ | Button | `ui/button.js` (+module, 14 skins) on Base UI Button; swap 35 files incl. wallets (7 deferred per risk 7a/§0; Tips stay Buttons until C12); §4b `btn btn-*` string sites → `buttonClasses()` incl. the dynamic `nav/common.js:400` ternary; §4c link-Button sweep | branded-territory hover retint, light+dark ✓ QA 2026-07-05 |
| C2 | static leaves | Badge/Alert/Image/Container + Row/Col utility swaps + Table (`fee-button.js`) + CardFooter (`territory-header.js`) — **full spec §11** | visual diff |
| C3 | Tooltip | `ui/tooltip.js`; `Tooltip.Provider` in `_app.js`; `action-tooltip.js` internals; direct files — **full spec §12** | import grep → 0; ~150ms starting/ending-style motion + reduced-motion off-switch (supersedes "fadeIn = only surviving animation" — §12.4) |
| C4 | Popover/PreviewCard | `ui/popover.js`; `hoverable-popover.js` internals; upvote Overlay → anchored Popover | hover cards 500/300 delays |
| C5 | Dropdown/Menu | `ui/dropdown.js` (`modal={false}`, dual-mode Item); `action-dropdown.js`; 20 files incl. split login (§6.8), ToC (§6.5), mentions (§6.4); upvote.js finishes | no scroll-lock; viewport-edge collision |
| C6 | Dialog | `modal.js` internals + `modal.module.css`; ~25 consumers untouched | zap→QR→back stack; keepOpen |
| C7 | Toast | render layer only | dedup count + progress resync |
| C8a | editor: Tabs | mode switch → `ui/tabs.js` + `switch.js` rewrite | write/compose parity, no focus loss |
| C8b | editor: Toolbar | Toolbar+Menu+Separator rewrite; `MenuAlternateDimension` dies | selection survives menu format |
| C8c | editor: link Popover | `link/editor.js` rewrite (§6.3) | link-editor checklist (§9) |
| C9a | form core + barrel | `components/form/` split (25 exports), `form.js` barrel; Input/Field/Checkbox/native-select/InputGroup on Base UI; suggest render swap (D3); Range/CheckboxGroup/MultiInput moved but legacy-shaped | drafts persist; invalid-after-submit-only |
| C9b | form semantics | Range → Slider+NumberField (§6.6); CheckboxGroup; MultiInput → OTP Field | ∞ sentinel; `/email` code entry |
| C10 | Nav/Navbar/Drawer | `ui/nav.js` + ~22 files; `ui/drawer.js` **end + bottom**; both Offcanvas consumers; §4b `nav-link` string sweep (footer); Indicator literal ternary (§6.11) | offcanvas snap, backdrop, bottom sheet |
| C11 | **rb-zero** | `ui/collapsible.js` + `accordian-item.js` internals (last import); `long-pressable` functional rewrite | `grep -rn "react-bootstrap" components pages wallets lib` → **0**; extended `bs-utility-check.js` component-class gate (§4b) → **0** |
| C12 | broad-adoption upgrades | capability Switch (§Table B); bolt11 + max-fee Collapsible (§6.7); Tips Toggle Group (§6.12) | §9 additions |
| C13 | optional | MultiSelect → Combobox `multiple` + chips | — |

Editor work is split three ways (C8a/b/c) because each piece is independently shippable and reviewably small; C8 sits after C3 (needs ActionTooltip) and C5 (needs menu chrome). C12 sits **after** the rb-zero gate — pure hand-rolled→Base UI upgrades, off the migration-critical path.

## 9. Interaction-parity checklist (additions for the new scope)

Master plan's checklist (modal stack, toast dedup, dropdown edges, @/~ keyboard, offcanvas, form validation/drafts, datepicker, territory retint, dark toggle, iOS zoom) still applies. Add:

- **Toolbar**: menu opens above (`side='top'`); pointer format keeps Lexical selection and applies; tooltips suppressed while a menu is open; Escape closes menu, focus returns to editor; arrow-key roving focus (new, expected).
- **Mode switch**: toggles sync Formik; upload-in-progress still blocks with toast; same-tab click no-ops; no editor focus loss.
- **Link editor**: view-mode open steals no focus; edit mode focuses+selects input; Enter confirms / Escape cancels from both popup and editor; outside click cancels and strips empty links; autolink→link conversion; position tracks scroll/resize; icon clicks don't dismiss.
- **Mentions**: `@`/`~` opens at caret; Lexical arrows/Enter/Escape; editor blur closes; click-select keeps editor focus.
- **ToC**: filter input receives all printable keys; heading click closes then navigates.
- **Tips**: chip click sets amount; pressed chip = current amount; typed custom amount clears pressed; clicking the pressed chip keeps the value; localStorage custom tips appear sorted.
- **Range**: slider to floor with `allOption` → null/∞ in both directions; typed number moves slider; blur clamps; no digit grouping; territory + settings forms submit identical values.
- **CheckboxGroup**: postTypes array membership toggles; error only after submit.
- **OTP (`/email`)**: type-advance, backspace-retreat, paste-fill, uppercase; do NOT enable `autoSubmit` (parity).
- **Capability switch**: toggles `${key}.enabled`; label reflects state.
- **Collapsible pills**: more/less expands inline with no flex-row layout shift; `aria-expanded` correct; zero animation.
- **Drawer**: right nav drawer + wallets bottom sheet; backdrop click and X close; no swipe.
- **Split login**: renders as one visual button; main routes, caret opens account menu.
- **Upvote walkthrough**: popovers anchor right of the bolt; dismiss X; show-once flags persist.

## 10. PR2-specific risks

1. **Lexical focus vs Base UI popups** — toolbar Menu focus-return and link-editor focus guards vs `BLUR_COMMAND`; mitigations in §6.1/§6.3; test mentions + link editor together.
2. **NumberField Intl formatting** — `format={{ useGrouping: false }}`; verify iOS numeric keyboard (`inputMode`).
3. **Slider⇄Formik echo loops** — single-direction writes only (user events → Formik).
4. **`Collapsible.Panel` wrapper div in flex-wrap rows** — `className='contents'`.
5. **Menu default scroll-lock** — `modal={false}` everywhere (repeat of master risk 5, it will bite otherwise).
6. **Barrel-split regressions** — C9a is move-only + Input swap; review the diff keyed on the 25-export list.
7. **InputGroup corner-joining vs the utility cascade** — Bootstrap flattens grouped children's inner corners with unlayered-normal rules; the Button recipe's radius utilities (`rounded-md`/`rounded-sm` since C2.5 — was `rounded-sn`) are layered-`!important` and beat them. Two consequences: (a) **C1 must NOT swap Buttons nested inside live InputGroups** — resolved by deferring the WHOLE files (single-import cleanliness): user-header.js, item-act.js, pages/settings/index.js, pages/rewards/index.js, wallets home/actions.js, form.js → C9a; login-button.js → C5 (ButtonGroup, same trap); (b) the new `form/input-group.js` cannot flatten child corners from its module (same cascade loss) — it must inject `rounded-s-none`/`rounded-e-none` utilities into first/middle/last children.

## 11. C2 expansion — static leaves (censused 2026-07-05)

Fresh per-site censuses of every C2 family, verified against globals.scss and compiled Bootstrap. Headline numbers: **Badge 7 files / 16 sites** (only `bg` + `className` are ever passed — no `pill`/`text`/`as`), **Alert 9 files / 11 sites** (variants `info`/`danger`/`warning` only; no site uses `show`), **Container 9 files / 10 sites** (none `fluid`; 4 need `as=`), **Row/Col 8 files** (no `align`/`justify`/`g-*` anywhere in the codebase), **Image 5 files / 8 sites** (none `fluid`; one `roundedCircle`), **Table ×1**, **CardFooter ×1**. `components/badge.js` (user-badge SVG icons, `Badges` export) is unrelated to react-bootstrap Badge — the new file is `components/ui/badge.js`; don't confuse them in imports.

### 11.0 The cascade rule that shapes everything below

Badge is the first component whose consumers override the skin from **module CSS**, not just `className` utilities: `item.module.css .newComment` and `notifications.module.css .badge` both carry `color`/`background !important` written to beat Bootstrap's unlayered `.badge`. Our Tailwind utilities are layered-`!important`, and for `!important` declarations layer order **inverts**: a layered-important utility beats even an unlayered `!important` module declaration. Consequence: **any property named in a recipe's utility string is unoverridable by consumer module CSS.** So C2 recipes split like this:

- Properties consumer skins override today (`color`, `background-color`) live in the ui module as plain unlayered declarations. The existing `!important` skins keep beating them exactly as they beat Bootstrap today — independent of CSS-module import order, which follows the webpack import graph and is NOT a reliable cascade tool. *(Revised 2026-07-06: the two badge shout-skins ended up **absorbed** into badge.module.css as the `.grey` variant instead — same-module var assignments need no `!important`, and the skins' `!important` had nothing left to beat once the swapped spans stop carrying Bootstrap's literal `badge` class. The bucket rule still binds for any consumer skin that stays outside the ui module.)*
- Everything else (box metrics) goes in recipe utilities per keystone 6.
- Consumer-skin declarations that are *not* `!important` today and only win by globals-before-modules load order (`vertical-align`, negative margins) move to call-site utilities — they're layout anyway.

This regime is **transitional** (decided 2026-07-05): the utility `!important` exists only to out-shout Bootstrap's unlayered CSS, and is scheduled for removal after PR3 — see the master plan's post-migration **cascade de-escalation** cleanup (drops the flag *paired* with wrapping skins in `@layer components`, preserving the utilities-win contract without `!important`). Until then the buckets above bind; the var-based skins C2 builds are already the shape the end-state needs.

### 11.1 `ui/badge.js` + `badge.module.css` ✅ shipped (see §0; recipe values revised by C2.5)

Decisions that bind future work (the module + call sites are canonical for values):

- API mirrors Button: `badgeClasses({ variant, className })` + default `<Badge>` span. **No default variant** (rb defaulted to `primary`; every SN site passed `bg` explicitly) — omitted `variant` ⇒ transparent skin-only badge. Only 7 variants exist (`primary` unused): grey / secondary / boost / danger / success / warning / info. `.badge:empty { display: none }` kept (BS parity). `vertical-align` deliberately not declared — sites set `align-middle`/`align-text-top` per-site.
- `.secondary`/`.boost` skins use the `--bs-*-rgb` triplets so (a) the branded-territory retint flows through (custom-css.js overrides `--bs-secondary-rgb`; territory-header's nsfw badge renders on exactly those pages) and (b) comment.js's `op` badge keeps its 75% alpha via the `--sn-badge-opacity` var, written per-site as `[--sn-badge-opacity:0.75]`. `boost` is in `$theme-colors` so `--bs-boost-rgb` exists until PR3.
- Text is `#fff` for every Bootstrap-derived variant (BS badge has no YIQ) — do NOT "fix" secondary with `--sn-secondary-text`. `.grey` is the one variant that sets its own text color; it **absorbed** the two legacy shout-skins (`item.module.css .newComment`, `notifications.module.css .badge` — deleted, along with item `.badge` and comment `.op`); their margins became call-site utilities (since C2.5: `ms-0.5`, vertical nudges dropped). Dark mode is free — the `--theme-*` vars flip with the theme. This pre-empts the master plan's de-escalation follow-up (3) for badge.
- `styles/satistics(.module|_old.module).css .badge` are dead skins no JSX applies — leave for PR3's module sweep.

### 11.2 `ui/alert.js` + `alert.module.css` ✅ shipped (see §0; Heading sizing revised by C2.5 → `text-xl leading-tight`)

Decisions that bind future work (module + consumers canonical for values):

- Compound API preserved so consumers are drop-in: default `Alert` plus `Alert.Heading`/`Alert.Link` as plain function properties. **No `show` prop** — zero sites used it; all gate with conditional rendering. Variants: info / danger / warning only.
- Skins: one `color-mix` tint/shade pair per variant with a `:global([data-bs-theme='dark'])` block — **PR3 must migrate that selector** (§11.11). The hand-drawn `border-radius: 33% 2% / 11% 74%` is an SN identity one-off (allowed exception to keystone 6d).
- `.close` deviates from Bootstrap's `.btn-close` **by design** (verified against painted CSS, not the scss — the `$close-*` vars in globals are dead BS4 names): literal lightning-font `X` child (modal.js precedent), `#000` at `.5`/`.75` opacities, gold focus ring, dark-mode `#fff`. globals' `.btn-close` rules stay until Drawer (C4) stops consuming them.
- `Alert.Link` = bold `text-reset` — the layered-important utility also beats globals' `a:hover` recolor, matching today (alert links don't change color on hover).
- Non-mechanical consumers to remember: post.js:104 keeps `className='absolute'` + inline `top: -6rem` (the utility beats module `position: relative`); wallets send-error.js passes a **dynamic** `{error.variant}` (`warning`|`danger`, both skins exist) and composes `classNames(styles.fields, 'mt-4 mb-0')` through cn; banners.js exercises the full compound API; snl.js's `onClose` writes localStorage (behavior stays consumer-side); territory-payment-due/notifications embed forms/buttons that stay untouched.

### 11.3 `ui/container.js` ✅ shipped (revised by C2.5 → single `max-w-4xl`)

Tailwind-only recipe (`w-full mx-auto px-4 max-w-4xl`; 896px ≈ the old lg 900px cap, Bootstrap's 540/720 tablet tiers dropped), polymorphic `as` (4 sites), no `fluid` (unused — never built). `px-4` = half of SN's `$grid-gutter-width: 2rem` override. Verified when built: PullToRefresh forwards `className` onto its `<main>` (layout.js passes only `className`+children, nothing dropped); no SN stylesheet keys off a `.container` selector, so the tailwind.css `container` blocklist is no longer load-bearing (still dies at PR3). All 10 sites/9 files swapped import-only. Consumer overrides compose: `px-0` drops the recipe's `px-4` via twMerge; `sm:px-0` coexists (different modifier).

### 11.4 Row/Col ✅ done 2026-07-07 (no wrapper — native gap/grid; revised same day from the −mx-4/px-4 replication)

Revision in the same spirit as C2.5's Container rewrite: Bootstrap's negative-margin/padding gutter is *structure* we don't keep under native-first — it only ever existed because `gap` didn't. New mapping:

- **Fractional columns → CSS grid.** `gap` doesn't compose with flex percentage widths (`w-1/2` + `gap-8` overflows and wraps), but grid subtracts gaps from track math natively: `grid grid-cols-2 md:grid-cols-3 gap-x-8`, nothing on the cells.
- **Bare/auto columns → flex + `gap`.** Equal-split pairs become `grid grid-cols-2 gap-8` or flex children with `grow basis-0`.
- **Single-`Col` rows are no-ops — delete them.** The col's `px-4` exactly cancelled the row's `-mx-4`; keep a plain `div` only where a utility class lives.
- **Consumer `ps-0` was gap-choosing in disguise** — every site pairing `px-4` with `ps-0` really wanted a 1rem gap ⇒ `gap-4`. §11.10 risk 2 (shorthand/longhand compiled ordering) is **moot**: there is no gutter padding to cancel.
- **Behavior parity, not pixel parity**: bare cols sit side-by-side at *all* widths ⇒ unprefixed `grid-cols-2` (chart pairs, lightning wallet lists); fractional cols keep their wrap points; raw non-Col children of a Row (which `.row > *` forced full-width) get block flow instead.
- **Every grid needs explicit tracks at every width** (found in QA 2026-07-07): a breakpoint-only template (`grid` + `md:grid-cols-2`) leaves mobile cells in *implicit auto tracks*, whose minimum is the content's min-content — the 300px-intrinsic QR svg then overflows narrow viewports (Bootstrap never hit this: `.row > *` width:100% gave cols a definite width for `max-width:100%` to resolve against). Tailwind's `grid-cols-*` emits `minmax(0, 1fr)` precisely to kill that floor ⇒ always pair a base `grid-cols-1` with responsive variants.

Risk 5 resolved by checking callers: lightning-auth's `md`/`lg` were **live**, not dead — settings/logins.js passed `md={12} lg={12}` (always stacked) while login.js used the defaults (2-col at ≥lg). Only two shapes exist ⇒ the 12-column props are replaced by a **`stacked` boolean** on `LightningExplainer`/`LightningAuthWithExplainer`; settings/logins.js passes `stacked`, login.js passes nothing.

Per-site (8 files):
- **nostr-auth.js** — main Row → `grid grid-cols-1 md:grid-cols-2 gap-8 w-full text-muted` (`w-full` still needed: `.login` is a centered flex column); left cell `mb-6` (`ps-0` dropped); right cell `w-full max-w-75 mx-auto` (inline style converted — TW4 dynamic spacing, 75 × .25rem ≡ 300px; auto margins center a max-width-capped grid item). The two single-col accordion Rows (extensions / NIP-46 lists) deleted outright.
- **lightning-auth.js** — main Row → `grid grid-cols-1 gap-8 w-full text-muted` + `lg:grid-cols-2` unless `stacked`; raw-text Row (`mb-4`, no Col) → plain `div mb-4` (also fixes its 1rem `-mx-4` bleed inside the accordion); two wallet lists → `grid grid-cols-2 gap-8`; QR cell as in nostr-auth.
- **job-form.js** — location + remote row → `flex gap-4` (today's effective gap: `pe-4` + `ps-0` = 1rem); input cell `grow basis-0`, checkbox cell `flex`. `me-0` dropped — it only killed the old right-edge bleed.
- **territory-form.js** — postTypes → `grid grid-cols-3 sm:flex sm:flex-wrap sm:gap-x-8`; the four cells become plain divs (3-per-row below sm preserved, auto-width inline above).
- **pages/satistics/graphs/[when].js** — stat tiles → `grid grid-cols-2 md:grid-cols-3 gap-x-8 my-6`, tiles keep `text-center mb-4`; chart pairs → `grid grid-cols-2 gap-x-8` with `mt-4` cells; the empty filler `<Col className='mt-4' />` deleted (a grid track stays empty on its own).
- **pages/stackers/[sub]/[when].js** — same with `md:grid-cols-4` (tiles, incl. the conditional registrations cell); three chart-pair rows.
- **form.js** (swept per §11.8) — InputInner Row → `div flex gap-4`, input cell `grow basis-0` (no `min-w-0` — Bootstrap's `.col` had none either), `AppendColumn` → `div flex` (+`invisible` passthrough; `xs='auto'`/`ps-0` dropped, gap provides the 1rem); VariableInput outer Row/Col → plain `div mb-2` — block flow stacks input/hint/feedback naturally (hint loses the old 1rem `.row > *` indent, now consistent with InputInner's own un-indented hint). adv-post-form's render-prop `AppendColumn` flows back into InputInner's row, so no other file changes.
- **pages/rewards/index.js** (swept per §11.8) — single-col Row → `div pb-4`.

### 11.5 Image ✅ done 2026-07-07 (plain `<img>`, no wrapper)

rb `Image` without boolean props renders a bare `<img>` with no added class — all sites are 1:1 tag swaps keeping `src`/`width`/`height`/`className`/`onClick`: item-job.js:28, user-list.js:41/:69/:120/:204, user-header.js:102 (§11.8), nav/mobile/offcanvas.js:18 (has `onClick`). Exception: job-form.js:45 `roundedCircle` → `rounded-full` (50% vs 9999px — identical on a 135×135 square).

Landed exactly as sketched (job-form gets `className='rounded-full'` since it had no className before). See §0 for gates and import-line handling in the two files that keep other rb imports.

### 11.6 fee-button Table → plain `<table>` ✅ done 2026-07-07 (landed verbatim)

`<Table className={styles.receipt} borderless size='sm'>` → `<table className={styles.receipt}>`. The module already re-declares almost everything Bootstrap contributed (width, bg, td padding — which beats globals' ≥899px `.table-sm` padding by load order today — colors, tfoot border; `margin: auto` already neutralizes `.table`'s `margin-bottom`). Add to fee-button.module.css what silently came from elsewhere:
- `.receipt { border-collapse: collapse; }` (currently Bootstrap reboot; PR3 deletes reboot — do it now)
- `.receipt td { line-height: 1.2rem; vertical-align: top; }` (currently globals.scss:459 `.table-sm` rule; vertical-align is belt-and-suspenders — single-line rows can't visibly differ)

`borderless`/`size='sm'` drop with nothing to preserve. The deprecated `align='right'` td attributes stay (parity, out of scope).

### 11.7 territory-header CardFooter → plain `<div>` ✅ done 2026-07-07 (class-drop only — the sketched skin was never painted)

Pre-flight finding (2026-07-07, compiled-CSS + DOM census — risk §11.10.3's "painted, not scss" rule striking again): Bootstrap 5.3 compiles `.card-footer` entirely as `var(--bs-card-*)` declarations, and those vars are defined **only on the `.card` selector** — which SN never renders (zero react-bootstrap `Card` imports anywhere; no raw `card` class strings; this footer's ancestors are `.accordion-body` in territory-header, a popover body in sub-popover.js, and modals in sub-select.js / territory-list.js). With the vars unresolvable, every `.card-footer` declaration — padding, background, border-top, and the `:last-child` bottom radius the old open question asked about — is invalid at computed-value time and falls back to `unset` ⇒ **the class paints nothing anywhere in SN**. (It did paint before Bootstrap 5.2's CSS-var refactor compiled the literals away; the footer chrome was silently lost at that upgrade and nobody missed it.)

As landed: `<CardFooter className={'py-1 ' + styles.other}>` → `<div>` with the identical className (+ closing tag); `CardFooter` specifier dropped from the import line (`Dropdown` stays until C5). No item.module.css addition, no `px-4`, no radius line — the earlier sketch's `.cardFooter` skin (`--bs-card-cap-bg` bg + `--bs-border-color-translucent` border-top, `px-4`) copied Bootstrap's *intended* values off the `.card` var block, which never applied at this site; landing it would have added a chrome band today's users don't see, in all four render contexts. If the footer band is ever wanted back, that's a new design decision, not migration parity.

### 11.8 Deferred-file overlap — decision

Three §0-deferred files carry C2 families: form.js (Row/Col ×3 clusters), pages/rewards/index.js (Row/Col ×1), user-header.js (Image ×1). **C2 sweeps them.** The risk-7a deferral protects Buttons inside live InputGroups; Row/Col/Image swaps touch neither buttons nor corner-joining, and pre-cleaning form.js keeps C9a's "move-only" diff pure (the barrel split then carries plain markup). Their react-bootstrap import lines survive until C9a/C5 regardless — C11's grep is the gate that cares.

### 11.9 Gates & QA

- Import grep: `grep -rnE "from 'react-bootstrap" components pages wallets lib | grep -E "\b(Badge|Alert|Container|Row|Col|Image|Table|CardFooter)\b"` → **0**. *(Sole allowed hits: `pages/dev/playground.js` — the untracked dev comparison page imports Bootstrap originals as `Bs*` on purpose; it dies before the PR lands and must not count against this gate or C11's.)*
- Raw-utility grep: `grep -rn "bg-opacity" components pages wallets` → **0** (same playground exemption).
- Alert compiled-color parity: devtools-compare all three variants, light **and** dark, against the color-mix values before deleting anything.
- Visual-diff pass (light + dark): item rows + a comment thread (grey `variant='grey'` chips — subName/nsfw/freebie/downsats; OP badge `fwd` vs `boost` incl. the 75% alpha); job item (stopped chip + company logo); territory header **on a branded custom domain** (nsfw badge must retint via `--bs-secondary-rgb`); territory domains settings (verified/pending/HOLD/active); territory form (nsfw badge in copy; postTypes Row at <576/≥576); notifications (error alert, notify-prompt alert with its Yes/No buttons, autowithdraw chip); login page + lightning/nostr auth at <768/≥768/≥992 (Row/Col grids); post error alert (absolute, `top: -6rem`); wallet send error (warning **and** danger); settings/logins error alert; fee receipt popover (td line-height 1.2rem); territory info footer **unchanged** after the §11.7 class-drop (small grey text, py-1, no bg band / border-top — check all four contexts: territory header accordion, sub hover popover, sub-select info modal, territories list); all headers + footer + search + sticky bar (container cap `max-w-4xl`/896px per C2.5, `as=` sites still render `header`/PullToRefresh); satistics + stackers stat grids across the md breakpoint; mobile offcanvas avatar.

### 11.10 C2-specific risks

1. **The §11.0 inversion** — never add `text-*`/`bg-*` utilities to `badgeClasses` BASE or to call sites; a layered-important utility beats the module color declarations (even `!important` ones) and freezes the variant in every state.
2. ~~**`px-4` + `ps-0` longhand ordering**~~ — retired by the §11.4 revision (2026-07-07): the gap/grid mapping has no gutter padding for a consumer longhand to fight.
3. **Alert dark tokens + close-button chrome** — devtools before/after; don't trust the scss reading (dead BS4 `$close-*` vars, possible residual `.btn-close` svg/opacity).
4. **`as={PullToRefresh}`** (layout.js) — confirm className passthrough so the container padding/max-width land on the wrapper element.
5. ~~**lightning-auth `md`/`lg` props** may be dead parameters~~ — resolved (2026-07-07): callers checked, props were live (settings/logins.js passed `md={12} lg={12}`); replaced with the `stacked` boolean per §11.4.
6. **CSS-module import order is not a cascade tool** (§11.0) — anything that must beat the ui module base needs `!important` or call-site utilities; that's why item.module.css `.badge`/`.newComment`, comment.module.css `.op`, and notifications.module.css `.badge` are all deleted (absorbed into variants or replaced by utilities) rather than left to race.

### 11.11 PR3 handoff notes

C2 skins newly consume two `--bs-*` vars that PR3's variable sweep must alias or replace: `--bs-secondary-rgb`, `--bs-boost-rgb` (badge). *(The card-footer pair — `--bs-body-color-rgb`, `--bs-border-color-translucent` — dropped out with the §11.7 revision: no skin was added.)* Grep `--bs-` under `components/ui/` when PR3 starts. Also for PR3: the compiled `.card`/`.card-footer` block is now fully dead CSS (§11.7 proved no `.card` is ever rendered) — safe to confirm-and-drop with the Bootstrap sweep. The alert module's `[data-bs-theme='dark']` selector also survives into PR3's theme mechanism. badge.module.css additionally reads `--theme-grey` + `--theme-clickToContextColor` (`.grey` variant) — SN-owned vars that survive PR3; no action needed, listed so the var-grep result isn't a surprise.

## 12. C3 expansion — Tooltip (censused 2026-07-07)

Fresh per-site census verified against the working tree and `@base-ui/react@1.6.0`'s shipped types/source (not docs-from-memory). Headline numbers, correcting Table A: **rb `Tooltip` = 4 sites / 3 files** (action-tooltip.js:18, badge.js:101, login.js:138 + :170); **OverlayTrigger dies in the same 3 files** — the other two importers, footer.js (×4 sites, `trigger='click'` `rootClose` Popover overlays) and hoverable-popover.js, are **C4's** (their overlays are Popovers; a Base UI Tooltip can't express click-toggle). Table A's "OverlayTrigger ×5 → C3" conflated the two populations. **ActionTooltip consumers: 8 files / 12 sites**, all untouched (internals swap): fee-button.js:220, upvote.js:253, pay-bounty.js:102, comment.js:260, item.js:125, poll.js:22, footer.js:160/:163/:166, editor/plugins/toolbar/index.js:86/:140/:297. **BadgeTooltip** (badge.js:96, exported) has zero external importers — both uses are internal (badge.js:17 anon, :85 all other badges); keep the export. `hideDelay` has **zero passers** anywhere; `transition` is passed only by the 3 toolbar sites; `placement` values in use: default `bottom`, `left` (poll), `top` (toolbar ×3), explicit `bottom` (login ×2, badge default).

### 12.0 Two tooltip populations today (and what actually paints)

The old "popper parity" note flattened a real split. Verified in code (rb `Overlay.js:26` defaults `transition = Fade`; `:99` adds a bare `show` class when `transition` is falsy):

- **Population A — ActionTooltip sites (12).** `transition={transition || false}` ⇒ default **no fade**: classes `tooltip bs-tooltip-<side> show` ⇒ Bootstrap's `.tooltip.show` paints **opacity .9**, appearance is a **snap** (except the 3 toolbar sites, which pass `transition` ⇒ population B). `popperConfig` disables `preventOverflow` (**collisions off**) and the `<Tooltip style={{position:'fixed'}}>` hack rides along — the two were a pair against tooltip jitter in scrolling lists. Delays: `showDelay`/`hideDelay` → rb `delay`, default **0/0**; toolbar passes 500/500/1000. `show={formik?.isSubmitting ? false : undefined}` force-hides during submit unless `notForm` — **fee-button.js:220 is the only formik-aware site** (every other consumer passes `notForm`).
- **Population B — badge.js + login.js (3 sites, + toolbar's 3 via `transition`).** No `transition` prop ⇒ rb default `Fade` ⇒ classes `fade tooltip … show` ⇒ SN's `.fade.tooltip` (globals.scss:1064) paints **opacity 1** + `fadeIn 0.15s ease-in` (SN wrote that animation because `$enable-transitions: false` compiled Bootstrap's `.fade` transition away). **No `popperConfig`** ⇒ popper's `preventOverflow`+`flip` are **ON** — these tooltips avoid viewport edges today; population A's don't.
- **Shared chrome** (compiled BS 5.3 + globals.scss:1046–1077 overrides; ~~scss claims~~ → painted values per pre-flight 1, 2026-07-07): bg `#5c8001` (`$tooltip-bg`, globals:85 — theme-invariant, no dark override), text `#fff`, font-size **13.02px** (NOT `.875rem`/14px — it's Bootstrap's `$tooltip-font-size: $font-size-sm` = SN's `.93rem` base × .875 = `.81375rem`; the old note quoted the sass formula, the compile bakes the small base in), `.tooltip-inner` padding `.2rem .45rem` (3.2/7.2px ✓) + `line-height: 1` (✓ computes 13.02px), `max-width: 200px` ✓, `text-align: center` ✓, `word-wrap: break-word` ✓, border-radius `.4rem` (6.4px ✓), arrow `.8rem × .4rem` (12.8×6.4px ✓) green triangle, `z-index: 1080` ✓ (≡ `--sn-z-tooltip`). Touch: `@media (hover:none),(hover:on-demand) { .tooltip { visibility: hidden } }` — **touch-disabled for population A ONLY**: `.fade.tooltip { visibility: visible }` (globals:1064) is specificity (0,2,0) vs the media rule's (0,1,0), so **population B tooltips DO open on tap today** (mobile synthesizes hover; confirmed empirically under emulated `hover:none` — badge tooltip computed `visibility: visible`). The old "by design" claim held only for A.

**Pre-flight checks (painted output, not scss — the §11.7 lesson) — ✅ all four run 2026-07-07** (headless system Chrome via playwright-core against the dev server; scratch page `pages/dev/tooltip-preflight.js` mounts both rb populations + a bare Base UI tooltip — **delete it when C3 lands**; scripts in session scratchpad):
1. ✅ **Split confirmed exactly.** A (front-page upvote bolt in situ + scratch): classes `show tooltip bs-tooltip-bottom`, `animation: none`, opacity `.9` from first frame (snap). B (badge): classes `fade show tooltip bs-tooltip-bottom`, `animation: 0.15s ease-in fadeIn`, opacity ramps 0→.07→.30→1. `.tooltip-inner` computed: padding/radius/max-width all as quoted (3.2×7.2px / 6.4px / 200px) but **font-size 13.02px, not 14px** — shared-chrome bullet corrected above; `text-sm` (14px) remains the nearest native step (|14−13.02| = .98 < |13.02−12| = 1.02), it's just not "exact". **Bonus finding**: the `position:fixed` hack is **inert today** — computed `position: absolute` on live tooltips (popper's applyStyles overwrites the React inline style), so dropping it (§12.2) loses nothing.
2. ✅ **Gap = 6.0px** (A, front-page bolt) / **6.33px** (B, badge) — §12.0's ≈6.4 prediction holds. Base UI with `sideOffset={6}` painted a 6.33px gap in the same run: **`sideOffset={6}` locked** (open question 3 answered).
3. ✅ **Docs demo pattern pulled** (base-ui.com/react/components/tooltip.md): `origin-[var(--transform-origin)]`, transition on `[transform, opacity]` **ease-out**, `data-starting-style`/`data-ending-style` at `opacity-0` + **`scale(0.98)`** (not the sketch's .95 — open question 4 answered), `data-instant:transition-none`. Docs use 100ms; keystone 5 pins ours at ~150ms (kept). Docs `sideOffset={11}` is their chunky-shadow design, not a parity input. Docs arrow is an SVG; we keep the CSS diamond (open question 2 rationale stands).
4. ✅ **No touch leak** (emulated iPhone, `hasTouch` — playwright tap + raw `touchscreen.tap`): Base UI opens **nothing** on tap while hover in the same setup opens fine; no §12.7-3 contingency needed. Real-iOS pass stays on sox's §12.6 QA list. ⚠️ **But see the corrected shared-chrome bullet**: today a tap DOES open population B tooltips (badge streak counts etc.) — under Base UI, mobile loses that. Evidence filed as open question 5.

*(Verified during spec: `Tooltip.Root` has `disabled`; collisions turn off via `collisionAvoidance={{ side: 'none', align: 'none', fallbackAxisSide: 'none' }}`; `TooltipPositioner`'s own `side` default is `'top'` — our wrapper must default `'bottom'`.)*

*(⚠️ Delay-resolution claim CORRECTED during implementation 2026-07-07: `TooltipTrigger.js:129` does read `delay ?? providerDelay ?? 600`, but that line sits inside a `groupOpenValue !== 0` guard — and `TooltipProvider delay={0}` feeds `FloatingDelayGroup` a base delay of `{open: 0}`, making `groupOpenValue === 0` **permanently**, which short-circuits every trigger to 0 and kills the toolbar's `showDelay={500}`/1000 (caught by headless QA: replica opened at ~200ms). As-built fix: the Provider carries **no delay props** (grouping only — the group's open value is then `undefined` in the normal phase and `0` only during the instant-swap phase, which is the guard's intended job), and the rb-parity 0-default lives on our wrapper's Trigger as `delay={delay ?? 0}` (`closeDelay` needs nothing — Trigger's own default is already 0). Grouping instant-swap re-verified working after the change.)*

### 12.1 `ui/tooltip.js` + `tooltip.module.css` (+ Provider in `_app.js`)

File-placement rule satisfied: 3 consumer files (action-tooltip.js internals, badge.js, login.js). Recipe per keystone 6 — layout/typography as utilities, chrome/motion in the module via `var(--sn-*)`:

```jsx
import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'
import { cn } from '@/lib/cn'
import styles from './tooltip.module.css'
// (an earlier draft pinned collisionAvoidance off for popper parity —
// deleted at QA, see §12.5 OQ1: Base UI's default flip+shift applies)

// _app.js mounts this once for grouping only (adjacent triggers swap
// instantly, 400ms native timeout). Deliberately NO delay props — a Provider
// delay of 0 would flatten every per-site delay to 0 via the groupOpenValue
// short-circuit (see §12.0 correction); the 0-default rides the Trigger
export function TooltipProvider ({ children }) {
  return <BaseTooltip.Provider>{children}</BaseTooltip.Provider>
}

/**
 * SN Tooltip — children must be a single element that spreads props and
 * forwards ref (DOM tags qualify); it stays in place, only the popup portals
 */
export default function Tooltip ({ children, content, side = 'bottom', delay, closeDelay, disabled, className }) {
  if (!content) return children
  return (
    <BaseTooltip.Root disabled={disabled}>
      {/* delay ?? 0 = rb parity (Trigger's own default is 600ms; closeDelay's is already 0) */}
      <BaseTooltip.Trigger render={children} delay={delay ?? 0} closeDelay={closeDelay} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner side={side} sideOffset={6} className={styles.positioner}>
          <BaseTooltip.Popup className={cn(styles.popup, 'px-2 py-1 text-sm leading-none text-center wrap-break-word max-w-48 rounded-md', className)}>
            <BaseTooltip.Arrow className={styles.arrow} />
            {content}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  )
}
```

Utility values, nearest-native per C2.5 (no brackets): padding `.2rem/.45rem` → `py-1 px-2` (`.25/.5rem` — also exactly Bootstrap's own stock tooltip padding; SN's override was a hand-nudge below stock), font 13.02px painted (see pre-flight 1) → `text-sm` (14px — **nearest step, not exact**; ~1px up), `line-height: 1` → `leading-none`, `max-width: 200px` → `max-w-48` (192px), radius `.4rem` → `rounded-md` (the C2.5 codemod value for BS `rounded`), `word-wrap: break-word` → `wrap-break-word` (TW 4.1 canonical; `break-words` is the v3 alias), `text-align: center` → `text-center`. Colors stay module-side per §11.0 discipline (no `bg-*`/`text-<color>` in the recipe string).

```css
/* tooltip.module.css */
.positioner {
  z-index: var(--sn-z-tooltip);   /* portals to <body>; ladder is the only z authority */
}

.popup {
  --sn-tooltip-bg: #5c8001;       /* $tooltip-bg (globals:85); theme-invariant today — no dark block */
  background-color: var(--sn-tooltip-bg);
  color: #fff;
  transform-origin: var(--transform-origin);
  transition: opacity 150ms ease-out, transform 150ms ease-out;   /* keystone 5, first application */
}

.popup[data-starting-style],
.popup[data-ending-style] {
  opacity: 0;
  transform: scale(0.98);         /* Base UI docs demo value (pre-flight 3, 2026-07-07) */
}

.popup[data-instant] {
  transition: none;               /* provider grouping / dismiss / focus opens skip the animation */
}

@media (prefers-reduced-motion: reduce) {
  .popup {
    transition: none;
  }
}

/* diamond arrow: rotated square, half-protruding; shares the bg var.
   8px ⇒ 4px protrusion ≈ today's .4rem triangle; data-side = popup side,
   so side='bottom' puts the arrow on the popup's TOP edge */
.arrow {
  width: 8px;
  height: 8px;
  background-color: var(--sn-tooltip-bg);
  transform: rotate(45deg);
}
.arrow[data-side='top'] { bottom: -4px; }
.arrow[data-side='bottom'] { top: -4px; }
.arrow[data-side='left'] { right: -4px; }
.arrow[data-side='right'] { left: -4px; }
```

`_app.js`: `import { TooltipProvider } from '@/components/ui/tooltip'`, wrap once directly inside the outer `<ErrorBoundary>` (line 121 — context-only, renders no DOM, any depth works; outermost keeps the diff one-line). This closes C0's standing decision "`Tooltip.Provider` lands in C3".

Intended native deltas (all three are Base UI defaults we deliberately keep — list them in the PR description):
- **Uniform opacity 1** — population A gains the `.1` Bootstrap dimmed it by; SN already chose `1` for population B.
- **Population A gains the ~150ms fade** (keystone 5) — it snaps today; population B's 0.15s ease-in becomes 150ms ease-out.
- **Provider grouping**: once one tooltip is open, moving to an adjacent trigger swaps instantly (`data-instant`, 400ms window) — footer's three toggles and the toolbar row benefit; rb had no equivalent. `timeout={0}` on the Provider kills it if QA dislikes it.
- **Focus opens on focus-visible only** — a mouse-click's focus no longer summons the tooltip (rb showed on any focus); keyboard Tab still does. Strictly better, same family as D8.
- **Hoverable popup** (WCAG 1.4.13): moving the pointer onto the tooltip keeps it open; rb closed it. Keep the default (`disableHoverablePopup` unset).
- **Collision avoidance everywhere** (added at QA, §12.5 OQ1): flip+shift keeps every tooltip in the viewport — population A never had it (clipped at edges by design of the old popper config), population B keeps what it had.

### 12.2 `action-tooltip.js` internals (public API frozen)

```jsx
import { useFormikContext } from 'formik'
import Tooltip from '@/components/ui/tooltip'

export default function ActionTooltip ({ children, notForm, disable, overlayText, placement, noWrapper, showDelay, hideDelay, transition }) {
  // if we're in a form, we want to hide tooltip on submit
  let formik
  if (!notForm) {
    formik = useFormikContext()
  }
  if (disable || !overlayText) {
    return children
  }
  return (
    <Tooltip
      content={overlayText}
      side={placement || 'bottom'}
      delay={showDelay}
      closeDelay={hideDelay}
      disabled={formik?.isSubmitting}
    >
      {noWrapper ? children : <span>{children}</span>}
    </Tooltip>
  )
}
```

- The early returns and the conditional `useFormikContext` stay **verbatim** — the hook-in-a-conditional is a pre-existing rules-of-hooks violation; C3 does not fix it (behavior risk + diff noise; `notForm` is constant per site so it never actually misfires).
- `show={isSubmitting ? false : undefined}` → `Root disabled` — flipping `disabled` true closes an open tooltip (change reason `'disabled'` exists in 1.6.0's `TooltipRoot.ChangeEventReason`). QA-verify on fee-button.
- `transition` becomes a **no-op** (keystone 5: everything animates now) — keep it in the signature so the 3 toolbar call sites don't error; C8b drops it from them. `hideDelay` likewise stays accepted (zero passers today).
- `position: fixed` hack + `popperConfig` die with the rb elements — portal-to-body + floating-ui auto-update is the native cure for the jitter they patched. (Pre-flight 1 bonus: the hack is already **inert** — popper's applyStyles overwrites the inline `position` to `absolute` at runtime, verified on live tooltips — so dropping it can't change anything.)

### 12.3 Direct sites — badge.js + login.js

- **badge.js**: `BadgeTooltip` body becomes `<Tooltip content={overlayText} side={placement || 'bottom'}>{children}</Tooltip>`; export kept. Both internal uses already pass a single `<span>` wrapper element ⇒ valid `render` targets. Drop the two rb import lines. *(Reminder from §11: `components/badge.js` ≠ `components/ui/badge.js`.)*
- **login.js** ×2 (:135, :167): today's `overlay={multiAuth ? <Tooltip>…</Tooltip> : <></>}` becomes `<Tooltip content='not available for account switching yet' disabled={!multiAuth}>` around the same `<div className='w-full'>` children (`key={provider.id}` moves onto our Tooltip — it's a component key, fine). `placement='bottom'` was explicit = our default, drop it. Import line 11 (`{ OverlayTrigger, Tooltip }` barrel) dies — nothing else rides it.

### 12.4 The fadeIn keyframe — keystone 5 reconciliation

The old C3 gate ("fadeIn = only surviving popup animation") predates the 2026-07-06 keystone 5 rewrite and is **superseded**: tooltip motion is now the module's `data-starting-style`/`data-ending-style` transition, and **no fadeIn keyframe moves into tooltip.module.css** (§3's old tree comment fixed accordingly). Census of the globals keyframe (2026-07-07): `@keyframes fadeIn` (globals:1070) has exactly two referencing rules — `.fade.tooltip` (:1064, dies with the rb tooltip DOM) and `.spin.fade-in` (:1060, **already dead**: every JSX `spin` pairs with `fill-*`, none with `fade-in`). So after C3 the keyframe has zero live consumers. **C3 deletes nothing in globals.scss** (C2 precedent: deletions are PR3's, grep-gated) — the whole block is queued in §12.8. text.scss:294 declares its own identical `fadeIn` (media fade-in) — keyframes share a global runtime namespace, but the two bodies are identical so today's shadowing is harmless, and text.scss's copy stands alone once globals' dies.

### 12.5 Open questions (for spec review)

1. ~~**Collisions.**~~ ✅ resolved 2026-07-08 (sox QA): badge tooltips **do** clip at the viewport edge with collisions off — `COLLISIONS_OFF` deleted from ui/tooltip.js, Base UI's default flip+shift now applies to **all** tooltips (verified headless: a 192px popup near a 420px viewport's edge shifts ~14px off-center to stay inside, side preserved). Population A gains collision avoidance it never had — intended betterment, **cite in the commit**.
2. ~~**Arrow.**~~ ✅ confirmed 2026-07-08 (sox QA): the CSS diamond stays.
3. ~~**`sideOffset={6}`** pending pre-flight 2's measurement~~ ✅ answered 2026-07-07: today's painted gap is 6.0px (A) / 6.33px (B); Base UI at `sideOffset={6}` paints 6.33px — locked at 6.
4. ~~**Scale value** in starting/ending styles pending pre-flight 3~~ ✅ answered 2026-07-07: docs demo uses `scale(0.98)` — landed in tooltip.module.css.
5. ~~**Mobile badge tooltips (new, from pre-flight 4).**~~ ✅ decided 2026-07-08 (sox): accept the loss at C3 — today population B opens on tap (`.fade.tooltip`'s `visibility: visible` out-specifies the touch-hiding media rule, see §12.0; that's how phone users read cowboy-streak day counts), and Base UI opens nothing on tap. **C4 must restore mobile access with a Popover for badges** — logged as §6.13.

### 12.6 Gates & QA

Mechanical gates:
- `grep -rn "react-bootstrap/Tooltip" components pages wallets lib` → **0**; `grep -rn "from 'react-bootstrap'" components pages wallets lib | grep -E "Tooltip|OverlayTrigger"` → **0** (playground exemption as always).
- `grep -rln "OverlayTrigger" components pages wallets lib` → **exactly** `footer.js` + `hoverable-popover.js` (C4's residue; C11's zero-grep is the final backstop) + the exempted `pages/dev/playground.js` (its BS comparison column imports rb Tooltip/OverlayTrigger by design — dies with C11/PR3 like every other playground rb import).
- `npx standard` clean on the touched files: `components/ui/tooltip.js` (new), `components/action-tooltip.js`, `components/badge.js`, `components/login.js`, `pages/_app.js`.
- No `@theme`/token changes ⇒ no compiled-CSS gate this commit.

Visual/interaction QA (light + dark where it matters — the green is theme-invariant):
- **Upvote bolt**: bubble below, arrow, `numWithUnits` text, ~150ms fade in **and** out; scroll a long item list mid-hover — no jitter/detach (the dead `position:fixed` hack's job, now native).
- **Fee button** inside a post form: tooltip shows fee text; **hides the moment submit starts** (formik gate via `disabled`); works again after.
- **Poll** '1 sat' opens `left`; **comment/item bounty** chips show "… paid".
- **Footer toggles** ×3 (dark mode / lightning animations / live comments): correct text per state; sweep the pointer across all three — adjacent opens are instant (grouping, intended).
- **Toolbar (interim, pre-C8b)**: 500ms delay, opens `top`; tooltip suppressed while its dropdown is open (`disable` → early return); show/hide-toolbar toggle at 1000ms; **the rb `Dropdown` child still opens/closes** (risk 1).
- **Badges**: anon spy, cowboy streak (day count), horse/gun/bot, wallet badges; hover one near the right viewport edge at ~375px — observe the collisions-off behavior and feed open question 1.
- **Login** (account-switching flow, `multiAuth`): tooltip on the email form + non-lightning providers only there; plain `/login` shows none.
- **Keyboard**: Tab to a trigger → tooltip on focus-visible; Escape closes. Mouse-click focus shows nothing (intended delta). *(Only sites whose trigger child is naturally focusable qualify — toolbar buttons; badge `<span>`s / login `<div>`s aren't keyboard-reachable today either (rb spans never focused), so no regression there — verified in pre-flight: a bare-span Base UI trigger is skipped by Tab.)*
- **Touch** (emulation + one real iOS pass): tap opens no tooltip anywhere (pre-flight 4's runtime confirmation).
- **`prefers-reduced-motion: reduce`**: instant show/hide, everything else identical.

### 12.7 C3-specific risks

1. **Toolbar's trigger child is an rb `Dropdown`** (`as='span'`) until C8b — `Trigger render={children}` must merge props+ref through react-bootstrap's forwardRef chain. Today's `cloneElement` path has the same requirements, so it should hold, but this is the one interim state to test explicitly before calling C3 done. Fallback: ActionTooltip wraps `noWrapper` children in `<span className='contents'>` temporarily (layout-inert), removed at C8b.
2. **Trigger's 600ms default delay** — mitigated by the Provider cascade (verified, §12.0); the wrapper must never rely on Trigger defaults. If a tooltip ever renders outside the Provider (tests, storybook-ish pages), it silently gains 600ms — keep the Provider at the app root, period.
3. **Touch leak** — if pre-flight 4 shows Base UI opening on tap-focus anywhere, contingency: `@media (hover: none), (hover: on-demand) { .positioner { display: none } }` in the module (same shape as today's globals rule, scoped to us). Only add it on evidence.
4. **Provider grouping surprises** — the 400ms instant-swap window is new behavior on the footer row; if it reads as glitchy, `timeout={0}` disables grouping without touching sites.
5. **`disabled` flip mid-hover** (fee-button submit) — spec assumes it closes an open tooltip; the reasons enum says yes, QA confirms.
6. **Conditional hook stays** (§12.2) — resist the urge to "fix" it in this diff.

### 12.8 PR3 handoff notes

- globals.scss deletions **unlocked by C3** (PR3 executes, each gated on its grep): `.tooltip-inner` (:1054), `.fade.tooltip` (:1064), the `@media (hover:none),(hover:on-demand) .tooltip` block (:1046), `@keyframes fadeIn` (:1070), and the already-dead `.spin.fade-in` (:1060). text.scss keeps its own `fadeIn` (unrelated, media loading).
- `$tooltip-bg` (globals.scss:85) then feeds only Bootstrap's dead tooltip compile → drop with PR3's Bootstrap sweep; the value's live home is `--sn-tooltip-bg` in tooltip.module.css.
- tooltip.module.css consumes **zero `--bs-*` vars** (unlike badge) — nothing for §11.11's var sweep; it reads only `--sn-z-tooltip`, `--sn-tooltip-bg` (self-declared), and Base UI's runtime `--transform-origin`.
- Master plan §PR3 keeps "animations/keyframes" as app.css survivors — annotate there that globals' `fadeIn` is an exception (deletable post-C3, census above).

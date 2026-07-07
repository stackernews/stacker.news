# Bootstrap usage audit: components + utility classes

## Part 1 — react-bootstrap component usage

### Components

| Component | Usage |
|---|---|
| **Button** (+`ButtonGroup`) | 32 files |
| **Form / Form.\*** | `Text`×19, `Control`×17, `Label`×9, `Group`×7, `Check`×6, `Select`×2, `Range`×2 |
| **Form.Control** | 16 files |
| **Form.Select** | 2 files |
| **Form.Check** (checkbox) | part of ×6 |
| **Form.Check** (radio) | part of ×6 |
| **Form.Range** | 2 files |
| **Dropdown** | 20 files (`Item`×77, `Menu`×16, `Toggle`×12, `Divider`×7) |
| **Tooltip** | 3 files |
| **OverlayTrigger** | 5 files |
| **Popover** | 3 files |
| **Toast** | 1 file (`components/toast.js`: `Toast`, `ToastBody`, `ToastContainer`, `Button`), consumed via `useToast`/`toast` across 34 importers |
| **Accordion** (+`AccordionButton`/`AccordionContext`) | 1 file |
| **Modal** | 1 import → but powers `useShowModal` across **21 files** + `ActionDropdown` overflow (13 files) |
| **Offcanvas** | 1 file (`nav/mobile/offcanvas.js`) |
| **Nav / Navbar** | Nav 14 files, Navbar 10 files (`Nav.Link`×46, `Nav.Item`×44, `Navbar.Brand`×2) |
| **InputGroup** | 12 files, `InputGroup.Text`×54 |
| **ButtonGroup** | 1 file |
| **Row / Col / Container** | 8 / 8 / 9 files |
| **Alert** (inline) | 8 files |
| **Badge** | 7 files |
| **Image** | 5 files |
| **Table** | 1 file |
| **CardFooter** | 1 file |

### Notes from the census

- **Modal is not "~1 file."** 1 import, but `useShowModal` (21 files) + `ActionDropdown`
  overflow (13 files) ride on it.
- **`InputGroup.Text` is used 54×** — the heaviest subpart count after Dropdown's `Item`.
- **Dropdown** is heavier than Button by subpart count (`Item`×77).
- **Toast** is live on this branch (`components/toast.js`), with 34 files consuming it via
  the `useToast`/`toast` hook.

### How these numbers were measured

```sh
# import sites by subpath
grep -rhoE "from 'react-bootstrap[^']*'" components pages lib svgs \
  --include="*.js" --include="*.jsx" | sort | uniq -c | sort -rn

# named barrel imports, split and counted
grep -rhoE "import \{[^}]*\} from 'react-bootstrap'" components pages lib svgs \
  --include="*.js" --include="*.jsx" \
  | sed -E "s/import \{//; s/\} from 'react-bootstrap'//" | tr ',' '\n' \
  | sed -E 's/ as .*//; s/^[[:space:]]*//; s/[[:space:]]*$//' \
  | grep -v '^$' | sort | uniq -c | sort -rn

# compound subpart JSX usage (Form.*, Dropdown.*, Nav.*, InputGroup.*)
grep -rhoE "Dropdown\.[A-Za-z]+" components pages lib svgs \
  --include="*.js" --include="*.jsx" | sort | uniq -c | sort -rn

# the hidden weight of Modal
grep -rl "useShowModal" components pages --include="*.js" --include="*.jsx" | wc -l
```

## Part 2 — Bootstrap utility class usage

### Method

A script extracted tokens from every `className`/`class` attribute (string literals, template
literals, and quoted-expression forms) across `components/`, `pages/`, `lib/`, `styles/`, and
`svgs/` (`.js`/`.jsx`). Template `${...}` interpolations were stripped before tokenizing, then
each token was matched against Bootstrap 5 utility-class patterns.

**Caveats:**

- Dynamically composed classes (e.g. `` `text-${variant}` ``, or class strings built in JS
  helpers) are **not** captured — real counts for color/state utilities are likely higher.
- Only `className`/`class` attributes were scanned, not class strings passed via other props.

### Headline numbers

- **160 distinct** Bootstrap utility classes in use
- **1527 total** uses
- `418` source files scanned

### Most-used classes (top 20)

| Class | Category | Uses | Files |
|---|---|---:|---:|
| `text-muted` | text | 172 | 66 |
| `d-flex` | display | 169 | 59 |
| `align-items-center` | flex | 94 | 43 |
| `fw-bold` | font | 93 | 44 |
| `p-0` | spacing | 45 | 11 |
| `text-center` | text | 44 | 22 |
| `w-100` | sizing | 44 | 22 |
| `mt-3` | spacing | 36 | 18 |
| `d-inline-flex` | display | 33 | 7 |
| `ms-1` | spacing | 32 | 10 |
| `text-reset` | text | 32 | 14 |
| `mt-2` | spacing | 30 | 20 |
| `mb-2` | spacing | 30 | 21 |
| `ms-2` | spacing | 29 | 19 |
| `justify-content-center` | flex | 28 | 13 |
| `mb-3` | spacing | 24 | 14 |
| `d-block` | display | 20 | 11 |
| `mx-2` | spacing | 18 | 4 |
| `fw-normal` | font | 18 | 5 |
| `mt-1` | spacing | 17 | 13 |

### By category

| Category | Distinct | Uses |
|---|---:|---:|
| **spacing** | 82 | 561 |
| **text** | 11 | 262 |
| **display** | 12 | 251 |
| **flex** | 23 | 204 |
| **font** | 8 | 135 |
| **sizing** | 5 | 59 |
| **color-text** | 5 | 22 |
| **color-bg** | 1 | 1 |
| **position** | 3 | 15 |
| **rounded** | 3 | 5 |
| **overflow** | 1 | 1 |
| **visibility** | 1 | 4 |
| **col-grid** | 2 | 2 |
| **misc** | 3 | 5 |

### Full breakdown

#### `spacing` — 82 distinct, 561 uses

| Class | Uses | Files |
|---|---:|---:|
| `p-0` | 45 | 11 |
| `mt-3` | 36 | 18 |
| `ms-1` | 32 | 10 |
| `mb-2` | 30 | 21 |
| `mt-2` | 30 | 20 |
| `ms-2` | 29 | 19 |
| `mb-3` | 24 | 14 |
| `mx-2` | 18 | 4 |
| `mt-1` | 17 | 13 |
| `ms-auto` | 16 | 15 |
| `me-1` | 15 | 7 |
| `mb-0` | 14 | 12 |
| `me-2` | 14 | 9 |
| `px-2` | 12 | 10 |
| `mx-1` | 10 | 4 |
| `pb-2` | 10 | 8 |
| `mt-4` | 9 | 8 |
| `pb-3` | 9 | 9 |
| `py-1` | 9 | 3 |
| `my-2` | 8 | 6 |
| `mx-auto` | 7 | 5 |
| `my-3` | 7 | 7 |
| `pb-4` | 7 | 6 |
| `px-0` | 7 | 6 |
| `px-3` | 7 | 5 |
| `mb-1` | 6 | 5 |
| `mt-5` | 6 | 4 |
| `p-1` | 6 | 3 |
| `py-2` | 6 | 4 |
| `mb-4` | 5 | 5 |
| `me-0` | 5 | 4 |
| `ps-0` | 5 | 5 |
| `pt-2` | 5 | 4 |
| `pt-4` | 5 | 5 |
| `ms-0` | 4 | 1 |
| `p-3` | 4 | 4 |
| `pb-1` | 4 | 3 |
| `px-sm-0` | 4 | 4 |
| `me-3` | 3 | 2 |
| `ms-3` | 3 | 3 |
| `ms-4` | 3 | 1 |
| `mx-3` | 3 | 2 |
| `my-1` | 3 | 3 |
| `pb-0` | 3 | 3 |
| `ps-1` | 3 | 2 |
| `px-4` | 3 | 3 |
| `py-0` | 3 | 2 |
| `py-3` | 3 | 3 |
| `py-5` | 3 | 3 |
| `m-auto` | 2 | 1 |
| `ms-sm-1` | 2 | 2 |
| `my-0` | 2 | 2 |
| `my-4` | 2 | 2 |
| `p-2` | 2 | 2 |
| `p-4` | 2 | 2 |
| `pe-3` | 2 | 2 |
| `pt-5` | 2 | 1 |
| `mb-5` | 1 | 1 |
| `me-auto` | 1 | 1 |
| `me-md-2` | 1 | 1 |
| `ms-md-3` | 1 | 1 |
| `ms-sm-3` | 1 | 1 |
| `mt-0` | 1 | 1 |
| `mt-auto` | 1 | 1 |
| `mt-sm-0` | 1 | 1 |
| `mx-5` | 1 | 1 |
| `mx-md-auto` | 1 | 1 |
| `p-5` | 1 | 1 |
| `pb-5` | 1 | 1 |
| `pe-0` | 1 | 1 |
| `pe-1` | 1 | 1 |
| `pe-2` | 1 | 1 |
| `ps-2` | 1 | 1 |
| `ps-3` | 1 | 1 |
| `ps-4` | 1 | 1 |
| `pt-0` | 1 | 1 |
| `pt-1` | 1 | 1 |
| `pt-3` | 1 | 1 |
| `px-1` | 1 | 1 |
| `px-5` | 1 | 1 |
| `py-4` | 1 | 1 |
| `py-md-1` | 1 | 1 |

#### `text` — 11 distinct, 262 uses

| Class | Uses | Files |
|---|---:|---:|
| `text-muted` | 172 | 66 |
| `text-center` | 44 | 22 |
| `text-reset` | 32 | 14 |
| `text-start` | 5 | 4 |
| `text-end` | 2 | 2 |
| `text-uppercase` | 2 | 2 |
| `text-break` | 1 | 1 |
| `text-decoration-underline` | 1 | 1 |
| `text-left` | 1 | 1 |
| `text-nowrap` | 1 | 1 |
| `text-truncate` | 1 | 1 |

#### `display` — 12 distinct, 251 uses

| Class | Uses | Files |
|---|---:|---:|
| `d-flex` | 169 | 59 |
| `d-inline-flex` | 33 | 7 |
| `d-block` | 20 | 11 |
| `d-none` | 10 | 8 |
| `d-md-flex` | 5 | 3 |
| `d-md-none` | 4 | 4 |
| `d-inline-block` | 3 | 2 |
| `d-grid` | 2 | 2 |
| `d-md-block` | 2 | 2 |
| `d-inline` | 1 | 1 |
| `d-sm-block` | 1 | 1 |
| `d-sm-none` | 1 | 1 |

#### `flex` — 23 distinct, 204 uses

| Class | Uses | Files |
|---|---:|---:|
| `align-items-center` | 94 | 43 |
| `justify-content-center` | 28 | 13 |
| `flex-wrap` | 15 | 14 |
| `flex-column` | 12 | 9 |
| `align-self-center` | 10 | 5 |
| `justify-content-end` | 10 | 10 |
| `justify-content-between` | 6 | 4 |
| `flex-grow-1` | 5 | 4 |
| `flex-row` | 5 | 5 |
| `align-self-start` | 3 | 3 |
| `flex-shrink-0` | 2 | 2 |
| `flex-shrink-1` | 2 | 2 |
| `justify-content-start` | 2 | 2 |
| `align-items-end` | 1 | 1 |
| `align-items-start` | 1 | 1 |
| `align-self-sm-center` | 1 | 1 |
| `flex-md-fill` | 1 | 1 |
| `flex-md-nowrap` | 1 | 1 |
| `flex-md-shrink-0` | 1 | 1 |
| `flex-nowrap` | 1 | 1 |
| `flex-shrink` | 1 | 1 |
| `flex-sm-row` | 1 | 1 |
| `justify-content-around` | 1 | 1 |

#### `font` — 8 distinct, 135 uses

| Class | Uses | Files |
|---|---:|---:|
| `fw-bold` | 93 | 44 |
| `fw-normal` | 18 | 5 |
| `fs-5` | 7 | 2 |
| `fst-italic` | 5 | 5 |
| `fw-bolder` | 4 | 3 |
| `fw-light` | 4 | 2 |
| `font-monospace` | 3 | 2 |
| `fs-6` | 1 | 1 |

#### `sizing` — 5 distinct, 59 uses

| Class | Uses | Files |
|---|---:|---:|
| `w-100` | 44 | 22 |
| `mw-100` | 6 | 4 |
| `w-auto` | 6 | 6 |
| `h-auto` | 2 | 1 |
| `h-25` | 1 | 1 |

#### `color-text` — 5 distinct, 22 uses

| Class | Uses | Files |
|---|---:|---:|
| `text-info` | 7 | 4 |
| `text-danger` | 6 | 5 |
| `text-success` | 6 | 6 |
| `text-warning` | 2 | 2 |
| `text-light` | 1 | 1 |

#### `color-bg` — 1 distinct, 1 uses

| Class | Uses | Files |
|---|---:|---:|
| `bg-dark` | 1 | 1 |

#### `position` — 3 distinct, 15 uses

| Class | Uses | Files |
|---|---:|---:|
| `position-relative` | 11 | 9 |
| `position-absolute` | 3 | 3 |
| `position-fixed` | 1 | 1 |

#### `rounded` — 3 distinct, 5 uses

| Class | Uses | Files |
|---|---:|---:|
| `rounded` | 3 | 2 |
| `rounded-2` | 1 | 1 |
| `rounded-3` | 1 | 1 |

#### `overflow` — 1 distinct, 1 uses

| Class | Uses | Files |
|---|---:|---:|
| `overflow-hidden` | 1 | 1 |

#### `visibility` — 1 distinct, 4 uses

| Class | Uses | Files |
|---|---:|---:|
| `invisible` | 4 | 4 |

#### `col-grid` — 2 distinct, 2 uses

| Class | Uses | Files |
|---|---:|---:|
| `container` | 1 | 1 |
| `row` | 1 | 1 |

#### `misc` — 3 distinct, 5 uses

| Class | Uses | Files |
|---|---:|---:|
| `align-middle` | 2 | 2 |
| `visually-hidden-focusable` | 2 | 1 |
| `visually-hidden` | 1 | 1 |

### Notes & migration signals

- **Spacing dominates.** `m*`/`p*` utilities are the single largest surface — the bulk of any
  migration to Tailwind's spacing scale concentrates here, but it maps mechanically.
- **`text-left` is Bootstrap v4 legacy** (renamed `text-start` in v5) — likely dead styling;
  worth locating its single occurrence.
- **The grid system is effectively unused** — `row`/`container`/`col-*` appear only a couple of
  times total. Layout is done almost entirely with flex utilities, simplifying a move off
  Bootstrap.
- **Long-tail singletons** (~70 classes used in just one file) are the cheapest to inline or
  drop.

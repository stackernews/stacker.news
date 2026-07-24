// dev-only playground for the bootstrap → base ui + tailwind migration
// (docs/dev/pr2-base-ui-components.md): every new ui/* component rendered
// next to the react-bootstrap original it replaces, same props on both sides,
// in the real app cascade — bootstrap css, globals.scss and tailwind all
// loaded. since the native-first revision (2026-07-06, master plan §Strategy
// revision) the two sides are intentionally close, NOT identical — each
// section note calls out the intended deltas, so a visible difference here
// is only a bug if no note claims it.
//
// lifecycle: the react-bootstrap column, its imports, and every literal
// bootstrap class used for comparison (fs-*, rounded, text-monospace, btn…)
// must die with C11/PR3 — the rb-zero and utility-checker gates grep pages/
// too. strip the left column then, or delete the page along with it.

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import BsAlert from 'react-bootstrap/Alert'
import BsBadge from 'react-bootstrap/Badge'
import BsButton from 'react-bootstrap/Button'
import BsContainer from 'react-bootstrap/Container'
import BsTooltip from 'react-bootstrap/Tooltip'
import BsPopover from 'react-bootstrap/Popover'
import BsDropdown from 'react-bootstrap/Dropdown'
import BsButtonGroup from 'react-bootstrap/ButtonGroup'
import BsModal from 'react-bootstrap/Modal'
import BsToast from 'react-bootstrap/Toast'
import BsToastBody from 'react-bootstrap/ToastBody'
import BsToastContainer from 'react-bootstrap/ToastContainer'
import Overlay from 'react-bootstrap/Overlay'
import OverlayTrigger from 'react-bootstrap/OverlayTrigger'
import BsForm from 'react-bootstrap/Form'
import BsInputGroup from 'react-bootstrap/InputGroup'
import { Menu as BaseMenu } from '@base-ui/react/menu'
import { Formik } from 'formik'
import {
  Form as SnForm, Input as SnInput, Checkbox as SnCheckbox, Select as SnSelect,
  CopyInput as SnCopyInput, PasswordInput as SnPasswordInput, InputUserSuggest as SnInputUserSuggest,
  SubmitButton as SnSubmitButton, InputGroup as SnInputGroup, CheckboxGroup as SnCheckboxGroup,
  RadioGroup as SnRadioGroup, Radio as SnRadio, Range as SnRange, Slider as SnSlider, OtpInput as SnOtpInput
} from '@/components/form'
import Layout from '@/components/layout'
import { SNEditor } from '@/components/editor'
import { FeeButtonProvider } from '@/components/fee-button'
import Button, { buttonClasses } from '@/components/ui/button'
import Badge from '@/components/ui/badge'
import Alert from '@/components/ui/alert'
import Container from '@/components/ui/container'
import Tooltip from '@/components/ui/tooltip'
import Popover from '@/components/ui/popover'
import PreviewCard from '@/components/ui/preview-card'
import Menu, { menuClasses, itemClasses } from '@/components/ui/menu'
import { useShowModal } from '@/components/modal'
import { useToast } from '@/components/ui/toast'
import ActionDropdown from '@/components/action-dropdown'
import { BadgeTooltip } from '@/components/badge'
import dropdownStyles from '@/components/dropdown.module.css'
import { cn } from '@/lib/cn'
import CowboyHatIcon from '@/svgs/cowboy.svg'
import MoreIcon from '@/svgs/more-fill.svg'
import BackArrow from '@/svgs/arrow-left-line.svg'
import ArrowDownIcon from '@/svgs/editor/toolbar/arrow-down.svg'
import useDarkMode from '@/components/dark-mode'
import { getGetServerSideProps } from '@/api/ssrApollo'

// force SSR to include CSP nonces; never serve this outside development
export const getServerSideProps = process.env.NODE_ENV === 'development'
  ? getGetServerSideProps({ query: null })
  : async () => ({ notFound: true })

// twitter/dark joined at C5 — login-button.js's variants sat out C1's census
// inside the deferred file
const BUTTON_VARIANTS = [
  'primary', 'secondary', 'danger', 'info', 'success', 'grey', 'grey-medium',
  'nostr', 'twitter', 'dark', 'outline-secondary', 'outline-info', 'outline-grey',
  'outline-warning', 'outline-grey-darkmode', 'link'
]

const BADGE_VARIANTS = ['secondary', 'boost', 'danger', 'success', 'warning', 'info']

const ALERT_VARIANTS = ['info', 'danger', 'warning']

// C2.5 native scale — bs-tw-map.js fs-* entries; BS side is RFS-fluid, new side static
const TYPE_SCALE = [
  ['fs-6', 'text-base', '.93rem @theme token — SN body identity'],
  ['fs-5', 'text-lg', '1.1625rem → 1.125rem'],
  ['fs-4', 'text-xl', 'RFS 1.2645–1.395rem → 1.25rem'],
  ['fs-3', 'text-2xl', 'RFS 1.28775–1.6275rem → 1.5rem'],
  ['fs-2', 'text-3xl', 'RFS 1.311–1.86rem → 1.875rem'],
  ['fs-1', 'text-4xl', 'RFS 1.3575–2.325rem → 2.25rem']
]

// what lib/domains/custom-css.js writes for a branded territory, doubled up:
// the :root aliases (--sn-primary: var(--bs-primary)) are substituted at
// :root, so overriding --bs-* on a wrapper div can't reach them — both ends
// of every chain get pinned here
const RETINT_VARS = {
  '--bs-primary': '#e0245e',
  '--bs-primary-rgb': '224, 36, 94',
  '--theme-primary-text': '#fff',
  '--sn-primary': '#e0245e',
  '--sn-primary-text': '#fff',
  '--bs-secondary': '#6f42c1',
  '--bs-secondary-rgb': '111, 66, 193',
  '--theme-secondary-text': '#fff',
  '--sn-secondary': '#6f42c1',
  '--sn-secondary-text': '#fff'
}

// docs/dev/pr2-base-ui-components.md §8 — add a section above as each lands
const ROADMAP = [
  ['Nav / Navbar + Drawer', 'C10'],
  ['Collapsible', 'C11'],
  ['Switch, Toggle Group', 'C12']
]

// note: one-sentence lead (what the component is, where it lives).
// details: bullet list for the longer story — intended deltas, receipts,
// what to poke at during QA
function Section ({ title, note, details, children }) {
  return (
    <section className='mb-5'>
      <h2 className='text-lg font-bold mb-0'>{title}</h2>
      {note && <p className='text-muted text-sm mb-0 max-w-prose'>{note}</p>}
      {details?.length > 0 &&
        <ul className='text-muted text-sm list-disc ps-5 mt-1 mb-0 max-w-prose space-y-1'>
          {details.map((d, i) => <li key={i}>{d}</li>)}
        </ul>}
      <div className='mt-3'>{children}</div>
    </section>
  )
}

function CompareGrid ({ children }) {
  return (
    <div className='grid grid-cols-[8rem_1fr_1fr] gap-x-4 gap-y-3 items-center'>
      <div />
      <div className='text-muted text-sm font-bold'>react-bootstrap (current)</div>
      <div className='text-muted text-sm font-bold'>base ui + tailwind (new)</div>
      {children}
    </div>
  )
}

// the note paints as a caption under the compared pair (full content width)
// instead of wrapping inside the 8rem label column
function Compare ({ label, note, bs, sn }) {
  return (
    <>
      <div className='text-sm font-mono text-muted'>{label}</div>
      <div className='min-w-0'>{bs}</div>
      <div className='min-w-0'>{sn}</div>
      {note && <div className='col-start-2 col-span-2 -mt-2 text-xs text-muted max-w-prose'>{note}</div>}
    </>
  )
}

function DismissibleCompare () {
  const [open, setOpen] = useState({ bs: true, sn: true })

  return (
    <Compare
      label='dismissible'
      bs={open.bs
        ? (
          <BsAlert variant='warning' dismissible onClose={() => setOpen(o => ({ ...o, bs: false }))} className='mb-0'>
            dismiss me
          </BsAlert>
          )
        : <Button variant='grey' size='sm' onClick={() => setOpen(o => ({ ...o, bs: true }))}>bring it back</Button>}
      sn={open.sn
        ? (
          <Alert variant='warning' dismissible onClose={() => setOpen(o => ({ ...o, sn: false }))} className='mb-0'>
            dismiss me
          </Alert>
          )
        : <Button variant='grey' size='sm' onClick={() => setOpen(o => ({ ...o, sn: true }))}>bring it back</Button>}
    />
  )
}

// the two rb tooltip populations (pr2 doc §12.0), for the left column only.
// A = old ActionTooltip internals: no fade, opacity .9, collisions off,
// position:fixed hack. B = rb defaults (badge/login): Fade, opacity 1,
// collisions on. children must be a DOM tag — cloneElement injects props
function BsTooltipA ({ text, placement = 'bottom', delay = 0, children }) {
  return (
    <OverlayTrigger
      placement={placement}
      overlay={<BsTooltip style={{ position: 'fixed' }}>{text}</BsTooltip>}
      trigger={['hover', 'focus']}
      delay={{ show: delay, hide: 0 }}
      transition={false}
      popperConfig={{ modifiers: { preventOverflow: { enabled: false } } }}
    >
      {children}
    </OverlayTrigger>
  )
}

function BsTooltipB ({ text, placement = 'bottom', children }) {
  return (
    <OverlayTrigger placement={placement} overlay={<BsTooltip>{text}</BsTooltip>} trigger={['hover', 'focus']}>
      {children}
    </OverlayTrigger>
  )
}

// the deleted rb hover-card machinery verbatim (500ms show timeout, 300ms
// hide grace, popup :hover check, position:fixed hack — pr2 doc §13.3), for
// the left column only — dies with C11/PR3
function BsHoverCard ({ trigger, body }) {
  const [show, setShow] = useState(false)
  const popRef = useRef(null)
  const timeoutId = useRef(null)

  const onToggle = show => {
    clearTimeout(timeoutId.current)
    if (show) {
      timeoutId.current = setTimeout(() => setShow(true), 500)
    } else {
      timeoutId.current = setTimeout(() => setShow(!!popRef.current?.matches(':hover')), 300)
    }
  }

  return (
    <OverlayTrigger
      placement='bottom'
      trigger={['hover', 'focus']}
      show={show}
      onToggle={onToggle}
      transition
      rootClose
      overlay={
        <BsPopover style={{ position: 'fixed' }} onPointerLeave={() => onToggle(false)}>
          <BsPopover.Body ref={popRef}>
            {body}
          </BsPopover.Body>
        </BsPopover>
      }
    >
      <span>{trigger}</span>
    </OverlayTrigger>
  )
}

// footer.js FooterPopover shape (trigger press toggles, outside-press +
// Escape close, keyboard-reachable div trigger)
function ClickPopover ({ label, side = 'top', children }) {
  return (
    <Popover>
      <Popover.Trigger nativeButton={false} render={<div className='nav-link p-0 inline-flex cursor-pointer'>{label}</div>} />
      <Popover.Content initialFocus={false} side={side}>
        <Popover.Body className='font-medium'>{children}</Popover.Body>
      </Popover.Content>
    </Popover>
  )
}

// upvote.js WalkthroughPopover shape — controlled, no Trigger, anchored to a
// detached element, ignores outside-press (parity: a stray click must not
// mark the walkthrough seen)
function WalkthroughCompare () {
  const bsRef = useRef()
  const snRef = useRef()
  const [showBs, setShowBs] = useState(false)
  const [showSn, setShowSn] = useState(false)
  return (
    <Compare
      label='walkthrough'
      note="upvote shape: controlled, anchor ref, side='right', header + lightning X. outside click does NOT dismiss on either side — parity, a stray click must not mark the walkthrough seen. Escape dismisses the new side (deliberate a11y add)."
      bs={
        <div className='flex items-center'>
          <BsButton size='sm' variant='grey' onClick={() => setShowBs(s => !s)}>toggle</BsButton>
          <span ref={bsRef} className='ms-2'>⚡️</span>
          <Overlay show={showBs} target={bsRef.current} placement='right'>
            <BsPopover id='popover-basic'>
              <BsPopover.Header className='flex justify-between alert-dismissible' as='h4'>Zapping
                <button type='button' className='btn-close' onClick={() => setShowBs(false)}><span className='sr-only focus-within:not-sr-only'>Close alert</span></button>
              </BsPopover.Header>
              <BsPopover.Body>
                <div className='mb-2'>Press the bolt again to zap 1 more sat.</div>
                <div>Repeatedly press the bolt to zap more sats.</div>
              </BsPopover.Body>
            </BsPopover>
          </Overlay>
        </div>
      }
      sn={
        <div className='flex items-center'>
          <Button size='sm' variant='grey' onClick={() => setShowSn(s => !s)}>toggle</Button>
          <span ref={snRef} className='ms-2'>⚡️</span>
          <Popover
            open={showSn} onOpenChange={(open, details) => {
              if (!open && (details.reason === 'close-press' || details.reason === 'escape-key')) setShowSn(false)
            }}
          >
            <Popover.Content anchor={snRef} side='right' initialFocus={false}>
              <Popover.Header>Zapping<Popover.Close /></Popover.Header>
              <Popover.Body>
                <div className='mb-2'>Press the bolt again to zap 1 more sat.</div>
                <div>Repeatedly press the bolt to zap more sats.</div>
              </Popover.Body>
            </Popover.Content>
          </Popover>
        </div>
      }
    />
  )
}

// login-button.js split-group shape, both sides with static accounts
// (the real LoginWithNymButton needs multi_auth cookies)
const SPLIT_ACCOUNTS = [{ id: 1, name: 'alice' }, { id: 2, name: 'bob_the_long_named' }, { id: 3, name: 'carol' }]

function BsSplitLogin () {
  const [pointer, setPointer] = useState(1)
  return (
    <BsDropdown className='mb-0 w-full' as={BsButtonGroup}>
      <BsButton variant='success' title='Log in with @alice' style={{ minWidth: 0 }}>
        <span className='truncate' style={{ minWidth: 0 }}>Log in with @alice</span>
      </BsButton>
      <BsDropdown.Toggle split variant='success' title='select account' style={{ maxWidth: '42px' }}>
        <ArrowDownIcon width={16} height={16} />
      </BsDropdown.Toggle>
      <BsDropdown.Menu className={dropdownStyles.dropdownExtra} style={{ width: '150px' }}>
        {SPLIT_ACCOUNTS.map(a => (
          <BsDropdown.Item
            key={a.id} onClick={() => setPointer(a.id)}
            className={cn(dropdownStyles.dropdownExtraItem, a.id === pointer && dropdownStyles.active)}
          >
            <span className={dropdownStyles.dropdownExtraItemText}>{a.name}</span>
          </BsDropdown.Item>
        ))}
      </BsDropdown.Menu>
    </BsDropdown>
  )
}

function SnSplitLogin () {
  const [pointer, setPointer] = useState(1)
  return (
    <div className='inline-flex w-full'>
      <Button variant='success' title='Log in with @alice' className='min-w-0 grow rounded-e-none'>
        <span className='truncate min-w-0'>Log in with @alice</span>
      </Button>
      <Menu className='flex shrink-0'>
        <Menu.Trigger
          title='select account'
          className={cn(buttonClasses({ variant: 'success' }), 'rounded-s-none w-10 px-0 shrink-0 flex items-center justify-center')}
        >
          <ArrowDownIcon width={16} height={16} />
        </Menu.Trigger>
        <Menu.Popup align='end' className={cn(dropdownStyles.dropdownExtra, 'w-40 p-2 rounded-md')}>
          {SPLIT_ACCOUNTS.map(a => (
            <BaseMenu.Item
              key={a.id} onClick={() => setPointer(a.id)}
              className={cn(dropdownStyles.dropdownExtraItem, a.id === pointer && dropdownStyles.active)}
            >
              <span className={dropdownStyles.dropdownExtraItemText}>{a.name}</span>
            </BaseMenu.Item>
          ))}
        </Menu.Popup>
      </Menu>
    </div>
  )
}

// shared modal guts so both columns paint identical content — the ul/li rows
// exercise the .modal-body li spacing (globals:403, now module-side on the right)
function ModalGuts () {
  return (
    <>
      <p className='font-bold'>modal body</p>
      <p>bg/border ride --theme-inputBg/--theme-borderColor — dark mode flips for free</p>
      <ul>
        <li>li line-height 1.25</li>
        <li>li margin-top .5rem</li>
      </ul>
    </>
  )
}

// the old modal.js (pre-C6) replicated for the left column: rb Modal, the
// stack machinery, the literal modal-* chrome strings (globals.scss paints
// them until PR3) — dies with C11/PR3 like every rb import here
function BsModalReplica ({ label, keepOpen, fullScreen, overflow, stackable, children }) {
  const [depth, setDepth] = useState(0)
  const close = () => setDepth(0)
  const cls = fullScreen ? 'fullscreen' : ''
  return (
    <>
      <BsButton size='sm' variant='grey' onClick={() => setDepth(1)}>{label}</BsButton>
      {depth > 0 &&
        <BsModal
          onHide={keepOpen ? undefined : close} show
          className={cls} dialogClassName={cls} contentClassName={cls}
        >
          <div className='flex flex-row'>
            {overflow &&
              <div className={'modal-btn modal-overflow ' + cls}>
                <ActionDropdown>{overflow}</ActionDropdown>
              </div>}
            {depth > 1 ? <div className='modal-btn modal-back' onClick={() => setDepth(d => d - 1)}><BackArrow width={18} height={18} /></div> : null}
            <div className={'modal-btn modal-close ' + cls} onClick={close}>X</div>
          </div>
          <BsModal.Body className={cls}>
            {depth > 1
              ? <div><p>modal B (top of stack)</p><input placeholder='focusable input' /></div>
              : (
                <div>
                  {children}
                  {stackable && <BsButton size='sm' variant='grey' onClick={() => setDepth(2)}>push modal B</BsButton>}
                </div>
                )}
          </BsModal.Body>
        </BsModal>}
    </>
  )
}

// stack content for the new side — pushes B through the real useShowModal
function SnStackGuts ({ showModal }) {
  return (
    <div>
      <p>modal A (bottom of stack)</p>
      <Button
        size='sm' variant='grey' onClick={() =>
          showModal(() => <div><p>modal B (top of stack)</p><input placeholder='focusable input' /></div>)}
      >
        push modal B
      </Button>
    </div>
  )
}

// the C5 ⚠️ regression preserved as a receipt: the overflow menu pinned at the
// OLD ladder value (inline z 1000) opens BEHIND the fullscreen modal (1055) —
// §15.5 pre-flight 8's failing check. the right column rides the fixed
// --sn-z-dropdown (1060) and paints above. same-PR fix: the regression never ships
function BsZRegressionModal () {
  const [open, setOpen] = useState(false)
  return (
    <>
      <BsButton size='sm' variant='grey' onClick={() => setOpen(true)}>menu at old z 1000</BsButton>
      {open &&
        <BsModal onHide={() => setOpen(false)} show className='fullscreen' dialogClassName='fullscreen' contentClassName='fullscreen'>
          <div className='flex flex-row'>
            <div className='modal-btn modal-overflow fullscreen'>
              <BaseMenu.Root modal={false}>
                <BaseMenu.Trigger nativeButton={false} render={<span className='pointer'><MoreIcon className='fill-grey ms-1' height={16} width={16} /></span>} />
                <BaseMenu.Portal>
                  <BaseMenu.Positioner sideOffset={2} style={{ zIndex: 1000 }}>
                    <BaseMenu.Popup className={menuClasses()}>
                      <BaseMenu.Item className={itemClasses()}>menu z 1000</BaseMenu.Item>
                      <BaseMenu.Item className={itemClasses()}>behind modal 1055</BaseMenu.Item>
                    </BaseMenu.Popup>
                  </BaseMenu.Positioner>
                </BaseMenu.Portal>
              </BaseMenu.Root>
            </div>
            <div className='modal-btn modal-close fullscreen' onClick={() => setOpen(false)}>X</div>
          </div>
          <BsModal.Body className='fullscreen'>
            <p className='text-center pt-8'>the "…" up top opens a menu pinned at the pre-C6 z — it paints BEHIND this modal (you won't see it)</p>
          </BsModal.Body>
        </BsModal>}
    </>
  )
}

// mentions.js listbox shape (D4) — static replica, click moves the selection
function MentionsListboxReplica () {
  const [selected, setSelected] = useState(0)
  const names = ['satoshi', 'sox', 'k00b']
  return (
    <div role='listbox' className={cn(menuClasses(), 'inline-block')}>
      {names.map((name, i) => (
        <div
          key={name} role='option' aria-selected={selected === i}
          className={itemClasses({ active: selected === i })}
          onClick={() => setSelected(i)}
        >
          {name}
        </div>
      ))}
    </div>
  )
}

// the old toast.js (pre-C7) replicated for the left column: rb Toast/ToastBody/
// ToastContainer plus the state machine the port killed — tag-dedup reducer
// ("(N) body"), rb autohide timers, X-only options-onClose, slide-in keyframe,
// the dead progressBar option, always-expanded vertical stack, no limit — dies
// with C11/PR3 like every rb import here. anchored bottom-LEFT so both stacks
// can fire side by side (the real thing sat bottom-right like the new side)
const BS_TOAST_REPLICA_CSS = `
.bs-toast-replica {
  font-size: small;
  width: fit-content;
  color: #fff;
  border-width: 1px;
  border-style: solid;
  animation: bs-toast-slide ease-out 0.2s;
}
@keyframes bs-toast-slide {
  0% { transform: translateY(100%); }
  100% { transform: translateY(0%); }
}
.bs-toast-replica.bs-success { border-color: var(--bs-success-border-subtle); }
.bs-toast-replica.bs-danger { border-color: var(--bs-danger-border-subtle); }
.bs-toast-replica.bs-warning { border-color: var(--bs-warning-border-subtle); }
.bs-toast-close {
  color: #fff;
  font-family: "lightning";
  font-size: 150%;
  line-height: 1rem;
  margin-bottom: -0.25rem;
  cursor: pointer;
  display: flex;
  align-items: center;
}
.bs-toast-close:hover { opacity: 0.7; }
.bs-toast-progress {
  width: 0;
  height: 5px;
  filter: brightness(66%);
  animation: bs-toast-progress linear 1;
}
.bs-toast-progress.bs-success { background-color: var(--bs-success); }
.bs-toast-progress.bs-danger { background-color: var(--bs-danger); }
.bs-toast-progress.bs-warning { background-color: var(--bs-warning); }
@keyframes bs-toast-progress {
  0% { width: 0; }
  100% { width: 100%; }
}
`

function FormCompares () {
  return (
    <SnForm
      initial={{ pgBasic: '', pgGrouped: '', pgReq: '', pgCheck: true, pgKind: 'apples', pgPostTypes: ['LINK'], pgSel: 'b', pgNym: '', pgClear: 'clear me', pgPw: 'hunter2hunter2', pgSats: null, pgOtp: '' }}
      validate={values => values.pgReq ? {} : { pgReq: 'required' }}
      onSubmit={() => {}}
    >
      <CompareGrid>
        <Compare
          label='input'
          bs={
            <BsForm.Group className='form-group'>
              <BsForm.Label>label</BsForm.Label>
              <BsInputGroup hasValidation>
                <BsForm.Control placeholder='placeholder' />
              </BsInputGroup>
              <BsForm.Text>a hint below</BsForm.Text>
            </BsForm.Group>
            }
          sn={<SnInput label='label' name='pgBasic' placeholder='placeholder' hint='a hint below' />}
        />
        <Compare
          label='addon group'
          note='intended deltas: height 41.5→40px (py 6.72→6px), padding-x 13.4→16px, radius 6.4→6px'
          bs={
            <BsInputGroup>
              <BsInputGroup.Text>@</BsInputGroup.Text>
              <BsForm.Control defaultValue='100' />
              <BsInputGroup.Text className='font-mono'>sats</BsInputGroup.Text>
            </BsInputGroup>
            }
          sn={
            <SnInput
              name='pgGrouped' groupClassName='mb-0'
              prepend={<SnInputGroup.Text>@</SnInputGroup.Text>}
              append={<SnInputGroup.Text className='font-mono'>sats</SnInputGroup.Text>}
            />
            }
        />
        <Compare
          label='invalid'
          note='left = forced paint; right is LIVE — submit empty to trip the submit-gated invalid, then type to clear it'
          bs={
            <div>
              <BsInputGroup hasValidation>
                <BsForm.Control isInvalid defaultValue='forced invalid' />
                <BsForm.Control.Feedback type='invalid'>required</BsForm.Control.Feedback>
              </BsInputGroup>
            </div>
            }
          sn={
            <div className='flex items-start gap-2'>
              <div className='grow'><SnInput name='pgReq' groupClassName='mb-0' placeholder='required — submit me empty' /></div>
              <SnSubmitButton variant='secondary' size='sm' className='mt-1'>submit</SnSubmitButton>
            </div>
            }
        />
        <Compare
          label='clear / copy / password'
          bs={<BsForm.Control readOnly defaultValue='rb had SN-custom addons here' />}
          sn={
            <div className='flex flex-col gap-2'>
              <SnInput name='pgClear' clear groupClassName='mb-0' />
              <SnCopyInput placeholder='copy this value' readOnly noForm groupClassName='mb-0' />
              <SnPasswordInput name='pgPw' groupClassName='mb-0' />
            </div>
            }
        />
        <Compare
          label='checkbox + array group'
          note='C9b: the group (Base UI CheckboxGroup) OWNS the postTypes-shaped array — children derive checked from containment, one write path; checked bg rides --bs-primary (territory-tintable)'
          bs={
            <div>
              <BsForm.Check id='pg-bs-check' label='checkbox' defaultChecked />
              <BsForm.Check id='pg-bs-array-a' label='array member (LINK)' defaultChecked />
              <BsForm.Check id='pg-bs-array-b' label='array member (DISCUSSION)' />
            </div>
            }
          sn={
            <div>
              <SnCheckbox name='pgCheck' label='checkbox' groupClassName='mb-0' />
              <SnCheckboxGroup name='pgPostTypes' groupClassName='mb-0'>
                <SnCheckbox name='pgPostTypes' value='LINK' label='array member (LINK)' groupClassName='mb-0' />
                <SnCheckbox name='pgPostTypes' value='DISCUSSION' label='array member (DISCUSSION)' groupClassName='mb-0' />
              </SnCheckboxGroup>
            </div>
            }
        />
        <Compare
          label='radio group'
          note='C9b: native radios → a true RadioGroup on the real field; arrow keys rove focus AND select (intended a11y betterment); the dot skin re-keyed :checked → [data-checked], values verbatim'
          bs={
            <div>
              <BsForm.Check id='pg-bs-radio-a' type='radio' name='pgBsKind' label='apples' defaultChecked />
              <BsForm.Check id='pg-bs-radio-b' type='radio' name='pgBsKind' label='bananas' />
            </div>
            }
          sn={
            <SnRadioGroup name='pgKind' groupClassName='mb-0'>
              <SnRadio value='apples' id='pg-radio-a' label='apples' groupClassName='mb-0' />
              <SnRadio value='bananas' id='pg-radio-b' label='bananas' groupClassName='mb-0' />
            </SnRadioGroup>
            }
        />
        <Compare
          label='slider (bare)'
          note='the formik-less Slider (avatar shape); C9b deltas: thumb rides var(--bs-primary) — territory-tintable (the compiled rb thumb was LITERAL #FADA5E); rb mounts at the native midpoint (the avatar bug defaultValue={1} fixes)'
          bs={<BsForm.Range min={1} max={2} step='0.05' />}
          sn={<SnSlider min={1} max={2} step={0.05} defaultValue={1} />}
        />
        <Compare
          label='range allOption ∞'
          note='left = the dead rb Range replica (compiled .form-range/form-control CSS survives until PR3) — slide to the far left for the ∞ chip; C9b deltas: the number twin live-clamps while typing, keeps the value on clear (rb wrote 0 live), canonicalizes text on blur; twin height 41.47→40.03'
          bs={<BsRangeReplica />}
          sn={
            <SnRange
              name='pgSats' min={-1000} max={1000} suffix=' sats' allOption groupClassName='mb-0'
              labels={[
                { value: -1060, label: 'wild west' },
                { value: 125, label: '125' },
                { value: 1060, label: 'tea & crumpets' }
              ]}
            />
            }
        />
        <Compare
          label='otp'
          note='C9b: MultiInput died into OtpInput (Base UI OTP Field) — lowercase-normalizes typed AND pasted input, alphanumeric (bech32); cells px-4→px-0, paint-identical at 44px'
          bs={
            <div className='flex flex-row justify-center gap-2'>
              {[...Array(6)].map((_, i) =>
                <BsForm.Control key={i} type='text' className='text-center' style={{ maxWidth: '44px' }} />)}
            </div>
            }
          sn={<SnOtpInput length={6} name='pgOtp' groupClassName='mb-0' />}
        />
        <Compare
          label='select'
          note="rb's error text under a Select NEVER displayed (sibling-selector dead paint) — the new Select shows it: an intended bugfix delta"
          bs={
            <BsForm.Select className='form-select w-auto'>
              <option>a</option>
              <optgroup label='group'>
                <option>b</option>
                <option>c</option>
              </optgroup>
            </BsForm.Select>
            }
          sn={<SnSelect name='pgSel' items={['a', { label: 'group', items: ['b', 'c'] }]} groupClassName='mb-0' className='w-auto' />}
        />
        <Compare
          label='user suggest (D3)'
          note='left = static rb replica (the dead-shell shape with the opacity workaround); right is LIVE — type k0, arrows/Enter/Tab/Escape; deltas: menu chrome joins C5 (py-2 items, shadow-lg, z-ladder 1060, radius 6px)'
          bs={<BsSuggestReplica />}
          sn={<SnInputUserSuggest name='pgNym' autoComplete='off' groupClassName='mb-0' />}
        />
      </CompareGrid>
    </SnForm>
  )
}

// the pre-C9b rb Range verbatim (form/range.js at its death): .form-range +
// number Control + InputGroup with the raw form-control ∞ chip, useState-driven
function BsRangeReplica ({ min = -1000, max = 1000, step = 1, suffix = ' sats' }) {
  const [value, setValue] = useState(null) // null = the allOption ∞ sentinel
  const isAll = value == null
  const sliderMin = min - step
  const labels = [
    { value: -1060, label: 'wild west' },
    { value: 125, label: '125' },
    { value: 1060, label: 'tea & crumpets' }
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', columnGap: '1rem', alignItems: 'center' }}>
      <span className='text-muted' style={{ whiteSpace: 'nowrap' }}>- <span style={{ display: 'inline-block', transform: 'scale(1.4)', transformOrigin: 'center' }}>∞</span></span>
      <BsForm.Range
        min={sliderMin} max={max} step={step}
        value={isAll ? sliderMin : value}
        onChange={e => {
          const val = Number(e.target.value)
          setValue(val <= sliderMin ? null : val)
        }}
      />
      <small className='text-muted font-mono'>{max}</small>
      <BsInputGroup className='flex-nowrap' style={{ width: 'auto' }}>
        {isAll
          ? <span className='form-control px-2' style={{ width: '4rem', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25em' }}>-<span style={{ display: 'inline-block', transform: 'scale(1.4)', transformOrigin: 'center' }}>∞</span></span>
          : <BsForm.Control
              type='number' min={min} max={max} step={step} value={value}
              className='text-end hide-spinners px-2' style={{ width: '4rem' }}
              onChange={e => { const val = Number(e.target.value); if (!isNaN(val)) setValue(val) }}
              onBlur={e => { const val = Number(e.target.value); if (!isNaN(val)) setValue(Math.min(max, Math.max(min, val))) }}
            />}
        {suffix && <BsInputGroup.Text>{suffix.trim()}</BsInputGroup.Text>}
      </BsInputGroup>
      <div className='relative' style={{ gridColumn: 2, height: '1.2em' }}>
        {labels.map(({ value: v, label }) => (
          <span key={v} className='text-muted' style={{ position: 'absolute', left: `${((v - sliderMin) / (max - sliderMin)) * 100}%`, transform: 'translateX(-50%)', fontSize: '80%', whiteSpace: 'nowrap' }}>{label}</span>
        ))}
      </div>
    </div>
  )
}

// the pre-C9a BaseSuggest shell verbatim (form.js:526-540 at its death): a
// show-forced rb Dropdown with no Toggle + the #5475 opacity workaround inlined
function BsSuggestReplica () {
  const [show, setShow] = useState(false)
  const [index, setIndex] = useState(0)
  const items = ['k00b', 'k00b2', 'k00b4']
  return (
    <div>
      <BsForm.Control
        placeholder='type to open the static replica'
        onChange={e => setShow(e.target.value.length > 0)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setIndex(i => Math.min(i + 1, items.length - 1)) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setIndex(i => Math.max(i - 1, 0)) }
          if (e.key === 'Escape') setShow(false)
        }}
      />
      <BsDropdown show={show}>
        <BsDropdown.Menu style={{ opacity: 1, pointerEvents: 'unset' }}>
          {items.map((v, i) =>
            <BsDropdown.Item key={v} active={index === i} onClick={() => setShow(false)}>{v}</BsDropdown.Item>)}
        </BsDropdown.Menu>
      </BsDropdown>
    </div>
  )
}

function ToastCompares () {
  const toaster = useToast()
  const router = useRouter()
  const [bsToasts, setBsToasts] = useState([])
  const bsId = useRef(0)

  // the old removeToast: drop by id AND every same-tag sibling
  const bsRemove = toast => {
    setBsToasts(ts => ts.filter(t => t.id !== toast.id && !(toast.tag && t.tag === toast.tag)))
  }

  const bsAdd = (variant, body, options = {}) => {
    const toast = {
      body,
      variant,
      autohide: variant !== 'danger',
      delay: 5000,
      tag: options?.tag || body, // JSX bodies become their own tag — reference equality never merges (old behavior)
      ...options,
      id: bsId.current++
    }
    setBsToasts(ts => [...ts, toast])
    return () => bsRemove(toast)
  }
  const bs = {
    success: (body, options) => bsAdd('success', body, options),
    warning: (body, options) => bsAdd('warning', body, options),
    danger: (body, options) => bsAdd('danger', body, options)
  }

  // the old routeChangeStart effect: unflagged toasts close on navigation
  useEffect(() => {
    const handler = () => setBsToasts(ts => ts.filter(t => t.persistOnNavigate))
    router.events.on('routeChangeStart', handler)
    return () => router.events.off('routeChangeStart', handler)
  }, [router.events])

  // the old tagReducer: same-tag toasts merge into one "(N) body"; the merged
  // toast takes the newest id, so rb remounts it and its autohide timer restarts
  const visible = bsToasts.reduce((acc, toast) => {
    const idx = toast.tag ? acc.findIndex(t => t.tag === toast.tag) : -1
    if (idx === -1) return [...acc, toast]
    const amount = (acc[idx].amount ?? 1) + 1
    return [
      ...acc.slice(0, idx),
      { ...toast, amount, body: `(${amount}) ${toast.body}` },
      ...acc.slice(idx + 1)
    ]
  }, [])

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: BS_TOAST_REPLICA_CSS }} />
      <CompareGrid>
        <Compare
          label='variant trio'
          note='success/warning autohide at 5s, danger persists until X; warning keeps dark text + dark X on both sides. new-side deltas: no border + tighter shadow, danger announces assertively (role=alertdialog)'
          bs={
            <div className='flex gap-2 flex-wrap'>
              <BsButton size='sm' variant='grey' onClick={() => bs.success('rb success toast')}>success</BsButton>
              <BsButton size='sm' variant='grey' onClick={() => bs.warning('rb warning toast')}>warning</BsButton>
              <BsButton size='sm' variant='grey' onClick={() => bs.danger('rb danger toast')}>danger</BsButton>
            </div>
          }
          sn={
            <div className='flex gap-2 flex-wrap'>
              <Button size='sm' variant='grey' onClick={() => toaster.success('success toast')}>success</Button>
              <Button size='sm' variant='grey' onClick={() => toaster.warning('warning toast')}>warning</Button>
              <Button size='sm' variant='grey' onClick={() => toaster.danger('danger toast')}>danger</Button>
            </div>
          }
        />
        <Compare
          label='dedup ×3'
          note='fired 3× in one click → ONE toast "(3) zap pending", because the tag defaults to the string body. the timer refreshes on both sides: old remounts the merged toast under the newest id, new uses native upsert resetTimer. the new side also pulses per upsert.'
          bs={<BsButton size='sm' variant='grey' onClick={() => { bs.success('rb zap pending'); bs.success('rb zap pending'); bs.success('rb zap pending') }}>fire ×3</BsButton>}
          sn={<Button size='sm' variant='grey' onClick={() => { toaster.success('zap pending'); toaster.success('zap pending'); toaster.success('zap pending') }}>fire ×3</Button>}
        />
        <Compare
          label='JSX body (crossposter)'
          note='the whole-contract exerciser: JSX body with working buttons, autohide false, captured cancel fn — Retry cancels after 1s, Skip cancels now. JSX bodies never dedup on either side. new: swipe also dismisses (reads as skip)'
          bs={
            <BsButton
              size='sm' variant='grey' onClick={() => {
                const removeToast = bs.warning(
                  <>
                    Crossposting failed for wss://relay.example<br />
                    <BsButton variant='link' className='p-0' onClick={() => setTimeout(() => removeToast(), 1000)}>Retry</BsButton>
                    {' | '}
                    <BsButton variant='link' className='p-0' onClick={() => removeToast()}>Skip</BsButton>
                  </>,
                  { autohide: false }
                )
              }}
            >
              crosspost failure
            </BsButton>
          }
          sn={
            <Button
              size='sm' variant='grey' onClick={() => {
                const removeToast = toaster.warning(
                  <>
                    Crossposting failed for wss://relay.example<br />
                    <Button variant='link' className='p-0' onClick={() => setTimeout(() => removeToast(), 1000)}>Retry</Button>
                    {' | '}
                    <Button variant='link' className='p-0' onClick={() => removeToast()}>Skip</Button>
                  </>,
                  { autohide: false }
                )
              }}
            >
              crosspost failure
            </Button>
          }
        />
        <Compare
          label='4-at-once stack'
          note='old: full-size vertical stack, all 4 painted. new: collapsed peek-stack (12px peeks, −5% scale per index) — hover/focus fans it out, mouse-out re-collapses. with limit 3 the oldest is already hidden and its fan slot stays blank (known cosmetic, §16.8-7).'
          bs={<BsButton size='sm' variant='grey' onClick={() => { bs.success('rb stack 1'); bs.success('rb stack 2'); bs.danger('rb stack 3'); bs.warning('rb stack 4') }}>fire 4</BsButton>}
          sn={<Button size='sm' variant='grey' onClick={() => { toaster.success('stack 1'); toaster.success('stack 2'); toaster.danger('stack 3'); toaster.warning('stack 4') }}>fire 4</Button>}
        />
        <Compare
          label='countdown (progressBar)'
          note='dead option — zero passers in the app, kept honored. old: 5px variant-tinted bar filling 0→100%. new: 3px white bar draining under the body. it pauses while the stack is hovered (Base UI pauses the real timer too) and restarts when a dedup upsert refreshes the timer.'
          bs={<BsButton size='sm' variant='grey' onClick={() => bs.success('rb progress', { progressBar: true })}>fire</BsButton>}
          sn={<Button size='sm' variant='grey' onClick={() => toaster.success('progress', { progressBar: true })}>fire</Button>}
        />
        <Compare
          label='swipe-dismiss'
          note='new gesture (Base UI native, pointer + touch): drag the toast right or down past the threshold — the exit continues the gesture direction. danger persists, so it waits for you'
          bs={<span className='text-muted text-sm'>no swipe — X or timeout only</span>}
          sn={<Button size='sm' variant='grey' onClick={() => toaster.danger('swipe me right or down')}>fire persistent</Button>}
        />
        <Compare
          label='persistOnNavigate'
          note='fire the pair, then navigate (same-page query push → routeChangeStart): the flagged toast survives, the plain one closes — the wrapper kept the old routeChangeStart effect'
          bs={
            <div className='flex gap-2 flex-wrap'>
              <BsButton size='sm' variant='grey' onClick={() => { bs.success('rb survives nav', { persistOnNavigate: true, autohide: false }); bs.success('rb closes on nav', { autohide: false }) }}>fire pair</BsButton>
              <BsButton size='sm' variant='grey' onClick={() => router.push({ query: { nav: Date.now() } })}>navigate</BsButton>
            </div>
          }
          sn={
            <div className='flex gap-2 flex-wrap'>
              <Button size='sm' variant='grey' onClick={() => { toaster.success('survives nav', { persistOnNavigate: true, autohide: false }); toaster.success('closes on nav', { autohide: false }) }}>fire pair</Button>
              <Button size='sm' variant='grey' onClick={() => router.push({ query: { nav: Date.now() } })}>navigate</Button>
            </div>
          }
        />
        <Compare
          label='limit 3'
          note='fire 5 distinct bodies: old paints all 5 full-size; new keeps 3 visible — the oldest 2 get data-limited (opacity 0, still in state) and resurface as the front ones close'
          bs={<BsButton size='sm' variant='grey' onClick={() => [1, 2, 3, 4, 5].forEach(n => bs.success(`rb limit probe ${n}`))}>fire 5</BsButton>}
          sn={<Button size='sm' variant='grey' onClick={() => [1, 2, 3, 4, 5].forEach(n => toaster.success(`limit probe ${n}`))}>fire 5</Button>}
        />
      </CompareGrid>
      <BsToastContainer position='bottom-start' containerPosition='fixed' className='pb-4 px-4' style={{ display: 'grid', zIndex: 1090 }}>
        {visible.map(toast => {
          const textStyle = toast.variant === 'warning' ? 'text-dark' : ''
          return (
            <BsToast
              key={toast.id} bg={toast.variant} show autohide={toast.autohide} delay={toast.delay}
              className={cn('bs-toast-replica', `bs-${toast.variant}`, textStyle)} onClose={() => bsRemove(toast)}
            >
              <BsToastBody>
                <div className='flex items-center'>
                  <div className='grow overflow-hidden'>{toast.body}</div>
                  <BsButton
                    variant={null} className='p-0 ps-2' aria-label='close'
                    onClick={() => { toast.onClose?.(); bsRemove(toast) }}
                  >
                    <div className={cn('bs-toast-close', textStyle)}>X</div>
                  </BsButton>
                </div>
              </BsToastBody>
              {toast.progressBar && <div className={cn('bs-toast-progress', `bs-${toast.variant}`)} style={{ animationDuration: `${toast.delay}ms` }} />}
            </BsToast>
          )
        })}
      </BsToastContainer>
    </>
  )
}

export default function Playground () {
  const [dark, toggleDark] = useDarkMode()
  const [retint, setRetint] = useState(false)
  const showModal = useShowModal()

  return (
    <Layout contain={false} footer={false}>
      <div className='px-4 pb-6 mx-auto w-full max-w-6xl'>
        <h1 className='text-2xl font-bold mt-4'>base ui playground</h1>
        <p className='text-muted'>
          each row renders the react-bootstrap original and its base ui + tailwind
          replacement with the same props. since the native-first revision the sides
          are intentionally <em>close, not identical</em> — section notes call out the
          intended deltas. hover/active/focus each control to compare interaction
          states, and flip the toggles below to compare themes.
        </p>
        <div className='flex items-center gap-4 mb-4'>
          <Button variant='grey' size='sm' onClick={toggleDark}>
            {dark ? 'light mode' : 'dark mode'}
          </Button>
          <label className='flex items-center gap-2 cursor-pointer select-none'>
            <input type='checkbox' checked={retint} onChange={e => setRetint(e.target.checked)} />
            simulate branded-territory retint
          </label>
        </div>

        <div style={retint ? RETINT_VARS : undefined}>
          <Section
            title='Button'
            note='ui/button.js — every variant on Base UI Button.'
            details={[
              'hover mixes 15% toward --sn-btn-mix, active mixes 20%',
              'native metrics since C2.5: text-base token, md padding px-4 py-1.5, rounded-md. expect ~1px size deltas vs the BS side'
            ]}
          >
            <CompareGrid>
              {BUTTON_VARIANTS.map(v =>
                <Compare
                  key={v}
                  label={v}
                  bs={<BsButton variant={v}>{v}</BsButton>}
                  sn={<Button variant={v}>{v}</Button>}
                />)}
              <Compare
                label='outline-grey + border-2'
                note='territory-header — border width is utility-owned, color skin-owned'
                bs={<BsButton variant='outline-grey' className='border-2'>edit territory</BsButton>}
                sn={<Button variant='outline-grey' className='border-2'>edit territory</Button>}
              />
              <Compare
                label='outline-warning + border'
                note='notifications retry'
                bs={<BsButton variant='outline-warning' className='border'>retry</BsButton>}
                sn={<Button variant='outline-warning' className='border'>retry</Button>}
              />
              <Compare
                label='sizes'
                bs={
                  <div className='flex flex-wrap items-center gap-2'>
                    <BsButton size='sm' variant='primary'>sm</BsButton>
                    <BsButton variant='primary'>md (default)</BsButton>
                    <BsButton size='lg' variant='primary'>lg</BsButton>
                  </div>
                }
                sn={
                  <div className='flex flex-wrap items-center gap-2'>
                    <Button size='sm' variant='primary'>sm</Button>
                    <Button variant='primary'>md (default)</Button>
                    <Button size='lg' variant='primary'>lg</Button>
                  </div>
                }
              />
              <Compare
                label='disabled'
                bs={<BsButton variant='primary' disabled>zap</BsButton>}
                sn={<Button variant='primary' disabled>zap</Button>}
              />
              <Compare
                label='link as button'
                note='old: <Link className="btn btn-primary">; new: buttonClasses()'
                bs={<Link href='#' className='btn btn-primary'>go somewhere</Link>}
                sn={<Link href='#' className={buttonClasses({ variant: 'primary' })}>go somewhere</Link>}
              />
            </CompareGrid>
          </Section>

          <Section
            title='Badge'
            note='ui/badge.js — no default variant.'
            details={[
              'native fixed metrics since C2.5: px-2 py-0.5 text-xs rounded-md',
              'intended delta: badges no longer em-scale with the surrounding font size — the "in text" row shows it'
            ]}
          >
            <CompareGrid>
              {BADGE_VARIANTS.map(v =>
                <Compare
                  key={v}
                  label={v}
                  bs={<BsBadge bg={v}>{v}</BsBadge>}
                  sn={<Badge variant={v}>{v}</Badge>}
                />)}
              <Compare
                label='grey'
                note='left side recreates the deleted item/notifications shout-skins inline'
                bs={<BsBadge bg={null} style={{ color: 'var(--theme-grey)', backgroundColor: 'var(--theme-clickToContextColor)' }}>12 new</BsBadge>}
                sn={<Badge variant='grey'>12 new</Badge>}
              />
              <Compare
                label='75% opacity'
                note='comment.js OP badge — bg-opacity-75 becomes [--sn-badge-opacity:0.75]'
                bs={<BsBadge bg='boost' className='bg-opacity-75'>OP</BsBadge>}
                sn={<Badge variant='boost' className='[--sn-badge-opacity:0.75]'>OP</Badge>}
              />
              <Compare
                label='in text'
                note='intended delta: BS side em-scales with the paragraph, new side stays text-xs'
                bs={<p className='text-xl mb-0'>scaled context <BsBadge bg='info'>info</BsBadge></p>}
                sn={<p className='text-xl mb-0'>scaled context <Badge variant='info'>info</Badge></p>}
              />
            </CompareGrid>
          </Section>

          <Section
            title='Alert'
            note='ui/alert.js — color-mix skins verified value-exact against compiled sass, light + dark.'
            details={[
              'intended delta: Heading is text-xl since C2.5 (was the fs-4 fluid clamp) — the compound row shows the size difference'
            ]}
          >
            <CompareGrid>
              {ALERT_VARIANTS.map(v =>
                <Compare
                  key={v}
                  label={v}
                  bs={<BsAlert variant={v} className='mb-0'>{v}: something happened</BsAlert>}
                  sn={<Alert variant={v} className='mb-0'>{v}: something happened</Alert>}
                />)}
              <DismissibleCompare />
              <Compare
                label='compound'
                note='Alert.Heading + Alert.Link (banners.js shape)'
                bs={
                  <BsAlert variant='info' className='mb-0'>
                    <BsAlert.Heading>midsummer madness</BsAlert.Heading>
                    <div>we are giving away sats — <BsAlert.Link href='#'>see the leaderboard</BsAlert.Link>.</div>
                  </BsAlert>
                }
                sn={
                  <Alert variant='info' className='mb-0'>
                    <Alert.Heading>midsummer madness</Alert.Heading>
                    <div>we are giving away sats — <Alert.Link href='#'>see the leaderboard</Alert.Link>.</div>
                  </Alert>
                }
              />
            </CompareGrid>
          </Section>
        </div>

        <Section
          title='Container'
          note='ui/container.js — single max-w-4xl (896px) since C2.5, replacing the 540/720/900 tiers.'
          details={[
            'resize the window between 576–992px to see the intended width gain on the new side'
          ]}
        >
          <div className='flex flex-col gap-2'>
            <BsContainer className='bg-info/10 py-1 text-center text-sm'>react-bootstrap Container — 540/720/900 tiers</BsContainer>
            <Container className='bg-success/10 py-1 text-center text-sm'>ui Container — max-w-4xl</Container>
          </div>
        </Section>

        <Section
          title='native scale'
          note='C2.5 — the codemod map emits native steps now.'
          details={[
            'the BS side of fs-1..4 is RFS-fluid (resize the window to watch it move); the new side is static',
            'text-base carries SN’s type identity as an @theme token (.93rem / 1.75)'
          ]}
        >
          <CompareGrid>
            {TYPE_SCALE.map(([bs, tw, note]) =>
              <Compare
                key={bs}
                label={`${bs} → ${tw}`}
                note={note}
                bs={<span className={bs}>stack sats</span>}
                sn={<span className={tw}>stack sats</span>}
              />)}
            <Compare
              label='text-monospace → font-mono'
              note='intended delta: the Menlo/SFMono stack replaces browser-default monospace'
              bs={<span className='text-monospace'>21000000 sats</span>}
              sn={<span className='font-mono'>21000000 sats</span>}
            />
            <Compare
              label='rounded → rounded-md'
              note='.4rem → .375rem; the rounded-sn token is gone'
              bs={<span className='rounded bg-info text-white px-4 py-2 inline-block'>chip</span>}
              sn={<span className='rounded-md bg-info text-white px-4 py-2 inline-block'>chip</span>}
            />
          </CompareGrid>
        </Section>

        <Section
          title='Tooltip'
          note='ui/tooltip.js — Base UI Tooltip portaled onto the --sn-z ladder. 150ms ease-out fade + scale(.98) is keystone 5&apos;s first application.'
          details={[
            'intended delta: the ActionTooltip population gains the fade (was a snap). its .9 opacity stays — restored 2026-07-09, C3 had unified on 1. login drops to .9 with it; badges don’t, they render a Popover now at opacity 1',
            'intended delta: the pointer can move onto the popup (WCAG 1.4.13)',
            'intended delta: every tooltip flip+shifts to stay in the viewport — QA decision; the old ActionTooltip config clipped at edges',
            'green is theme-invariant — same in dark mode',
            'arrow rides the shared ui/arrow.module.css at 12px, borderless. the 12×6 tip ≈ BS’s native .8rem × .4rem; C3’s drew 11.3×5.7 (C4 QA fix). it no longer morphs during open either'
          ]}
        >
          <CompareGrid>
            <Compare
              label='ActionTooltip (A)'
              note='left replicates the old internals: snap, opacity .9 — hover both to feel the fade delta'
              bs={<BsTooltipA text='21 sats'><span className='cursor-help underline decoration-dotted'>zap it</span></BsTooltipA>}
              sn={<Tooltip content='21 sats'><span className='cursor-help underline decoration-dotted'>zap it</span></Tooltip>}
            />
            <Compare
              label='badge/login (B)'
              note='rb default Fade (.15s ease-in, opacity 1) → 150ms ease-out; the closest-parity row'
              bs={<BsTooltipB text='anonymous'><span className='cursor-help underline decoration-dotted'>anon badge</span></BsTooltipB>}
              sn={<Tooltip content='anonymous'><span className='cursor-help underline decoration-dotted'>anon badge</span></Tooltip>}
            />
            <Compare
              label="side='top' + delay 500"
              note='toolbar shape — the per-site delay must survive the Provider (see §12.0 correction)'
              bs={<BsTooltipA text='bold (⌘B)' placement='top' delay={500}><span className='cursor-help underline decoration-dotted'>toolbar button</span></BsTooltipA>}
              sn={<Tooltip content='bold (⌘B)' side='top' delay={500}><span className='cursor-help underline decoration-dotted'>toolbar button</span></Tooltip>}
            />
            <Compare
              label="side='left'"
              note='poll.js'
              bs={<BsTooltipA text='1 sat' placement='left'><span className='cursor-help underline decoration-dotted'>poll option</span></BsTooltipA>}
              sn={<Tooltip content='1 sat' side='left'><span className='cursor-help underline decoration-dotted'>poll option</span></Tooltip>}
            />
            <Compare
              label='grouping'
              note='sweep the pointer across: once one is open, adjacent SN tooltips swap instantly (400ms window) — new behavior, rb has no equivalent'
              bs={
                <div className='flex gap-4'>
                  {['dark mode', 'lightning strikes', 'live comments'].map(t =>
                    <BsTooltipA key={t} text={t}><span className='cursor-help underline decoration-dotted'>{t.split(' ')[0]}</span></BsTooltipA>)}
                </div>
              }
              sn={
                <div className='flex gap-4'>
                  {['dark mode', 'lightning strikes', 'live comments'].map(t =>
                    <Tooltip key={t} content={t}><span className='cursor-help underline decoration-dotted'>{t.split(' ')[0]}</span></Tooltip>)}
                </div>
              }
            />
            <Compare
              label='wrap'
              note='max-width 200px → max-w-48 (192px); font is text-sm 14px vs 13.02px painted today (nearest-native)'
              bs={<BsTooltipB text='the tooltip content wraps once it runs past the maximum width of the bubble'><span className='cursor-help underline decoration-dotted'>long content</span></BsTooltipB>}
              sn={<Tooltip content='the tooltip content wraps once it runs past the maximum width of the bubble'><span className='cursor-help underline decoration-dotted'>long content</span></Tooltip>}
            />
            <Compare
              label='disabled'
              note='login.js pattern (Root disabled) — nothing should open on either side'
              bs={<OverlayTrigger placement='bottom' overlay={<></>} trigger={['hover', 'focus']}><span className='cursor-help underline decoration-dotted'>account switching</span></OverlayTrigger>}
              sn={<Tooltip content='not available for account switching yet' disabled><span className='cursor-help underline decoration-dotted'>account switching</span></Tooltip>}
            />
          </CompareGrid>
        </Section>

        <Section
          title='Popover / Preview Card'
          note='ui/popover.js + ui/preview-card.js — body-bg chrome on the --sn-z ladder, shared clip-window arrow (ui/arrow.module.css), 150ms fade+scale (was: snap).'
          details={[
            'intended delta: body font is text-sm 14px vs 13.02px painted today (footer bodies 14.4px)',
            'intended delta: shadow-lg — today paints none (pre-flight 1; judge by eye)',
            'new click/keyboard affordances are called out per row',
            'chrome is body-vars — theme-flips and territory-retints for free'
          ]}
        >
          <CompareGrid>
            <Compare
              label='click popover'
              note="footer shape: press toggles, outside press + Escape close, side='top'. new: the div trigger is keyboard-reachable (Tab + Enter/Space)"
              bs={
                <OverlayTrigger
                  trigger='click' placement='top' rootClose overlay={
                    <BsPopover>
                      <BsPopover.Body style={{ fontWeight: 500, fontSize: '.9rem' }}>
                        <a href='https://t.me/k00bideh' className='nav-link p-0 inline-flex' target='_blank' rel='noreferrer'>telegram</a>
                        <span className='mx-2 text-muted'> \ </span>
                        <a href='https://signal.group/#CjQKIEt57YiluJoTW3lZqaqAq6echCekEYFfg7eIua2X91nLEhA__6ALI9pkaY_McQqX0jm1' className='nav-link p-0 inline-flex' target='_blank' rel='noreferrer'>signal</a>
                      </BsPopover.Body>
                    </BsPopover>
                  }
                >
                  <div className='nav-link p-0 inline-flex' style={{ cursor: 'pointer' }}>chat</div>
                </OverlayTrigger>
              }
              sn={
                <ClickPopover label='chat'>
                  <a href='https://t.me/k00bideh' className='nav-link p-0 inline-flex' target='_blank' rel='noreferrer'>telegram</a>
                  <span className='mx-2 text-muted'> \ </span>
                  <a href='https://signal.group/#CjQKIEt57YiluJoTW3lZqaqAq6echCekEYFfg7eIua2X91nLEhA__6ALI9pkaY_McQqX0jm1' className='nav-link p-0 inline-flex' target='_blank' rel='noreferrer'>signal</a>
                </ClickPopover>
              }
            />
            <Compare
              label='hover card'
              note='500ms open / 300ms close grace on both sides; pointer can move into the card; focus opens; Escape closes'
              bs={
                <BsHoverCard
                  trigger={<Link href='#'>@satoshi</Link>}
                  body={
                    <div>
                      <div className='font-bold'>@satoshi</div>
                      <small className='text-muted'>stacking since: <Link href='#'>#1</Link></small>
                    </div>
                  }
                />
              }
              sn={
                <PreviewCard
                  trigger={<Link href='#'>@satoshi</Link>}
                  body={
                    <div>
                      <div className='font-bold'>@satoshi</div>
                      <small className='text-muted'>stacking since: <Link href='#'>#1</Link></small>
                    </div>
                  }
                />
              }
            />
            <Compare
              label='nested hover card'
              note='user-preview-card hosts an item-preview-card trigger in its body ("stacking since") — hover the inner #1 with the outer card open (risk 1)'
              bs={
                <BsHoverCard
                  trigger={<Link href='#'>@satoshi</Link>}
                  body={
                    <div>
                      <div className='font-bold'>@satoshi</div>
                      <small className='text-muted'>stacking since: <BsHoverCard trigger={<Link href='#'>#1</Link>} body={<div>an item summary</div>} /></small>
                    </div>
                  }
                />
              }
              sn={
                <PreviewCard
                  trigger={<Link href='#'>@satoshi</Link>}
                  body={
                    <div>
                      <div className='font-bold'>@satoshi</div>
                      <small className='text-muted'>stacking since: <PreviewCard trigger={<Link href='#'>#1</Link>} body={<div>an item summary</div>} /></small>
                    </div>
                  }
                />
              }
            />
            <WalkthroughCompare />
            <Compare
              label='badge hint'
              note="left = C3's green tooltip — what badges render before this commit; login.js keeps it. right = the badge Popover. hover opens instantly; click PINS until outside click/Escape (intended); tap works on touch; Tab + Enter reaches it (all new)."
              bs={
                <Tooltip content='50 days'>
                  <span className='inline-flex items-center justify-center'><CowboyHatIcon className='fill-grey align-middle' height={16} width={16} /></span>
                </Tooltip>
              }
              sn={
                <BadgeTooltip overlayText='50 days'>
                  <span className='inline-flex items-center justify-center'><CowboyHatIcon className='fill-grey align-middle' height={16} width={16} /></span>
                </BadgeTooltip>
              }
            />
            <Compare
              label='arrow, four sides'
              note="C4 QA fix: the popup is position:relative now, so the arrow's containing block survives the open/close transform. it used to re-anchor to the positioner when the transition ended — the shape-shift sox caught. the shape is the Base UI docs clip-window diamond from the shared ui/arrow.module.css at 16px; the 16×7 tip ≈ BS's native 1rem × .5rem popover arrow, where the old 12px rotated square drew 17×8.5. watch it open: no morph/jump, the notch stays crisp, and the popup border must not cut across it."
              bs={
                <div className='flex gap-4'>
                  {['top', 'right', 'bottom', 'left'].map(p =>
                    <OverlayTrigger key={p} trigger='click' placement={p} rootClose overlay={<BsPopover><BsPopover.Body>{p}</BsPopover.Body></BsPopover>}>
                      <div className='nav-link p-0 inline-flex cursor-pointer'>{p}</div>
                    </OverlayTrigger>)}
                </div>
              }
              sn={
                <div className='flex gap-4'>
                  {['top', 'right', 'bottom', 'left'].map(s =>
                    <ClickPopover key={s} label={s} side={s}>{s}</ClickPopover>)}
                </div>
              }
            />
          </CompareGrid>
        </Section>

        <Section
          title='Menu (Dropdown)'
          note='ui/menu.js — Base UI Menu at rb-Dropdown ergonomics, with modal={false} BAKED: Menu.Root is the one popup primitive that scroll-locks by default (Popover does not).'
          details={[
            'intended delta: items unify at py-2 — nav/modal/territory menus grow .25rem per item; the item-"..." menus already painted it',
            'intended deltas: shadow-lg (today paints none), rounded-md 6px vs 6.4px, 150ms fade+scale (was: snap), split caret w-10 40px vs 42px',
            'new behaviors: typeahead letter-jump, keyboard highlight paints like hover, the "..." and split triggers are focusable'
          ]}
        >
          <CompareGrid>
            <Compare
              label='link menu'
              note='MeDropdown shape: link items, active glow + dividers, end-aligned at 2px gap. arrows/Enter/typeahead on the new side; Tab returns to the trigger'
              bs={
                <BsDropdown align='end'>
                  <BsDropdown.Toggle variant='custom' className='nav-link nav-item font-normal'>@satoshi</BsDropdown.Toggle>
                  <BsDropdown.Menu>
                    <BsDropdown.Item as={Link} href='#'>profile</BsDropdown.Item>
                    <BsDropdown.Item as={Link} href='#' active>wallets</BsDropdown.Item>
                    <BsDropdown.Divider />
                    <BsDropdown.Item as={Link} href='#'>settings</BsDropdown.Item>
                  </BsDropdown.Menu>
                </BsDropdown>
              }
              sn={
                <Menu>
                  <Menu.Trigger className='nav-link nav-item font-normal ps-0 pe-2 py-0.5'>@satoshi</Menu.Trigger>
                  <Menu.Popup align='end'>
                    <Menu.Item href='#'>profile</Menu.Item>
                    <Menu.Item href='#' active>wallets</Menu.Item>
                    <Menu.Separator />
                    <Menu.Item href='#'>settings</Menu.Item>
                  </Menu.Popup>
                </Menu>
              }
            />
            <Compare
              label='action "..."'
              note='ActionDropdown shape: span trigger with the more icon — new side adds role=button + tabIndex, the old as="a" toggle was untabbable. action items + separator; items at py-2 on both sides here (the item-"…" menus painted .5rem already).'
              bs={
                <BsDropdown className='pointer' as='span'>
                  <BsDropdown.Toggle variant='success' as='a'>
                    <MoreIcon className='fill-grey ms-1' height={16} width={16} />
                  </BsDropdown.Toggle>
                  <BsDropdown.Menu>
                    <BsDropdown.Item onClick={() => {}}>copy link</BsDropdown.Item>
                    <BsDropdown.Item onClick={() => {}}>details</BsDropdown.Item>
                    <BsDropdown.Divider />
                    <BsDropdown.Item onClick={() => {}}><span className='text-danger'>downzap</span></BsDropdown.Item>
                  </BsDropdown.Menu>
                </BsDropdown>
              }
              sn={
                <Menu className='pointer'>
                  <Menu.Trigger nativeButton={false} render={<span><MoreIcon className='fill-grey ms-1' height={16} width={16} /></span>} />
                  <Menu.Popup>
                    <Menu.Item onClick={() => {}}>copy link</Menu.Item>
                    <Menu.Item onClick={() => {}}>details</Menu.Item>
                    <Menu.Separator />
                    <Menu.Item onClick={() => {}}><span className='text-danger'>downzap</span></Menu.Item>
                  </Menu.Popup>
                </Menu>
              }
            />
            <Compare
              label='split login'
              note="login-button.js group: the caret opens an end-aligned menu on the dropdownExtra skins — raw Base UI items, because itemClasses' utilities would out-!important the skin (§11.0). menu width is 160px on both sides (the old inline 150px always lost to Bootstrap's min-width). the current account keeps the .active skin; keyboard highlight is the new [data-highlighted] hover twin."
              bs={<BsSplitLogin />}
              sn={<SnSplitLogin />}
            />
            <Compare
              label='mentions listbox'
              note='editor @/~ suggestions (D4): a plain listbox on menuClasses/itemClasses. Lexical owns the keyboard; selection paints the active glow. the rb Dropdown shell (and the opacity !important workaround it needed) is gone. left = static rb lookalike.'
              bs={
                <div className='dropdown-menu show relative inline-block'>
                  <a className='dropdown-item active' href='#satoshi' onClick={e => e.preventDefault()}>satoshi</a>
                  <a className='dropdown-item' href='#sox' onClick={e => e.preventDefault()}>sox</a>
                  <a className='dropdown-item' href='#k00b' onClick={e => e.preventDefault()}>k00b</a>
                </div>
              }
              sn={<MentionsListboxReplica />}
            />
            <Compare
              label='scroll lock (modal)'
              note="pre-flight 4's receipt. left is NOT rb — it's a raw Base UI Menu at the DEFAULT modal, which LOCKS document scroll while open (body overflow:hidden). right is ui/menu with the baked modal={false}: the page keeps scrolling, matching every rb menu today. this asymmetry is why the wrapper bakes it — Popover.Root defaults false, Menu.Root defaults true."
              bs={
                <BaseMenu.Root>
                  <BaseMenu.Trigger className={buttonClasses({ variant: 'grey', size: 'sm' })}>default modal — locks</BaseMenu.Trigger>
                  <BaseMenu.Portal>
                    <BaseMenu.Positioner sideOffset={2} className='z-(--sn-z-dropdown)'>
                      <BaseMenu.Popup className={menuClasses()}>
                        <BaseMenu.Item className={itemClasses()}>try scrolling</BaseMenu.Item>
                        <BaseMenu.Item className={itemClasses()}>the page is locked</BaseMenu.Item>
                      </BaseMenu.Popup>
                    </BaseMenu.Positioner>
                  </BaseMenu.Portal>
                </BaseMenu.Root>
              }
              sn={
                <Menu>
                  <Menu.Trigger className={buttonClasses({ variant: 'grey', size: 'sm' })}>modal={'{false}'} baked — scrolls</Menu.Trigger>
                  <Menu.Popup>
                    <Menu.Item>try scrolling</Menu.Item>
                    <Menu.Item>the page still scrolls</Menu.Item>
                  </Menu.Popup>
                </Menu>
              }
            />
          </CompareGrid>
        </Section>

        <Section
          title='Modal (Dialog)'
          note="modal.js internals on ONE controlled Dialog.Root — the stack/back/keepOpen/fullScreen machinery is unchanged (D1) and useShowModal's 24 consumer files didn't move. the right column IS the real modal."
          details={[
            'Dialog KEEPS Base UI’s modal default — scroll lock + focus trap are the contract here. the deliberate pair to Menu’s baked modal={false}',
            'NO motion: open and close snap on BOTH sides. deliberate keystone-5 exception — an exit fade needs deferred-unmount machinery inside the stack logic, parked in §15.8-1',
            'intended delta: max-w-lg 512px vs 500px',
            'intended delta: the X is a Dialog.Close — Tab reaches it, Enter/Space close (D8). rb’s div was untabbable',
            'intended delta: the popup itself takes focus on open (rb focused the container) — no focus ring, no mobile keyboard on either side'
          ]}
        >
          <CompareGrid>
            <Compare
              label='plain chrome'
              note='census row: inputBg/borderColor chrome, 1px border, radius 8px (rounded-lg, exact), body padding 32px (p-8, exact), 28px top margin ≥576px (sm:my-7), lightning X at 160% with hover opacity .7, li spacing from the module'
              bs={<BsModalReplica label='plain modal'><ModalGuts /></BsModalReplica>}
              sn={<Button size='sm' variant='grey' onClick={() => showModal(() => <div><ModalGuts /></div>)}>plain modal</Button>}
            />
            <Compare
              label='2-deep stack'
              note="push B → the back arrow appears. back pops ONE level; B's onClose fires after the pop — the modal.js:39–42 ordering that keeps a QR cancel from nuking the stack. X closes everything from any depth."
              bs={<BsModalReplica label='open stack' stackable><p>modal A (bottom of stack)</p></BsModalReplica>}
              sn={<Button size='sm' variant='grey' onClick={() => showModal(() => <SnStackGuts showModal={showModal} />)}>open stack</Button>}
            />
            <Compare
              label='keepOpen'
              note="QR/ApiKeyModal shape: Escape and backdrop-click no-op on both sides, the X always closes. 'close-press' routes around the keepOpen gate exactly like rb's direct onClick did — onHide={undefined} only ever killed light dismiss."
              bs={<BsModalReplica label='keepOpen modal' keepOpen><p>Escape/backdrop do nothing — only the X closes me</p></BsModalReplica>}
              sn={<Button size='sm' variant='grey' onClick={() => showModal(() => <p>Escape/backdrop do nothing — only the X closes me</p>, { keepOpen: true })}>keepOpen modal</Button>}
            />
            <Compare
              label='fullScreen + overflow'
              note='carousel shape: viewport tint (66% inputBg) over the black backdrop, borderless transparent popup, body 100svh − 6.8rem at padding 0, close/overflow chrome at 1.25rem with the −10px overflow nudge'
              bs={
                <BsModalReplica
                  label='fullScreen' fullScreen
                  overflow={<Menu.Item href='https://example.com' target='_blank' rel='noreferrer'>view original</Menu.Item>}
                >
                  <p className='text-center pt-8'>fullScreen content</p>
                </BsModalReplica>
              }
              sn={
                <Button
                  size='sm' variant='grey' onClick={() =>
                    showModal(() => <p className='text-center pt-8'>fullScreen content</p>, {
                      fullScreen: true,
                      overflow: <Menu.Item href='https://example.com' target='_blank' rel='noreferrer'>view original</Menu.Item>
                    })}
                >
                  fullScreen
                </Button>
              }
            />
            <Compare
              label='overflow menu z'
              note="the C5 ⚠️ regression receipt (extends the Menu scroll-lock receipt family). the ONE menu that opens from inside a modal is the carousel's overflow. left pins its positioner at the old ladder value 1000, so it opens BEHIND the modal — §15.5 pre-flight 8's failing check. right rides the fixed --sn-z-dropdown 1060 and paints visibly on top. same PR, so the regression never ships."
              bs={<BsZRegressionModal />}
              sn={
                <Button
                  size='sm' variant='grey' onClick={() =>
                    showModal(() => <p className='text-center pt-8'>open the "…" up top — the menu paints ABOVE this modal (1060 &gt; 1055)</p>, {
                      fullScreen: true,
                      overflow: (
                        <>
                          <Menu.Item onClick={() => {}}>menu z 1060</Menu.Item>
                          <Menu.Item onClick={() => {}}>above modal 1055</Menu.Item>
                        </>
                      )
                    })}
                >
                  menu at fixed z 1060
                </Button>
              }
            />
          </CompareGrid>
        </Section>

        <Section
          title='Toast'
          note="toast.js internals on Base UI Toast (Provider + portaled Viewport) — the hand-rolled state machine died (upsert-by-id covers dedup, timer refresh and countdown natively) and useToast's 42 consumer files didn't move."
          details={[
            'left column = pre-C7 replica firing bottom-LEFT so both stacks run side by side (the real thing sat bottom-right like the new side)',
            'intended deltas (keystone-5 revision, GO 2026-07-16): 250ms peek-stack + hover fan-out + swipe-dismiss + upsert pulse + pausing countdown replace the 0.2s slide-in/fade and the always-expanded vertical stack',
            'intended deltas: shadow-only chrome — the 1px border dies, shadow 0 2px 8px 25% vs 0 8px 16px 15%; radius 6px vs 6.4px; limit 3',
            'new behaviors: toasts are tab-reachable and F6 jumps to the stack; reduced-motion disables all motion (rb animated under reduce)'
          ]}
        >
          <ToastCompares />
        </Section>

        <Section
          title='Editor'
          note='the real SNEditor, no rb replica — a compare pair would need a second Lexical editor (§17.0-4). whatever is swapped paints here.'
          details={[
            "C8a mode switch: inline Base UI Tabs — a real <button role='tab'> tablist with roving tabindex. arrows move focus, Enter/Space activates through the upload guard, the active tab no-ops natively",
            'C8b Toolbar + Menu — intended deltas: ~150ms menu motion, shadow-lg on the popups, toolbar roving arrows. the popup takes focus while open; format still applies to the original selection and focus returns after — ⚠️ iOS keyboard may retract, device QA',
            'C8c link editor: controlled Popover at ladder z 1070 — house popover chrome replaces the old composite bg, scroll-tracking is native. Tab-out alone no longer closes it; selection tracking unmounts on caret-leave'
          ]}
        >
          <Formik initialValues={{ pgEditorTop: '', pgEditorComment: '' }} onSubmit={() => {}}>
            {() => (
              <FeeButtonProvider>
                <div className='flex flex-col gap-4'>
                  <div>
                    <div className='text-muted text-sm mb-1'>topLevel (post form)</div>
                    <SNEditor name='pgEditorTop' topLevel placeholder='top-level editor' minRows={3} />
                  </div>
                  <div>
                    <div className='text-muted text-sm mb-1'>comment-level (reply form)</div>
                    <SNEditor name='pgEditorComment' placeholder='comment-level editor' minRows={2} />
                  </div>
                </div>
              </FeeButtonProvider>
            )}
          </Formik>
        </Section>

        <Section
          title='Form'
          note='components/form.js became a barrel over components/form/ — Input/Field on Base UI Field+Input, Checkbox on Base UI Checkbox.Root, radios a true Base UI RadioGroup (C9b), select native on the SN pill skin, InputGroup is SN-composed (consumers only ever passed .Text addons). Formik owns all state; Base UI Form was deliberately NOT adopted.'
          details={[
            'invalid stays submit-gated (Field.Root invalid + Field.Error match — the documented external-library hooks); Checkbox/Select invalid are deliberately ungated, as today',
            'intended deltas: input height 41.5→40px, padding-x 13.4→16px, radius 6.4→6px; suggest menus join the C5 chrome (py-2 items, shadow-lg, ladder z 1060, gap stays 0); select shows its error text (rb never displayed it — dead sibling selector); select gains the mobile 16px iOS-zoom guard (rb zoomed)',
            "corner-joining is clone-injected utilities now (rounded-e-none/rounded-none/rounded-s-none by position) — module CSS can't flatten a layered-!important radius (§11.0)",
            'drafts (storageKeyPrefix), Ctrl/Cmd+Enter submit, maxLength counter, clear-X, copy/password addons all ride along unchanged',
            'C9b: Range → Base UI Slider + NumberField (touched on blur, error ungated — verbatim); MultiInput → OtpInput (submit-gated error — verbatim); CheckboxGroup owns the array; billing → RadioGroup on the real billingType field (its error slot was reading a phantom field — inert)'
          ]}
        >
          <FormCompares />
        </Section>

        <Section
          title='coming next'
          note='docs/dev/pr2-base-ui-components.md §8 — a comparison section gets added above as each commit lands'
        >
          <ul className='list-none p-0 m-0 text-muted text-sm'>
            {ROADMAP.map(([name, commit]) =>
              <li key={name} className='py-1'>
                <span className='text-reset'>{name}</span> — {commit}
              </li>)}
          </ul>
        </Section>
      </div>
    </Layout>
  )
}

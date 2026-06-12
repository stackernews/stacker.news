import { useState } from 'react'
import { formatSats, msatsToSatsDecimal, satsToMsats } from '@/lib/format'
import { bolt11Section, safeDecodeBolt11 } from '@/lib/bolt11'
import { timeLeft, timeSince } from '@/lib/time'
import CopyChip, { Chip } from '@/components/copy-chip'
import Link from 'next/link'
import { nostrZapDetails } from '@/lib/nostr'
import Text from '@/components/text'
import NostrIcon from '@/svgs/nostr.svg'
import styles from './bolt11-info.module.css'
import { useIsClient } from '@/components/use-client'

const DEFAULT_CHIP_COUNT = 3
const DESCRIPTION_CHIP_MAX_LENGTH = 80

export default function Bolt11Info ({
  bolt11,
  hash,
  preimage,
  description,
  msats,
  expiresAt,
  confirmedAt,
  nostr,
  nostrNote,
  lud18Data,
  comment,
  children
}) {
  const [expanded, setExpanded] = useState(false)
  const showRelativeTimes = useIsClient()
  const details = bolt11Details({ bolt11, hash, preimage, description, msats, expiresAt, confirmedAt, nostr, nostrNote, lud18Data, comment }, { showRelativeTimes })
  if (!details && !children) return null

  const chips = details?.chips ?? []
  const showMoreToggle = chips.length > DEFAULT_CHIP_COUNT
  const visibleChips = expanded ? chips : chips.slice(0, DEFAULT_CHIP_COUNT)
  const hiddenChipCount = chips.length - DEFAULT_CHIP_COUNT
  const hasDetailPills = details?.commentText || details?.nostrZap

  return (
    <div className={styles.details}>
      {details?.amount && (
        <div className={styles.amount}>
          <span>{details.amount.amount}</span>
          <span>{details.amount.unit}</span>
        </div>
      )}
      {(chips.length > 0 || hasDetailPills) && (
        <div className={styles.chipRow}>
          {visibleChips.map(chip => <InvoiceDetailChip key={chip.key} chip={chip} />)}
          {showMoreToggle && (
            <Chip onClick={() => setExpanded(expanded => !expanded)} title={expanded ? 'show fewer invoice details' : 'show more invoice details'}>
              {expanded ? 'less' : `more ${hiddenChipCount}`}
            </Chip>
          )}
          {details?.commentText && (
            <ExpandableDetailPill label={`LNURL comment${details.senderLabel ? ` from ${details.senderLabel}` : ''}`}>
              <Text>{details.commentText}</Text>
            </ExpandableDetailPill>
          )}
          {details?.nostrZap && <NostrZapRequest zap={details.nostrZap} />}
        </div>
      )}
      {children}
    </div>
  )
}

export function toBolt11InfoProps (info) {
  const {
    bolt11,
    hash,
    preimage,
    confirmedPreimage,
    description,
    msats,
    msatsRequested,
    satsRequested,
    expiresAt,
    confirmedAt,
    nostr,
    nostrNote,
    lud18Data,
    comment
  } = info ?? {}

  return {
    bolt11,
    hash,
    preimage: preimage ?? confirmedPreimage,
    description,
    msats: msats ?? msatsRequested ?? (satsRequested != null ? satsToMsats(satsRequested) : undefined),
    expiresAt,
    confirmedAt,
    nostr,
    nostrNote,
    lud18Data,
    comment
  }
}

function InvoiceDetailChip ({ chip }) {
  if (chip.key === 'description' && isLongDescription(chip.value)) {
    return (
      <ExpandableDetailPill label={truncatedDescriptionLabel(chip.value)}>
        <Text>{chip.value}</Text>
      </ExpandableDetailPill>
    )
  }

  if (chip.value) {
    return (
      <CopyChip value={chip.value} prefix={chip.prefix} tone={chip.tone}>
        {chip.label}
      </CopyChip>
    )
  }

  return <Chip tone={chip.tone}>{chip.label}</Chip>
}

function isLongDescription (value) {
  return typeof value === 'string' && value.length > DESCRIPTION_CHIP_MAX_LENGTH
}

function truncatedDescriptionLabel (description) {
  return `for ${description.slice(0, DESCRIPTION_CHIP_MAX_LENGTH).trimEnd()}...`
}

function ExpandableDetailPill ({ label, children, icon }) {
  const [open, setOpen] = useState(false)
  const className = [
    styles.detailPill,
    open ? styles.detailPillOpen : null
  ].filter(Boolean).join(' ')

  return (
    <div className={className}>
      <button
        type='button'
        className={styles.detailPillButton}
        aria-expanded={open}
        onClick={() => setOpen(open => !open)}
        title={open ? 'hide details' : 'show details'}
      >
        {icon}
        <span className={styles.detailPillLabel}>{label}</span>
        <span className={styles.detailPillIndicator} aria-hidden='true'>{open ? '-' : '+'}</span>
      </button>
      {open && (
        <div className={styles.detailPillBody}>
          {children}
        </div>
      )}
    </div>
  )
}

function NostrZapRequest ({ zap }) {
  const { npub, content, note } = nostrZapDetails(zap)

  return (
    <ExpandableDetailPill label='Nostr zap request' icon={<NostrIcon width={16} height={16} className='fill-nostr' />}>
      <div className='fw-bold text-nostr small'>
        from{' '}
        <Link className='text-reset text-underline' target='_blank' href={`https://njump.me/${npub}`} rel='noreferrer nofollow noopener'>
          {npub.slice(0, 10)}...
        </Link>
        {note && (
          <>
            {' '}on{' '}
            <Link className='text-reset text-underline' target='_blank' href={`https://njump.me/${note}`} rel='noreferrer nofollow noopener'>
              {note.slice(0, 12)}...
            </Link>
          </>
        )}
      </div>
      {content && <div className='mt-1'><Text>{content}</Text></div>}
    </ExpandableDetailPill>
  )
}

function bolt11Details ({ bolt11, hash, preimage, description, msats, expiresAt, confirmedAt, nostr, nostrNote, lud18Data, comment }, { showRelativeTimes } = {}) {
  const decoded = safeDecodeBolt11(bolt11)
  const decodedTimestamp = bolt11Section(decoded, 'timestamp')?.value
  const decodedExpiry = bolt11Section(decoded, 'expiry')?.value
  const decodedExpiresAt = decodedTimestamp && decodedExpiry ? new Date((decodedTimestamp + decodedExpiry) * 1000) : null
  const decodedDescription = bolt11Section(decoded, 'description')?.value
  const amountMsats = msats ?? bolt11Section(decoded, 'amount')?.value
  const invoiceExpiresAt = expiresAt ? new Date(expiresAt) : decodedExpiresAt
  description ??= decodedDescription
  hash ??= bolt11Section(decoded, 'payment_hash')?.value
  const nostrZap = nostr ?? nostrNote?.note
  const commentText = typeof comment === 'string' ? comment : comment?.comment
  const senderLabel = lud18Data?.name || lud18Data?.identifier || ''
  const paidAt = confirmedAt ? new Date(confirmedAt) : null
  const paidChip = paidAt
    ? { key: 'paid', label: showRelativeTimes ? `paid ${timeSince(paidAt)}` : 'paid' }
    : preimage && { key: 'paid', label: 'paid' }

  // Keep the compact invoice details ordered from human-readable context to raw proof data.
  const chips = [
    description && { key: 'description', label: `for ${description}`, value: description },
    paidChip,
    !paidChip && invoiceExpiresAt && invoiceExpiryChip(invoiceExpiresAt, { showRelativeTimes }),
    ...payerDataChips(lud18Data),
    hash && { key: 'hash', prefix: 'hash', value: hash },
    preimage && { key: 'preimage', prefix: 'preimage', value: preimage },
    bolt11 && { key: 'bolt11', prefix: 'bolt11', value: bolt11 }
  ].filter(Boolean)

  const amount = amountMsats ? msatsToDisplaySats(amountMsats) : null
  if (!amount && chips.length === 0 && !commentText && !nostrZap) return null
  return { amount, chips, commentText, senderLabel, nostrZap }
}

function invoiceExpiryChip (expiresAt, { showRelativeTimes }) {
  if (!showRelativeTimes) {
    return { key: 'expires-relative', label: 'expires' }
  }

  return {
    key: 'expires-relative',
    label: invoiceRelativeExpiryLabel(expiresAt),
    tone: expiresAt <= new Date() ? 'danger' : undefined
  }
}

function msatsToDisplaySats (msats) {
  const [amount, unit] = formatSats(Number(msatsToSatsDecimal(msats))).split(' ')
  return { amount, unit }
}

function invoiceRelativeExpiryLabel (expiresAt) {
  return expiresAt <= new Date() ? `expired ${timeSince(expiresAt)}` : `expires ${timeLeft(expiresAt)}`
}

function payerDataChips (payerData) {
  if (!payerData) return []
  return [
    payerData.name && { key: 'payer-name', label: `name ${payerData.name}`, value: payerData.name },
    payerData.identifier && { key: 'payer-identifier', label: payerData.identifier, value: payerData.identifier },
    payerData.email && { key: 'payer-email', label: payerData.email, value: payerData.email },
    payerData.pubkey && { key: 'payer-pubkey', prefix: 'payer pubkey', value: payerData.pubkey }
  ].filter(Boolean)
}

import { Fragment } from 'react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import Tooltip from '@/components/ui/tooltip'
import CowboyHatIcon from '@/svgs/cowboy.svg'
import AnonIcon from '@/svgs/spy-fill.svg'
import GunIcon from '@/svgs/revolver.svg'
import HorseIcon from '@/svgs/horse.svg'
import BotIcon from '@/svgs/robot-2-fill.svg'
import { numWithUnits } from '@/lib/format'
import { USER_ID } from '@/lib/constants'
import classNames from 'classnames'

export default function Badges ({ user, badge, bot, showWalletBadges, interactive = false, className = 'ms-1', badgeClassName, spacingClassName = 'ms-1', height = 16, width = 16 }) {
  if (!user) return null
  if (Number(user.id) === USER_ID.anon) {
    return (
      <BadgeTooltip overlayText='anonymous' interactive={interactive}>
        <span className={className}>
          <AnonIcon className={`${badgeClassName} align-middle`} height={height} width={width} />
          <span className='sr-only'>anonymous</span>
        </span>
      </BadgeTooltip>
    )
  }

  let badges = []

  const streak = user.optional.streak
  if (streak !== null) {
    badges.push({
      icon: CowboyHatIcon,
      overlayText: streak
        ? `${numWithUnits(streak, { abbreviate: false, unitSingular: 'day', unitPlural: 'days' })}`
        : 'new'
    })
  }

  if (showWalletBadges && user.optional.hasRecvWallet) {
    badges.push({
      icon: HorseIcon,
      overlayText: 'can receive sats'
    })
  }

  if (showWalletBadges && user.optional.hasSendWallet) {
    badges.push({
      icon: GunIcon,
      sizeDelta: 2,
      style: { marginBottom: '-2px' },
      overlayText: 'can send sats'
    })
  }

  if (bot) {
    badges = [{
      icon: BotIcon,
      overlayText: 'posted as bot'
    }]
  }

  if (badges.length === 0) return null

  return (
    <span className={classNames(className, 'inline-flex items-center justify-center')}>
      {badges.map(({ icon, overlayText, sizeDelta, style }, i) => (
        <SNBadge
          key={i}
          user={user}
          badge={badge}
          overlayText={overlayText}
          badgeClassName={classNames(badgeClassName, i > 0 && spacingClassName)}
          IconForBadge={icon}
          height={height}
          width={width}
          sizeDelta={sizeDelta}
          style={style}
          interactive={interactive}
        />
      ))}
    </span>
  )
}

function SNBadge ({ user, badge, overlayText, badgeClassName, IconForBadge, height = 16, width = 16, sizeDelta = 0, style, interactive }) {
  let Wrapper = Fragment

  if (overlayText) {
    Wrapper = ({ children }) => (
      <BadgeTooltip overlayText={overlayText} interactive={interactive}>{children}</BadgeTooltip>
    )
  }

  return (
    <Wrapper>
      <span className='inline-flex items-center justify-center' style={style}>
        <IconForBadge className={badgeClassName} height={height + sizeDelta} width={width + sizeDelta} />
        <span className='sr-only'>{overlayText}</span>
      </span>
    </Wrapper>
  )
}

// Badges inside links and menu triggers stay passive so they cannot create a
// control inside another control. Standalone badges opt into a tap-accessible
// Popover; passive badges retain hover help and inline screen-reader text.
export function BadgeTooltip ({ children, overlayText, placement, interactive = false }) {
  if (!interactive) {
    return <Tooltip content={overlayText} side={placement || 'bottom'}>{children}</Tooltip>
  }

  return (
    <Popover>
      <PopoverTrigger render={children} nativeButton={false} openOnHover delay={0} />
      {/* initialFocus={false}: a text-only hint must not yank focus on press */}
      <PopoverContent side={placement || 'bottom'} initialFocus={false} aria-label='Badge details' className='py-1 px-2 text-center'>
        {overlayText}
      </PopoverContent>
    </Popover>
  )
}

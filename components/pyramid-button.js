import { useMemo } from 'react'
import styles from './pyramid-button.module.css'

function measureLabel (text, fontSize) {
  if (!text) return { w: 0, h: 0 }
  const letterSpacing = 0.22 * fontSize
  return {
    w: text.length * fontSize * 0.6 + Math.max(0, text.length - 1) * letterSpacing,
    h: fontSize * 1.2
  }
}

/**
 * PyramidButton renders N concentric rectangles stepping inward from the outer
 * edge to a label pad at the center. The button fills its container (width
 * 100% with aspect-ratio); layer insets are percentage-based so it scales
 * cleanly. Each layer sits on an oklch lightness ramp: `direction='in'` goes
 * outer-light -> inner-dark; `direction='out'` is reversed. On hover (or
 * keyboard focus) every layer expands 15% toward the outer edge (aperture).
 *
 * @param {number}     [aspect=1]       width:height aspect ratio
 * @param {number}     [layers=4]       concentric layer count (min 2)
 * @param {'in'|'out'} [direction='in'] lightness ramp direction
 * @param {number}     [radius=0]       corner radius px
 * @param {string}     [label='ENTER']  centered label text (CSS-uppercased)
 * @param {number}     [fontSize=14]    label font size px
 * @param {number}     [pad=22]         label padding px; inner layer grows by 2x pad around the label
 * @param {number}     [innerWidthScale=1] multiplier for the inner layer width
 * @param {React.ElementType} [as='button'] element/component to render
 * @param {function}   [onClick]
 * @param {string}     [ariaLabel]      overrides `label` for screen readers
 * @param {string}     [className]      extra class merged onto the outer button
 */
export default function PyramidButton ({
  aspect = 1,
  layers = 4,
  direction = 'in',
  radius = 0,
  label = 'ENTER',
  fontSize = 14,
  pad = 22,
  innerWidthScale = 1,
  as: Component = 'button',
  onClick,
  ariaLabel,
  className,
  ...rest
}) {
  const rects = useMemo(() => {
    const n = Math.max(2, layers)
    const { w: labelW, h: labelH } = measureLabel(label, fontSize)
    const innerSize = Math.max(labelW, labelH) + pad * 2
    const innerW = Math.max((innerSize + pad * 0.6) * innerWidthScale, 1)
    const innerH = Math.max(innerSize - pad * 0.45, 1)

    // Compressed lightness ramp so both ends are visible on light and dark
    // backgrounds; hue/chroma carry the identity.
    const innerL = direction === 'out' ? 0.72 : 0.52
    const outerL = direction === 'out' ? 0.5 : 0.74

    return Array.from({ length: n }, (_, i) => {
      // Layer 0 is outermost; (n - 1) is innermost. Percentage of half the
      // "gap" between container edge and inner rect.
      const t = i / (n - 1)
      return {
        i,
        insetX: `calc((100% - ${innerW}px) * ${(t / 2).toFixed(4)})`,
        insetY: `calc((100% - ${innerH}px) * ${(t / 2).toFixed(4)})`,
        L: outerL + (innerL - outerL) * t
      }
    })
  }, [layers, direction, label, fontSize, pad, innerWidthScale])

  const innerL = rects[rects.length - 1].L
  const labelColor = innerL < 0.55 ? '#f3efe4' : '#14120c'

  const shadow = direction === 'in'
    ? 'inset 0.15px 1px 0px rgba(0,0,0,0.1)'
    : '0.15px 1px 0px rgba(0,0,0,0.1)'

  const classes = [styles.pyramid, className]
    .filter(Boolean).join(' ')
  const isButton = Component === 'button'

  return (
    <Component
      {...(isButton ? { type: 'button' } : {})}
      className={classes}
      onClick={onClick}
      aria-label={ariaLabel || label || 'pyramid button'}
      style={{
        '--aspect': aspect
      }}
      {...rest}
    >
      {rects.map(({ i, insetX, insetY, L }) => (
        <span
          key={i}
          className={styles.layer}
          style={{
            '--inset-x': insetX,
            '--inset-y': insetY,
            '--l': L.toFixed(3),
            // Outermost layer is the anchor and never casts a shadow.
            '--shadow': i === 0 ? 'none' : shadow,
            borderRadius: i === 0 ? 0 : `${radius}px`,
            zIndex: i
          }}
        />
      ))}
      {label && (
        <span
          className={styles.label}
          style={{
            zIndex: rects.length + 1,
            color: labelColor,
            fontSize: `${fontSize}px`,
            letterSpacing: `${0.22 * fontSize}px`
          }}
        >
          {label}
        </span>
      )}
    </Component>
  )
}

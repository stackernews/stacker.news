import { useMemo } from 'react'
import styles from './pyramid-button.module.css'

// Cached canvas 2D context for text measurement. Lazy-initialised so the
// module is SSR-safe (no `document` on the server).
let measureCtx

function measureLabel (text, fontSize) {
  if (!text) return { w: 0, h: 0 }
  const letterSpacing = 0.22 * fontSize
  if (!measureCtx && typeof document !== 'undefined') {
    measureCtx = document.createElement('canvas').getContext('2d')
  }
  // Server fallback: estimate width by char count. Good enough to render;
  // the client remeasures on hydration.
  if (!measureCtx) {
    return {
      w: text.length * fontSize * 0.6 + Math.max(0, text.length - 1) * letterSpacing,
      h: fontSize * 1.2
    }
  }
  measureCtx.font = `500 ${fontSize}px Helvetica, "Helvetica Neue", Arial, sans-serif`
  const extra = Math.max(0, text.length - 1) * letterSpacing
  return { w: measureCtx.measureText(text).width + extra, h: fontSize * 1.2 }
}

/**
 * PyramidButton renders N concentric rectangles stepping inward from the outer
 * edge to a label pad at the center. The button fills its container (width
 * 100% with aspect-ratio); layer insets are percentage-based so it scales
 * cleanly. Each layer sits on an oklch lightness ramp: `direction='in'` goes
 * outer-light -> inner-dark; `direction='out'` is reversed. On hover (or
 * keyboard focus) every layer pulls 35% toward the outer edge (aperture) and
 * darkens by 0.12 L.
 *
 * @param {number}     [aspect=1]       width:height aspect ratio
 * @param {number}     [layers=4]       concentric layer count (min 2)
 * @param {number}     [hue=32]         oklch hue 0-360
 * @param {number}     [chroma=0]       oklch chroma (0 = grayscale)
 * @param {'in'|'out'} [direction='in'] lightness ramp direction
 * @param {number}     [depth=0]        shadow depth px; positive raises, negative sinks
 * @param {number}     [radius=0]       corner radius px
 * @param {string}     [label='ENTER']  centered label text (CSS-uppercased)
 * @param {number}     [fontSize=14]    label font size px
 * @param {number}     [pad=22]         label padding px; inner layer grows by 2x pad around the label
 * @param {number}     [innerWidthScale=1] multiplier for the inner layer width
 * @param {function}   [onClick]
 * @param {string}     [ariaLabel]      overrides `label` for screen readers
 * @param {React.Node} [children]       alternative to label: render custom content (e.g. logo) in the center slot
 * @param {string}     [state]          visual state; accepts 'glow' for active-in-dark-mode neon
 * @param {string}     [className]      extra class merged onto the outer button
 */
export default function PyramidButton ({
  aspect = 1,
  layers = 4,
  hue = 32,
  chroma = 0,
  direction = 'in',
  depth = 0,
  radius = 0,
  label = 'ENTER',
  fontSize = 14,
  pad = 22,
  innerWidthScale = 1,
  onClick,
  onContextMenu,
  ariaLabel,
  children,
  state,
  className,
  ...rest
}) {
  const rects = useMemo(() => {
    const n = Math.max(2, layers)
    // When custom children fill the inner slot, reserve a square-ish cavity
    // sized by pad; otherwise measure the text label.
    const { w: labelW, h: labelH } = children
      ? { w: 2 * pad, h: 2 * pad }
      : measureLabel(label, fontSize)
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
  }, [layers, direction, label, fontSize, pad, innerWidthScale, children])

  const innerL = rects[rects.length - 1].L
  const labelColor = innerL < 0.55 ? '#f3efe4' : '#14120c'

  const n = rects.length
  const shadow = direction === 'in'
    ? 'inset 0.15px 1px 0px rgba(0,0,0,0.1)'
    : '0.15px 1px 0px rgba(0,0,0,0.1)'

  const classes = [styles.pyramid, state === 'glow' ? styles.glow : null, className]
    .filter(Boolean).join(' ')

  return (
    <button
      type='button'
      className={classes}
      onClick={onClick}
      onContextMenu={onContextMenu}
      aria-label={ariaLabel || label || 'pyramid button'}
      style={{
        '--aspect': aspect,
        '--hue': hue,
        '--chroma': chroma
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
      {children
        ? (
          <span className={styles.slot} style={{ zIndex: n + 1 }}>
            {children}
          </span>
          )
        : label && (
          <span
            className={styles.label}
            style={{
              zIndex: n + 1,
              color: labelColor,
              fontSize: `${fontSize}px`,
              letterSpacing: `${0.22 * fontSize}px`
            }}
          >
            {label}
          </span>
        )}
    </button>
  )
}

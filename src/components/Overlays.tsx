import { useEffect, useLayoutEffect, useRef } from 'react'
import type { CSSProperties, ElementType, ReactNode } from 'react'
import carroData from '../data/carro-points.json'
import { clamp01, carroProgress, scrollStore, smooth } from '../store'

const CARRO_SEGMENT = 1 / Math.max(carroData.cameraViews.length - 1, 1)

type Visibility = { amount: number; blur: number }

/**
 * A scroll-driven overlay. Visibility is written straight to the DOM node
 * (opacity / blur / visibility / aria-hidden) so scrolling never re-renders React.
 */
function ScrollReveal({
  as: Tag = 'section',
  className,
  label,
  compute,
  children,
}: {
as?: ElementType
className: string
  label?: string
  compute: (progress: number) => Visibility
  children: ReactNode
}) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    return scrollStore.subscribe((p) => {
      const { amount, blur } = compute(carroProgress(p))
      const visible = amount > 0.01
      node.style.opacity = visible ? String(amount) : '0'
      node.style.visibility = visible ? 'visible' : 'hidden'
      node.style.filter = visible && blur > 0.2 ? `blur(${blur.toFixed(2)}px)` : 'none'
      node.setAttribute('aria-hidden', visible ? 'false' : 'true')
    })
  }, [compute])

  return (
    <Tag ref={ref} className={className} aria-label={label} style={{ opacity: 0, visibility: 'hidden' } as CSSProperties}>
      {children}
    </Tag>
  )
}

const windowed = (value: number, inStart: number, inEnd: number, outStart?: number, outEnd?: number): Visibility => {
  const reveal = smooth(value, inStart, inEnd)
  const fade = outStart === undefined || outEnd === undefined ? 1 : 1 - smooth(value, outStart, outEnd)
  return { amount: reveal * fade, blur: (1 - reveal) * 12 + (1 - fade) * 12 }
}

const L = CARRO_SEGMENT

const computePlatform = (p: number) => windowed(p, L, L + L * 0.22, L * 1.6 - L * 0.28, L * 1.6)
const computeStats = (p: number) => windowed(p, L * 1.75, L * 2.05, L * 2.5, L * 2.9)
const computeEnterprise = (p: number) => windowed(p, L * 2.85, L * 3.03, L * 3.6, L * 3.95)
const computeFinal = (p: number) => windowed(p, L * 4.7, L * 4.96)
const computeNarrative = (p: number) => windowed(p, L * 3.0, L * 3.3, L * 4.65, L * 5.05)
export function OttonomyCallout() {
  return (
    <ScrollReveal className="platform-callout" compute={computePlatform} label="Autonomous delivery platform">
      <div className="platform-callout-copy">
        <span className="platform-callout-label">Autonomous delivery platform</span>
        <p>
          Ottonomy robots help organizations move medicines, lab samples, retail packages, and critical materials
          autonomously—curbside, across campuses, and within facilities.
        </p>
      </div>
    </ScrollReveal>
  )
}

const statistics = [
  ['4', 'Industries served', 'people'],
  ['4', 'Types of critical deliveries', 'brain'],
  ['3', 'Delivery environments', 'time'],
  ['24/7', 'Designed for continuous operations', 'heart'],
  ['1', 'Autonomous delivery layer', 'pulse'],
  ['∞', 'Routes across your operation', 'hospital'],
] as const

export function DeliveryHighlights() {
  return (
    <ScrollReveal className="delivery-highlights" compute={computeStats} label="Autonomous delivery at a glance">
      <h2>
        Autonomous delivery <strong>at a glance</strong>
      </h2>
      <div className="stats-grid">
        {statistics.map(([value, label, icon]) => (
          <article className="stat-card" key={value}>
            <h3>{value}</h3>
            <p>{label}</p>
            <div className="stat-icon-wrap">
              <span className={`stat-icon stat-icon-${icon}`} aria-hidden="true" />
            </div>
          </article>
        ))}
      </div>
    </ScrollReveal>
  )
}

export function EnterpriseCallout() {
  return (
    <ScrollReveal className="enterprise-callout" compute={computeEnterprise} label="Delivery across every environment">
      <span className="callout-label">Built for every environment</span>
      <h2>From curbside to the center of the campus</h2>
      <p>
        Ottonomy’s autonomous robots are designed to connect the last mile with the places where work happens:
        hospitals, stores, distribution points, and enterprise facilities.
      </p>
      <p>
        Integrate delivery into existing operations to help teams focus on higher-value work while goods keep moving.
      </p>
    </ScrollReveal>
  )
}

export function ReliabilityCallout() {
  return (
    <ScrollReveal className="final-callout" compute={computeFinal} label="Reliable autonomous delivery">
      <span className="callout-label">The next handoff</span>
      <h2>More efficiency. More reliability. Less friction.</h2>
      <p>
        Give every delivery a dependable path with autonomous mobility that scales from a single facility to an entire
        network of locations.
      </p>
    </ScrollReveal>
  )
}

export function CarroNarrative() {
  return (
    <ScrollReveal className="carro-narrative" compute={computeNarrative} label="Autonomy in motion">
      <span className="carro-narrative-label">Autonomy in motion</span>
      <h2>Every delivery has a destination.</h2>
      <p>
        See how a flexible robotic fleet can move through real-world environments and make the final handoff feel
        effortless.
      </p>
    </ScrollReveal>
  )
}

/** Hero wordmark: travels from centre to top-left using transform only (no layout thrash). */
export function BrandMark() {
  const ref = useRef<HTMLHeadingElement>(null)
  const size = useRef({ width: 0, height: 0 })

  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return

    const apply = (p: number) => {
      const wp = carroProgress(p)
      const move = smooth(wp, L * 0.4, L * 1.15)
      const blurIn = smooth(wp, L * 0.4, L * 0.7)
      const blurOut = smooth(wp, L * 0.7, L * 1.15)
      const blur = Math.max(0, blurIn - blurOut) * 14
      const scale = 1 - move * 0.52
      const vw = window.innerWidth
      const vh = window.innerHeight
      const { width, height } = size.current
      const x = (vw - width) / 2 + (vw * 0.03 - (vw - width) / 2) * move
      const y = (vh - height) / 2 + (vh * 0.035 - (vh - height) / 2) * move
      node.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${scale.toFixed(4)})`
      node.style.filter = blur > 0.2 ? `blur(${blur.toFixed(2)}px)` : 'none'
    }

    const measure = () => {
      size.current = { width: node.offsetWidth, height: node.offsetHeight }
      apply(scrollStore.value)
    }
    measure()
    const resize = new ResizeObserver(measure)
    resize.observe(node)
    window.addEventListener('resize', measure)
    document.fonts?.ready.then(measure)
    const unsubscribe = scrollStore.subscribe(apply)
    return () => {
      resize.disconnect()
      window.removeEventListener('resize', measure)
      unsubscribe()
    }
  }, [])

  return (
    <h1 className="brand-mark" ref={ref} aria-label="Ottonomy">
      <span className="brand-mark-text" aria-hidden="true">
        Ottonomy
      </span>
    </h1>
  )
}

/** Thin progress rail + scroll cue. */
export function ProgressChrome() {
  const rail = useRef<HTMLDivElement>(null)
  const cue = useRef<HTMLDivElement>(null)

  useEffect(
    () =>
      scrollStore.subscribe((p) => {
        if (rail.current) rail.current.style.transform = `scaleX(${clamp01(p)})`
        if (cue.current) {
          const o = 1 - smooth(p, 0.003, 0.03)
          cue.current.style.opacity = String(o)
          cue.current.style.visibility = o > 0.01 ? 'visible' : 'hidden'
        }
      }),
    [],
  )

  return (
    <>
      <div className="progress-rail" ref={rail} aria-hidden="true" />
      <div className="scroll-cue" ref={cue} aria-hidden="true">
        <span>Scroll</span>
        <i />
      </div>
    </>
  )
}

import { useEffect, useLayoutEffect, useRef } from 'react'
import type { CSSProperties, ElementType, ReactNode } from 'react'
import watchData from '../data/watch-points.json'
import vienData from '../data/vien-points.json'
import { clamp01, scrollStore, smooth, vienProgress, watchProgress } from '../store'

const WATCH_SEGMENT = 1 / Math.max(watchData.cameraViews.length - 1, 1)
const VIEN_SEGMENT = 1 / Math.max(vienData.cameraViews.length - 1, 1)

type Phase = 'watch' | 'vien'
type Visibility = { amount: number; blur: number }

/**
 * A scroll-driven overlay. Visibility is written straight to the DOM node
 * (opacity / blur / visibility / aria-hidden) so scrolling never re-renders React.
 */
function ScrollReveal({
  as: Tag = 'section',
  phase = 'watch',
  className,
  label,
  compute,
  children,
}: {
  as?: ElementType
  phase?: Phase
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
      const local = phase === 'watch' ? watchProgress(p) : vienProgress(p)
      const inPhase = phase === 'watch' ? p < 0.52 : p > 0.48
      const { amount, blur } = compute(local)
      const visible = inPhase && amount > 0.01
      node.style.opacity = visible ? String(amount) : '0'
      node.style.visibility = visible ? 'visible' : 'hidden'
      node.style.filter = visible && blur > 0.2 ? `blur(${blur.toFixed(2)}px)` : 'none'
      node.setAttribute('aria-hidden', visible ? 'false' : 'true')
    })
  }, [compute, phase])

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

const L = WATCH_SEGMENT

const computeMedical = (p: number) => windowed(p, L, L + L * 0.22, L * 1.6 - L * 0.28, L * 1.6)
const computeStats = (p: number) => windowed(p, L * 1.75, L * 2.05, L * 2.5, L * 2.9)
const computeClinical = (p: number) => windowed(p, L * 2.85, L * 3.03, L * 3.6, L * 3.95)
const computeFinal = (p: number) => windowed(p, L * 4.7, L * 4.96)
const computeNarrative = (p: number) => windowed(p, L * 3.0, L * 3.3, L * 4.65, L * 5.05)
const computeVien = (p: number) =>
  windowed(p, VIEN_SEGMENT * 1.65, VIEN_SEGMENT * 1.9, VIEN_SEGMENT * 2.6, VIEN_SEGMENT * 2.85)

export function MedicalCallout() {
  return (
    <ScrollReveal className="medical-callout" compute={computeMedical} label="Wearable neuromodulation platform">
      <div className="medical-callout-copy">
        <span className="medical-callout-label">Wearable neuromodulation platform</span>
        <p>
          StimCardio Medical is developing a non-invasive, wearable neuromodulation platform that integrates continuous
          physiological sensing with personalized therapy, designed for use in everyday life, beginning with atrial
          fibrillation.
        </p>
      </div>
    </ScrollReveal>
  )
}

const statistics = [
  ['52.5M+', 'People worldwide', 'people'],
  ['~5×', 'Increased risk of ischemic stroke', 'brain'],
  ['1 in 3–5', 'Lifetime risk after age 40', 'time'],
  ['>60%', 'AF recurrence within one year', 'heart'],
  ['$36B', 'Annual healthcare cost in the U.S.', 'pulse'],
  ['~500K', 'AF-related hospitalizations each year', 'hospital'],
] as const

export function AfibStatistics() {
  return (
    <ScrollReveal className="afib-statistics" compute={computeStats} label="Atrial Fibrillation by the Numbers">
      <h2>
        Atrial Fibrillation <strong>by the Numbers</strong>
        <sup>2</sup>
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

export function ClinicalResearchCallout() {
  return (
    <ScrollReveal className="clinical-callout" compute={computeClinical} label="Clinical research">
      <span className="clinical-callout-label">Clinical research</span>
      <h2>Advancing neuromodulation through clinical research</h2>
      <p>
        StimCardio Medical is conducting a structured, multi-stage clinical program to evaluate its non-invasive,
        wearable neuromodulation platform.
      </p>
      <p>
        Studies assess feasibility, safety, usability, physiological effects, and clinical efficacy, with atrial
        fibrillation as the lead indication.
      </p>
    </ScrollReveal>
  )
}

export function FinalCallout() {
  return (
    <ScrollReveal className="final-callout" compute={computeFinal} label="Personalized neuromodulation">
      <span className="clinical-callout-label">The next signal</span>
      <h2>Personalized neuromodulation for everyday life</h2>
      <p>
        StimCardio is advancing a non-invasive, wearable platform designed to sense each person’s physiology and
        deliver personalized therapy for the future of atrial fibrillation care.
      </p>
    </ScrollReveal>
  )
}

export function WatchNarrative() {
  return (
    <ScrollReveal className="watch-narrative" compute={computeNarrative} label="Personalized cardiac sensing">
      <span className="watch-narrative-label">A closer signal</span>
      <h2>Every heartbeat carries information.</h2>
      <p>
        Continuous sensing helps reveal the rhythms, patterns, and moments that shape each person’s experience of
        atrial fibrillation.
      </p>
    </ScrollReveal>
  )
}

export function VienNarrative() {
  return (
    <ScrollReveal className="vien-narrative" phase="vien" compute={computeVien} label="A wearable signal">
      <span className="vien-narrative-label">A wearable signal</span>
      <p>
        Designed to move with the body, Vienna brings sensing and personalized neuromodulation closer to everyday
        cardiac care.
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
      const wp = watchProgress(p)
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
    <h1 className="brand-mark" ref={ref} aria-label="StimCardio">
      <span className="brand-mark-text" aria-hidden="true">
        StimCardio
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

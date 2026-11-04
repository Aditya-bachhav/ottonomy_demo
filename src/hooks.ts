import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import Lenis from 'lenis'
import { clamp01, pointerStore, prefersReducedMotion, scrollStore } from './store'
import { lenisRef } from './lenis'

/** Drives Lenis and pushes stage progress into the external store. */
export function useLenisScroll(stageRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const reduced = prefersReducedMotion()
    const lenis = new Lenis({
      autoRaf: false,
      lerp: reduced ? 1 : 0.045,
      duration: 1.8,
      easing: (value) => 1 - Math.pow(1 - value, 4),
      smoothWheel: !reduced,
      syncTouch: !reduced,
      wheelMultiplier: 0.68,
      touchMultiplier: 1,
    })
    lenisRef.current = lenis
    let frame = 0

    const update = () => {
      const stage = stageRef.current
      if (!stage) return
      const top = stage.getBoundingClientRect().top + window.scrollY
      const range = Math.max(stage.offsetHeight - window.innerHeight, 1)
      scrollStore.set(clamp01((window.scrollY - top) / range))
    }

    lenis.on('scroll', update)
    window.addEventListener('resize', update)
    update()
    const raf = (time: number) => {
      lenis.raf(time)
      frame = requestAnimationFrame(raf)
    }
    frame = requestAnimationFrame(raf)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', update)
      lenis.off('scroll', update)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [stageRef])
}

/** Normalised pointer (-1..1) written to a plain object — no re-renders. */
export function usePointerMotion() {
  useEffect(() => {
    if (prefersReducedMotion() || !window.matchMedia('(pointer: fine)').matches) return
    const update = (event: PointerEvent) => {
      pointerStore.x = Math.max(-1, Math.min(1, (event.clientX / window.innerWidth) * 2 - 1))
      pointerStore.y = Math.max(-1, Math.min(1, (event.clientY / window.innerHeight) * 2 - 1))
    }
    window.addEventListener('pointermove', update, { passive: true })
    return () => window.removeEventListener('pointermove', update)
  }, [])
}

/** Boolean that only re-renders when scroll progress crosses a threshold. */
export function useScrollAbove(threshold: number) {
  const [above, setAbove] = useState(false)
  useEffect(() => scrollStore.subscribe((p) => setAbove(p >= threshold)), [threshold])
  return above
}

/** Fade sections in as they enter the viewport. */
export function useInView<T extends HTMLElement>(options: IntersectionObserverInit = { threshold: 0.18 }) {
  const ref = useRef<T>(null)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (!('IntersectionObserver' in window)) {
      node.classList.add('is-in')
      return
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        node.classList.add('is-in')
        observer.disconnect()
      }
    }, options)
    observer.observe(node)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return ref
}

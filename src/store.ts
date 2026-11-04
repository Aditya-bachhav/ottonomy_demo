import * as THREE from 'three'

type Listener = (progress: number) => void

/**
 * Tiny external store for scroll progress. Scroll (60+ events/sec) never
 * touches React state: the WebGL scene reads `scrollStore.value` inside
 * useFrame and DOM overlays subscribe and write styles directly.
 */
export const scrollStore = {
  value: 0,
  listeners: new Set<Listener>(),
  set(next: number) {
    this.value = next
    this.listeners.forEach((listener) => listener(next))
  },
  subscribe(listener: Listener) {
    this.listeners.add(listener)
    listener(this.value)
    return () => {
      this.listeners.delete(listener)
    }
  },
}

export const pointerStore = { x: 0, y: 0 }

export const smooth = THREE.MathUtils.smoothstep
export const clamp01 = (value: number) => THREE.MathUtils.clamp(value, 0, 1)

/** Frame-rate independent exponential smoothing factor. */
export const ease = (lambda: number, delta: number) => 1 - Math.exp(-lambda * delta)

/** Scroll progress of the whole cinematic stage -> per-model progress. */
export const watchProgress = (p: number) => clamp01(p * 2)
export const vienProgress = (p: number) => clamp01((p - 0.5) * 2)

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

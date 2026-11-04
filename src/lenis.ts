import Lenis from 'lenis'

/** Shared Lenis instance so anchor links can use smooth scrolling. */
export const lenisRef: { current: Lenis | null } = { current: null }

export function scrollToTarget(target: string | number, immediate = false) {
  const lenis = lenisRef.current
  if (lenis) {
    lenis.scrollTo(target, { duration: immediate ? 0 : 2.2, easing: (t) => 1 - Math.pow(1 - t, 4), offset: 0 })
    return
  }
  if (typeof target === 'number') window.scrollTo({ top: target })
  else document.querySelector(target)?.scrollIntoView()
}

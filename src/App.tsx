import { useCallback, useEffect, useRef, useState } from 'react'
import { useLenisScroll, usePointerMotion } from './hooks'
import { lenisRef, scrollToTarget } from './lenis'
import { scrollStore, smooth } from './store'
import Scene from './components/Scene'
import { Loader, SceneBoundary } from './components/Chrome'
import { Navbar, PostModelLayout, SiteFooter } from './components/Sections'
import {
  BrandMark,
  DeliveryHighlights,
  EnterpriseCallout,
  OttonomyCallout,
  ReliabilityCallout,
  ProgressChrome,
  CarroNarrative,
} from './components/Overlays'

export default function App() {
  const stageRef = useRef<HTMLElement>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [sceneFailed, setSceneFailed] = useState(false)
  const handleDone = useCallback(() => setReady(true), [])
  const handleError = useCallback(() => setSceneFailed(true), [])

  useLenisScroll(stageRef)
  usePointerMotion()

  // Fade the fixed cinematic layer out as the story hands over to the page.
  useEffect(
    () =>
      scrollStore.subscribe((p) => {
        const layer = layerRef.current
        if (!layer) return
        const opacity = 1 - smooth(p, 0.94, 1)
        layer.style.opacity = String(opacity)
        layer.style.visibility = opacity < 0.005 ? 'hidden' : 'visible'
      }),
    [],
  )

  // Hold scrolling until the loader has finished.
  useEffect(() => {
    const lenis = lenisRef.current
    if (!lenis) return
    if (ready) lenis.start()
    else lenis.stop()
  }, [ready])

  // Smooth in-page anchors via Lenis.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]')
      if (!link) return
      const hash = link.getAttribute('href') ?? ''
      event.preventDefault()
      if (hash === '#home' || hash === '#') scrollToTarget(0)
      else if (document.querySelector(hash)) scrollToTarget(hash)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  // Land on a clean start; the story is scroll-driven.
  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
    window.scrollTo(0, 0)
    scrollStore.set(0)
  }, [])

  return (
    <main id="home" className={ready ? 'is-ready' : ''}>
      <a className="skip-link" href="#about">
        Skip to content
      </a>
      <Loader forceDone={sceneFailed} onDone={handleDone} />
      <Navbar />
      <ProgressChrome />
      <section className="scroll-stage" ref={stageRef} aria-label="Ottonomy autonomous delivery story">
        <div className="cinematic-layer" ref={layerRef}>
          <div className="scene">
            <SceneBoundary onError={handleError}>
              <Scene />
            </SceneBoundary>
          </div>
          <div className="model-content">
            <BrandMark />
            <OttonomyCallout />
            <DeliveryHighlights />
            <EnterpriseCallout />
            <ReliabilityCallout />
            <CarroNarrative />
          </div>
          <div className="grain-overlay" aria-hidden="true" />
        </div>
      </section>
      <PostModelLayout />
      <SiteFooter />
    </main>
  )
}

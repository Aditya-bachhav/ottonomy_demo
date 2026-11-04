import { Component, useEffect, useState } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { useProgress } from '@react-three/drei'

/** Catches WebGL / model failures so the page still works without the 3D scene. */
export class SceneBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('3D scene unavailable:', error, info.componentStack)
    this.props.onError()
  }
  render() {
    return this.state.failed ? <div className="scene-fallback" aria-hidden="true" /> : this.props.children
  }
}

export function Loader({ forceDone, onDone }: { forceDone: boolean; onDone: () => void }) {
  const { progress } = useProgress()
  const [hidden, setHidden] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (forceDone) {
      setReady(true)
      return
    }
    if (progress >= 100) setReady(true)
  }, [progress, forceDone])

  // Never trap the visitor behind the loader on a slow or failing connection.
  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 2200)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!ready) return
    onDone()
    const timer = window.setTimeout(() => setHidden(true), 1100)
    return () => window.clearTimeout(timer)
  }, [ready, onDone])

  if (hidden) return null
  const value = Math.round(forceDone ? 100 : Math.min(progress, 92))

  return (
    <div className={`loader${ready ? ' is-done' : ''}`} role="status" aria-live="polite">
      <span className="loader__name">Ottonomy</span>
      <div className="loader__bar" aria-hidden="true">
        <i style={{ transform: `scaleX(${value / 100})` }} />
      </div>
      <span className="loader__count">{ready ? 'Ready' : `Preparing route ${String(value).padStart(2, '0')}%`}</span>
    </div>
  )
}

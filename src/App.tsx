import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { useEffect, useMemo, useRef, useState } from 'react'
import Lenis from 'lenis'
import * as THREE from 'three'
import type { Group } from 'three'
import type { RefObject } from 'react'
import motionData from '../watch-points.json'
import vienMotionData from '../model/vien-points.json'

type VectorKeyframe = { x: number; y: number; z: number }
type CameraView = {
  position: VectorKeyframe
  target: VectorKeyframe
  fov: number
}
type MotionData = {
  points: VectorKeyframe[]
  angles: VectorKeyframe[]
  cameraViews: CameraView[]
}

type RenderMaterial = THREE.Material & {
  wireframe?: boolean
  emissive?: THREE.Color
  emissiveIntensity?: number
}

type MaterialPair = {
  solid: RenderMaterial
  wireframe: RenderMaterial
  baseOpacity: number
}

const defaultMotion: MotionData = { points: [], angles: [], cameraViews: [] }

function useScrollProgress(stageRef: RefObject<HTMLElement | null>) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const lenis = new Lenis({
      autoRaf: false,
      lerp: 0.045,
      duration: 1.8,
      easing: (value) => 1 - Math.pow(1 - value, 4),
      smoothWheel: true,
      syncTouch: true,
      wheelMultiplier: 0.68,
      touchMultiplier: 1,
    })
    let frame = 0

    const update = () => {
      const stage = stageRef.current
      if (!stage) return
      const scrollRange = Math.max(stage.offsetHeight - window.innerHeight, 1)
      setProgress(THREE.MathUtils.clamp((window.scrollY - stage.offsetTop) / scrollRange, 0, 1))
    }

    lenis.on('scroll', update)
    update()
    const raf = (time: number) => {
      lenis.raf(time)
      frame = requestAnimationFrame(raf)
    }
    frame = requestAnimationFrame(raf)

    return () => {
      cancelAnimationFrame(frame)
      lenis.off('scroll', update)
      lenis.destroy()
    }
  }, [stageRef])

  return progress
}

function usePointerMotion() {
  const [pointer, setPointer] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const update = (event: PointerEvent) => {
      setPointer({
        x: THREE.MathUtils.clamp((event.clientX / window.innerWidth) * 2 - 1, -1, 1),
        y: THREE.MathUtils.clamp((event.clientY / window.innerHeight) * 2 - 1, -1, 1),
      })
    }

    window.addEventListener('pointermove', update, { passive: true })
    return () => window.removeEventListener('pointermove', update)
  }, [])

  return pointer
}

function sampleKeyframes<T>(keyframes: T[], progress: number, interpolate: (from: T, to: T, amount: number) => T) {
  if (keyframes.length === 0) return undefined
  if (keyframes.length === 1) return keyframes[0]

  const scaled = THREE.MathUtils.clamp(progress, 0, 1) * (keyframes.length - 1)
  const index = Math.min(Math.floor(scaled), keyframes.length - 2)
  const linearAmount = scaled - index
  const easedAmount = linearAmount * linearAmount * linearAmount * (linearAmount * (linearAmount * 6 - 15) + 10)
  return interpolate(keyframes[index], keyframes[index + 1], easedAmount)
}

function Watch({ motion, progress, pointer }: { motion: MotionData; progress: number; pointer: { x: number; y: number } }) {
  const { scene } = useGLTF('/model/watch.glb')
  const watch = useMemo(() => scene.clone(), [scene])
  const trail = useMemo(() => scene.clone(), [scene])
  const group = useRef<Group>(null)
  const trailGroup = useRef<Group>(null)
  const materialPairs = useRef<MaterialPair[]>([])
  const trailMaterials = useRef<RenderMaterial[]>([])
  const desiredPosition = useMemo(() => new THREE.Vector3(), [])
  const desiredRotation = useMemo(() => new THREE.Euler(), [])
  const previousPosition = useMemo(() => new THREE.Vector3(), [])
  const previousRotation = useMemo(() => new THREE.Euler(), [])

  const position = sampleKeyframes(motion.points, progress, (from, to, amount) => ({
    x: THREE.MathUtils.lerp(from.x, to.x, amount),
    y: THREE.MathUtils.lerp(from.y, to.y, amount),
    z: THREE.MathUtils.lerp(from.z, to.z, amount),
  }))
  const rotation = sampleKeyframes(motion.angles, progress, (from, to, amount) => ({
    x: THREE.MathUtils.lerp(from.x, to.x, amount),
    y: THREE.MathUtils.lerp(from.y, to.y, amount),
    z: THREE.MathUtils.lerp(from.z, to.z, amount),
  }))

  useEffect(() => {
    materialPairs.current = []
    const meshes: THREE.Mesh[] = []
    watch.traverse((object) => {
      if (object instanceof THREE.Mesh) meshes.push(object)
    })

    meshes.forEach((object) => {
      object.castShadow = true
      object.receiveShadow = true
      const meshMaterials = Array.isArray(object.material) ? object.material : [object.material]
        const solidMaterials = meshMaterials.map((material) => material.clone() as RenderMaterial)
        const wireframeMaterials = meshMaterials.map((material) => {
          const wireframeMaterial = material.clone() as RenderMaterial
          wireframeMaterial.wireframe = true
          wireframeMaterial.transparent = true
          wireframeMaterial.depthWrite = false
          if (wireframeMaterial.emissive) {
            wireframeMaterial.emissive = new THREE.Color('#bfe9ff')
            wireframeMaterial.emissiveIntensity = 2.5
          }
          return wireframeMaterial
        })

        object.material = Array.isArray(object.material) ? solidMaterials : solidMaterials[0]
        const wireframeMesh = new THREE.Mesh(object.geometry, Array.isArray(object.material) ? wireframeMaterials : wireframeMaterials[0])
        wireframeMesh.name = `${object.name}-wireframe`
        wireframeMesh.frustumCulled = false
        object.add(wireframeMesh)
        solidMaterials.forEach((solid, index) => {
          materialPairs.current.push({
            solid,
            wireframe: wireframeMaterials[index],
            baseOpacity: solid.opacity,
          })
        })
    })

    trailMaterials.current = []
    trail.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      const clonedMaterials = materials.map((material) => {
        const clone = material.clone() as RenderMaterial
        clone.transparent = true
        clone.depthWrite = false
        clone.opacity = 0
        return clone
      })
      object.material = Array.isArray(object.material) ? clonedMaterials : clonedMaterials[0]
      trailMaterials.current.push(...clonedMaterials)
    })
  }, [watch])

  useFrame(() => {
    if (group.current) {
      desiredPosition.set(
        (position?.x ?? 0) + pointer.x * 0.018,
        (position?.y ?? 0) - pointer.y * 0.012,
        position?.z ?? 0,
      )
      desiredRotation.set(
        (rotation?.x ?? 0) + pointer.y * 0.035,
        (rotation?.y ?? 0) + pointer.x * 0.055,
        (rotation?.z ?? 0) - pointer.x * 0.012,
      )
      group.current.position.lerp(desiredPosition, 0.08)
      group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, desiredRotation.x, 4, 1 / 60)
      group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, desiredRotation.y, 4, 1 / 60)
      group.current.rotation.z = THREE.MathUtils.damp(group.current.rotation.z, desiredRotation.z, 4, 1 / 60)

      if (trailGroup.current) {
        const movement = group.current.position.distanceTo(previousPosition)
        const rotationMovement =
          Math.abs(group.current.rotation.x - previousRotation.x) +
          Math.abs(group.current.rotation.y - previousRotation.y) +
          Math.abs(group.current.rotation.z - previousRotation.z)
        const trailOpacity = THREE.MathUtils.clamp((movement + rotationMovement * 0.25) * 2.8, 0, 0.16)
        trailGroup.current.position.lerp(group.current.position, 0.18)
        trailGroup.current.rotation.x = THREE.MathUtils.damp(trailGroup.current.rotation.x, group.current.rotation.x, 3, 1 / 60)
        trailGroup.current.rotation.y = THREE.MathUtils.damp(trailGroup.current.rotation.y, group.current.rotation.y, 3, 1 / 60)
        trailGroup.current.rotation.z = THREE.MathUtils.damp(trailGroup.current.rotation.z, group.current.rotation.z, 3, 1 / 60)
        trailMaterials.current.forEach((material) => {
          material.opacity = trailOpacity
        })
        previousPosition.copy(group.current.position)
        previousRotation.copy(group.current.rotation)
      }
    }

    const viewFiveProgress = 4 / Math.max(motion.cameraViews.length - 1, 1)
    const viewSixProgress = 5 / Math.max(motion.cameraViews.length - 1, 1)
    const wireframeAmount =
      progress < viewFiveProgress
        ? THREE.MathUtils.smoothstep(
            progress,
            viewFiveProgress - 1.4 / Math.max(motion.cameraViews.length - 1, 1),
            viewFiveProgress,
          )
        : 1 -
          THREE.MathUtils.smoothstep(
            progress,
            viewFiveProgress,
            viewSixProgress + 0.15 / Math.max(motion.cameraViews.length - 1, 1),
          )

    materialPairs.current.forEach(({ solid, wireframe, baseOpacity }) => {
      solid.transparent = wireframeAmount > 0.001
      solid.opacity = baseOpacity * (1 - wireframeAmount)
      wireframe.opacity = wireframeAmount
    })
  })

  return (
    <>
      <group ref={trailGroup} scale={0.998}>
        <primitive object={trail} />
      </group>
      <group ref={group}>
      <primitive object={watch} />
      </group>
    </>
  )
}

function Vien({ progress, pointer }: { progress: number; pointer: { x: number; y: number } }) {
  const { scene } = useGLTF('/model/vien.glb')
  const vien = useMemo(() => scene.clone(), [scene])
  const wireVien = useMemo(() => scene.clone(), [scene])
  const group = useRef<Group>(null)
  const bounds = useMemo(() => {
    vien.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(vien)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    vien.position.sub(center)
    return { scale: 2.4 / Math.max(size.x, size.y, size.z) }
  }, [vien])
  const desiredRotation = useMemo(() => new THREE.Euler(), [])

  useEffect(() => {
    wireVien.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material]
      const wireframeMaterials = sourceMaterials.map((source) => {
        const material = source.clone() as RenderMaterial
        material.wireframe = true
        material.transparent = true
        material.depthWrite = false
        if (material.emissive) {
          material.emissive = new THREE.Color('#aeeeff')
          material.emissiveIntensity = 3
        }
        return material
      })
      object.material = Array.isArray(object.material) ? wireframeMaterials : wireframeMaterials[0]
      object.renderOrder = 2
    })
  }, [wireVien])

  useFrame(() => {
    if (!group.current) return
    desiredRotation.set(pointer.y * 0.02, Math.PI / 2 + pointer.x * 0.03, Math.PI / 2)
    group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, desiredRotation.x, 3.5, 1 / 60)
    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, desiredRotation.y, 3.5, 1 / 60)
    group.current.rotation.z = THREE.MathUtils.damp(group.current.rotation.z, desiredRotation.z, 3.5, 1 / 60)
    group.current.position.y = THREE.MathUtils.damp(group.current.position.y, Math.sin(progress * Math.PI) * 0.025, 2.5, 1 / 60)
    wireVien.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.forEach((material) => {
        material.opacity = 0.52 + Math.sin(progress * Math.PI) * 0.18
      })
    })
  })

  return (
    <group ref={group} scale={bounds.scale}>
      <primitive object={vien} />
      <primitive object={wireVien} />
    </group>
  )
}

function CameraMotion({ motion, progress }: { motion: MotionData; progress: number }) {
  const { camera } = useThree()
  const target = useMemo(() => new THREE.Vector3(), [])
  const desiredPosition = useMemo(() => new THREE.Vector3(), [])
  const desiredTarget = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    const view = sampleKeyframes(motion.cameraViews, progress, (from, to, amount) => ({
      position: {
        x: THREE.MathUtils.lerp(from.position.x, to.position.x, amount),
        y: THREE.MathUtils.lerp(from.position.y, to.position.y, amount),
        z: THREE.MathUtils.lerp(from.position.z, to.position.z, amount),
      },
      target: {
        x: THREE.MathUtils.lerp(from.target.x, to.target.x, amount),
        y: THREE.MathUtils.lerp(from.target.y, to.target.y, amount),
        z: THREE.MathUtils.lerp(from.target.z, to.target.z, amount),
      },
      fov: THREE.MathUtils.lerp(from.fov, to.fov, amount),
    }))
    if (!view || !(camera instanceof THREE.PerspectiveCamera)) return

    desiredPosition.set(view.position.x, view.position.y, view.position.z)
    desiredTarget.set(view.target.x, view.target.y, view.target.z)
    camera.position.lerp(desiredPosition, 0.075)
    target.lerp(desiredTarget, 0.075)
    camera.lookAt(target)
    camera.fov = view.fov
    camera.updateProjectionMatrix()
  })

  return null
}

function Scene({
  motion,
  progress,
  vienProgress,
  pointer,
}: {
  motion: MotionData
  progress: number
  vienProgress: number
  pointer: { x: number; y: number }
}) {
  const watchPhase = progress < 0.5
  const cameraMotion = watchPhase ? motion : vienMotionData
  const cameraProgress = watchPhase ? progress * 2 : vienProgress

  return (
    <Canvas
      camera={{ position: [3.1, -0.45, -0.18], fov: 45 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      shadows
    >
      <ambientLight intensity={1.5} />
      <directionalLight position={[4, 5, 3]} intensity={3} castShadow />
      <directionalLight position={[-3, -2, -4]} intensity={1.2} />
      {watchPhase && <Watch motion={motion} progress={progress * 2} pointer={pointer} />}
      {!watchPhase && <Vien progress={vienProgress} pointer={pointer} />}
      <CameraMotion motion={cameraMotion} progress={cameraProgress} />
      <EffectComposer multisampling={4}>
        <Bloom
          intensity={1.15}
          luminanceSmoothing={0.82}
          luminanceThreshold={0.45}
          mipmapBlur
          radius={0.72}
        />
      </EffectComposer>
    </Canvas>
  )
}

function BrandMark({ progress }: { progress: number }) {
  const viewLength = 1 / Math.max(motionData.cameraViews.length - 1, 1)
  const transitionStart = viewLength * 0.4
  const transitionMiddle = viewLength * 0.7
  const transitionEnd = viewLength * 1.15
  const moveAmount = THREE.MathUtils.smoothstep(progress, transitionStart, transitionEnd)
  const blurIn = THREE.MathUtils.smoothstep(progress, transitionStart, transitionMiddle)
  const blurOut = THREE.MathUtils.smoothstep(progress, transitionMiddle, transitionEnd)
  const blur = Math.max(0, blurIn - blurOut) * 14
  const left = THREE.MathUtils.lerp(50, 3, moveAmount)
  const top = THREE.MathUtils.lerp(50, 3, moveAmount)
  const scale = THREE.MathUtils.lerp(1, 0.48, moveAmount)
  const translateX = THREE.MathUtils.lerp(-50, 0, moveAmount)
  const translateY = THREE.MathUtils.lerp(-50, 0, moveAmount)

  return (
    <div
      className="brand-mark"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        filter: `blur(${blur}px)`,
        fontSize: `${scale * 2.8}rem`,
        transform: `translate(${translateX}%, ${translateY}%)`,
      }}
    >
      <span className="brand-mark-text">StrimCardio</span>
    </div>
  )
}

function MedicalCallout({ progress }: { progress: number }) {
  const viewLength = 1 / Math.max(motionData.cameraViews.length - 1, 1)
  const start = viewLength
  const end = viewLength * 1.6
  const reveal = THREE.MathUtils.smoothstep(progress, start, start + viewLength * 0.22)
  const disappear = 1 - THREE.MathUtils.smoothstep(progress, end - viewLength * 0.28, end)
  const visibility = reveal * disappear
  const blur = (1 - reveal) * 12 + (1 - disappear) * 12

  return (
    <div
      className="medical-callout"
      style={{ opacity: visibility, filter: `blur(${blur}px)` }}
    >
      <div className="medical-callout-copy">
        <span className="medical-callout-label">Wearable neuromodulation platform</span>
        <p>
          StimCardio Medical is developing a non-invasive, wearable neuromodulation platform that integrates continuous
          physiological sensing with personalized therapy, designed for use in everyday life, beginning with atrial
          fibrillation.
        </p>
      </div>
    </div>
  )
}

const statistics = [
  ['52.5M+', 'People worldwide', 'people'],
  ['~5×', 'Increased risk of ischemic stroke', 'brain'],
  ['1 in 3-5', 'Lifetime risk after age 40', 'time'],
  ['>60%', 'AF recurrence within one year', 'heart'],
  ['$36B', 'Annual healthcare cost in the U.S.', 'pulse'],
  ['~500K AF', 'Related hospitalizations each year', 'hospital'],
] as const

function StatIcon({ type }: { type: (typeof statistics)[number][2] }) {
  return <span className={`stat-icon stat-icon-${type}`} aria-hidden="true" />
}

function AfibStatistics({ progress }: { progress: number }) {
  const viewLength = 1 / Math.max(motionData.cameraViews.length - 1, 1)
  const reveal = THREE.MathUtils.smoothstep(progress, viewLength * 1.75, viewLength * 2.05)
  const fade = 1 - THREE.MathUtils.smoothstep(progress, viewLength * 2.5, viewLength * 2.9)
  const blur = (1 - reveal) * 12 + (1 - fade) * 12

  return (
    <section
      className="afib-statistics"
      style={{ opacity: reveal * fade, filter: `blur(${blur}px)` }}
      aria-label="Atrial Fibrillation by the Numbers"
    >
      <h2>
        Atrial Fibrillation <strong>by the Numbers</strong><sup>2</sup>
      </h2>
      <div className="stats-grid">
        {statistics.map(([value, label, icon]) => (
          <article className="stat-card" key={value}>
            <h3>{value}</h3>
            <p>{label}</p>
            <div className="stat-icon-wrap">
              <StatIcon type={icon} />
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function ClinicalResearchCallout({ progress }: { progress: number }) {
  const viewLength = 1 / Math.max(motionData.cameraViews.length - 1, 1)
  const start = viewLength * 2.85
  const visibleUntil = viewLength * 3.6
  const end = viewLength * 3.95
  const reveal = THREE.MathUtils.smoothstep(progress, start, start + viewLength * 0.18)
  const fade = 1 - THREE.MathUtils.smoothstep(progress, visibleUntil, end)
  const blur = (1 - reveal) * 12 + (1 - fade) * 12

  return (
    <section
      className="clinical-callout"
      style={{ opacity: reveal * fade, filter: `blur(${blur}px)` }}
      aria-label="Clinical research"
    >
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
      <span className="clinical-callout-link">Explore all studies&nbsp; ↗</span>
    </section>
  )
}

function FinalCallout({ progress }: { progress: number }) {
  const viewLength = 1 / Math.max(motionData.cameraViews.length - 1, 1)
  const start = viewLength * 4.7
  const reveal = THREE.MathUtils.smoothstep(progress, start, viewLength * 4.96)
  const blur = (1 - reveal) * 12

  return (
    <section
      className="final-callout"
      style={{ opacity: reveal, filter: `blur(${blur}px)` }}
      aria-label="Personalized neuromodulation"
    >
      <span className="clinical-callout-label">The next signal</span>
      <h2>Personalized neuromodulation for everyday life</h2>
      <p>
        StimCardio is advancing a non-invasive, wearable platform designed to sense each person’s physiology and
        deliver personalized therapy for the future of atrial fibrillation care.
      </p>
      <span className="clinical-callout-link">Learn more&nbsp; ↗</span>
    </section>
  )
}

function WatchNarrative({ progress }: { progress: number }) {
  const viewLength = 1 / Math.max(motionData.cameraViews.length - 1, 1)
  const reveal = THREE.MathUtils.smoothstep(progress, viewLength * 1.8, viewLength * 2.2)
  const fade = 1 - THREE.MathUtils.smoothstep(progress, viewLength * 4.65, viewLength * 5.05)
  const blur = (1 - reveal) * 12 + (1 - fade) * 12

  return (
    <section
      className="watch-narrative"
      style={{ opacity: reveal * fade, filter: `blur(${blur}px)` }}
      aria-label="Personalized cardiac sensing"
    >
      <span className="watch-narrative-label">A closer signal</span>
      <h2>Every heartbeat carries information.</h2>
      <p>
        Continuous sensing helps reveal the rhythms, patterns, and moments that shape each person’s experience of
        atrial fibrillation.
      </p>
    </section>
  )
}

function VienNarrative({ progress }: { progress: number }) {
  const viewLength = 1 / Math.max(vienMotionData.cameraViews.length - 1, 1)
  const start = viewLength * 1.65
  const end = viewLength * 2.85
  const reveal = THREE.MathUtils.smoothstep(progress, start, start + viewLength * 0.25)
  const fade = 1 - THREE.MathUtils.smoothstep(progress, end - viewLength * 0.25, end)
  const blur = (1 - reveal) * 12 + (1 - fade) * 12

  return (
    <section
      className="vien-narrative"
      style={{ opacity: reveal * fade, filter: `blur(${blur}px)` }}
      aria-label="Personalized neuromodulation"
    >
      <span className="vien-narrative-label">A wearable signal</span>
      <p>
        Designed to move with the body, Vienna brings sensing and personalized neuromodulation closer to everyday
        cardiac care.
      </p>
    </section>
  )
}

const siteCards = [
  {
    number: '01',
    label: 'ABOUT',
    title: 'A new signal for everyday care',
    copy: 'StimCardio is building a non-invasive, wearable neuromodulation platform that brings personalized therapy into daily life.',
  },
  {
    number: '02',
    label: 'TECHNOLOGY',
    title: 'Sensing that adapts to you',
    copy: 'Continuous physiological sensing and intelligent therapy work together to create a more responsive path to rhythm care.',
  },
  {
    number: '03',
    label: 'CLINICAL RESEARCH',
    title: 'Evidence, built step by step',
    copy: 'Our structured clinical program evaluates feasibility, safety, usability, physiological effects, and clinical efficacy.',
  },
  {
    number: '04',
    label: 'NEWS',
    title: 'Follow the next chapter',
    copy: 'Explore the latest research, milestones, and thinking from StimCardio Medical as the platform develops.',
  },
]

function PostModelLayout() {
  return (
    <section className="site-layout" aria-label="StimCardio information">
      <div className="site-layout-head">
        <span className="site-layout-index">01 — 04</span>
        <span className="site-layout-label">StimCardio Medical</span>
      </div>
      <div className="site-layout-intro">
        <p className="site-layout-kicker">A different rhythm of care</p>
        <h1>Designed for the moments<br />between medicine and life.</h1>
      </div>
      <div className="site-card-grid">
        {siteCards.map((card) => (
          <article className="site-card" key={card.number}>
            <div className="site-card-top">
              <span>{card.number}</span>
              <span>{card.label}</span>
            </div>
            <div className="site-card-body">
              <h2>{card.title}</h2>
              <p>{card.copy}</p>
            </div>
            <span className="site-card-arrow">↗</span>
          </article>
        ))}
      </div>
    </section>
  )
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__top">
        <span className="site-footer__eyebrow">StimCardio Medical</span>
        <p>Building a more responsive future for atrial fibrillation care.</p>
      </div>
      <div className="site-footer__grid">
        <div>
          <span className="site-footer__label">Explore</span>
          <a href="#about">About</a>
          <a href="#technology">Technology</a>
          <a href="#clinical-research">Clinical Research</a>
          <a href="#news">News</a>
        </div>
        <div>
          <span className="site-footer__label">Connect</span>
          <a href="mailto:hello@stimcardio.com">Contact Us ↗</a>
          <a href="#careers">Careers ↗</a>
          <a href="https://www.linkedin.com/company/stimcardio/" target="_blank" rel="noreferrer">LinkedIn ↗</a>
        </div>
        <div className="site-footer__mark">StrimCardio</div>
      </div>
      <div className="site-footer__bottom">
        <span>© 2026 StimCardio Medical. All rights reserved.</span>
        <span>Investigational device. Not approved for sale.</span>
      </div>
    </footer>
  )
}

function StrimCardioNavbar() {
  return (
    <nav className="strim-navbar" aria-label="Main navigation">
      <div className="strim-navbar__inner">
        <div className="strim-navbar__image strim-navbar__image--left" aria-hidden="true">
          <span>
            <img src="https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=240&q=80" alt="" />
          </span>
        </div>
        <h1 className="strim-navbar__title">StrimCardio</h1>
        <div className="strim-navbar__image strim-navbar__image--right" aria-hidden="true">
          <span>
            <img src="https://images.unsplash.com/photo-1559757175-0eb30cd8c063?auto=format&fit=crop&w=240&q=80" alt="" />
          </span>
        </div>
        <div className="strim-navbar__links">
          <a href="#home">Home</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
          <a href="#careers">Careers</a>
        </div>
      </div>
    </nav>
  )
}

export default function App() {
  const stageRef = useRef<HTMLElement>(null)
  const progress = useScrollProgress(stageRef)
  const watchProgress = THREE.MathUtils.clamp(progress * 2, 0, 1)
  const vienProgress = THREE.MathUtils.clamp((progress - 0.5) * 2, 0, 1)
  const pointer = usePointerMotion()
  const motion: MotionData = { ...defaultMotion, ...motionData }

  return (
    <main>
      <StrimCardioNavbar />
      <section className="scroll-stage" ref={stageRef}>
        <div className="cinematic-layer" style={{ opacity: 1 - THREE.MathUtils.smoothstep(progress, 0.94, 1) }}>
          <div className="scene">
            <Scene motion={motion} progress={progress} vienProgress={vienProgress} pointer={pointer} />
          </div>
          <div className="watch-content">
            <BrandMark progress={watchProgress} />
            <MedicalCallout progress={watchProgress} />
            <AfibStatistics progress={watchProgress} />
            <ClinicalResearchCallout progress={watchProgress} />
            <FinalCallout progress={watchProgress} />
            <WatchNarrative progress={watchProgress} />
          </div>
          <VienNarrative progress={vienProgress} />
          <div className="grain-overlay" aria-hidden="true" />
        </div>
      </section>
      <PostModelLayout />
      <SiteFooter />
    </main>
  )
}

useGLTF.preload('/model/watch.glb')
useGLTF.preload('/model/vien.glb')

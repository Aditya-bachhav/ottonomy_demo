import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, Preload, useGLTF } from '@react-three/drei'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Group } from 'three'
import watchData from '../data/watch-points.json'
import vienData from '../data/vien-points.json'
import { clamp01, ease, pointerStore, prefersReducedMotion, scrollStore, smooth, vienProgress, watchProgress } from '../store'
import { useScrollAbove } from '../hooks'

type Vec = { x: number; y: number; z: number }
type CameraView = { position: Vec; target: Vec; fov: number }
type MotionData = { points: Vec[]; angles: Vec[]; cameraViews: CameraView[] }

type RenderMaterial = THREE.Material & { emissive?: THREE.Color; emissiveIntensity?: number; wireframe?: boolean }
type MaterialPair = { solid: RenderMaterial; wireframe: RenderMaterial; baseOpacity: number }

const watchMotion = watchData as unknown as MotionData
const vienMotion = vienData as unknown as MotionData

/** Quintic smootherstep between keyframes. */
function sampleKeyframes<T>(keyframes: T[], progress: number, mix: (from: T, to: T, t: number) => T) {
  if (keyframes.length === 0) return undefined
  if (keyframes.length === 1) return keyframes[0]
  const scaled = clamp01(progress) * (keyframes.length - 1)
  const index = Math.min(Math.floor(scaled), keyframes.length - 2)
  const t = scaled - index
  const eased = t * t * t * (t * (t * 6 - 15) + 10)
  return mix(keyframes[index], keyframes[index + 1], eased)
}

const mixVec = (a: Vec, b: Vec, t: number): Vec => ({
  x: THREE.MathUtils.lerp(a.x, b.x, t),
  y: THREE.MathUtils.lerp(a.y, b.y, t),
  z: THREE.MathUtils.lerp(a.z, b.z, t),
})

const toArray = <T,>(value: T | T[]) => (Array.isArray(value) ? value : [value])

function disposeAll(materials: THREE.Material[]) {
  materials.forEach((material) => material.dispose())
}

function Watch({ reduced }: { reduced: boolean }) {
  const { scene } = useGLTF('/model/watch.glb')
  const watch = useMemo(() => scene.clone(), [scene])
  const trail = useMemo(() => scene.clone(), [scene])
  const root = useRef<Group>(null)
  const group = useRef<Group>(null)
  const trailGroup = useRef<Group>(null)
  const pairs = useRef<MaterialPair[]>([])
  const wireMeshes = useRef<THREE.Mesh[]>([])
  const trailMaterials = useRef<RenderMaterial[]>([])
  const desiredPosition = useMemo(() => new THREE.Vector3(), [])
  const desiredRotation = useMemo(() => new THREE.Euler(), [])
  const previousPosition = useMemo(() => new THREE.Vector3(), [])
  const previousRotation = useMemo(() => new THREE.Euler(), [])

  // Build solid + wireframe layers once, and tear them down cleanly (StrictMode safe).
  useEffect(() => {
    const created: THREE.Material[] = []
    const added: THREE.Mesh[] = []
    pairs.current = []
    wireMeshes.current = []

    const meshes: THREE.Mesh[] = []
    watch.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) meshes.push(object as THREE.Mesh)
    })

    meshes.forEach((mesh) => {
      mesh.castShadow = true
      mesh.receiveShadow = true
      const original = toArray(mesh.material)
      const solids = original.map((m) => m.clone() as RenderMaterial)
      const wires = original.map((m) => {
        const wire = m.clone() as RenderMaterial
        wire.wireframe = true
        wire.transparent = true
        wire.depthWrite = false
        wire.opacity = 0
        if (wire.emissive) {
          wire.emissive = new THREE.Color('#bfe9ff')
          wire.emissiveIntensity = 2.5
        }
        return wire
      })
      created.push(...solids, ...wires)
      mesh.material = Array.isArray(mesh.material) ? solids : solids[0]

      const wireMesh = new THREE.Mesh(mesh.geometry, Array.isArray(mesh.material) ? wires : wires[0])
      wireMesh.name = `${mesh.name}-wireframe`
      wireMesh.frustumCulled = false
      wireMesh.visible = false
      mesh.add(wireMesh)
      added.push(wireMesh)
      wireMeshes.current.push(wireMesh)
      solids.forEach((solid, i) => pairs.current.push({ solid, wireframe: wires[i], baseOpacity: solid.opacity }))
    })

    trailMaterials.current = []
    trail.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh) return
      const clones = toArray(mesh.material).map((m) => {
        const clone = m.clone() as RenderMaterial
        clone.transparent = true
        clone.depthWrite = false
        clone.opacity = 0
        return clone
      })
      created.push(...clones)
      mesh.material = Array.isArray(mesh.material) ? clones : clones[0]
      trailMaterials.current.push(...clones)
    })

    return () => {
      added.forEach((mesh) => mesh.parent?.remove(mesh))
      disposeAll(created)
    }
  }, [watch, trail])

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1)
    const p = scrollStore.value
    const wp = watchProgress(p)
    if (root.current) root.current.visible = p < 0.5

    if (!group.current || p >= 0.5) return
    const position = sampleKeyframes(watchMotion.points, wp, mixVec)
    const rotation = sampleKeyframes(watchMotion.angles, wp, mixVec)
    const px = reduced ? 0 : pointerStore.x
    const py = reduced ? 0 : pointerStore.y

    desiredPosition.set((position?.x ?? 0) + px * 0.018, (position?.y ?? 0) - py * 0.012, position?.z ?? 0)
    desiredRotation.set(
      (rotation?.x ?? 0) + py * 0.035,
      (rotation?.y ?? 0) + px * 0.055,
      (rotation?.z ?? 0) - px * 0.012,
    )
    group.current.position.lerp(desiredPosition, ease(5, delta))
    group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, desiredRotation.x, 4, delta)
    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, desiredRotation.y, 4, delta)
    group.current.rotation.z = THREE.MathUtils.damp(group.current.rotation.z, desiredRotation.z, 4, delta)

    // Ghost trail that only shows while the watch is moving.
    if (trailGroup.current) {
      const frameScale = delta > 0 ? delta * 60 : 1
      const movement = group.current.position.distanceTo(previousPosition) / frameScale
      const rotationMovement =
        (Math.abs(group.current.rotation.x - previousRotation.x) +
          Math.abs(group.current.rotation.y - previousRotation.y) +
          Math.abs(group.current.rotation.z - previousRotation.z)) /
        frameScale
      const opacity = reduced ? 0 : THREE.MathUtils.clamp((movement + rotationMovement * 0.25) * 2.8, 0, 0.16)
      trailGroup.current.visible = opacity > 0.003
      trailGroup.current.position.lerp(group.current.position, ease(12, delta))
      trailGroup.current.rotation.x = THREE.MathUtils.damp(trailGroup.current.rotation.x, group.current.rotation.x, 3, delta)
      trailGroup.current.rotation.y = THREE.MathUtils.damp(trailGroup.current.rotation.y, group.current.rotation.y, 3, delta)
      trailGroup.current.rotation.z = THREE.MathUtils.damp(trailGroup.current.rotation.z, group.current.rotation.z, 3, delta)
      trailMaterials.current.forEach((material) => (material.opacity = opacity))
      previousPosition.copy(group.current.position)
      previousRotation.copy(group.current.rotation)
    }

    // Solid -> wireframe -> solid choreography (peaks on camera view 5).
    const segments = Math.max(watchMotion.cameraViews.length - 1, 1)
    const viewFive = 4 / segments
    const viewSix = 5 / segments
    const wireAmount =
      wp < viewFive
        ? smooth(wp, viewFive - 1.4 / segments, viewFive)
        : 1 - smooth(wp, viewFive, viewSix + 0.15 / segments)

    const showWire = wireAmount > 0.001
    wireMeshes.current.forEach((mesh) => (mesh.visible = showWire))
    pairs.current.forEach(({ solid, wireframe, baseOpacity }) => {
      solid.transparent = showWire
      solid.opacity = baseOpacity * (1 - wireAmount)
      wireframe.opacity = wireAmount
    })
  })

  return (
    <group ref={root}>
      <group ref={trailGroup} scale={0.998} visible={false}>
        <primitive object={trail} />
      </group>
      <group ref={group}>
        <primitive object={watch} />
      </group>
    </group>
  )
}

function Vien({ reduced }: { reduced: boolean }) {
  const { scene } = useGLTF('/model/vien.glb')
  const vien = useMemo(() => scene.clone(), [scene])
  const wireVien = useMemo(() => scene.clone(), [scene])
  const root = useRef<Group>(null)
  const group = useRef<Group>(null)
  const wireMaterials = useRef<RenderMaterial[]>([])
  const desiredRotation = useMemo(() => new THREE.Euler(), [])

  const scale = useMemo(() => {
    vien.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(vien)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    vien.position.sub(center)
    wireVien.position.copy(vien.position)
    return 2.4 / Math.max(size.x, size.y, size.z)
  }, [vien, wireVien])

  useEffect(() => {
    const created: THREE.Material[] = []
    wireMaterials.current = []
    wireVien.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh) return
      const wires = toArray(mesh.material).map((source) => {
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
      created.push(...wires)
      mesh.material = Array.isArray(mesh.material) ? wires : wires[0]
      mesh.renderOrder = 2
      wireMaterials.current.push(...wires)
    })
    return () => disposeAll(created)
  }, [wireVien])

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1)
    const p = scrollStore.value
    if (root.current) root.current.visible = p >= 0.5
    if (!group.current || p < 0.5) return
    const vp = vienProgress(p)
    const px = reduced ? 0 : pointerStore.x
    const py = reduced ? 0 : pointerStore.y

    desiredRotation.set(py * 0.02, Math.PI / 2 + px * 0.03, Math.PI / 2)
    group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, desiredRotation.x, 3.5, delta)
    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, desiredRotation.y, 3.5, delta)
    group.current.rotation.z = THREE.MathUtils.damp(group.current.rotation.z, desiredRotation.z, 3.5, delta)
    group.current.position.y = THREE.MathUtils.damp(group.current.position.y, Math.sin(vp * Math.PI) * 0.025, 2.5, delta)

    const opacity = 0.52 + Math.sin(vp * Math.PI) * 0.18
    wireMaterials.current.forEach((material) => (material.opacity = opacity))
  })

  return (
    <group ref={root} visible={false}>
      <group ref={group} scale={scale} rotation={[0, Math.PI / 2, Math.PI / 2]}>
        <primitive object={vien} />
        <primitive object={wireVien} />
      </group>
    </group>
  )
}

function CameraMotion() {
  const camera = useThree((state) => state.camera)
  const target = useMemo(() => new THREE.Vector3(), [])
  const desiredPosition = useMemo(() => new THREE.Vector3(), [])
  const desiredTarget = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1)
    const p = scrollStore.value
    const watchPhase = p < 0.5
    const motion = watchPhase ? watchMotion : vienMotion
    const progress = watchPhase ? watchProgress(p) : vienProgress(p)

    const view = sampleKeyframes(motion.cameraViews, progress, (from, to, t) => ({
      position: mixVec(from.position, to.position, t),
      target: mixVec(from.target, to.target, t),
      fov: THREE.MathUtils.lerp(from.fov, to.fov, t),
    }))
    if (!view || !(camera instanceof THREE.PerspectiveCamera)) return

    desiredPosition.set(view.position.x, view.position.y, view.position.z)
    desiredTarget.set(view.target.x, view.target.y, view.target.z)
    const k = ease(4.8, delta)
    camera.position.lerp(desiredPosition, k)
    target.lerp(desiredTarget, k)
    camera.lookAt(target)
    camera.fov = view.fov
    camera.updateProjectionMatrix()
  })

  return null
}

export default function Scene() {
  const finished = useScrollAbove(0.995)
  const reduced = useMemo(() => prefersReducedMotion(), [])

  return (
    <Canvas
      camera={{ position: [3.1, -0.45, -0.18], fov: 45, near: 0.05, far: 60 }}
      dpr={[1, 1.75]}
      frameloop={finished ? 'never' : 'always'}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      shadows
      aria-hidden="true"
    >
      <ambientLight intensity={1.1} />
      <directionalLight
        position={[4, 5, 3]}
        intensity={3}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      <directionalLight position={[-3, -2, -4]} intensity={1.2} />
      <Environment resolution={256} environmentIntensity={0.55}>
        <Lightformer form="rect" intensity={3} position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[8, 8, 1]} />
        <Lightformer form="rect" intensity={2} position={[-5, 1, -2]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} />
        <Lightformer form="ring" intensity={2.4} color="#bfe9ff" position={[4, 0, 4]} scale={4} />
      </Environment>
      <Watch reduced={reduced} />
      <Vien reduced={reduced} />
      <CameraMotion />
      <EffectComposer multisampling={4}>
        <Bloom intensity={1.15} luminanceSmoothing={0.82} luminanceThreshold={0.45} mipmapBlur radius={0.72} />
      </EffectComposer>
      <Preload all />
    </Canvas>
  )
}

useGLTF.preload('/model/watch.glb')
useGLTF.preload('/model/vien.glb')

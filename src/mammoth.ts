import * as T from 'three'
import { Penguin, type Status } from './penguin'
import type { Footprints, Snowfield, SnowParticles } from './snow'

const sphere = new T.SphereGeometry(1, 20, 14)
const coat = new T.MeshStandardMaterial({color: 0x916247, roughness: .94})
const hair = new T.MeshStandardMaterial({color: 0x704733, roughness: .96})
const ear = new T.MeshStandardMaterial({color: 0xa77a64, roughness: .94})
const ivory = new T.MeshStandardMaterial({color: 0xffebca, roughness: .75})
const dark = new T.MeshStandardMaterial({color: 0x30242a, roughness: .62})
const fur = new T.MeshStandardMaterial({vertexColors: true, roughness: .98})

function oval(group: T.Group, material: T.Material, x: number, y: number, z: number, w: number, h: number, d: number,
  geometry: T.BufferGeometry = sphere) {
  const mesh = new T.Mesh(geometry, material)
  mesh.position.set(x, y, z)
  mesh.scale.set(w, h, d)
  group.add(mesh)
  return mesh
}

function furShape(body: boolean) {
  const geometry = new T.SphereGeometry(1, 96, 48)
  const positions = geometry.attributes.position
  const colors = new Float32Array(positions.count * 3)
  const base = new T.Color(body ? 0x8e6043 : 0xa07050)
  const mane = new T.Color(body ? 0x63402c : 0x6e442e)
  const color = new T.Color()
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i)
    const angle = Math.atan2(z, x)
    const locks = Math.cos(angle * 16 + Math.sin(angle * 5) * .9 + y * .85)
    const grain = Math.cos(angle * 39 - y * 1.6 + Math.sin(angle * 9))
    const fringe = T.MathUtils.smoothstep(y, -.96, -.56) * (1 - T.MathUtils.smoothstep(y, -.28, .25))
    const stretch = body ? .16 + .12 * locks : 0
    const shoulder = body ? .20 * T.MathUtils.smoothstep(z, -.50, .68) * Math.max(0, y) : 0
    positions.setXYZ(i, x * (1 + fringe * locks * .024), y + shoulder - fringe * stretch, z)
    const hairline = body ? -.74 + .08 * locks : .39 + .10 * locks + .035 * grain
    const coverage = T.MathUtils.smoothstep(y, hairline - .035, hairline + .13)
    const strands = Math.sqrt(x * x + z * z) * (.075 * locks + .035 * grain)
    color.copy(base).lerp(mane, coverage * (body ? .72 : .89))
      .multiplyScalar(1 + coverage * strands)
    color.toArray(colors, i * 3)
  }
  geometry.setAttribute('color', new T.BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}

const bodyFur = furShape(true)
const headFur = furShape(false)

function curve(points: T.Vector3[], radius: number, tipRatio: number) {
  const path = new T.CatmullRomCurve3(points)
  const geometry = new T.TubeGeometry(path, 22, radius, 8, false)
  const vertices = geometry.attributes.position
  for (let row = 0; row <= 22; row++) {
    const t = row / 22
    const center = path.getPointAt(t)
    const scale = T.MathUtils.lerp(1, tipRatio, t)
    for (let col = 0; col <= 8; col++) {
      const i = row * 9 + col
      vertices.setXYZ(i, center.x + (vertices.getX(i) - center.x) * scale,
        center.y + (vertices.getY(i) - center.y) * scale, center.z + (vertices.getZ(i) - center.z) * scale)
    }
  }
  geometry.computeVertexNormals()
  return geometry
}

const trunkShape = curve([
  new T.Vector3(0, .10, .31), new T.Vector3(0, -.20, .57), new T.Vector3(0, -.63, .69),
  new T.Vector3(0, -.87, .83), new T.Vector3(0, -.78, 1.06),
], .21, .48)
const tuskShape = [-1, 1].map(side => curve([
  new T.Vector3(side * .29, -.15, .33), new T.Vector3(side * .46, -.40, .71),
  new T.Vector3(side * .52, -.33, 1.07), new T.Vector3(side * .47, -.15, 1.21),
], .105, .015))

export class Mammoth extends Penguin {
  private frame = new T.Group()
  private face = new T.Group()
  private trunk = new T.Group()
  private legs: T.Mesh[] = []

  override get formationRadius() { return 2.05 }

  constructor(scene: T.Scene, x: number, z: number, status: Status = 'solo', seed?: number) {
    super(scene, x, z, status, false, seed, 'mammoth')
    this.height = 2.38
    this.radius = 1.40
    this.angle = this.seed / 0x100000000 * Math.PI * 2
    this.shadow.scale.set(3.2, 1, 3.55)
    this.frame.scale.x = 1.38
    this.root.add(this.frame)
    oval(this.frame, fur, 0, 1.32, -.22, 1.01, .90, 1.23, bodyFur)
    for (const side of [-1, 1]) {
      for (const z of [-.89, .43]) {
        const leg = oval(this.frame, coat, side * .55, .51, z, .29, .52, .31)
        this.legs.push(leg)
      }
    }
    oval(this.frame, hair, 0, .85, -1.34, .13, .36, .15).rotation.x = -.30
    this.face.position.set(0, 1.62, .72)
    this.frame.add(this.face)
    oval(this.face, fur, 0, .04, 0, .61, .62, .54, headFur)
    for (const side of [-1, 1]) {
      oval(this.face, hair, side * .52, .16, -.14, .26, .40, .15).rotation.z = side * .32
      oval(this.face, ear, side * .59, .13, -.035, .15, .28, .08).rotation.z = side * .32
      oval(this.face, dark, side * .30, .17, .45, .064, .076, .037)
      oval(this.face, ivory, side * .30 - .018, .193, .481, .019, .02, .013)
    }
    this.face.add(...tuskShape.map(geometry => new T.Mesh(geometry, ivory)), this.trunk)
    this.trunk.add(new T.Mesh(trunkShape, coat))
    oval(this.trunk, hair, 0, -.78, 1.06, .104, .085, .068)
  }

  override animate(dt: number, time: number, snow: Snowfield, prints: Footprints, particles: SnowParticles) {
    const step = super.animate(dt, time, snow, prints, particles)
    const pace = Math.min(1, this.speed / .65)
    const gait = Math.sin(this.phase) * pace
    this.frame.rotation.z = (this.swimming ? 0 : this.body.rotation.x * .49) + gait * .035
    this.frame.rotation.x = this.swimming ? -.12 + gait * .055 : 0
    this.face.rotation.y = Math.sin(time * .63 + this.angle) * (1 - pace) * .19
    this.trunk.rotation.z = gait * .20 + Math.sin(time * 1.4) * .075
    this.legs.forEach((leg, i) => {
      const swing = i === 0 || i === 3 ? gait : -gait
      leg.rotation.x = swing * .25
      leg.position.y = .51 + Math.max(0, swing) * .14
    })
    return step
  }
}

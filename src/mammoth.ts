import * as T from 'three'
import { Penguin, type Status } from './penguin'
import type { Footprints, Snowfield, SnowParticles } from './snow'

const sphere = new T.SphereGeometry(1, 20, 14)
const coat = new T.MeshStandardMaterial({color: 0x916247, roughness: .94})
const hair = new T.MeshStandardMaterial({color: 0x704733, roughness: .96})
const ear = new T.MeshStandardMaterial({color: 0xa77a64, roughness: .94})
const ivory = new T.MeshStandardMaterial({color: 0xffebca, roughness: .75})
const dark = new T.MeshStandardMaterial({color: 0x30242a, roughness: .62})

function oval(group: T.Group, material: T.Material, x: number, y: number, z: number, w: number, h: number, d: number) {
  const mesh = new T.Mesh(sphere, material)
  mesh.position.set(x, y, z)
  mesh.scale.set(w, h, d)
  group.add(mesh)
  return mesh
}

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
    oval(this.frame, coat, 0, 1.32, -.22, 1.01, .90, 1.23)
    oval(this.frame, hair, 0, 1.72, .14, .88, .58, .86)
    for (const side of [-1, 1]) {
      for (const z of [-.89, .43]) {
        const leg = oval(this.frame, coat, side * .55, .51, z, .29, .52, .31)
        this.legs.push(leg)
      }
      for (let i = 0; i < 4; i++) {
        oval(this.frame, i % 2 ? coat : hair, side * (.82 + (i % 2) * .07), 1.15 + i % 2 * .10,
          .57 - i * .47, .15, .33 + i % 2 * .07, .24).rotation.x = .24
      }
    }
    oval(this.frame, hair, 0, .85, -1.34, .13, .36, .15).rotation.x = -.30
    this.face.position.set(0, 1.62, .72)
    this.frame.add(this.face)
    oval(this.face, coat, 0, .04, 0, .61, .62, .54)
    oval(this.face, hair, 0, .49, .12, .48, .24, .43)
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

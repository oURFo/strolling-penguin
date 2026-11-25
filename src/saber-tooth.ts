import * as T from 'three'
import { Penguin, type Status } from './penguin'
import type { Footprints, Snowfield, SnowParticles } from './snow'

const sphere = new T.SphereGeometry(1, 20, 14)
const fang = new T.ConeGeometry(1, 1, 14).rotateZ(Math.PI)
const ear = new T.ConeGeometry(1, 1, 5)
const felineNose = new T.ConeGeometry(1, 1, 3).rotateZ(Math.PI)
const fur = new T.MeshStandardMaterial({color: 0xc68b52, roughness: .88})
const cream = new T.MeshStandardMaterial({color: 0xffe1b8, roughness: .91})
const markings = new T.MeshStandardMaterial({color: 0x805238, roughness: .93})
const nose = new T.MeshStandardMaterial({color: 0x432b32, roughness: .76})
const ivory = new T.MeshStandardMaterial({color: 0xfff4de, roughness: .7})
const amber = new T.MeshStandardMaterial({color: 0xe3aa46, roughness: .42})

function oval(group: T.Group, material: T.Material, x: number, y: number, z: number, w: number, h: number, d: number,
  geometry: T.BufferGeometry = sphere) {
  const mesh = new T.Mesh(geometry, material)
  mesh.position.set(x, y, z)
  mesh.scale.set(w, h, d)
  group.add(mesh)
  return mesh
}

export class SaberTooth extends Penguin {
  private frame = new T.Group()
  private muzzle = new T.Group()
  private legs: T.Group[] = []
  private tail: T.Mesh

  override get formationRadius() { return 1.46 }

  constructor(scene: T.Scene, x: number, z: number, status: Status = 'solo', seed?: number) {
    super(scene, x, z, status, false, seed, 'saber-tooth')
    this.height = 1.64
    this.radius = .57
    this.angle = this.seed / 0x100000000 * Math.PI * 2
    this.shadow.scale.set(1.55, 1, 2.6)
    this.root.add(this.frame)
    oval(this.frame, fur, 0, .95, -.25, .43, .38, .98)
    oval(this.frame, cream, 0, .72, -.18, .35, .22, .75)
    oval(this.frame, fur, 0, .99, .37, .48, .52, .53)
    oval(this.frame, fur, 0, .87, -.89, .43, .41, .42)
    this.tail = oval(this.frame, markings, 0, .94, -1.29, .095, .11, .26)
    this.tail.rotation.x = -.40
    this.muzzle.position.set(0, 1.29, .71)
    this.frame.add(this.muzzle)
    oval(this.muzzle, fur, 0, .05, 0, .405, .30, .38)
    oval(this.muzzle, cream, 0, -.245, .23, .25, .107, .24)
    oval(this.muzzle, fur, 0, -.015, .30, .155, .13, .23)
    oval(this.muzzle, nose, 0, -.082, .505, .103, .105, .068, felineNose)
    for (const side of [-1, 1]) {
      oval(this.muzzle, fur, side * .286, .268, -.145, .113, .27, .09, ear).rotation.z = -side * .25
      oval(this.muzzle, cream, side * .294, .27, -.073, .066, .17, .026, ear).rotation.z = -side * .25
      oval(this.muzzle, cream, side * .284, -.08, .20, .14, .12, .17)
      oval(this.muzzle, markings, side * .227, .097, .306, .112, .061, .043).rotation.z = side * .20
      oval(this.muzzle, amber, side * .226, .096, .346, .073, .036, .022).rotation.z = side * .20
      oval(this.muzzle, nose, side * .226, .096, .367, .018, .030, .009)
      oval(this.muzzle, cream, side * .126, -.139, .408, .154, .095, .127)
      oval(this.muzzle, ivory, side * .161, -.326, .465, .061, .47, .071, fang).rotation.x = -.15
      for (let i = 0; i < 3; i++) {
        oval(this.muzzle, markings, side * (.14 + i * .04), -.132 - (i % 2) * .035, .53 - i * .018, .013, .013, .009)
        oval(this.frame, markings, side * (.42 - i * .02), 1.03 - i * .09, .38 - i * .19, .043, .10, .058).rotation.x = -.35
      }
      for (const z of [-.69, .42]) {
        const leg = new T.Group()
        leg.position.set(side * .30, .79, z)
        this.frame.add(leg)
        oval(leg, fur, 0, -.24, 0, .17, .34, .20)
        oval(leg, fur, 0, -.49, -.026, .116, .25, .129)
        oval(leg, cream, 0, -.69, .072, .151, .099, .211)
        this.legs.push(leg)
      }
    }
    for (let i = 0; i < 3; i++) {
      oval(this.frame, markings, 0, 1.28 - i * .034, .26 - i * .29, .25, .055, .067)
    }
  }

  override animate(dt: number, time: number, snow: Snowfield, prints: Footprints, particles: SnowParticles) {
    const step = super.animate(dt, time, snow, prints, particles)
    const pace = Math.min(1, this.speed / .8)
    const gait = Math.sin(this.phase) * pace
    this.frame.rotation.z = this.swimming ? gait * .08 : this.body.rotation.x * .54 + gait * .053
    this.frame.rotation.x = this.swimming ? -.13 + gait * .07 : 0
    this.muzzle.rotation.y = Math.sin(time * .9 + this.angle) * (1 - pace) * .25
    this.muzzle.rotation.x = Math.sin(time * 2.4 + this.angle) * .047 + gait * .08
    this.tail.rotation.y = Math.sin(time * 2.3 + this.angle) * .36
    this.legs.forEach((leg, i) => {
      leg.rotation.x = (i === 0 || i === 3 ? gait : -gait) * (this.swimming ? .58 : .32)
    })
    return step
  }
}

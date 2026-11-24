import * as T from 'three'
import { Penguin, type Status } from './penguin'
import type { Footprints, Snowfield, SnowParticles } from './snow'

const sphere = new T.SphereGeometry(1, 20, 14)
const fang = new T.ConeGeometry(1, 1, 14).rotateZ(Math.PI)
const fur = new T.MeshStandardMaterial({color: 0xc68b52, roughness: .88})
const cream = new T.MeshStandardMaterial({color: 0xffe1b8, roughness: .91})
const markings = new T.MeshStandardMaterial({color: 0x805238, roughness: .93})
const nose = new T.MeshStandardMaterial({color: 0x432b32, roughness: .76})
const ivory = new T.MeshStandardMaterial({color: 0xfff4de, roughness: .7})

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
    oval(this.frame, fur, 0, .88, -.18, .55, .46, .91)
    oval(this.frame, cream, 0, .64, -.08, .43, .24, .70)
    oval(this.frame, fur, 0, 1, .30, .49, .49, .49)
    this.tail = oval(this.frame, markings, 0, .92, -1.03, .13, .14, .33)
    this.tail.rotation.x = -.40
    this.muzzle.position.set(0, 1.20, .66)
    this.frame.add(this.muzzle)
    oval(this.muzzle, fur, 0, .02, 0, .43, .34, .37)
    oval(this.muzzle, cream, 0, -.21, .17, .29, .15, .24)
    oval(this.muzzle, nose, 0, -.04, .438, .096, .055, .058)
    for (const side of [-1, 1]) {
      oval(this.muzzle, markings, side * .30, .25, -.14, .135, .17, .096).rotation.z = -side * .19
      oval(this.muzzle, cream, side * .30, .25, -.063, .082, .106, .032)
      oval(this.muzzle, nose, side * .232, .065, .285, .052, .056, .035)
      oval(this.muzzle, ivory, side * .232 - .017, .083, .314, .014, .016, .009)
      oval(this.muzzle, cream, side * .138, -.10, .352, .175, .108, .137)
      oval(this.muzzle, ivory, side * .187, -.255, .393, .057, .29, .057, fang).rotation.z = side * .13
      for (const z of [-.69, .42]) {
        const leg = new T.Group()
        leg.position.set(side * .34, .72, z)
        this.frame.add(leg)
        oval(leg, fur, 0, -.30, 0, .18, .39, .19)
        oval(leg, cream, 0, -.62, .065, .177, .107, .229)
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

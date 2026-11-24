import * as T from 'three'
import { random, type Snowfield, type Footprints, type SnowParticles } from './snow'
import { Penguin, type Status } from './penguin'

const sphere = new T.SphereGeometry(1, 20, 14)
const fur = new T.MeshStandardMaterial({color: 0x889da9, roughness: .88})
const pale = new T.MeshStandardMaterial({color: 0xcdd9db, roughness: .9})
const markings = new T.MeshStandardMaterial({color: 0x627c8d, roughness: .86})
const eyes = new T.MeshStandardMaterial({color: 0x242f3c, roughness: .55})

function part(group: T.Group, material: T.Material, x: number, y: number, z: number, width: number, height: number, depth: number) {
  const mesh = new T.Mesh(sphere, material)
  mesh.position.set(x, y, z)
  mesh.scale.set(width, height, depth)
  group.add(mesh)
  return mesh
}

export class Seal extends Penguin {
  private sealBody = new T.Group()
  private sealHead = new T.Group()
  private flippers: T.Mesh[] = []
  private idlePhase: number

  override get formationRadius() { return 1.58 }

  constructor(scene: T.Scene, x: number, z: number, status: Status = 'solo', seed?: number) {
    super(scene, x, z, status, false, seed, 'seal')
    const pose = random(this.seed)
    this.idlePhase = pose() * Math.PI * 2
    this.angle = pose() * Math.PI * 2
    this.height = .98
    this.radius = .70
    this.root.add(this.sealBody)
    part(this.sealBody, fur, 0, .38, -.19, .62, .38, 1.04)
    part(this.sealBody, pale, 0, .20, .12, .49, .20, .77)
    for (const [px, py, pz, size] of [[-.23, .67, -.41, .10], [.18, .72, -.24, .075], [.32, .60, -.66, .09], [-.04, .60, -.92, .07]]) {
      part(this.sealBody, markings, px, py, pz, size, .036, size * 1.37)
    }
    this.sealHead.position.set(0, .53, .60)
    this.sealBody.add(this.sealHead)
    part(this.sealHead, fur, 0, .08, 0, .38, .36, .39)
    for (const side of [-1, 1]) {
      const fin = part(this.sealBody, fur, side * .51, .12, .21, .33, .083, .21)
      fin.rotation.y = side * .51
      this.flippers.push(fin)
      part(this.sealBody, fur, side * .18, .135, -1.17, .21, .115, .42).rotation.y = -side * .42
      part(this.sealHead, pale, side * .105, -.032, .32, .15, .105, .13)
      part(this.sealHead, eyes, side * .20, .13, .295, .047, .056, .037)
      for (let i = 0; i < 3; i++) {
        part(this.sealHead, markings, side * (.15 + i * .041), -.022 - i * .021, .422 - i * .017, .012, .012, .012)
      }
    }
    part(this.sealHead, eyes, 0, .025, .437, .087, .051, .038)
    this.shadow.scale.set(1.9, 1, 2.9)
  }

  override animate(dt: number, time: number, snow: Snowfield, prints: Footprints, particles: SnowParticles) {
    const step = super.animate(dt, time, snow, prints, particles)
    const breath = Math.sin(time * 1.9 + this.idlePhase)
    const stroke = Math.sin(this.phase) * Math.min(1, this.speed / .65)
    const fallen = this.status === 'trip'
    this.sealBody.scale.y = 1 + breath * .045
    this.sealBody.rotation.z = this.body.rotation.x * .62 + stroke * .08
    this.sealHead.rotation.set(.06 * breath + stroke * .09, Math.sin(time * .58 + this.idlePhase) * (this.speed > .06 ? .11 : .34), .035 * breath)
    this.flippers.forEach((fin, i) => {
      const side = i ? 1 : -1
      fin.rotation.y = side * .51 + stroke * .39
      fin.rotation.z = side * (.07 + breath * .045 + (fallen ? Math.sin(time * 19) * .29 : stroke * .16))
    })
    return step
  }
}

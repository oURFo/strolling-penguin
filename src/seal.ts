import * as T from 'three'
import { random, softDot, type Snowfield } from './snow'

const sphere = new T.SphereGeometry(1, 20, 14)
const plane = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
const fur = new T.MeshStandardMaterial({color: 0x889da9, roughness: .88})
const pale = new T.MeshStandardMaterial({color: 0xcdd9db, roughness: .9})
const markings = new T.MeshStandardMaterial({color: 0x627c8d, roughness: .86})
const eyes = new T.MeshStandardMaterial({color: 0x242f3c, roughness: .55})
const shade = new T.MeshBasicMaterial({map: softDot(), color: 0x55788b, transparent: true, opacity: .28, depthWrite: false})

function part(group: T.Group, material: T.Material, x: number, y: number, z: number, width: number, height: number, depth: number) {
  const mesh = new T.Mesh(sphere, material)
  mesh.position.set(x, y, z)
  mesh.scale.set(width, height, depth)
  group.add(mesh)
  return mesh
}

export class Seal {
  readonly position: T.Vector2
  private root = new T.Group()
  private body = new T.Group()
  private head = new T.Group()
  private shadow = new T.Mesh(plane, shade)
  private flippers: T.Mesh[] = []
  private phase: number
  private heading: number
  private slope = new T.Vector3()
  private up = new T.Vector3(0, 1, 0)
  private facing = new T.Quaternion()

  constructor(scene: T.Scene, x: number, z: number, readonly seed = Math.floor(Math.random() * 0x100000000)) {
    const pose = random(seed)
    this.phase = pose() * Math.PI * 2
    this.heading = pose() * Math.PI * 2
    this.position = new T.Vector2(x, z)
    this.root.add(this.body)
    part(this.body, fur, 0, .38, -.19, .62, .38, 1.04)
    part(this.body, pale, 0, .20, .12, .49, .20, .77)
    for (const [px, py, pz, size] of [[-.23, .67, -.41, .10], [.18, .72, -.24, .075], [.32, .60, -.66, .09], [-.04, .60, -.92, .07]]) {
      part(this.body, markings, px, py, pz, size, .036, size * 1.37)
    }
    this.head.position.set(0, .53, .60)
    this.body.add(this.head)
    part(this.head, fur, 0, .08, 0, .38, .36, .39)
    for (const side of [-1, 1]) {
      const fin = part(this.body, fur, side * .51, .12, .21, .33, .083, .21)
      fin.rotation.y = side * .51
      this.flippers.push(fin)
      part(this.body, fur, side * .18, .135, -1.17, .21, .115, .42).rotation.y = -side * .42
      part(this.head, pale, side * .105, -.032, .32, .15, .105, .13)
      part(this.head, eyes, side * .20, .13, .295, .047, .056, .037)
      for (let i = 0; i < 3; i++) {
        part(this.head, markings, side * (.15 + i * .041), -.022 - i * .021, .422 - i * .017, .012, .012, .012)
      }
    }
    part(this.head, eyes, 0, .025, .437, .087, .051, .038)
    this.shadow.scale.set(1.9, 1, 2.9)
    this.shadow.renderOrder = 2
    scene.add(this.root, this.shadow)
  }

  animate(time: number, snow: Snowfield) {
    const {x, y: z} = this.position
    const y = snow.height(x, z)
    this.root.position.set(x, y, z)
    this.shadow.position.set(x, y + .02, z)
    this.shadow.quaternion.setFromUnitVectors(this.up, snow.slope(x, z, this.slope))
      .multiply(this.facing.setFromAxisAngle(this.up, this.heading))
    this.root.quaternion.copy(this.shadow.quaternion)
    const breath = Math.sin(time * 1.9 + this.phase)
    this.body.scale.y = 1 + breath * .045
    this.head.rotation.set(.06 * breath, Math.sin(time * .58 + this.phase) * .33, .035 * breath)
    this.flippers.forEach((fin, i) => { fin.rotation.z = (i ? 1 : -1) * (.07 + breath * .045) })
  }

  dispose(scene: T.Scene) {
    scene.remove(this.root, this.shadow)
  }
}

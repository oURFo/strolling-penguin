import * as T from 'three'
import { type Snowfield, type SnowParticles, type Footprints, softDot } from './snow'

export type Status = 'solo' | 'leader' | 'follow' | 'trip' | 'dream' | 'stray'
const sphere = new T.SphereGeometry(1, 20, 14)
const cone = new T.ConeGeometry(1, 1, 18).rotateX(Math.PI / 2)
const trumpetShape = new T.CylinderGeometry(1, .53, 1, 20, 1, true).rotateX(Math.PI / 2)
const bell = new T.TorusGeometry(.062, .017, 10, 24)
const shadowMap = new T.MeshBasicMaterial({color: 0x4c7594, map: softDot(), transparent: true, opacity: .26, depthWrite: false})
const material = (color: number, map?: T.Texture) => new T.MeshStandardMaterial({color, map: map ?? null, roughness: .87})
const white = material(0xfffbef)
const foot = material(0xeea455)
const dark = material(0x242638)
const blush = material(0xf5b0ab)
const scarf = material(0xe27b63)
const loader = new T.TextureLoader()
function feather(name: string) {
  const map = loader.load(import.meta.env.BASE_URL + 'textures/' + name + '.webp')
  map.colorSpace = T.SRGBColorSpace
  return map
}
const featherAdult = feather('adult')
const featherChick = feather('chick')
const adults = [0x6e7890, 0x697d95, 0x8b778e].map(color => material(color, featherAdult))
const chicks = [0xd1cfd3, 0xbeb6bf, 0xbac8d2].map(color => material(color, featherChick))

function shape(root: T.Group, mat: T.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, geometry: T.BufferGeometry = sphere) {
  const mesh = new T.Mesh(geometry, mat)
  mesh.position.set(x, y, z)
  mesh.scale.set(sx, sy, sz)
  root.add(mesh)
  return mesh
}

const up = new T.Vector3(0, 1, 0)
const slope = new T.Vector3()
const heading = new T.Quaternion()
const look = new T.Vector2()
const TAU = Math.PI * 2

export class Penguin {
  root = new T.Group()
  body = new T.Group()
  head = new T.Group()
  feet: T.Mesh[]
  wings: T.Mesh[]
  eyes: T.Mesh[] = []
  pupils: T.Mesh[] = []
  beak: T.Mesh
  trumpet = new T.Group()
  position: T.Vector2
  route: T.Vector2[] = []
  target = new T.Vector2()
  status: Status
  angle = 0
  radius: number
  height: number
  phase = 0
  speed = 0
  recruit = 0
  joy = 0
  honk = 0
  slide = 0
  nextTurn = 0
  protectedUntil = 0
  private distance = 0
  private side = 1
  private shadow: T.Mesh
  private tilt = 0
  private chick: boolean
  private gait = 0
  private idleSeed = Math.random() * TAU
  private idleLookIn = .5 + Math.random() * 2
  private idleYaw = 0
  private idlePitch = 0
  private blinkIn = 1 + Math.random() * 4

  constructor(scene: T.Scene, x: number, z: number, status: Status, player = false, chick = !player && Math.random() < .43) {
    this.status = status
    this.position = new T.Vector2(x, z)
    this.target.copy(this.position)
    this.chick = chick
    this.height = player ? 1.42 : chick ? .57 + Math.random() * .27 : 1.1 + Math.random() * .35
    const sx = player ? 1.07 : (chick ? .95 : .85) + Math.random() * .4
    const sz = .9 + Math.random() * .35
    this.radius = .3 * sx * this.height / 1.3
    const palette = chick ? chicks : adults
    const coat = palette[Math.floor(Math.random() * palette.length)]
    this.root.add(this.body)
    this.body.scale.set(sx * this.height / 1.3, this.height / 1.3, sz * this.height / 1.3)
    shape(this.body, coat, 0, .53, 0, chick ? .39 : .335, .48, .29)
    shape(this.body, white, 0, .50, .197, chick ? .287 : .245, .365, .13)
    this.wings = [-1, 1].map(sign => shape(this.body, coat, sign * .324, .58, -.008, .088, .265, .125))
    this.feet = [-1, 1].map(sign => shape(this.body, foot, sign * .145, .071, .094, .118, .067, .17))
    this.head.position.y = chick ? .95 : .995
    this.body.add(this.head)
    const headSize = chick ? .343 : .276
    shape(this.head, coat, 0, 0, .008, headSize, .296, .251)
    for (const sign of [-1, 1]) {
      shape(this.head, white, sign * .095, -.037, .187, .135, .147, .081)
      shape(this.head, blush, sign * .169, -.086, .245, .037, .026, .016)
      this.eyes.push(shape(this.head, dark, sign * .102, .003, .261, .032, .046, .025))
      this.pupils.push(shape(this.head, white, sign * .102 - .008, .017, .283, .009, .012, .007))
    }
    this.beak = shape(this.head, foot, 0, -.081, .295, .075, .052, .155, cone)
    this.trumpet.position.set(0, -.073, .345)
    shape(this.trumpet, foot, 0, 0, 0, .08, .08, .19, trumpetShape)
    shape(this.trumpet, dark, 0, 0, .072, .065, .065, .009)
    shape(this.trumpet, foot, 0, 0, .09, 1.17, 1.17, 1, bell)
    this.head.add(this.trumpet)
    this.trumpet.visible = false
    if (player) {
      shape(this.body, scarf, 0, .795, .016, .298, .067, .268)
      const tail = shape(this.body, scarf, -.205, .669, .201, .072, .18, .047)
      tail.rotation.z = -.32
    }
    this.shadow = new T.Mesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), shadowMap)
    this.shadow.scale.setScalar(this.height * .96)
    this.shadow.renderOrder = 2
    scene.add(this.root, this.shadow)
    this.route.push(this.position.clone())
  }

  move(toward: T.Vector2, speed: number, dt: number) {
    look.subVectors(toward, this.position)
    const distance = look.length()
    if (distance < .0001 || speed <= 0) return
    const step = Math.min(distance, speed * dt)
    this.position.addScaledVector(look, step / distance)
    const angle = Math.atan2(look.x, look.y)
    const difference = Math.atan2(Math.sin(angle - this.angle), Math.cos(angle - this.angle))
    this.angle += difference * Math.min(dt * 11, 1)
    this.speed = step / dt
  }

  breadcrumb(gap: number, target: T.Vector2) {
    let previous = this.position
    for (let i = this.route.length - 1; i >= 0; i--) {
      const point = this.route[i]
      const length = previous.distanceTo(point)
      if (gap <= length && length > 0) return target.copy(previous).lerp(point, gap / length)
      gap -= length
      previous = point
    }
    return target.copy(previous)
  }

  track() {
    if (this.position.distanceToSquared(this.route[this.route.length - 1]) < .012) return
    this.route.push(this.position.clone())
    if (this.route.length > 48) this.route.shift()
  }

  animate(dt: number, time: number, snow: Snowfield, prints: Footprints, particles: SnowParticles) {
    const {x, y: z} = this.position
    const ground = snow.height(x, z)
    const stumble = this.status === 'trip'
    const dream = this.status === 'dream'
    this.joy = Math.max(0, this.joy - dt)
    this.honk = Math.max(0, this.honk - dt)
    this.tilt = T.MathUtils.lerp(this.tilt, stumble ? 1.39 : 0, Math.min(1, dt * 11))
    const stride = this.chick ? .29 : .41
    const moving = !stumble && this.speed > .065
    const walk = moving ? T.MathUtils.clamp(this.speed / 2.4, .64, 1) : 0
    const blend = 1 - Math.exp(-dt * 13)
    this.gait = T.MathUtils.lerp(this.gait, walk, blend)
    this.phase = (this.phase + this.speed * dt * Math.PI / stride) % TAU
    const idle = !moving && !stumble && !dream && this.honk === 0
    const breath = Math.sin(time * 2.8 + this.idleSeed)
    if (idle) {
      this.idleLookIn -= dt
      if (this.idleLookIn <= 0) {
        this.idleLookIn = 1.05 + Math.random() * 1.65
        const look = Math.random()
        this.idleYaw = look < .36 ? -.72 : look < .72 ? .72 : (Math.random() - .5) * .3
        this.idlePitch = look < .72 ? -.06 + Math.random() * .18 : -.32
      }
    }
    this.blinkIn -= dt
    if (this.blinkIn < -.15) this.blinkIn = 2 + Math.random() * 3.8
    const blink = this.blinkIn < 0 ? Math.sin(-this.blinkIn / .15 * Math.PI) : 0
    const recoveryHop = this.joy > 0 ? Math.sin(this.joy / .72 * Math.PI) * .23 : 0
    const bounce = Math.abs(Math.sin(this.phase)) * this.gait * .06
    this.root.position.set(x, ground + recoveryHop + Math.sin(this.tilt) * .32 + bounce, z)
    this.root.quaternion.setFromUnitVectors(up, snow.slope(x, z, slope))
      .multiply(heading.setFromAxisAngle(up, this.angle))
    this.shadow.position.set(x, ground + .02, z)
    this.shadow.quaternion.setFromUnitVectors(up, slope)
    const sway = Math.sin(this.phase) * this.gait
    this.body.rotation.set(this.tilt, 0, sway * .17 + (idle ? breath * .022 : 0))
    const pitch = dream ? -.22 + Math.sin(time * 2) * .13 : this.honk > 0 ? -.24 : idle ? this.idlePitch : -.035
    const yaw = dream ? Math.sin(time * 2.1) * .45 : idle ? this.idleYaw : 0
    this.head.rotation.x = T.MathUtils.lerp(this.head.rotation.x, pitch + (idle ? breath * .035 : 0), blend)
    this.head.rotation.y = T.MathUtils.lerp(this.head.rotation.y, yaw, blend * .65)
    this.head.rotation.z = T.MathUtils.lerp(this.head.rotation.z, idle ? yaw * -.11 : -sway * .07, blend)
    this.beak.visible = this.honk === 0
    this.trumpet.visible = this.honk > 0
    this.trumpet.scale.z = 1 + Math.sin(this.honk / .6 * Math.PI) * .57
    this.eyes.forEach((eye, i) => {
      const open = dream ? .018 : this.joy > 0 ? .022 : this.status === 'stray' ? .055 : .046
      eye.scale.y = T.MathUtils.lerp(open, .004, blink)
      eye.rotation.z = dream || stumble ? (i === 0 ? .36 : -.36) : 0
      this.pupils[i].visible = !dream && !stumble && blink < .45
    })
    this.feet.forEach((mesh, i) => {
      const step = Math.sin(this.phase + i * Math.PI) * this.gait
      mesh.position.y = .071 + Math.max(0, step) * .17
      mesh.position.z = .094 + step * .13
      this.wings[i].rotation.x = -step * .34
      this.wings[i].rotation.z = (i ? 1 : -1) * (.23 + (stumble ? Math.sin(time * 22) * .49 : sway * .2 + (idle ? breath * .035 : 0)))
    })
    if (!moving) return
    this.distance += this.speed * dt
    if (this.distance < stride) return
    this.distance %= stride
    this.side *= -1
    const lateral = this.radius * .6 * this.side
    const fx = x + Math.cos(this.angle) * lateral - Math.sin(this.angle) * .085
    const fz = z - Math.sin(this.angle) * lateral - Math.cos(this.angle) * .085
    prints.add(fx, fz, this.angle + this.side * .15, this.height * .32, time)
    particles.burst(fx, ground + .06, fz, this.chick ? 2 : 3, .64)
    return true
  }

  shift(dx: number, dz: number) {
    this.position.x -= dx
    this.position.y -= dz
    this.target.x -= dx
    this.target.y -= dz
    for (const point of this.route) {
      point.x -= dx
      point.y -= dz
    }
  }

  dispose(scene: T.Scene) {
    scene.remove(this.root, this.shadow)
    this.shadow.geometry.dispose()
  }
}



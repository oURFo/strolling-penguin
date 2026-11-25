import * as T from 'three'
import { type Snowfield, type SnowParticles, type Footprints, random, SEA_LEVEL, softDot } from './snow'

export type Status = 'solo' | 'leader' | 'follow' | 'trip' | 'dream' | 'stray'
export type RestPose = 'tumble' | 'dream' | 'hop' | 'chat' | 'fish' | 'drink'
export type PenguinSave = {
  species?: Penguin['species']
  seed: number
  position: [number, number]
  target: [number, number]
  route: [number, number][]
  status: Status
  angle: number
  phase: number
  recruit: number
  joy: number
  slide: number
  nextTurn: number
  protectedUntil: number
  distance: number
  side: number
}
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
  feet: T.Mesh[] = []
  wings: T.Mesh[] = []
  eyes: T.Mesh[] = []
  pupils: T.Mesh[] = []
  beak?: T.Mesh
  trumpet = new T.Group()
  position: T.Vector2
  route: T.Vector2[] = []
  target = new T.Vector2()
  status: Status
  angle = 0
  radius: number
  get formationRadius() { return this.radius }
  height: number
  phase = 0
  speed = 0
  swimming = false
  restPose?: RestPose
  recruit = 0
  joy = 0
  honk = 0
  slide = 0
  nextTurn = 0
  protectedUntil = 0
  private distance = 0
  private side = 1
  protected shadow: T.Mesh
  private tilt = 0
  readonly chick: boolean
  private gait = 0
  private idleSeed = Math.random() * TAU
  private idleLookIn = .5 + Math.random() * 2
  private idleYaw = 0
  private idlePitch = 0
  private blinkIn = 1 + Math.random() * 4
  private waterKnown = false
  private shoreTime = 0
  private shoreHeight = 0
  private diveDepth = 0
  private nextStroke = 0

  constructor(scene: T.Scene, x: number, z: number, status: Status, player = false,
    protected seed = Math.floor(Math.random() * 0x100000000), readonly species: 'penguin' | 'seal' | 'mammoth' | 'saber-tooth' = 'penguin') {
    const appearance = random(seed)
    const chick = !player && species === 'penguin' && appearance() < .43
    this.status = status
    this.position = new T.Vector2(x, z)
    this.target.copy(this.position)
    this.chick = chick
    this.height = player ? 1.42 : chick ? .57 + appearance() * .27 : 1.1 + appearance() * .35
    const sx = player ? 1.12 : (chick ? .95 : .85) + appearance() * .4
    const sz = player ? 1.30 : .9 + appearance() * .35
    this.radius = .3 * sx * this.height / 1.3
    this.shadow = new T.Mesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), shadowMap)
    this.shadow.scale.setScalar(this.height * .96)
    this.shadow.renderOrder = 2
    scene.add(this.root, this.shadow)
    this.route.push(this.position.clone())
    if (species !== 'penguin') return
    const palette = chick ? chicks : adults
    const coat = palette[Math.floor(appearance() * palette.length)]
    this.root.add(this.body)
    this.body.scale.set(sx * this.height / 1.3, this.height / 1.3, sz * this.height / 1.3)
    shape(this.body, coat, 0, .53, 0, player ? .365 : chick ? .39 : .335, .48, player ? .325 : .29)
    shape(this.body, white, 0, .50, player ? .227 : .197, player ? .272 : chick ? .287 : .245, .365, .13)
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
      shape(this.body, scarf, 0, .795, .016, .323, .067, .296)
      const tail = shape(this.body, scarf, -.205, .669, .245, .072, .18, .047)
      tail.rotation.z = -.32
    }
  }

  snapshot(): PenguinSave {
    return {
      species: this.species, seed: this.seed, position: this.position.toArray(), target: this.target.toArray(),
      route: this.route.map(point => point.toArray()), status: this.status, angle: this.angle, phase: this.phase,
      recruit: this.recruit, joy: this.joy, slide: this.slide, nextTurn: this.nextTurn,
      protectedUntil: this.protectedUntil, distance: this.distance, side: this.side,
    }
  }

  restore({target, route, angle, phase, recruit, joy, slide, nextTurn, protectedUntil, distance, side}: PenguinSave) {
    this.target.fromArray(target)
    this.route = route.map(point => new T.Vector2().fromArray(point))
    Object.assign(this, {angle, phase, recruit, joy, slide, nextTurn, protectedUntil, distance, side})
    this.tilt = this.status === 'trip' ? 1.39 : 0
  }

  move(toward: T.Vector2, speed: number, dt: number) {
    look.subVectors(toward, this.position)
    const distance = look.length()
    if (distance < .0001 || speed <= 0) return
    const step = Math.min(distance, speed * dt)
    this.position.addScaledVector(look, step / distance)
    this.turn(Math.atan2(look.x, look.y), dt)
    this.speed = step / dt
  }

  faceToward(toward: T.Vector2, dt: number) {
    look.subVectors(toward, this.position)
    if (look.lengthSq() > .0001) this.turn(Math.atan2(look.x, look.y), dt)
  }

  private turn(angle: number, dt: number) {
    const difference = Math.atan2(Math.sin(angle - this.angle), Math.cos(angle - this.angle))
    this.angle += difference * Math.min(dt * 11, 1)
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
    const water = ground < SEA_LEVEL
    if (this.waterKnown && water !== this.swimming) {
      this.shoreHeight = this.root.position.y
      this.shoreTime = .58
      particles.burst(x, SEA_LEVEL + .07, z, water ? 23 : 14, water ? 1.75 : 1.28)
    }
    this.waterKnown = true
    this.swimming = water
    const stumble = !water && (this.status === 'trip' || this.restPose === 'tumble')
    const dream = this.status === 'dream' || this.restPose === 'dream'
    const chatting = this.restPose === 'chat'
    this.joy = Math.max(0, this.joy - dt)
    this.honk = Math.max(0, this.honk - dt)
    this.tilt = T.MathUtils.lerp(this.tilt, stumble ? 1.39 : water ? 1.10 : 0, Math.min(1, dt * 9))
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
      + (this.restPose === 'hop' ? Math.abs(Math.sin(time * 8 + this.idleSeed)) ** 2 * .18 : 0)
    const floatDepth = this.height * (this.species === 'penguin' ? .22 : this.species === 'seal' ? .23 : .46)
    const strokeDepth = this.height * (this.species === 'penguin' ? .33 : .67) + .38
    const dive = moving && water ? strokeDepth * (.78 + Math.sin(time * 2.9 + this.idleSeed) * .22) : 0
    this.diveDepth = water ? T.MathUtils.lerp(this.diveDepth, dive, 1 - Math.exp(-dt * 4.5)) : 0
    const mediumHeight = water ? Math.max(ground + .08, SEA_LEVEL - floatDepth - this.diveDepth)
      + Math.sin(time * 4.1 + this.idleSeed) * .048
      : ground + Math.sin(this.tilt) * .32
    this.shoreTime = Math.max(0, this.shoreTime - dt)
    const crossing = 1 - this.shoreTime / .58
    const y = T.MathUtils.lerp(this.shoreHeight, mediumHeight, T.MathUtils.smoothstep(crossing, 0, 1))
      + Math.sin(crossing * Math.PI) * (water ? .45 : .56)
    this.root.position.set(x, y + recoveryHop + (water ? bounce * .25 : bounce), z)
    const groundNormal = water ? up : snow.slope(x, z, slope)
    this.root.quaternion.setFromUnitVectors(up, groundNormal)
      .multiply(heading.setFromAxisAngle(up, this.angle))
    this.shadow.position.set(x, ground + .02, z)
    this.shadow.visible = !water
    this.shadow.quaternion.setFromUnitVectors(up, groundNormal)
    if (this.species !== 'penguin') this.shadow.quaternion.multiply(heading)
    const sway = Math.sin(this.phase) * this.gait
    this.body.rotation.set(this.tilt, 0, sway * .17 + (idle ? breath * .022 : 0))
    const pitch = this.honk > 0 ? -.24 : water ? -.47 + Math.sin(this.phase) * .09 : this.restPose === 'fish' ? .18 + Math.sin(time * 2) * .07 : this.restPose === 'drink' ? .20 : dream ? -.22 + Math.sin(time * 2) * .13
      : chatting ? Math.sin(time * 8 + this.idleSeed) * .13 : idle ? this.idlePitch : -.035
    const yaw = dream ? Math.sin(time * 2.1) * .45 : idle && !chatting ? this.idleYaw : 0
    this.head.rotation.x = T.MathUtils.lerp(this.head.rotation.x, pitch + (idle ? breath * .035 : 0), blend)
    this.head.rotation.y = T.MathUtils.lerp(this.head.rotation.y, yaw, blend * .65)
    this.head.rotation.z = T.MathUtils.lerp(this.head.rotation.z, idle ? yaw * -.11 : -sway * .07, blend)
    if (this.beak) this.beak.visible = this.honk === 0
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
      const paddle = water ? Math.sin(time * (moving ? 11 : 4) + i * Math.PI) * (moving ? .81 : .25) : 0
      this.wings[i].rotation.x = water ? paddle : -step * .34
      if (this.restPose === 'fish' && i === 1) this.wings[i].rotation.x = -.80 + Math.sin(time * 3) * .12
      if (this.restPose === 'drink' && i === 1) this.wings[i].rotation.x = -1.18
      const playFlap = water ? .25 + paddle * .48 : this.restPose === 'hop' ? .31 + Math.sin(time * 15) * .24 : 0
      this.wings[i].rotation.z = (i ? 1 : -1) * (.23 + (stumble ? Math.sin(time * 22) * .49 : sway * .2 + playFlap + (idle ? breath * .035 : 0)))
    })
    if (water) {
      if (moving && time >= this.nextStroke) {
        this.nextStroke = time + .20 + Math.random() * .10
        particles.burst(x - Math.sin(this.angle) * this.radius, SEA_LEVEL + .06,
          z - Math.cos(this.angle) * this.radius, 4, .65)
      }
      return
    }
    if (!moving || this.shoreTime > 0) return
    this.distance += this.speed * dt
    if (this.distance < stride) return
    this.distance %= stride
    this.side *= -1
    const lateral = this.radius * .6 * this.side
    const fx = x + Math.cos(this.angle) * lateral - Math.sin(this.angle) * .085
    const fz = z - Math.sin(this.angle) * lateral - Math.cos(this.angle) * .085
    if (this.species === 'penguin') prints.add(fx, fz, this.angle + this.side * .15, this.height * .32, time)
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



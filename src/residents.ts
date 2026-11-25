import * as T from 'three'
import { createAnimal } from './animals'
import type { Penguin, PenguinSave } from './penguin'
import type { Footprints, Snowfield, SnowParticles } from './snow'
import { buildingCenter, buildingInfo, buildingKind, propBlocks, type Building } from './buildings'

export const MAX_OUTSIDE_RESIDENTS = 48
type Rod = {root: T.Group, line: T.Line, bob: T.Mesh}
type Outing = {animal: Penguin, phase: 'walking' | 'pausing' | 'viewing' | 'fishing' | 'drinking' | 'returning' | 'entering',
  until: number, returnAfter: number, visit?: Building, rod?: Rod, drink?: T.Group, turnSide?: number, social?: Social}
type Chase = {leader: Outing, target: T.Vector2, nextTurn: number, nextSwap: number}
type Social = {pair: [Outing, Outing], until: number, chase?: Chase}
const detourAngles = [.42, .84, 1.25, 1.62, 2.05, 2.6]
type Resident = {home: Building, due: number, outing?: Outing}
const rodMaterial = new T.LineBasicMaterial({color: 0x805334})
const lineMaterial = new T.LineBasicMaterial({color: 0x526d83, transparent: true, opacity: .84})
const bobGeometry = new T.SphereGeometry(.080, 9, 6)
const bobMaterial = new T.MeshStandardMaterial({color: 0xe98b72})
const cupShape = new T.CylinderGeometry(.13, .095, .20, 12, 1, true)
const cupMaterial = new T.MeshStandardMaterial({color: 0xdaf4fa, side: T.DoubleSide})
const waterShape = new T.CylinderGeometry(.028, .016, .24, 8)
const waterMaterial = new T.MeshStandardMaterial({color: 0x8cdcf4})

export class Residents {
  private roster = new Map<PenguinSave, Resident>()
  private homes: Building[] = []
  private decorations: Building[] = []
  private nextCheck = 0
  private active = 0
  private door = new T.Vector2()
  private waypoint = new T.Vector2()
  private step = new T.Vector2()

  constructor(private scene: T.Scene, private tile: number, private width: number, private height: number) {}

  sync(buildings: Building[], time: number) {
    this.homes = buildings.filter(house => buildingInfo(house).capacity > 0)
    this.decorations = buildings.filter(item => !buildingInfo(item).capacity)
    const current = new Set<PenguinSave>()
    for (const home of this.homes) for (const saved of home.residents) {
      current.add(saved)
      const existing = this.roster.get(saved)
      if (existing) existing.home = home
      else this.roster.set(saved, {home, due: time + .9 + Math.random() * 5})
    }
    for (const [saved, resident] of this.roster) {
      if (current.has(saved)) continue
      if (resident.outing) this.finish(resident, time)
      this.roster.delete(saved)
    }
  }

  update(dt: number, time: number, px: number, pz: number, snow: Snowfield, prints: Footprints, flakes: SnowParticles) {
    if (time >= this.nextCheck) {
      this.nextCheck = time + 2.1 + Math.random() * 3.7
      this.scheduleOne(time, px, pz)
      if (Math.random() < .45) this.meet(time)
    }
    for (const resident of this.roster.values()) {
      if (resident.outing) this.updateOuting(resident, dt, time, snow, prints, flakes)
    }
  }

  private scheduleOne(time: number, px: number, pz: number) {
    const departures: [PenguinSave, Resident][] = []
    const returns: Outing[] = []
    let nearby = 0
    for (const [saved, resident] of this.roster) {
      const outing = resident.outing
      if (outing && !outing.social && time >= outing.returnAfter && (outing.phase === 'pausing' || outing.phase === 'walking')) returns.push(outing)
      this.exit(resident.home)
      if ((this.door.x - px) ** 2 + (this.door.y - pz) ** 2 >= 35 ** 2) continue
      nearby++
      if (!outing && time >= resident.due) departures.push([saved, resident])
    }
    const target = Math.min(MAX_OUTSIDE_RESIDENTS, Math.min(nearby, Math.max(2, Math.ceil(nearby * .42))))
    const returnChance = returns.length ? (this.active > target ? .70 : this.active === target ? .43 : .15) : 0
    const departureChance = departures.length && this.active < MAX_OUTSIDE_RESIDENTS
      ? (this.active < target ? .72 : this.active === target && target >= 2 ? .16 : 0) : 0
    const roll = Math.random()
    if (roll < returnChance) {
      const outing = returns[Math.floor(Math.random() * returns.length)]
      outing.visit = undefined
      outing.phase = 'returning'
    } else if (roll < returnChance + departureChance) {
      const [saved, resident] = departures[Math.floor(Math.random() * departures.length)]
      this.exit(resident.home)
      this.start(saved, resident, time)
    }
  }

  private start(saved: PenguinSave, resident: Resident, time: number) {
    const animal = createAnimal(this.scene, this.door.x, this.door.y, 'solo', false, saved.seed, saved.species)
    animal.angle = this.angle(resident.home)
    const outing: Outing = {animal, phase: 'walking', until: time + 5, returnAfter: time + 8 + Math.random() * 11}
    resident.outing = outing
    this.walkAround(resident, outing, time)
    this.active++
  }

  private updateOuting(resident: Resident, dt: number, time: number, snow: Snowfield, prints: Footprints, flakes: SnowParticles) {
    const outing = resident.outing!
    const {animal} = outing
    animal.speed = 0
    if (outing.social) {
      const {pair, until, chase} = outing.social
      if (time >= until) this.endMeeting(outing.social, time)
      else {
        const other = pair[0] === outing ? pair[1] : pair[0]
        if (chase) this.playChase(outing, other, chase, time, dt)
        else {
          animal.faceToward(other.animal.position, dt)
          animal.restPose = 'chat'
        }
        animal.animate(dt, time, snow, prints, flakes)
        return
      }
    }
    if (outing.visit && !this.decorations.includes(outing.visit)) {
      this.clearVisit(outing)
      this.walkAround(resident, outing, time)
    }
    if (outing.phase === 'walking') {
      this.walkTo(outing, resident.home, animal.target, 1.15, dt)
      const arrived = animal.position.distanceToSquared(animal.target) < .13 ** 2
      if (arrived && outing.visit) {
        const kind = buildingKind(outing.visit)
        outing.phase = kind === 'fishing' ? 'fishing' : kind === 'filter' ? 'drinking' : 'viewing'
        outing.until = time + (outing.phase === 'fishing' ? 6.5 + Math.random() * 3 : outing.phase === 'drinking' ? 4 : 2 + Math.random() * 2)
        if (outing.phase === 'fishing') this.startFishing(outing)
        if (outing.phase === 'drinking') this.startDrinking(outing, time)
      } else if (arrived || time >= outing.until) {
        outing.visit = undefined
        outing.phase = 'pausing'
        outing.until = time + 2 + Math.random() * 3.6
      }
    } else if (outing.phase === 'pausing' && time >= outing.until) {
      this.walkAround(resident, outing, time)
    } else if (outing.visit && (outing.phase === 'viewing' || outing.phase === 'fishing' || outing.phase === 'drinking')) {
      const center = buildingCenter(outing.visit)
      animal.faceToward(this.waypoint.set(center.x * this.tile, center.y * this.tile), dt)
      if (outing.rod) this.animateRod(outing.rod, time)
      if (outing.drink) this.animateDrink(outing, time)
      if (time >= outing.until) {
        this.clearVisit(outing)
        outing.phase = 'pausing'
        outing.until = time + 1.3
      }
    }
    if (outing.phase === 'returning') {
      this.exit(resident.home)
      this.walkTo(outing, resident.home, this.door, 1.55, dt)
      if (animal.position.distanceToSquared(this.door) < .16 ** 2) {
        outing.phase = 'entering'
        outing.until = time + .38
      }
    } else if (outing.phase === 'entering') {
      if (time >= outing.until) {
        this.finish(resident, time)
        return
      }
      animal.root.scale.setScalar((outing.until - time) / .38)
    }
    animal.animate(dt, time, snow, prints, flakes)
  }

  private finish(resident: Resident, time: number) {
    if (resident.outing?.social) this.endMeeting(resident.outing.social, time)
    if (resident.outing) this.clearVisit(resident.outing)
    resident.outing?.animal.dispose(this.scene)
    resident.outing = undefined
    resident.due = time + 4.5 + Math.random() * 10
    this.active--
  }

  private walkAround(resident: Resident, outing: Outing, time: number) {
    this.exit(resident.home)
    outing.phase = 'walking'
    outing.until = time + 5 + Math.random() * 5
    if (Math.random() < .38) {
      const choices = this.decorations.filter(item => {
        const center = buildingCenter(item)
        return (buildingKind(item) !== 'filter' || outing.animal.species === 'penguin') &&
          (center.x * this.tile - this.door.x) ** 2 + (center.y * this.tile - this.door.y) ** 2 < 12 ** 2 &&
          ![...this.roster.values()].some(r => r.outing?.visit === item)
      })
      if (choices.length) {
        const item = choices[Math.floor(Math.random() * choices.length)]
        const center = buildingCenter(item)
        const x = center.x * this.tile
        const z = center.y * this.tile
        const filter = buildingKind(item) === 'filter'
        const reach = buildingInfo(item).radius * this.tile + (filter ? .45 : .56)
        this.waypoint.set(outing.animal.position.x - x, outing.animal.position.y - z)
        const bearing = filter ? (item.rotation ?? 0) * Math.PI / 4 : Math.atan2(this.waypoint.x, this.waypoint.y)
        for (const offset of filter ? [0] : [0, .8, -.8, 1.6, -1.6, Math.PI]) {
          const px = x + Math.sin(bearing + offset) * reach
          const pz = z + Math.cos(bearing + offset) * reach
          if (px < .4 || pz < .4 || px > this.width * this.tile - .4 || pz > this.height * this.tile - .4) continue
          if (this.homes.some(home => this.inside(home, px, pz)) ||
            this.decorations.some(item => propBlocks(item, px / this.tile, pz / this.tile))) continue
          outing.visit = item
          outing.animal.target.set(px, pz)
          outing.until = time + 14
          return
        }
      }
    }
    this.pickTarget(resident.home, outing.animal)
  }

  private meet(time: number) {
    const available = [...this.roster.values()].flatMap(({outing}) =>
      outing && !outing.social && !outing.visit && (outing.phase === 'walking' || outing.phase === 'pausing') &&
      outing.animal.species === 'penguin' ? [outing] : [])
    const pairs: [Outing, Outing][] = []
    for (const [index, first] of available.entries()) for (const second of available.slice(index + 1)) {
      const distance = first.animal.position.distanceToSquared(second.animal.position)
      if (distance > 1.05 ** 2 && distance < 2.8 ** 2) pairs.push([first, second])
    }
    if (!pairs.length) return
    const pair = pairs[Math.floor(Math.random() * pairs.length)]
    const chicks = pair.every(({animal}) => animal.chick)
    const social: Social = {pair, until: time + (chicks ? 7 : 3.5) + Math.random() * 3}
    if (chicks) {
      social.chase = {leader: pair[0], target: new T.Vector2(), nextTurn: time, nextSwap: time + 2.7}
    }
    for (const outing of pair) outing.social = social
  }

  private playChase(outing: Outing, other: Outing, chase: Chase, time: number, dt: number) {
    const {animal} = outing
    if (time >= chase.nextSwap) {
      chase.leader = chase.leader === outing ? other : outing
      chase.nextSwap = time + 2.7
      chase.nextTurn = time
    }
    animal.restPose = 'hop'
    if (chase.leader !== outing) {
      if (animal.position.distanceToSquared(other.animal.position) > .85 ** 2) {
        this.walkTo(outing, undefined, other.animal.position, 2.15, dt)
      }
      return
    }
    if (time >= chase.nextTurn || animal.position.distanceToSquared(chase.target) < .45 ** 2) {
      const x = animal.position.x, y = animal.position.y
      const away = Math.atan2(x - other.animal.position.x, y - other.animal.position.y)
      chase.target.copy(animal.position)
      for (const offset of [1, -1, 0, 2, -2]) {
        const angle = away + offset
        const px = x + Math.sin(angle) * 3.8, py = y + Math.cos(angle) * 3.8
        if (px < .6 || py < .6 || px > this.width * this.tile - .6 || py > this.height * this.tile - .6 ||
          this.homes.some(home => this.inside(home, px, py)) ||
          this.decorations.some(item => propBlocks(item, px / this.tile, py / this.tile))) continue
        chase.target.set(px, py)
        break
      }
      chase.nextTurn = time + 1.5
    }
    this.walkTo(outing, undefined, chase.target, 1.9, dt)
  }

  private endMeeting({pair}: Social, time: number) {
    for (const outing of pair) {
      outing.social = undefined
      outing.animal.restPose = undefined
      outing.phase = 'pausing'
      outing.until = time + .35 + Math.random()
    }
  }

  private walkTo(outing: Outing, home: Building | undefined, target: T.Vector2, speed: number, dt: number) {
    const {animal} = outing
    const {x, y} = animal.position
    const distance = animal.position.distanceTo(target)
    if (distance < .0001) return
    const stride = speed * dt
    const heading = Math.atan2(target.x - x, target.y - y)
    const canStep = (angle: number, length: number) => {
      this.step.set(x + Math.sin(angle) * length, y + Math.cos(angle) * length)
      const gx = this.step.x / this.tile, gy = this.step.y / this.tile
      return gx >= 0 && gy >= 0 && gx <= this.width && gy <= this.height &&
        !this.homes.some(other => other !== home && this.inside(other, this.step.x, this.step.y)) &&
        !this.decorations.some(item => propBlocks(item, gx, gy, x / this.tile, y / this.tile))
    }
    if (canStep(heading, Math.min(distance, Math.max(stride, .6))) &&
        canStep(heading, Math.min(distance, stride))) {
      outing.turnSide = undefined
      animal.move(target, speed, dt)
      return
    }
    for (const side of [outing.turnSide ?? 1, -(outing.turnSide ?? 1)]) {
      for (const offset of detourAngles) {
        if (!canStep(heading + side * offset, stride)) continue
        outing.turnSide = side
        animal.move(this.step, speed, dt)
        return
      }
    }
  }

  private startFishing(outing: Outing) {
    const root = new T.Group()
    const grip = new T.Vector3(.29, .57, .18)
    const tip = new T.Vector3(.27, 1.35, 1.32)
    const rod = new T.Line(new T.BufferGeometry().setFromPoints([grip, new T.Vector3(.30, 1.04, .64), tip]), rodMaterial)
    const line = new T.Line(new T.BufferGeometry().setFromPoints([tip, new T.Vector3(.17, .20, 2.18)]), lineMaterial)
    const bob = new T.Mesh(bobGeometry, bobMaterial)
    root.add(rod, line, bob)
    outing.animal.root.add(root)
    outing.animal.restPose = 'fish'
    outing.rod = {root, line, bob}
  }

  private animateRod({line, bob, root}: Rod, time: number) {
    root.rotation.x = Math.sin(time * 2.5) * .035
    bob.position.set(.17, .20 + Math.sin(time * 5.1) * .022, 2.18)
    line.geometry.attributes.position.setXYZ(1, bob.position.x, bob.position.y, bob.position.z)
    line.geometry.attributes.position.needsUpdate = true
  }

  private startDrinking(outing: Outing, time: number) {
    const drink = new T.Group()
    drink.add(new T.Mesh(cupShape, cupMaterial), new T.Mesh(waterShape, waterMaterial))
    outing.animal.root.add(drink)
    outing.drink = drink
    this.animateDrink(outing, time)
  }

  private animateDrink(outing: Outing, time: number) {
    const [cup, stream] = outing.drink!.children
    const elapsed = 4 - (outing.until - time)
    const sip = T.MathUtils.smoothstep(elapsed, 1.5, 2.2) * (1 - T.MathUtils.smoothstep(elapsed, 3.2, 4))
    cup.position.set(.11 * sip, .43 + sip * .53, .54 - sip * .15)
    cup.rotation.x = -sip * .65
    stream.position.set(0, .59, .54)
    stream.visible = elapsed > .35 && elapsed < 1.5
    outing.animal.restPose = sip > .35 ? 'drink' : 'fish'
  }

  private clearVisit(outing: Outing) {
    outing.visit = undefined
    outing.animal.restPose = undefined
    outing.drink?.removeFromParent()
    outing.drink = undefined
    if (!outing.rod) return
    const {root} = outing.rod
    root.removeFromParent()
    for (const child of root.children) if (child instanceof T.Line) child.geometry.dispose()
    outing.rod = undefined
  }

  private angle(home: Building) { return (home.rotation ?? 0) * Math.PI / 4 }

  private exit(home: Building) {
    const angle = this.angle(home)
    const center = buildingCenter(home)
    const reach = 3.07 * buildingInfo(home).size / 2
    this.door.set(center.x * this.tile + Math.sin(angle) * reach, center.y * this.tile + Math.cos(angle) * reach)
    if (!this.decorations.some(item => propBlocks(item, this.door.x / this.tile, this.door.y / this.tile))) return
    // A decoration can cover the entrance. Use the nearest open spot beside it.
    const {x, y} = this.door
    for (const distance of [.9, 1.7, 2.7]) for (const offset of [0, .7, -.7, 1.4, -1.4]) {
      const gx = (x + Math.sin(angle + offset) * distance) / this.tile
      const gy = (y + Math.cos(angle + offset) * distance) / this.tile
      if (gx < 0 || gy < 0 || gx > this.width || gy > this.height ||
        this.homes.some(other => other !== home && this.inside(other, gx * this.tile, gy * this.tile)) ||
        this.decorations.some(item => propBlocks(item, gx, gy))) continue
      this.door.set(gx * this.tile, gy * this.tile)
      return
    }
  }

  private inside(home: Building, x: number, z: number) {
    const size = buildingInfo(home).size
    return x / this.tile > home.x - .12 && x / this.tile < home.x + size + .12
      && z / this.tile > home.y - .12 && z / this.tile < home.y + size + .12
  }

  private pickTarget(home: Building, animal: Penguin) {
    for (let i = 0; i < 9; i++) {
      const angle = this.angle(home) + (Math.random() - .5) * Math.PI * .9
      const distance = 2.4 + Math.random() * 4.6
      this.waypoint.set(this.door.x + Math.sin(angle) * distance, this.door.y + Math.cos(angle) * distance)
      this.waypoint.x = T.MathUtils.clamp(this.waypoint.x, .4, this.width * this.tile - .4)
      this.waypoint.y = T.MathUtils.clamp(this.waypoint.y, .4, this.height * this.tile - .4)
      if (this.homes.some(other => other !== home && this.inside(other, this.waypoint.x, this.waypoint.y))) continue
      if (this.decorations.some(item => propBlocks(item, this.waypoint.x / this.tile, this.waypoint.y / this.tile))) continue
      animal.target.copy(this.waypoint)
      return
    }
    animal.target.copy(this.door)
  }
}

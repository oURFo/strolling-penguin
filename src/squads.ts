import * as T from 'three'
import { Penguin, type PenguinSave } from './penguin'
import { Seal } from './seal'
import { Mammoth } from './mammoth'
import { RestActivities } from './rest'
import { type Snowfield, type SnowParticles } from './snow'

const RECRUIT = 2.15
export const HONK = 7.5
const WALK_SCALE = .75
const WALK = 3.45 * WALK_SCALE
const SOLO_WALK = .66 * WALK_SCALE
const NPC_WALK = 1.65 * WALK_SCALE
const PLAYER_FOLLOW = 4.65 * WALK_SCALE
const NPC_FOLLOW = 2.75 * WALK_SCALE
const SOLO_SPAWN = 1 / 5
const SEAL_SPAWN = 1 / 100
const MAMMOTH_SPAWN = 1 / 1000
const SQUAD_SPAWN = 1 / 8
const INCIDENT_CHANCE = .84 / 10
const PLAYER_INCIDENT_SAMPLE = 7
const INCIDENT_MARKER_DURATION = 2
const RECOVERY_TIMEOUT = 10
const VISIT_CHANCE = .12
const VISIT_RADIUS = 18
const VISIT_DURATION = 22
const desired = new T.Vector2()
const absolute = new T.Vector2()
const separation = new T.Vector2()

type Incident = {
  actor: Penguin
  kind: 'trip' | 'dream' | 'stray'
  target?: Penguin
  falls: {member: Penguin, delay: number}[]
  elapsed: number
}
type Squad = {
  members: Penguin[]
  roll: number
  recallable?: boolean
  incident?: Incident
  visit?: {target: Penguin, until: number}
}
type SavedIncident = Omit<Incident, 'actor' | 'target' | 'falls'> & {
  actor: number
  target?: number
  falls: {member: number, delay: number}[]
}
export type ColonySave = {
  penguins: PenguinSave[]
  solos: number[]
  squads: {members: number[], roll: number, recallable?: boolean, incident?: SavedIncident, visit?: {target: number, until: number}}[]
  populated: string[]
  seals?: {position: [number, number], seed: number}[]
}

export class Colonies {
  penguins = new Set<Penguin>()
  player: Penguin
  party: Squad
  squads: Squad[]
  readonly rest: RestActivities
  private solos = new Set<Penguin>()
  private frustum = new T.Frustum()
  private projection = new T.Matrix4()
  private testPoint = new T.Vector3()
  private populated = new Set<string>()

  constructor(private scene: T.Scene, private snow: Snowfield, private flakes: SnowParticles,
    private notify: (text: string, sound?: boolean) => void, saved?: ColonySave) {
    this.rest = new RestActivities(snow, flakes)
    if (saved) {
      const playerId = saved.squads[0]?.members[0]
      const penguins = saved.penguins.map((entry, id) => {
        if (entry.position.length !== 2 || !entry.position.every(Number.isFinite) || !entry.route.length) {
          throw new Error('Invalid saved penguin')
        }
        const p = this.add(...entry.position, entry.status, id === playerId, entry.seed, entry.species)
        p.restore(entry)
        return p
      })
      const bird = (id: number) => {
        const p = penguins[id]
        if (!p) throw new Error('Invalid saved squad member')
        return p
      }
      this.player = bird(playerId)
      this.solos = new Set(saved.solos.map(bird))
      this.squads = saved.squads.map(({members, roll, recallable, incident, visit}) => ({
        members: members.map(bird), roll, recallable,
        incident: incident && {
          ...incident, actor: bird(incident.actor),
          target: incident.target === undefined ? undefined : penguins[incident.target],
          falls: incident.falls.map(({member, delay}) => ({member: bird(member), delay})),
        },
        visit: visit && penguins[visit.target] ? {target: bird(visit.target), until: visit.until} : undefined,
      }))
      this.party = this.squads[0]
      if (this.party.incident) this.detach(this.party.incident)
      this.populated = new Set(saved.populated)
      for (const {position, seed} of saved.seals ?? []) this.solo(...position, 0, 'seal', seed)
      return
    }
    this.player = this.add(0, 0, 'leader', true)
    this.player.angle = .36
    this.party = {members: [this.player], roll: 8}
    this.squads = [this.party]
    for (const [x, z] of [[-1.2, -4.3], [3.4, -5.4], [-6.2, -1.7], [3.1, 1.3], [-5.8, -8.9], [.4, 6.1]]) {
      if (Math.random() < SOLO_SPAWN) this.solo(x, z)
    }
    for (const [x, z] of [[8, -9], [-10, -11]]) {
      if (Math.random() < SQUAD_SPAWN) this.squad(x, z, 3)
    }
  }

  snapshot(): ColonySave {
    const penguins = [...this.penguins]
    const ids = new Map(penguins.map((penguin, i) => [penguin, i]))
    const id = (p: Penguin) => ids.get(p)!
    return {
      penguins: penguins.map(p => p.snapshot()),
      solos: [...this.solos].map(id),
      squads: this.squads.map(({members, roll, recallable, incident, visit}) => ({
        members: members.map(id), roll, recallable,
        incident: incident && {
          ...incident, actor: id(incident.actor), target: incident.target && ids.get(incident.target),
          falls: incident.falls.map(({member, delay}) => ({member: id(member), delay})),
        },
        visit: visit && ids.has(visit.target) ? {target: id(visit.target), until: visit.until} : undefined,
      })),
      populated: [...this.populated],
    }
  }

  private add(x: number, z: number, status: Penguin['status'], player = false, seed?: number, species: Penguin['species'] = 'penguin') {
    const penguin = species === 'mammoth' ? new Mammoth(this.scene, x, z, status, seed)
      : species === 'seal' ? new Seal(this.scene, x, z, status, seed)
      : new Penguin(this.scene, x, z, status, player, seed)
    this.penguins.add(penguin)
    return penguin
  }

  private solo(x: number, z: number, time = 0, species: Penguin['species'] = 'penguin', seed?: number) {
    const penguin = this.add(x, z, 'solo', false, seed, species)
    penguin.nextTurn = time + 1.5 + Math.random() * 5
    this.solos.add(penguin)
  }

  private squad(x: number, z: number, followers: number) {
    const leader = this.add(x, z, 'leader')
    const members = [leader]
    for (let i = 0; i < followers; i++) {
      const follower = this.add(x - .25 * (i + 1), z - 1.02 * (i + 1), 'follow')
      const predecessor = members[members.length - 1]
      predecessor.route.unshift(follower.position.clone())
      members.push(follower)
    }
    this.squads.push({members, roll: 8 + Math.random() * 6})
  }

  private roam(p: Penguin, dt: number, time: number, speed: number) {
    if (time >= p.nextTurn) {
      p.nextTurn = time + 3 + Math.random() * 5
      p.target.copy(p.position)
      const angle = p.angle + (Math.random() - .5) * 2.8
      p.target.x += Math.sin(angle) * 13
      p.target.y += Math.cos(angle) * 13
    }
    p.move(p.target, speed, dt)
  }

  private strollAlone(p: Penguin, dt: number, time: number) {
    if (p.position.distanceToSquared(p.target) > .0001) {
      p.move(p.target, SOLO_WALK, dt)
      if (p.position.distanceToSquared(p.target) <= .0001) {
        p.target.copy(p.position)
        p.nextTurn = time + 2.5 + Math.random() * 6.5
      }
      return
    }
    if (time < p.nextTurn) return
    const angle = p.angle + (Math.random() - .5) * Math.PI * 1.6
    const distance = 1.25 + Math.random() * 2.25
    p.target.set(p.position.x + Math.sin(angle) * distance, p.position.y + Math.cos(angle) * distance)
  }

  update(dt: number, time: number, input: T.Vector2, camera: T.Camera) {
    const player = this.player
    for (const p of this.penguins) p.speed = 0
    const inputStrength = input.length()
    const moving = inputStrength > .025
    if (moving) {
      desired.copy(player.position).addScaledVector(input, WALK * dt)
      player.move(desired, WALK * Math.min(1, inputStrength), dt)
    }
    player.track()
    this.populate(time)
    this.projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    this.frustum.setFromProjectionMatrix(this.projection)
    for (const solo of this.solos) {
      const recruitRange = Math.max(RECRUIT, solo.formationRadius + player.formationRadius + .65)
      if (solo.position.distanceToSquared(player.position) <= recruitRange ** 2) {
        if (solo.recruit === 0) {
          solo.target.copy(solo.position)
          solo.nextTurn = time + 2.5 + Math.random() * 3
        }
        solo.recruit += dt
        if (solo.recruit >= 1) {
          this.solos.delete(solo)
          solo.recruit = 0
          solo.status = 'follow'
          solo.joy = .72
          solo.protectedUntil = time + 5
          this.party.members.push(solo)
          this.notify(solo.species === 'mammoth' ? '長毛象加入了散步隊伍。'
            : solo.species === 'seal' ? '海豹加入了散步隊伍。' : '又一位夥伴加入了散步隊伍。', true)
        }
      } else {
        solo.recruit = 0
        this.strollAlone(solo, dt, time)
      }
      solo.track()
    }
    this.rest.update(this.party.members, dt, time, moving, this.frustum)
    for (const squad of [...this.squads]) this.updateSquad(squad, dt, time)
    this.keepMammothsClear()
    this.rollIncidents(dt, time)
  }

  private populate(time: number) {
    const player = this.player.position
    absolute.set(player.x + this.snow.offset.x, player.y + this.snow.offset.y)
    const cx = Math.floor((absolute.x + 10) / 20)
    const cz = Math.floor((absolute.y + 10) / 20)
    for (let z = cz - 2; z <= cz + 2; z++) {
      for (let x = cx - 2; x <= cx + 2; x++) {
        const key = x + ',' + z
        if (this.populated.has(key)) continue
        this.populated.add(key)
        const px = x * 20 - this.snow.offset.x
        const pz = z * 20 - this.snow.offset.y
        if (Math.random() < MAMMOTH_SPAWN) {
          this.solo(px + Math.random() * 12 - 6, pz + Math.random() * 12 - 6, time, 'mammoth')
        }
        if (Math.random() < SEAL_SPAWN) {
          this.solo(px + Math.random() * 12 - 6, pz + Math.random() * 12 - 6, time, 'seal')
        }
        if (x === 0 && z === 0) continue
        if (Math.random() < SOLO_SPAWN) this.solo(px + Math.random() * 8 - 4, pz + Math.random() * 8 - 4, time)
        if ((x + 2 * z) % 4 === 0 && Math.random() < SQUAD_SPAWN) {
          this.squad(px - 5, pz + 4, 2 + Math.floor(Math.random() * 7))
        }
      }
    }
    for (const key of this.populated) {
      const [x, z] = key.split(',').map(Number)
      if (Math.abs(x - cx) <= 3 && Math.abs(z - cz) <= 3) continue
      this.populated.delete(key)
    }
    for (const p of this.solos) {
      if (p.position.distanceToSquared(player) > 82 ** 2) {
        this.solos.delete(p)
        this.remove(p)
      }
    }
    for (const squad of this.squads.slice(1)) {
      if (squad.recallable) continue
      if (squad.members.some(p => p.position.distanceToSquared(player) < 82 ** 2)) continue
      this.squads.splice(this.squads.indexOf(squad), 1)
      for (const p of squad.members) this.remove(p)
    }
  }

  private remove(p: Penguin) {
    this.penguins.delete(p)
    p.dispose(this.scene)
  }

  private keepMammothsClear() {
    for (const mammoth of this.penguins) {
      if (mammoth.species !== 'mammoth') continue
      for (const animal of this.penguins) {
        if (animal === mammoth) continue
        const distance = mammoth.formationRadius + animal.formationRadius + .08
        separation.subVectors(animal.position, mammoth.position)
        if (separation.lengthSq() >= distance ** 2) continue
        if (separation.lengthSq() < 1e-8) separation.set(Math.sin(mammoth.angle), Math.cos(mammoth.angle)).negate()
        animal.position.copy(mammoth.position).add(separation.setLength(distance))
        animal.track()
      }
    }
  }

  private leadNpcSquad(squad: Squad, dt: number, time: number) {
    const leader = squad.members[0]
    if (squad.incident) {
      squad.visit = undefined
      this.roam(leader, dt, time, squad.incident.elapsed > 2.5 ? 0 : NPC_WALK)
      return
    }
    if (time >= leader.nextTurn && !squad.visit && Math.random() < VISIT_CHANCE) {
      let nearest = VISIT_RADIUS ** 2
      for (const solo of this.solos) {
        const distance = leader.position.distanceToSquared(solo.position)
        if (distance <= 2 ** 2 || distance > nearest) continue
        nearest = distance
        squad.visit = {target: solo, until: time + VISIT_DURATION}
      }
    }
    const visit = squad.visit
    if (visit && time < visit.until && this.solos.has(visit.target)) {
      if (leader.position.distanceToSquared(visit.target.position) > 1.65 ** 2) {
        leader.move(visit.target.position, NPC_WALK, dt)
        return
      }
      leader.target.copy(leader.position)
      leader.nextTurn = time + 2
    }
    squad.visit = undefined
    this.roam(leader, dt, time, NPC_WALK)
  }

  private updateSquad(squad: Squad, dt: number, time: number) {
    const members = squad.members
    const leader = members[0]
    if (squad !== this.party && !squad.recallable) {
      this.leadNpcSquad(squad, dt, time)
      leader.track()
    }
    const event = squad.incident
    const source = event ? members.indexOf(event.actor) : -1
    const strayPace = (squad.recallable ? WALK : NPC_WALK) * .5
    const followPace = squad === this.party || squad.recallable ? PLAYER_FOLLOW : NPC_FOLLOW
    if (event) {
      event.elapsed += dt
      if (squad.recallable && this.splitAfterTimeout(squad, event, time)) return
      if (event.kind === 'trip') {
        for (const fall of event.falls) {
          if (fall.delay <= event.elapsed && fall.member.status === 'follow') this.fall(fall.member)
        }
      } else if (event.kind === 'stray' && (!event.target || !this.penguins.has(event.target) || members.includes(event.target))) {
        if (squad.recallable) this.rejoin(squad, time)
        else this.resolve(squad, time)
        return
      }
      if (!squad.recallable && squad.incident && event.elapsed >= 3.4 && event.kind !== 'stray') {
        leader.honk = .6
        this.resolve(squad, time)
      }
    }

    for (let i = squad.recallable ? 0 : 1; i < members.length; i++) {
      const current = members[i]
      if (squad === this.party && this.rest.includes(current)) {
        current.track()
        continue
      }
      const previous = members[i - 1]
      if (current.status === 'stray' && event?.target) {
        current.move(event.target.position, strayPace, dt)
      } else if (current.status === 'trip' && current.slide > 0) {
        current.slide = Math.max(0, current.slide - dt)
        current.position.x += Math.sin(current.angle) * current.slide * 5 * dt
        current.position.y += Math.cos(current.angle) * current.slide * 5 * dt
      } else if (i > 0 && current.status === 'follow' && !(squad.incident?.kind === 'dream' && i > source)) {
        const gap = current.formationRadius + previous.formationRadius + .61
        const target = previous.breadcrumb(gap, desired)
        const pace = squad.incident?.kind === 'stray' && i > source ? strayPace : followPace
        if (current.position.distanceToSquared(target) > .025 ** 2 && (current.position.distanceToSquared(previous.position) > (gap * .74) ** 2 ||
          desired.distanceToSquared(previous.position) > current.position.distanceToSquared(previous.position))) current.move(target, pace, dt)
      }
      current.track()
    }

    if (squad.incident?.kind === 'stray' && event?.target) {
      if (event.actor.position.distanceToSquared(event.target.position) < 1.1 ** 2) this.merge(squad, event, time)
      else if (!squad.recallable && event.elapsed > 14) this.resolve(squad, time)
    }
  }

  private detach(event: Incident) {
    const members = this.party.members.splice(this.party.members.indexOf(event.actor))
    event.falls = event.falls.filter(fall => members.includes(fall.member))
    this.party.incident = undefined
    this.squads.push({members, roll: 10, recallable: true, incident: event})
  }

  private splitAfterTimeout(squad: Squad, event: Incident, time: number) {
    if (event.kind === 'stray') return false
    const start = event.kind === 'trip' ? event.falls.find(fall => fall.member.status === 'trip')?.delay : 0
    if (start === undefined || event.elapsed - start < RECOVERY_TIMEOUT) return false
    const {members} = squad
    const leader = members[0]
    for (const member of members) {
      const wasWaiting = member.status === 'trip' || member.status === 'dream'
      member.status = member === leader ? 'leader' : 'follow'
      member.slide = 0
      member.joy = wasWaiting ? .34 : 0
      member.protectedUntil = time + 5
    }
    leader.target.copy(leader.position)
    leader.nextTurn = time + .7
    squad.recallable = undefined
    squad.incident = undefined
    squad.roll = 10
    this.party.roll = 10
    this.notify('等候的夥伴自己組成了新隊伍，繼續在雪地散步。')
    return true
  }

  private rollIncidents(dt: number, time: number) {
    const active = this.squads.some(squad => squad.incident)
    const successes: {squad: Squad, actor: Penguin}[] = []
    for (const squad of this.squads) {
      if (squad === this.party && this.rest.active) continue
      if (squad.incident || squad.members.length < 2) continue
      squad.roll = Math.max(0, squad.roll - dt)
      if (active || squad.roll > 0) continue
      squad.roll = 8 + Math.random() * 7
      const candidates = squad.members.slice(1)
      if (squad === this.party && candidates.length > PLAYER_INCIDENT_SAMPLE) {
        for (let i = 0; i < PLAYER_INCIDENT_SAMPLE; i++) {
          const pick = i + Math.floor(Math.random() * (candidates.length - i))
          const actor = candidates[pick]
          candidates[pick] = candidates[i]
          candidates[i] = actor
        }
        candidates.length = PLAYER_INCIDENT_SAMPLE
      }
      for (const actor of candidates) {
        if (actor.status === 'follow' && actor.speed > .25 && actor.protectedUntil <= time && Math.random() < INCIDENT_CHANCE) {
          successes.push({squad, actor})
        }
      }
    }
    if (successes.length === 0) return
    const {squad, actor} = successes[Math.floor(Math.random() * successes.length)]
    const roll = Math.random()
    const target = roll > .59 ? this.strayTarget(squad, actor) : undefined
    const kind = target ? 'stray' : roll < .34 ? 'trip' : 'dream'
    const falls: Incident['falls'] = []
    if (kind === 'trip') {
      let delay = 0
      for (const member of squad.members.slice(squad.members.indexOf(actor))) {
        falls.push({member, delay})
        delay += .2 + Math.random() * .8
      }
      this.fall(actor)
    } else {
      actor.status = kind
    }
    const incident = {actor, kind, target, falls, elapsed: 0} satisfies Incident
    if (squad === this.party) {
      this.detach(incident)
      this.notify(kind === 'trip' ? '有夥伴跌倒了，請在 10 秒內回去呼喚。'
        : kind === 'dream' ? '有夥伴停下來發呆了，請在 10 秒內回去呼喚。' : '有夥伴拐往別處了，趕快追上牠！')
    } else {
      squad.incident = incident
    }
  }

  private strayTarget(squad: Squad, actor: Penguin) {
    let best: Penguin | undefined
    let distance = 12 ** 2
    for (const candidate of this.penguins) {
      if (squad.members.includes(candidate) || this.party.members.includes(candidate)) continue
      const d = actor.position.distanceToSquared(candidate.position)
      if (d < 3.7 ** 2 || d > distance) continue
      const {x, y: z} = candidate.position
      this.testPoint.set(x, this.snow.height(x, z) + .65, z)
      if (!this.frustum.containsPoint(this.testPoint)) continue
      distance = d
      best = candidate
    }
    return best
  }

  private fall(p: Penguin) {
    p.status = 'trip'
    p.slide = .36
    const {x, y: z} = p.position
    this.flakes.burst(x, this.snow.height(x, z) + .2, z, 24, 2.15)
  }

  private merge(from: Squad, event: Incident, time: number) {
    const target = event.target
    if (!target) return
    let to = this.squads.find(s => s.members.includes(target))
    if (!to) {
      this.solos.delete(target)
      target.recruit = 0
      target.status = 'leader'
      target.nextTurn = time
      to = {members: [target], roll: 13}
      this.squads.push(to)
    }
    const moved = from.members.splice(from.members.indexOf(event.actor))
    for (const member of moved) {
      member.status = 'follow'
      member.protectedUntil = time + 5
    }
    to.members.push(...moved)
    from.incident = undefined
    from.roll = 10
    if (from.recallable) {
      this.squads.splice(this.squads.indexOf(from), 1)
      this.notify('有夥伴加入了別隊，牠們會留在那裡。')
    }
  }

  private resolve(squad: Squad, time: number) {
    const event = squad.incident
    if (!event) return
    for (const p of squad.members) {
      if (p.status === 'follow' || p.status === 'leader') continue
      p.status = 'follow'
      p.slide = 0
      p.joy = .72
      p.protectedUntil = time + 4
    }
    squad.incident = undefined
    squad.roll = 8 + Math.random() * 7
  }

  get waitingSquad() {
    return this.squads.find(squad => squad.recallable)
  }

  ready() {
    return this.waitingSquad?.members.some(p =>
      p.position.distanceToSquared(this.player.position) <= HONK ** 2) ?? false
  }

  showsIncidentMarker(p: Penguin) {
    if (p.status === 'stray') return true
    if (p.status !== 'trip' && p.status !== 'dream') return false
    const event = this.squads.find(squad => squad.incident)?.incident
    if (!event || event.kind !== p.status) return false
    const start = event.kind === 'trip' ? event.falls.find(fall => fall.member === p)?.delay : 0
    return start !== undefined && event.elapsed - start < INCIDENT_MARKER_DURATION
  }

  private rejoin(squad: Squad, time: number) {
    for (const p of squad.members) {
      p.status = 'follow'
      p.slide = 0
      p.joy = .72
      p.protectedUntil = time + 4
    }
    this.party.members.push(...squad.members)
    this.party.roll = 8 + Math.random() * 7
    this.squads.splice(this.squads.indexOf(squad), 1)
  }

  rescue(time: number) {
    const squad = this.waitingSquad
    if (!squad || !this.ready()) return false
    this.rejoin(squad, time)
    return true
  }
}


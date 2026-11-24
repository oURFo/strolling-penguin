import * as T from 'three'
import { Penguin } from './penguin'
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
const SQUAD_SPAWN = 1 / 8
const INCIDENT_CHANCE = .84 / 10
const VISIT_CHANCE = .12
const VISIT_RADIUS = 18
const VISIT_DURATION = 22
const desired = new T.Vector2()
const absolute = new T.Vector2()

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
  incident?: Incident
  visit?: {target: Penguin, until: number}
}

export class Colonies {
  penguins = new Set<Penguin>()
  player: Penguin
  party: Squad
  squads: Squad[]
  private solos = new Set<Penguin>()
  private frustum = new T.Frustum()
  private projection = new T.Matrix4()
  private testPoint = new T.Vector3()
  private populated = new Set<string>()

  constructor(private scene: T.Scene, private snow: Snowfield, private flakes: SnowParticles, private notify: (text: string, sound?: boolean) => void) {
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

  private add(x: number, z: number, status: Penguin['status'], player = false) {
    const penguin = new Penguin(this.scene, x, z, status, player)
    this.penguins.add(penguin)
    return penguin
  }

  private solo(x: number, z: number, time = 0) {
    const penguin = this.add(x, z, 'solo')
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
    desired.copy(player.position).addScaledVector(input, WALK * dt)
    player.move(desired, WALK * Math.min(1, input.length()), dt)
    player.track()
    this.populate(time)
    this.projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    this.frustum.setFromProjectionMatrix(this.projection)
    for (const solo of this.solos) {
      if (solo.position.distanceToSquared(player.position) <= RECRUIT ** 2) {
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
          this.notify('又一位夥伴加入了散步隊伍。', true)
        }
      } else {
        solo.recruit = 0
        this.strollAlone(solo, dt, time)
      }
      solo.track()
    }
    for (const squad of [...this.squads]) this.updateSquad(squad, dt, time)
  }

  private populate(time: number) {
    const player = this.player.position
    absolute.set(player.x + this.snow.offset.x, player.y + this.snow.offset.y)
    const cx = Math.floor((absolute.x + 10) / 20)
    const cz = Math.floor((absolute.y + 10) / 20)
    for (let z = cz - 2; z <= cz + 2; z++) {
      for (let x = cx - 2; x <= cx + 2; x++) {
        const key = x + ',' + z
        if ((x === 0 && z === 0) || this.populated.has(key)) continue
        this.populated.add(key)
        const px = x * 20 - this.snow.offset.x
        const pz = z * 20 - this.snow.offset.y
        if (Math.random() < SOLO_SPAWN) this.solo(px + Math.random() * 8 - 4, pz + Math.random() * 8 - 4, time)
        if ((x + 2 * z) % 4 === 0 && Math.random() < SQUAD_SPAWN) {
          this.squad(px - 5, pz + 4, 2 + Math.floor(Math.random() * 7))
        }
      }
    }
    for (const key of this.populated) {
      const [x, z] = key.split(',').map(Number)
      if (Math.abs(x - cx) > 3 || Math.abs(z - cz) > 3) this.populated.delete(key)
    }
    for (const p of this.solos) {
      if (p.position.distanceToSquared(player) > 82 ** 2) {
        this.solos.delete(p)
        this.remove(p)
      }
    }
    for (const squad of this.squads.slice(1)) {
      if (squad.members.some(p => p.position.distanceToSquared(player) < 82 ** 2)) continue
      this.squads.splice(this.squads.indexOf(squad), 1)
      for (const p of squad.members) this.remove(p)
    }
  }

  private remove(p: Penguin) {
    this.penguins.delete(p)
    p.dispose(this.scene)
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
    if (squad !== this.party) {
      this.leadNpcSquad(squad, dt, time)
      leader.track()
    }
    const event = squad.incident
    const source = event ? members.indexOf(event.actor) : -1
    const strayPace = (squad === this.party ? WALK : NPC_WALK) * .5
    const followPace = squad === this.party ? PLAYER_FOLLOW : NPC_FOLLOW
    if (event) {
      event.elapsed += dt
      if (event.kind === 'trip') {
        for (const fall of event.falls) {
          if (fall.delay <= event.elapsed && fall.member.status === 'follow') this.fall(fall.member)
        }
      } else if (event.kind === 'stray' && (!event.target || !this.penguins.has(event.target) || members.includes(event.target))) {
        this.resolve(squad, time)
      }
      if (squad !== this.party && squad.incident && event.elapsed >= 3.4 && event.kind !== 'stray') {
        leader.honk = .6
        this.resolve(squad, time)
      }
    }

    for (let i = 1; i < members.length; i++) {
      const current = members[i]
      const previous = members[i - 1]
      if (current.status === 'stray' && event?.target) {
        current.move(event.target.position, strayPace, dt)
      } else if (current.status === 'trip' && current.slide > 0) {
        current.slide = Math.max(0, current.slide - dt)
        current.position.x += Math.sin(current.angle) * current.slide * 5 * dt
        current.position.y += Math.cos(current.angle) * current.slide * 5 * dt
      } else if (current.status === 'follow' && !(squad.incident?.kind === 'dream' && i > source)) {
        const gap = current.radius + previous.radius + .61
        const target = previous.breadcrumb(gap, desired)
        const pace = squad.incident?.kind === 'stray' && i > source ? strayPace : followPace
        if (current.position.distanceToSquared(target) > .025 ** 2 && (current.position.distanceToSquared(previous.position) > (gap * .74) ** 2 ||
          desired.distanceToSquared(previous.position) > current.position.distanceToSquared(previous.position))) current.move(target, pace, dt)
      }
      current.track()
    }

    if (squad.incident?.kind === 'stray' && event?.target) {
      if (event.actor.position.distanceToSquared(event.target.position) < 1.1 ** 2) this.merge(squad, event, time)
      else if (squad !== this.party && event.elapsed > 14) this.resolve(squad, time)
    }
    if (squad.incident || members.length < 2) return
    squad.roll -= dt
    if (squad.roll > 0) return
    squad.roll = 8 + Math.random() * 7
    const candidates = members.slice(1).filter(p => p.status === 'follow' && p.speed > .25 && p.protectedUntil <= time)
    if (!candidates.length || Math.random() >= INCIDENT_CHANCE) return
    const actor = candidates[Math.floor(Math.random() * candidates.length)]
    const roll = Math.random()
    const target = roll > .59 ? this.strayTarget(squad, actor) : undefined
    const kind = target ? 'stray' : roll < .34 ? 'trip' : 'dream'
    const falls: Incident['falls'] = []
    if (kind === 'trip') {
      let delay = 0
      for (const member of members.slice(members.indexOf(actor))) {
        falls.push({member, delay})
        delay += .2 + Math.random() * .8
      }
      this.fall(actor)
    } else {
      actor.status = kind
    }
    squad.incident = {actor, kind, target, falls, elapsed: 0}
    if (squad === this.party) this.notify(kind === 'trip' ? '有夥伴跌倒了。回到牠身邊呼喚。'
      : kind === 'dream' ? '有夥伴停下來發呆了。回去叫醒牠。' : '有夥伴拐往別處了，趕快追上牠！')
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
    if (from === this.party) this.notify('有夥伴加入了別隊，牠們會留在那裡。')
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

  ready() {
    return this.party.members.some(p => this.needsHelp(p) && p.position.distanceToSquared(this.player.position) <= HONK ** 2)
  }

  needsHelp(p: Penguin) {
    return p.status === 'trip' || p.status === 'dream' || p.status === 'stray'
  }

  rescue(time: number) {
    const incident = this.party.incident
    if (!incident || !this.ready()) return false
    if (incident.kind === 'trip') {
      for (const fall of incident.falls) {
        const p = fall.member
        if (p.status !== 'trip' || p.position.distanceToSquared(this.player.position) > HONK ** 2) continue
        p.status = 'follow'
        p.slide = 0
        p.joy = .72
        p.protectedUntil = time + 4
      }
      const scheduled = incident.falls.filter(fall => fall.delay > incident.elapsed || fall.member.status === 'trip')
      if (!scheduled.length) this.resolve(this.party, time)
      else {
        // A recovered link stops the domino effect from reaching unfallen birds behind it.
        const firstRecovered = incident.falls.findIndex(fall => fall.member.protectedUntil > time && fall.delay <= incident.elapsed)
        if (firstRecovered >= 0) incident.falls = incident.falls.filter((fall, i) =>
          fall.member.status === 'trip' || (i < firstRecovered && fall.delay > incident.elapsed))
        if (!incident.falls.length) this.resolve(this.party, time)
        else incident.actor = incident.falls[0].member
      }
    } else {
      this.resolve(this.party, time)
    }
    return true
  }
}


import * as T from 'three'
import { type Penguin, type RestPose } from './penguin'
import type { Snowfield, SnowParticles } from './snow'

const REST_DELAY = 2.4
const PLAY_RADIUS = 7.5
const GATHERING_REACH = 8
const GATHERING_SPACING = 5.2
const soloPoses: RestPose[] = ['dream', 'tumble', 'hop']
type Activity = {anchor: T.Vector2, until: number, pose?: RestPose, offset?: T.Vector2}
type Gathering = {
  kind: 'chat' | 'snow' | 'chase'
  members: Penguin[]
  center: T.Vector2
  angle: number
  started: number
  ends: number
}

export class RestActivities {
  active = false
  private idle = 0
  private nextGathering = 0
  private actions = new Map<Penguin, Activity>()
  private gatherings = new Map<Penguin, Gathering>()
  private target = new T.Vector2()
  private direction = new T.Vector2()

  constructor(private snow: Snowfield, private flakes: SnowParticles) {}

  includes(p: Penguin) {
    return this.actions.has(p)
  }

  update(members: Penguin[], dt: number, time: number, moving: boolean) {
    if (moving) {
      this.idle = 0
      if (!this.active) return
      this.active = false
      this.gatherings.clear()
      for (const p of this.actions.keys()) {
        p.restPose = undefined
        p.route = [p.position.clone()]
      }
      this.actions.clear()
      return
    }
    this.idle += dt
    if (this.idle < REST_DELAY) return
    if (!this.active) this.nextGathering = time + 1.0
    this.active = true
    const player = members[0]
    const followers = members.slice(1).filter(p => p.status === 'follow')
    const present = new Set(followers)
    for (const p of this.actions.keys()) {
      if (present.has(p)) continue
      p.restPose = undefined
      p.route = [p.position.clone()]
      this.actions.delete(p)
    }
    for (const group of new Set(this.gatherings.values())) {
      if (time < group.ends && group.members.every(p => present.has(p))) continue
      for (const p of group.members) {
        p.restPose = undefined
        this.gatherings.delete(p)
        const activity = this.actions.get(p)
        if (activity) this.actions.set(p, {anchor: activity.anchor, until: time + .35 + Math.random()})
      }
    }
    if (time >= this.nextGathering) {
      const candidates = followers.filter(p => p.species === 'penguin' && !this.gatherings.has(p))
      this.startGatherings(candidates, player.position, time)
      this.nextGathering = time + 7 + Math.random() * 4
    }

    for (const p of followers) {
      let activity = this.actions.get(p)
      if (!activity) {
        activity = {anchor: p.position.clone().sub(player.position), until: time}
        this.actions.set(p, activity)
      }
      const group = this.gatherings.get(p)
      if (group) {
        this.playTogether(p, group, activity, player.position, dt, time)
        continue
      }
      if (time >= activity.until) {
        activity = this.chooseActivity(p, activity.anchor, time)
        this.actions.set(p, activity)
      }
      p.restPose = activity.pose
      if (activity.offset) {
        this.target.copy(player.position).add(activity.anchor).add(activity.offset)
        p.move(this.target, 1.05, dt)
      }
    }
  }

  private chooseActivity(p: Penguin, anchor: T.Vector2, time: number): Activity {
    const kind = Math.random()
    if (kind < .53) {
      const angle = Math.random() * Math.PI * 2
      const distance = 1.4 + Math.random() * (PLAY_RADIUS - 1.4)
      return {anchor, until: time + 4 + Math.random() * 4, offset: new T.Vector2(Math.cos(angle), Math.sin(angle)).multiplyScalar(distance)}
    }
    const pose = p.species === 'penguin' && kind < .91 ? soloPoses[Math.floor(Math.random() * soloPoses.length)] : undefined
    if (pose === 'tumble' && this.snow.isWater(p.position.x, p.position.y)) return {anchor, until: time + 1.2, pose: 'dream'}
    if (pose === 'tumble') this.snowPuff(p, 12, 1.12)
    return {anchor, until: time + (pose === 'tumble' ? 1.2 : 1.25 + Math.random() * 1.8), pose}
  }

  private startGatherings(candidates: Penguin[], origin: T.Vector2, time: number) {
    const centers = [...new Set(this.gatherings.values())].map(group => group.center)
    while (candidates.length >= 2) {
      const first = candidates.splice(Math.floor(Math.random() * candidates.length), 1)[0]
      const close = candidates.filter(p => p.position.distanceToSquared(first.position) <= GATHERING_REACH ** 2)
      if (!close.length) continue
      close.sort((a, b) => a.position.distanceToSquared(first.position) - b.position.distanceToSquared(first.position))
      const roll = Math.random()
      const kind = roll < .38 ? 'chat' : roll < .69 ? 'snow' : 'chase'
      const partners = close.slice(0, kind !== 'chase' && Math.random() < .55 ? 2 : 1)
      const members = [first, ...partners]
      const center = new T.Vector2()
      for (const p of members) center.add(p.position)
      center.divideScalar(members.length).sub(origin)
      if (center.lengthSq() < 2.6 ** 2) {
        if (center.lengthSq() < .01) center.set(0, -1)
        center.setLength(2.6)
      }
      if (centers.some(other => other.distanceToSquared(center) < GATHERING_SPACING ** 2)) continue
      const group = {kind, members, center, angle: Math.random() * Math.PI * 2, started: time, ends: time + 6.5} satisfies Gathering
      for (const p of members) this.gatherings.set(p, group)
      for (const p of partners) candidates.splice(candidates.indexOf(p), 1)
      centers.push(center)
    }
  }

  private playTogether(p: Penguin, group: Gathering, activity: Activity, origin: T.Vector2, dt: number, time: number) {
    const i = group.members.indexOf(p)
    const elapsed = time - group.started
    const chase = group.kind === 'chase'
    const angle = group.angle + (chase ? i * 1.15 + Math.max(0, elapsed - 1.25) * .94 : i * Math.PI * 2 / group.members.length)
    const radius = chase ? 2.15 : 1.22
    this.target.copy(origin).add(group.center).addScaledVector(this.direction.set(Math.cos(angle), Math.sin(angle)), radius)
    p.restPose = undefined
    if (chase || p.position.distanceToSquared(this.target) > .10 ** 2) {
      p.move(this.target, chase ? 2.2 : 1.4, dt)
      return
    }
    p.faceToward(this.target.copy(origin).add(group.center), dt)
    const turn = Math.floor(elapsed * 2.2)
    if (turn % group.members.length !== i) return
    p.restPose = group.kind === 'chat' ? 'chat' : 'hop'
    if (group.kind === 'snow' && time >= activity.until) {
      this.snowPuff(p, 7, .85)
      activity.until = time + .9
    }
  }

  private snowPuff(p: Penguin, count: number, force: number) {
    const {x, y: z} = p.position
    this.flakes.burst(x, this.snow.surface(x, z) + .10, z, count, force)
  }
}

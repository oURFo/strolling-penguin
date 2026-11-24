import * as T from 'three'
import { type Penguin, type RestPose } from './penguin'
import type { Snowfield, SnowParticles } from './snow'

const REST_DELAY = 2.4
const PLAY_RADIUS = 4.8
const ENTER_RADIUS = 7
const soloPoses: RestPose[] = ['dream', 'tumble', 'hop']
type Activity = {until: number, pose?: RestPose, offset?: T.Vector2}
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
  private gathering?: Gathering
  private target = new T.Vector2()
  private direction = new T.Vector2()
  private point = new T.Vector3()

  constructor(private snow: Snowfield, private flakes: SnowParticles) {}

  includes(p: Penguin) {
    return this.actions.has(p)
  }

  update(members: Penguin[], dt: number, time: number, moving: boolean, frustum: T.Frustum) {
    if (moving) {
      this.idle = 0
      if (!this.active) return
      this.active = false
      this.gathering = undefined
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
    const [player, ...followers] = members
    const nearby = followers.filter(p => p.status === 'follow' && p.position.distanceToSquared(player.position) <= ENTER_RADIUS ** 2
      && this.visible(p.position, p.height * .5, frustum))
    for (const p of this.actions.keys()) {
      if (nearby.includes(p)) continue
      p.restPose = undefined
      p.route = [p.position.clone()]
      this.actions.delete(p)
    }
    if (this.gathering && (time >= this.gathering.ends || !this.gathering.members.every(p => nearby.includes(p)))) {
      for (const p of this.gathering.members) {
        p.restPose = undefined
        if (this.actions.has(p)) this.actions.set(p, {until: time + .35 + Math.random()})
      }
      this.gathering = undefined
    }
    if (!this.gathering && time >= this.nextGathering) {
      const candidates = nearby.filter(p => p.species === 'penguin')
      if (candidates.length >= 2) this.startGathering(candidates, player.position, time)
      this.nextGathering = time + 7 + Math.random() * 4
    }

    for (const p of nearby) {
      const groupIndex = this.gathering?.members.indexOf(p) ?? -1
      if (this.gathering && groupIndex >= 0) {
        if (!this.actions.has(p)) this.actions.set(p, {until: time})
        this.playTogether(p, groupIndex, this.gathering, player.position, dt, time, frustum)
        continue
      }
      let activity = this.actions.get(p)
      if (!activity || time >= activity.until) {
        activity = this.chooseActivity(p, time)
        this.actions.set(p, activity)
      }
      p.restPose = activity.pose
      if (activity.offset) {
        this.target.copy(player.position).add(activity.offset)
        if (this.visible(this.target, p.height * .5, frustum)) p.move(this.target, .86, dt)
      }
    }
  }

  private chooseActivity(p: Penguin, time: number): Activity {
    const kind = Math.random()
    if (kind < .53) {
      const angle = Math.random() * Math.PI * 2
      const distance = 1.4 + Math.random() * (PLAY_RADIUS - 1.4)
      return {until: time + 2.5 + Math.random() * 2.6, offset: new T.Vector2(Math.cos(angle), Math.sin(angle)).multiplyScalar(distance)}
    }
    const pose = p.species === 'penguin' && kind < .91 ? soloPoses[Math.floor(Math.random() * soloPoses.length)] : undefined
    if (pose === 'tumble') this.snowPuff(p, 12, 1.12)
    return {until: time + (pose === 'tumble' ? 1.2 : 1.25 + Math.random() * 1.8), pose}
  }

  private startGathering(candidates: Penguin[], origin: T.Vector2, time: number) {
    const first = candidates.splice(Math.floor(Math.random() * candidates.length), 1)[0]
    candidates.sort((a, b) => a.position.distanceToSquared(first.position) - b.position.distanceToSquared(first.position))
    const roll = Math.random()
    const kind = roll < .38 ? 'chat' : roll < .69 ? 'snow' : 'chase'
    const members = [first, ...candidates.slice(0, kind !== 'chase' && Math.random() < .55 ? 2 : 1)]
    const center = new T.Vector2()
    for (const p of members) center.add(p.position)
    center.divideScalar(members.length).sub(origin).clampLength(0, 2.6)
    if (center.lengthSq() < 1.4 ** 2) center.set(0, -1.5)
    this.gathering = {kind, members, center, angle: Math.random() * Math.PI * 2, started: time, ends: time + 5.5}
  }

  private playTogether(p: Penguin, i: number, group: Gathering, origin: T.Vector2, dt: number, time: number, frustum: T.Frustum) {
    const elapsed = time - group.started
    const chase = group.kind === 'chase'
    const angle = group.angle + (chase ? i * 1.15 + Math.max(0, elapsed - .7) * 1.48 : i * Math.PI * 2 / group.members.length)
    const radius = chase ? 1.24 : .75
    this.target.copy(origin).add(group.center).addScaledVector(this.direction.set(Math.cos(angle), Math.sin(angle)), radius)
    p.restPose = undefined
    if (!this.visible(this.target, p.height * .5, frustum)) return
    if (chase || p.position.distanceToSquared(this.target) > .10 ** 2) {
      p.move(this.target, chase ? 2.2 : 1.4, dt)
      return
    }
    p.faceToward(this.target.copy(origin).add(group.center), dt)
    const turn = Math.floor(elapsed * 2.2)
    if (turn % group.members.length !== i) return
    p.restPose = group.kind === 'chat' ? 'chat' : 'hop'
    const activity = this.actions.get(p)!
    if (group.kind === 'snow' && time >= activity.until) {
      this.snowPuff(p, 7, .85)
      activity.until = time + .9
    }
  }

  private visible(point: T.Vector2, height: number, frustum: T.Frustum) {
    return frustum.containsPoint(this.point.set(point.x, this.snow.height(point.x, point.y) + height, point.y))
  }

  private snowPuff(p: Penguin, count: number, force: number) {
    const {x, y: z} = p.position
    this.flakes.burst(x, this.snow.height(x, z) + .10, z, count, force)
  }
}

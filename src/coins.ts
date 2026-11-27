import * as T from 'three'
import { random, type Snowfield } from './snow'
import { CHRISTMAS_STARS } from './buildings'
import { glowMaterial } from './glow'

const REGION = 20
const CHANCE = .15
const coinMesh = new T.CylinderGeometry(.34, .34, .085, 24).rotateX(Math.PI / 2)
const rimMesh = new T.TorusGeometry(.274, .026, 8, 24)
const gold = new T.MeshStandardMaterial({color: 0xffc645, emissive: 0x7a3902, emissiveIntensity: .27, roughness: .41})
const rim = new T.MeshBasicMaterial({color: 0xffea91})
const chestBox = new T.BoxGeometry(1, 1, 1)
const chestWood = new T.MeshStandardMaterial({color: 0x75432f, roughness: .8})
const chestSnow = new T.MeshStandardMaterial({color: 0xeaf7ff, roughness: .75})
const starItems = Object.keys(CHRISTMAS_STARS) as (keyof typeof CHRISTMAS_STARS)[]
type ChestReward = {kind: 'coins', amount: number} | {kind: 'star', item: keyof typeof CHRISTMAS_STARS}
const chestGlow = glowMaterial(0xffca70, 1)
const sparkleShape = new T.OctahedronGeometry(1)
const sparkleMaterial = new T.MeshBasicMaterial({color: 0xffdb87, toneMapped: false})

function chestBurst(model: T.Group) {
  const glow = new T.Sprite(chestGlow)
  glow.position.y = .74
  const sparks = Array.from({length: 14}, () => new T.Mesh(sparkleShape, sparkleMaterial))
  model.add(glow, ...sparks)
  return {glow, sparks}
}

function chestModel() {
  const model = new T.Group()
  const lid = new T.Group()
  lid.position.set(0, .47, -.32)
  model.add(lid)
  const box = (group: T.Group, material: T.Material, x: number, y: number, z: number, w: number, h: number, d: number) => {
    const mesh = new T.Mesh(chestBox, material)
    mesh.position.set(x, y, z)
    mesh.scale.set(w, h, d)
    group.add(mesh)
  }
  box(model, chestWood, 0, .23, 0, 1.08, .46, .66)
  box(lid, chestWood, 0, .105, .32, 1.13, .24, .70)
  box(lid, chestSnow, 0, .24, .27, .91, .06, .54)
  for (const side of [-1, 1]) {
    box(model, gold, side * .43, .24, 0, .10, .46, .69)
    box(lid, gold, side * .43, .11, .32, .105, .255, .72)
  }
  box(model, gold, 0, .43, .35, .20, .22, .065)
  box(model, chestWood, 0, .43, .39, .04, .074, .012)
  return {model, lid}
}

export function chestContents(gx: number, gz: number): ChestReward {
  const rng = random(Math.imul(gx, 0x632be5ab) ^ Math.imul(gz, 0x85157af5) ^ 0x62199a11)
  return rng() < .20
    ? {kind: 'star', item: starItems[Math.floor(rng() * starItems.length)]}
    : {kind: 'coins', amount: 1 + Math.floor(rng() * 10)}
}

function chestPosition(gx: number, gz: number, isWater: (x: number, z: number) => boolean) {
  const rng = random(Math.imul(gx, 0x632be5ab) ^ Math.imul(gz, 0x85157af5) ^ 0x59d399a8)
  if (rng() >= .02) return
  for (let i = 0; i < 12; i++) {
    const x = gx * REGION + (rng() - .5) * 19
    const z = gz * REGION + (rng() - .5) * 19
    if (!isWater(x, z)) return {x, z}
  }
}

export function coinPosition(gx: number, gz: number, isWater: (x: number, z: number) => boolean) {
  const rng = random(Math.imul(gx, 0x7feb352d) ^ Math.imul(gz, 0x846ca68b) ^ 0xc0427837)
  if (rng() >= CHANCE) return
  for (let i = 0; i < 12; i++) {
    const x = gx * REGION + (rng() - .5) * 19
    const z = gz * REGION + (rng() - .5) * 19
    if (!isWater(x, z)) return {x, z}
  }
}

export class SnowCoins {
  readonly collected: Set<string>
  readonly openedChests: Set<string>
  private coins = new Map<string, {x: number, z: number, model: T.Group}>()
  private chests = new Map<string, ReturnType<typeof chestModel> & {
    x: number, z: number, gx: number, gz: number,
    effect?: ReturnType<typeof chestBurst> & {start: number}
  }>()
  private checked = new Set<string>()
  private cellX?: number
  private cellZ?: number

  constructor(private scene: T.Scene, private snow: Snowfield, saved?: string[], openedChests?: string[]) {
    this.collected = new Set(saved)
    this.openedChests = new Set(openedChests)
  }

  update(x: number, z: number, time: number) {
    const offset = this.snow.offset
    const cx = Math.floor((x + offset.x + REGION / 2) / REGION)
    const cz = Math.floor((z + offset.y + REGION / 2) / REGION)
    if (cx !== this.cellX || cz !== this.cellZ) {
      this.cellX = cx
      this.cellZ = cz
      const nearby = new Set<string>()
      for (let gz = cz - 2; gz <= cz + 2; gz++) for (let gx = cx - 2; gx <= cx + 2; gx++) {
        const key = gx + ',' + gz
        nearby.add(key)
        if (this.checked.has(key)) continue
        this.checked.add(key)
        const isWater = (px: number, pz: number) => this.snow.isWater(px - offset.x, pz - offset.y)
        if (!this.openedChests.has(key)) {
          const position = chestPosition(gx, gz, isWater)
          if (position) {
            const chest = chestModel()
            this.scene.add(chest.model)
            this.chests.set(key, {...position, gx, gz, ...chest})
          }
        }
        if (this.collected.has(key)) continue
        const position = coinPosition(gx, gz, isWater)
        if (!position) continue
        const model = new T.Group()
        const front = new T.Mesh(rimMesh, rim)
        const back = new T.Mesh(rimMesh, rim)
        front.position.z = .047
        back.position.z = -.047
        model.add(new T.Mesh(coinMesh, gold), front, back)
        this.scene.add(model)
        this.coins.set(key, {...position, model})
      }
      for (const key of this.checked) {
        if (nearby.has(key)) continue
        const coin = this.coins.get(key)
        if (coin) this.scene.remove(coin.model)
        this.coins.delete(key)
        const chest = this.chests.get(key)
        if (chest) this.scene.remove(chest.model)
        this.chests.delete(key)
        this.checked.delete(key)
      }
    }
    let picked = 0
    for (const [key, coin] of this.coins) {
      const px = coin.x - offset.x
      const pz = coin.z - offset.y
      if ((px - x) ** 2 + (pz - z) ** 2 < 1.2 ** 2) {
        this.collected.add(key)
        this.scene.remove(coin.model)
        this.coins.delete(key)
        picked++
      } else {
        coin.model.position.set(px, this.snow.surface(px, pz) + .64 + Math.sin(time * 3 + px) * .09, pz)
        coin.model.rotation.set(.11, time * 1.8 + pz, 0)
      }
    }
    const opened: ReturnType<typeof chestContents>[] = []
    for (const [key, chest] of this.chests) {
      const px = chest.x - offset.x, pz = chest.z - offset.y
      chest.model.position.set(px, this.snow.surface(px, pz), pz)
      if (!chest.effect && (px - x) ** 2 + (pz - z) ** 2 < 1.15 ** 2) {
        chest.effect = {...chestBurst(chest.model), start: time}
        this.openedChests.add(key)
        opened.push(chestContents(chest.gx, chest.gz))
      }
      if (!chest.effect) continue
      const {start, glow, sparks} = chest.effect
      const age = time - start
      chest.lid.rotation.x = -1.4 * (1 - (1 - Math.min(age / .38, 1)) ** 3)
      const pulse = Math.min(age / .18, 1) * Math.max(0, 1 - age / .95)
      glow.scale.setScalar(4.5 * pulse)
      sparks.forEach((spark, i) => {
        const angle = i * 2.4
        const radius = age * (1.5 + i % 4 * .28)
        spark.position.set(Math.cos(angle) * radius, .55 + age * (2.9 + i % 3 * .38) - age * age * 2.2, Math.sin(angle) * radius)
        spark.rotation.set(age * 6, angle, age * 4)
        spark.scale.setScalar(.11 * Math.max(0, 1 - age / (1.05 + i % 3 * .12)))
      })
      if (age > 1.65) {
        this.scene.remove(chest.model)
        this.chests.delete(key)
      }
    }
    return {picked, opened}
  }
}

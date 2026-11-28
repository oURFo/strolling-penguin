import * as T from 'three'

const sphere = new T.SphereGeometry(1, 12, 8)
const box = new T.BoxGeometry(1, 1, 1)
const disc = new T.CylinderGeometry(1, 1, 1, 16)
const cone = new T.ConeGeometry(1, 1, 16)
const ring = new T.TorusGeometry(1, .14, 8, 18)
const crystal = new T.OctahedronGeometry(1)
const palette = new Map<number, T.MeshStandardMaterial>()
const gold = 0xffce69, ice = 0x91e4ff, ink = 0x242e47, cream = 0xffefe0
const mint = 0x62c9ad, rose = 0xeb7890, lilac = 0xa894e3

function piece(parent: T.Group, color: number, geometry: T.BufferGeometry,
  x: number, y: number, z: number, w: number, h: number, d: number) {
  let material = palette.get(color)
  if (!material) {
    material = new T.MeshStandardMaterial({color, roughness: .67})
    palette.set(color, material)
  }
  const mesh = new T.Mesh(geometry, material)
  mesh.position.set(x, y, z)
  mesh.scale.set(w, h, d)
  parent.add(mesh)
  return mesh
}

type Model = ReturnType<typeof kit>
function kit(head: T.Group, body: T.Group) {
  const prop = new T.Group()
  body.add(prop)
  return {
    prop,
    head: (color: number, geometry: T.BufferGeometry, x: number, y: number, z: number, w: number, h: number, d: number) =>
      piece(head, color, geometry, x, y, z, w, h, d),
    body: (color: number, geometry: T.BufferGeometry, x: number, y: number, z: number, w: number, h: number, d: number) =>
      piece(body, color, geometry, x, y, z, w, h, d),
    held: (color: number, geometry: T.BufferGeometry, x: number, y: number, z: number, w: number, h: number, d: number) =>
      piece(prop, color, geometry, x, y, z, w, h, d),
  }
}

function hat(m: Model, color: number, height: number, brim = .34) {
  m.head(color, disc, 0, .21, 0, brim, .06, brim)
  m.head(color, disc, 0, .22 + height / 2, -.02, .217, height, .217)
}

function bow(m: Model, color: number, y = .72) {
  for (const side of [-1, 1]) {
    m.body(color, cone, side * .068, y, .30, .077, .105, .047).rotation.z = side * Math.PI / 2
  }
  m.body(color, sphere, 0, y, .326, .046, .041, .030)
}

function staff(m: Model, color: number, tip: number) {
  m.prop.position.set(.39, .42, .18)
  m.held(color, disc, 0, .10, 0, .026, .79, .026)
  m.held(tip, crystal, 0, .53, 0, .099, .135, .097)
}

// Motion parameters use local radians and world-height offsets.
type Motion = {rate: number, yaw?: number, pitch?: number, lean?: number, wing?: number, hop?: number, swing?: number, lift?: number}
type Style = {name: string, model: (m: Model) => void, motion: Motion}

// Positions are persistent style IDs. Append new styles without reordering these entries.
export const PENGUIN_STYLES: readonly Style[] = [
  {name: '墨鏡企鵝', motion: {rate: 2.3, yaw: .32, pitch: .12, lean: .10}, model: m => {
    for (const side of [-1, 1]) {
      m.head(ink, box, side * .107, .018, .294, .184, .104, .046)
      m.head(0x7594bc, box, side * .107, .044, .319, .123, .017, .008).rotation.z = -.23
    }
    m.head(ink, box, 0, .039, .29, .07, .024, .033)
  }},
  {name: '科技企鵝', motion: {rate: 3.8, yaw: .48, lift: .10, swing: .44}, model: m => {
    m.head(ink, sphere, 0, .03, .244, .288, .103, .096)
    m.head(ice, sphere, 0, .043, .326, .231, .035, .023)
    m.prop.position.set(.41, .56, .26)
    m.held(ink, box, 0, 0, 0, .22, .27, .055)
    m.held(ice, box, 0, 0, .033, .16, .20, .012)
  }},
  {name: '機械企鵝', motion: {rate: 2.7, yaw: .21, pitch: -.17, wing: .34, lean: -.10}, model: m => {
    const steel = 0x9aaebb
    m.head(steel, box, 0, .04, 0, .56, .36, .47)
    m.head(ink, box, 0, .038, .255, .49, .151, .077)
    for (const side of [-1, 1]) {
      m.head(0xff934e, box, side * .12, .048, .301, .075, .037, .019)
      m.body(steel, box, side * .29, .48, .13, .13, .36, .23)
    }
    m.body(steel, box, 0, .53, .26, .40, .35, .13)
    m.body(ice, disc, 0, .58, .34, .093, .035, .093).rotation.x = Math.PI / 2
  }},
  {name: '企鵝法師', motion: {rate: 2.1, pitch: -.23, swing: -.69, lift: .20, wing: .19}, model: m => {
    m.head(0x533a8d, disc, 0, .225, 0, .37, .075, .36)
    m.head(0x533a8d, cone, -.055, .43, -.028, .25, .49, .24).rotation.z = .26
    m.head(gold, disc, 0, .28, 0, .214, .053, .209)
    m.body(0x58418d, sphere, 0, .56, -.19, .35, .39, .13)
    staff(m, 0x725345, lilac)
  }},
  {name: '晚禮服企鵝', motion: {rate: 1.8, pitch: .34, lean: .12, wing: .19}, model: m => {
    hat(m, ink, .24)
    m.head(rose, disc, 0, .264, -.02, .221, .044, .221)
    bow(m, 0xa93455)
    for (const y of [.46, .55, .63]) m.body(ink, sphere, 0, y, .323, .027, .027, .014)
  }},
  {name: '貓布偶企鵝', motion: {rate: 3.7, pitch: .24, yaw: -.25, wing: .31, swing: .44}, model: m => {
    m.head(rose, ring, 0, 0, .18, .25, .26, .13)
    for (const side of [-1, 1]) {
      m.head(rose, cone, side * .205, .26, .018, .117, .255, .086).rotation.z = -side * .3
      m.head(cream, cone, side * .205, .276, .071, .063, .15, .032).rotation.z = -side * .3
    }
    m.held(rose, sphere, .13, .33, -.31, .11, .26, .092).rotation.z = -.6
  }},
  {name: '太空企鵝', motion: {rate: 2.6, wing: .43, hop: .22, lean: -.13, pitch: -.16}, model: m => {
    m.head(cream, ring, 0, -.012, .167, .263, .252, .11)
    for (const side of [-1, 1]) {
      m.head(ice, sphere, side * .258, .005, -.01, .09, .14, .13)
      m.held(cream, disc, side * .15, .52, -.27, .091, .39, .09)
      m.held(0xff9259, cone, side * .15, .27, -.27, .071, .17, .07).rotation.z = Math.PI
    }
  }},
  {name: '烘焙企鵝', motion: {rate: 3.0, pitch: .20, lift: .16, swing: .21}, model: m => {
    m.head(cream, disc, 0, .26, 0, .23, .15, .23)
    for (const x of [-.14, 0, .14]) m.head(cream, sphere, x, .38, 0, .136, .146, .14)
    m.body(rose, box, 0, .47, .286, .31, .34, .062)
    m.prop.position.set(.40, .36, .21)
    m.held(0xa7643d, disc, 0, 0, 0, .065, .27, .063).rotation.z = .55
  }},
  {name: '雪原探險企鵝', motion: {rate: 1.6, yaw: .56, pitch: -.20, lift: .21}, model: m => {
    hat(m, 0xb7895d, .13, .37)
    m.body(0x846047, box, 0, .57, -.28, .39, .44, .22)
    m.prop.position.set(0, .43, .36)
    for (const side of [-1, 1]) {
      m.held(ink, disc, side * .071, 0, 0, .069, .18, .069).rotation.x = Math.PI / 2
      m.held(ice, sphere, side * .071, 0, .096, .045, .045, .015)
    }
  }},
  {name: '海盜企鵝', motion: {rate: 2.9, lean: -.17, wing: .46, yaw: .21}, model: m => {
    m.head(ink, sphere, 0, .23, .013, .36, .13, .24)
    m.head(0xb24e58, sphere, 0, .28, .018, .29, .105, .22)
    m.head(cream, sphere, 0, .29, .232, .082, .079, .02)
    m.head(ink, sphere, -.106, .005, .294, .072, .067, .030)
    m.head(gold, ring, .278, -.072, .10, .049, .052, .05)
  }},
  {name: '雪地郵差企鵝', motion: {rate: 2.3, wing: .25, lift: .13, swing: -.45, yaw: .17}, model: m => {
    hat(m, 0x3976b6, .11, .285)
    m.head(0x255981, sphere, 0, .207, .236, .22, .041, .16)
    m.body(0x9a694c, box, -.24, .40, .22, .23, .23, .17)
    m.body(0xc99966, box, 0, .55, .303, .048, .45, .024).rotation.z = -.61
    m.prop.position.set(.32, .38, .36)
    m.held(cream, box, 0, 0, 0, .23, .16, .025)
    m.held(rose, box, .068, .046, .016, .048, .047, .006)
  }},
  {name: '搖滾企鵝', motion: {rate: 5.8, lean: .19, pitch: .18, wing: .39, swing: .26}, model: m => {
    for (let i = 0; i < 4; i++) m.head(0xcf4b7e, cone, 0, .31, .13 - i * .082, .067, .22 - i * .03, .07)
    m.prop.position.set(.05, .45, .35)
    m.held(0x9d4fd5, sphere, -.10, -.06, 0, .16, .165, .048)
    m.held(gold, box, .08, .07, .011, .35, .052, .043).rotation.z = .58
    m.held(cream, box, -.079, -.043, .05, .12, .05, .012)
  }},
  {name: '花匠企鵝', motion: {rate: 1.9, pitch: .31, lean: -.10, lift: .11, swing: .31}, model: m => {
    hat(m, 0xdfbe7a, .14, .37)
    m.head(mint, disc, 0, .248, -.02, .221, .043, .219)
    m.prop.position.set(.35, .36, .23)
    m.held(0x4a99a0, sphere, 0, 0, 0, .14, .13, .12)
    m.held(0x4a99a0, ring, -.13, .06, 0, .092, .094, .05)
    m.held(ice, cone, .143, .074, .014, .046, .20, .044).rotation.z = -1.12
  }},
  {name: '釣客企鵝', motion: {rate: 1.7, swing: -.49, lift: .15, pitch: .22}, model: m => {
    hat(m, 0x518d7b, .14, .31)
    staff(m, 0xa06a41, 0xfe966f)
    m.held(cream, box, .037, .34, 0, .012, .38, .012).rotation.z = .12
    m.held(rose, sphere, .058, .155, 0, .035, .052, .033)
  }},
  {name: '冰晶騎士企鵝', motion: {rate: 2.4, pitch: -.16, lift: .18, wing: .22, swing: -.31}, model: m => {
    m.head(0x7cacc8, sphere, 0, .122, -.026, .28, .231, .235)
    m.head(ice, box, 0, .15, .252, .33, .064, .065)
    m.prop.position.set(.31, .48, .34)
    m.held(ice, crystal, 0, 0, 0, .19, .235, .075)
    m.held(cream, crystal, 0, 0, .058, .075, .114, .035)
  }},
  {name: '月兔企鵝', motion: {rate: 3.5, hop: .23, wing: .21, lean: -.10}, model: m => {
    for (const side of [-1, 1]) {
      m.head(cream, sphere, side * .126, .38, -.025, .092, .25, .091).rotation.z = -side * .17
      m.head(rose, sphere, side * .139, .419, .045, .046, .169, .026).rotation.z = -side * .16
    }
    m.body(cream, sphere, 0, .33, -.255, .118, .121, .102)
    m.body(gold, ring, 0, .64, .319, .057, .057, .051)
  }},
  {name: '蜜蜂企鵝', motion: {rate: 6.5, wing: .48, hop: .13, swing: .29}, model: m => {
    for (const y of [.38, .54, .70]) m.body(gold, sphere, 0, y, 0, .34, .064, .31)
    for (const side of [-1, 1]) {
      m.head(ink, disc, side * .13, .29, .037, .014, .20, .014).rotation.z = -side * .32
      m.head(gold, sphere, side * .166, .39, .037, .04, .04, .04)
      m.held(ice, sphere, side * .23, .66, -.29, .10, .25, .051).rotation.z = side * .43
    }
  }},
  {name: '蘑菇企鵝', motion: {rate: 1.5, lean: .19, pitch: .17, yaw: -.17}, model: m => {
    m.head(0xd36b60, sphere, 0, .30, 0, .395, .182, .336)
    for (const [x, y, z] of [[-.14, .421, .14], [.16, .424, .05], [.04, .389, .252], [-.24, .391, -.04]]) {
      m.head(cream, sphere, x, y, z, .055, .033, .047)
    }
  }},
  {name: '南瓜企鵝', motion: {rate: 2.9, hop: .13, lean: -.16, yaw: .24}, model: m => {
    for (const x of [-.23, -.11, 0, .11, .23]) m.body(0xf28d44, sphere, x, .49, .19, .125, .27, .19)
    m.head(mint, cone, -.095, .29, 0, .088, .18, .074).rotation.z = .41
    m.body(ink, box, 0, .46, .389, .145, .036, .015)
    for (const x of [-.072, .072]) m.body(ink, cone, x, .56, .374, .045, .088, .018)
  }},
  {name: '雪國王企鵝', motion: {rate: 1.7, pitch: -.25, lift: .10, swing: .27}, model: m => {
    m.head(gold, disc, 0, .257, 0, .228, .092, .223)
    for (let i = 0; i < 6; i++) {
      const a = Math.PI * i / 3
      m.head(gold, cone, Math.sin(a) * .19, .33, Math.cos(a) * .19, .052, .15, .05)
    }
    m.head(ice, crystal, 0, .275, .23, .065, .085, .035)
    m.body(0x7f57a0, sphere, 0, .54, -.22, .32, .40, .122)
    staff(m, gold, ice)
  }},
  {name: '救援企鵝', motion: {rate: 3.9, lift: .19, swing: .20, yaw: .19}, model: m => {
    hat(m, 0xe65a59, .12, .30)
    m.prop.position.set(.34, .37, .29)
    m.held(cream, box, 0, 0, 0, .29, .22, .13)
    m.held(rose, box, 0, .004, .073, .15, .04, .010)
    m.held(rose, box, 0, .004, .074, .04, .15, .010)
  }},
  {name: '照相企鵝', motion: {rate: 2.0, lift: .25, yaw: -.26, pitch: .18}, model: m => {
    m.body(cream, box, 0, .59, .31, .043, .38, .028).rotation.z = .55
    m.prop.position.set(0, .43, .36)
    m.held(ink, box, 0, 0, 0, .30, .20, .11)
    m.held(0xa9bbc5, disc, 0, -.01, .081, .081, .085, .081).rotation.x = Math.PI / 2
    m.held(ice, sphere, 0, -.01, .13, .052, .052, .019)
  }},
  {name: '聖誕企鵝', motion: {rate: 3.2, lift: .13, lean: .11, swing: -.39, hop: .08}, model: m => {
    m.head(cream, disc, 0, .24, 0, .30, .085, .28)
    m.head(0xda5263, cone, -.08, .39, -.03, .235, .45, .237).rotation.z = .42
    m.head(cream, sphere, -.18, .58, -.03, .082, .084, .08)
    m.prop.position.set(.31, .35, .29)
    m.held(mint, box, 0, 0, 0, .24, .22, .21)
    m.held(gold, box, 0, 0, .11, .042, .22, .016)
    m.held(gold, box, 0, .112, 0, .042, .022, .22)
  }},
  {name: '幽靈企鵝', motion: {rate: 1.5, hop: .21, lean: .21, wing: .18, yaw: .13}, model: m => {
    const cloth = 0xddeafa
    m.body(cloth, sphere, 0, .53, -.12, .33, .45, .25)
    m.head(cloth, sphere, 0, .11, -.015, .294, .242, .232)
    m.head(cloth, cone, .055, .282, -.027, .187, .24, .17).rotation.z = -.37
    for (const x of [-.20, 0, .20]) m.held(cloth, sphere, x, .36, -.22, .105, .227, .11)
  }},
  {name: '滑雪企鵝', motion: {rate: 4.1, lean: -.23, pitch: .18, wing: .23, hop: .075}, model: m => {
    m.head(lilac, sphere, 0, .049, .247, .273, .115, .098)
    m.head(ice, box, 0, .048, .342, .37, .10, .038)
    for (const side of [-1, 1]) {
      m.body(0x497ec0, sphere, side * .139, .08, .093, .127, .080, .184)
      m.body(rose, disc, side * .288, .138, .221, .021, .24, .021).rotation.x = -.17
    }
  }},
]

export function dressPenguin(style: Style, head: T.Group, body: T.Group) {
  const model = kit(head, body)
  style.model(model)
  return {prop: model.prop, height: model.prop.position.y, motion: style.motion}
}

export const RESEARCH_RARITIES = [
  {name: '普通', chance: 60, styles: [1, 5, 6, 8, 9, 11, 13, 14, 21, 22]},
  {name: '稀有', chance: 27, styles: [10, 12, 16, 17, 18, 19, 25]},
  {name: '史詩', chance: 10, styles: [2, 4, 15, 23, 24]},
  {name: '傳說', chance: 3, styles: [3, 7, 20]},
] as const

export function rollResearch(random = Math.random) {
  let roll = random() * 100
  for (const rarity of RESEARCH_RARITIES) {
    roll -= rarity.chance
    if (roll < 0) return {rarity: rarity.name, style: rarity.styles[Math.floor(random() * rarity.styles.length)]}
  }
  throw new Error('Research rates must cover the full roll range')
}

export function stylePose(motion: Motion, phase: number, strength: number) {
  const wave = Math.sin(phase)
  const lift = Math.max(0, wave) ** 2
  return {
    yaw: wave * (motion.yaw ?? 0) * strength,
    pitch: lift * (motion.pitch ?? 0) * strength,
    lean: wave * (motion.lean ?? 0) * strength,
    wing: lift * (motion.wing ?? 0) * strength,
    hop: lift * (motion.hop ?? 0) * strength,
    swing: wave * (motion.swing ?? 0) * strength,
    lift: lift * (motion.lift ?? 0) * strength,
  }
}

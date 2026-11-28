import * as T from 'three'
import { glowMaterial } from './glow'
import { CHRISTMAS_STARS, isChristmasStar, isStall, WHEEL_HEIGHT, WHEEL_PERIOD, WHEEL_RADIUS, WHEEL_SEATS, wheelCabinPosition, type BuildKind, type StallKind } from './buildings'

const cube = new T.BoxGeometry(1, 1, 1)
const pebble = new T.IcosahedronGeometry(1, 0)
const round = new T.SphereGeometry(1, 16, 10)
const pot = new T.CylinderGeometry(.61, .39, 1, 9)
const cone = new T.CylinderGeometry(.23, .56, 1, 5)
const rim = new T.TorusGeometry(1, .17, 8, 24).rotateX(-Math.PI / 2)
const wood = new T.MeshStandardMaterial({color: 0x986c4d, roughness: .91})
const pale = new T.MeshStandardMaterial({color: 0xeaf8ff, roughness: .72})
const ice = new T.MeshStandardMaterial({color: 0x80bfdc, roughness: .43, flatShading: true})
const lightIce = new T.MeshStandardMaterial({color: 0xb3e6f4, roughness: .35, flatShading: true})
const hollow = new T.MeshStandardMaterial({color: 0x4b819f, roughness: .45})
const deep = new T.MeshStandardMaterial({color: 0x294c69, roughness: .42})
const green = new T.MeshStandardMaterial({color: 0x5f977a, roughness: .83})
const pink = new T.MeshStandardMaterial({color: 0xe790a7, roughness: .67})
const ceramic = new T.MeshStandardMaterial({color: 0xc48365, roughness: .92})
const machine = new T.MeshStandardMaterial({color: 0x527489, roughness: .42, metalness: .48})
const tank = new T.MeshStandardMaterial({color: 0xb8edff, transparent: true, opacity: .3, depthWrite: false, roughness: .16})
const seawater = new T.MeshStandardMaterial({color: 0x327e9c, roughness: .28})
const tankCylinder = new T.CylinderGeometry(1, 1, 1, 24)
const evergreen = new T.MeshStandardMaterial({color: 0x286750, flatShading: true})
const festiveRed = new T.MeshStandardMaterial({color: 0xb83b47, roughness: .58})
const festiveGold = new T.MeshStandardMaterial({color: 0xe8bc65, metalness: .38, roughness: .38})
const bough = new T.ConeGeometry(1, 1, 12)
const bulbs = [0xff5367, 0x79e8ff, 0xffd264, 0x8bffab].map(color =>
  new T.MeshStandardMaterial({color, emissive: color, emissiveIntensity: 1.5}))
const starShape = new T.Shape()
for (let i = 0; i < 10; i++) {
  const a = Math.PI / 2 + i * Math.PI / 5
  const r = i % 2 ? .11 : .26
  if (i) starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  else starShape.moveTo(0, r)
}
starShape.closePath()
const star = new T.ExtrudeGeometry(starShape, {depth: .075, bevelEnabled: false})
const floatingStar = new T.ExtrudeGeometry(starShape, {
  depth: .095, bevelEnabled: true, bevelSize: .068, bevelThickness: .078, bevelSegments: 5,
}).center()
const starMaterials = new Map(Object.entries(CHRISTMAS_STARS).map(([kind, {color}]) => [
  kind, {
    day: new T.MeshStandardMaterial({color, metalness: .14, roughness: .28}),
    night: new T.MeshStandardMaterial({color, emissive: color, emissiveIntensity: 1.4, roughness: .34}),
    glow: glowMaterial(color, .78),
  },
]))
const snowflakeCount = 48
const snowflakeTransform = new T.Object3D()
const snowflakeMaterial = new T.MeshBasicMaterial({color: 0xf5fbff})
const charcoal = new T.MeshStandardMaterial({color: 0x283745, roughness: .86})
const grilled = new T.MeshStandardMaterial({color: 0xb47035, roughness: .85})
const orange = new T.MeshStandardMaterial({color: 0xeea14b})
const lampMetal = new T.MeshStandardMaterial({color: 0x36515f, roughness: .42, metalness: .45})
const lampGlass = new T.MeshStandardMaterial({color: 0xf3e4bb, roughness: .31})
const lampGlow = new T.MeshStandardMaterial({color: 0xffd991, emissive: 0xffb955, emissiveIntensity: 2.4})
const lanternPanel = new T.Shape([
  new T.Vector2(-.35, -.41), new T.Vector2(.35, -.41),
  new T.Vector2(.35, .41), new T.Vector2(-.35, .41),
])
const penguinCutout = new T.Path()
penguinCutout.moveTo(0, .29)
penguinCutout.bezierCurveTo(.17, .29, .19, .13, .16, .045)
penguinCutout.lineTo(.25, -.11)
penguinCutout.quadraticCurveTo(.27, -.17, .16, -.13)
penguinCutout.bezierCurveTo(.15, -.30, .07, -.34, 0, -.29)
penguinCutout.bezierCurveTo(-.07, -.34, -.15, -.30, -.16, -.13)
penguinCutout.quadraticCurveTo(-.27, -.17, -.25, -.11)
penguinCutout.lineTo(-.16, .045)
penguinCutout.bezierCurveTo(-.19, .13, -.17, .29, 0, .29)
lanternPanel.holes.push(penguinCutout)
const lanternCutout = new T.ExtrudeGeometry(lanternPanel, {depth: .045, bevelEnabled: false, curveSegments: 8})
const schoolGable = new T.Shape()
schoolGable.moveTo(-1.39, 0)
schoolGable.lineTo(1.39, 0)
schoolGable.lineTo(0, .83)
schoolGable.closePath()
const schoolRoof = new T.ExtrudeGeometry(schoolGable, {depth: .78, bevelEnabled: false})

function part(group: T.Group, geometry: T.BufferGeometry, material: T.Material, x: number, y: number, z: number, w: number, h: number, d: number) {
  const mesh = new T.Mesh(geometry, material)
  mesh.position.set(x, y, z)
  mesh.scale.set(w, h, d)
  group.add(mesh)
  return mesh
}

function christmasTree(group: T.Group) {
  part(group, tankCylinder, wood, 0, .34, 0, .19, .68, .19)
  const lights: T.Mesh[] = []
  for (let tier = 0; tier < 3; tier++) {
    const y = 1.35 + tier * .82, radius = 1.62 - tier * .37
    part(group, bough, evergreen, 0, y, 0, radius, 1.72, radius)
    part(group, bough, pale, 0, y + .32, 0, radius * .67, 1.09, radius * .67).rotation.y = .18
    const count = 10 - tier * 2
    for (let i = 0; i < count; i++) {
      const angle = i * Math.PI * 2 / count + tier * .52
      const distance = radius * .87
      lights.push(part(group, round, bulbs[(i + tier) % bulbs.length],
        Math.cos(angle) * distance, y - .59, Math.sin(angle) * distance, .12, .12, .12))
    }
  }
  part(group, star, bulbs[2], 0, 4.08, 0, 1, 1, 1)
  part(group, star, bulbs[2], 0, 4.08, 0, 1, 1, 1).rotation.y = Math.PI / 2
  group.userData.lights = lights
}

function present(group: T.Group, x: number, y: number, z: number, size: number, color: T.Material, ribbon: T.Material, angle: number) {
  const box = new T.Group()
  group.add(box)
  box.position.set(x, y, z)
  box.rotation.y = angle
  part(box, cube, color, 0, size * .38, 0, size, size * .76, size * .9)
  part(box, cube, ribbon, 0, size * .39, 0, size * .15, size * .79, size * .92)
  part(box, cube, ribbon, 0, size * .39, 0, size * 1.02, size * .79, size * .14)
  for (const side of [-1, 1]) {
    part(box, round, ribbon, side * size * .13, size * .83, 0, size * .15, size * .055, size * .10).rotation.z = side * .36
  }
}

function santaSleigh(group: T.Group) {
  part(group, cube, festiveRed, 0, .52, 0, 1.46, .26, 2.04)
  part(group, cube, festiveRed, 0, .93, -.88, 1.48, .82, .22).rotation.x = -.16
  part(group, cube, pale, 0, 1.33, -.92, 1.51, .15, .26)
  part(group, cube, wood, 0, .76, -.51, 1.17, .16, .64)
  for (const side of [-1, 1]) {
    const x = side * .72
    part(group, cube, festiveRed, x, .75, 0, .16, .45, 1.98)
    part(group, cube, festiveGold, x, .99, 0, .18, .08, 2.02)
    part(group, cube, festiveGold, x, .13, -.12, .10, .12, 2.43)
    part(group, cube, festiveGold, x, .25, 1.16, .10, .12, .57).rotation.x = -.49
    for (const z of [-.79, .73]) part(group, cube, wood, x, .32, z, .12, .30, .14)
  }
}

function snowMachine(group: T.Group) {
  part(group, cube, machine, 0, .14, 0, 1.48, .28, 1.37)
  part(group, cube, ice, 0, .52, 0, 1.26, .55, 1.12)
  part(group, cube, pale, 0, .81, 0, 1.22, .12, 1.08)
  part(group, tankCylinder, machine, 0, 1.03, 0, .42, .42, .42)
  part(group, rim, lightIce, 0, 1.25, 0, .38, .29, .38)
  part(group, tankCylinder, deep, 0, 1.22, 0, .32, .09, .32)
  for (let i = -1; i <= 1; i++) {
    part(group, cube, machine, i * .25, .45, .57, .14, .15, .05)
  }
  part(group, round, bulbs[3], 0, .69, .57, .07, .07, .035)
  const snow = new T.InstancedMesh(pebble, snowflakeMaterial, snowflakeCount)
  snow.count = 0
  snow.frustumCulled = false
  snow.instanceMatrix.setUsage(T.DynamicDrawUsage)
  group.add(snow)
  group.userData.snow = snow
}

export function stallFood(kind: StallKind) {
  const food = new T.Group()
  if (kind === 'fish-stall') {
    part(food, cube, wood, 0, 0, 0, .04, .04, .75)
    part(food, round, grilled, 0, .05, .06, .13, .065, .25)
    part(food, pebble, grilled, 0, .05, -.18, .13, .04, .11)
    for (const z of [-.06, .04, .14]) part(food, cube, charcoal, 0, .105, z, .16, .014, .024).rotation.y = .28
  } else {
    part(food, pot, ice, 0, .1, 0, .32, .18, .32)
    part(food, round, pale, 0, .22, 0, .18, .12, .18)
    part(food, round, pink, 0, .30, 0, .13, .07, .13)
  }
  return food
}

function stallModel(group: T.Group, kind: StallKind) {
  const bear = kind === 'fish-stall'
  const accent = bear ? festiveRed : ice
  part(group, cube, wood, 0, .13, 0, 2.63, .25, 5.05)
  part(group, cube, accent, 0, .75, 2.04, 2.63, 1.05, .63)
  part(group, cube, wood, 0, 1.31, 2.04, 2.76, .15, .85)
  part(group, cube, pale, 0, .8, 2.37, .87, .48, .08)
  part(group, cube, accent, 0, .9, -2.30, 2.58, 1.55, .16)
  for (const x of [-1.19, 1.19]) for (const z of [-2.23, 1.9]) {
    part(group, cube, wood, x, 1.56, z, .16, 2.95, .16)
  }
  for (let i = 0; i < 7; i++) {
    const stripe = i % 2 ? pale : accent
    part(group, cube, stripe, (i - 3) * .40, 3.08, -.04, .405, .15, 5.0).rotation.x = .05
    part(group, round, stripe, (i - 3) * .40, 2.88, 2.48, .202, .17, .09)
  }
  for (const x of [-.98, .98]) part(group, round, bulbs[2], x, 2.56, 2.19, .10, .15, .10)
  const signFood = stallFood(kind)
  signFood.position.set(0, .80, 2.44)
  signFood.rotation.x = Math.PI / 2
  group.add(signFood)
  part(group, cube, bear ? charcoal : machine, -.77, 1.45, 2.07, .93, .16, .60)
  for (let i = 0; i < 3; i++) {
    const stock = stallFood(kind)
    stock.position.set(-.96 + i * .29, 1.54, 2.06)
    group.add(stock)
  }
  const owner = new T.Group()
  owner.position.set(.30, .24, 1.09)
  group.add(owner)
  const coat = bear ? pale : charcoal
  part(owner, round, coat, 0, .70, 0, .49, .64, .42)
  if (!bear) part(owner, round, pale, 0, .70, .29, .35, .48, .17)
  const head = new T.Group()
  head.position.y = 1.39
  owner.add(head)
  part(head, round, coat, 0, 0, 0, .45, .40, .39)
  const eyes: T.Mesh[] = []
  for (const side of [-1, 1]) {
    if (bear) part(head, round, pale, side * .33, .29, -.04, .145, .145, .09)
    else part(head, round, pale, side * .15, -.04, .29, .20, .23, .13)
    eyes.push(part(head, round, charcoal, side * .15, .04, .383, .047, .052, .028))
  }
  part(head, round, bear ? pale : orange, 0, -.13, .36, .21, .13, .15)
  if (bear) part(head, round, charcoal, 0, -.10, .496, .075, .055, .044)
  const arm = part(owner, round, coat, .44, .86, .04, .15, .33, .14)
  part(owner, round, coat, -.44, .82, .04, .15, .32, .14).rotation.z = -.30
  group.userData.vendor = {owner, head, eyes, arm}
}

function penguinSchool(group: T.Group) {
  part(group, cube, ice, 0, .21, 0, 6.48, .42, 4.28)
  part(group, cube, lightIce, 0, 1.67, 0, 6.1, 2.75, 3.9)
  for (const side of [-1, 1]) {
    const roof = part(group, cube, pale, side * 1.61, 3.26, 0, 3.63, .24, 4.32)
    roof.rotation.z = -side * .26
    part(group, cube, hollow, side * 2.14, 1.97, 1.96, 1.23, 1.08, .12)
    part(group, cube, festiveGold, side * 2.14, 1.97, 2.04, .075, 1.08, .075)
    part(group, cube, festiveGold, side * 2.14, 1.97, 2.04, 1.23, .075, .075)
  }
  part(group, cube, ice, 0, 2.5, 1.84, 2.48, 3.75, .59)
  part(group, schoolRoof, pale, 0, 4.35, 1.46, 1, 1, 1)
  part(group, cube, charcoal, 0, 1.05, 2.16, 1.1, 1.66, .12)
  part(group, cube, festiveGold, .29, .96, 2.23, .095, .13, .055)
  part(group, cube, pale, 0, .09, 2.42, 1.77, .18, .61)
  part(group, round, pale, 0, 3.77, 2.20, .41, .41, .085)
  part(group, cube, charcoal, 0, 3.86, 2.29, .043, .20, .035)
  part(group, cube, charcoal, .085, 3.77, 2.29, .18, .045, .035)
  // A raised penguin crest above the entrance identifies the school.
  part(group, round, charcoal, 0, 2.76, 2.24, .47, .55, .14)
  part(group, round, pale, 0, 2.65, 2.38, .36, .37, .06)
  for (const x of [-.14, .14]) {
    part(group, round, pale, x, 2.92, 2.365, .14, .15, .045)
    part(group, round, charcoal, x, 2.92, 2.411, .050, .060, .024)
  }
  part(group, round, orange, 0, 2.76, 2.42, .092, .055, .045)
  part(group, tankCylinder, charcoal, 0, 5.40, 1.83, .045, .84, .045)
  part(group, cube, festiveRed, .40, 5.66, 1.83, .80, .37, .065)
}

function pathLamp(group: T.Group, tall: boolean) {
  const height = tall ? 3.50 : 1.29
  const width = tall ? .70 : .55
  const base = tall ? .36 : .31
  part(group, tankCylinder, lampMetal, 0, .095, 0, base, .19, base)
  part(group, tankCylinder, lampMetal, 0, height / 2, 0, tall ? .075 : .10, height, tall ? .075 : .10)
  part(group, tankCylinder, festiveGold, 0, height - .38, 0, .13, .12, .13)
  part(group, cube, lampMetal, 0, height - .35, 0, width + .12, .12, width + .12)
  const glass = part(group, cube, lampGlass, 0, height, 0, width * .82, tall ? .79 : .58, width * .82)
  for (const x of [-1, 1]) for (const z of [-1, 1]) {
    part(group, cube, lampMetal, x * width * .48, height, z * width * .48, .065, tall ? .80 : .60, .065)
  }
  if (tall) {
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI / 2
      part(group, lanternCutout, lampMetal, Math.sin(angle) * .347, height, Math.cos(angle) * .347, 1, 1, 1).rotation.y = angle
    }
  }
  part(group, cube, lampMetal, 0, height + .39, 0, width + .19, .13, width + .19)
  part(group, round, pale, .02, height + .47, -.035, width * .66, .15, width * .64)
  part(group, round, pale, -width * .41, height + .37, .11, .091, .16, .14)
  group.userData.lamp = {glass, height, range: tall ? 12 : 7, intensity: tall ? 39 : 23}
}

export function lightPathLamp(model: T.Group, night: number) {
  const lamp = model.userData.lamp as {glass: T.Mesh, height: number, range: number, intensity: number} | undefined
  if (!lamp) return
  lamp.glass.material = night > .1 ? lampGlow : lampGlass
  return lamp
}

const wheelRim = new T.TorusGeometry(WHEEL_RADIUS, .105, 7, 48)
const wheelEntrance = new T.TorusGeometry(1.14, .10, 8, 24, Math.PI)
const wheelMedallion = new T.TorusGeometry(.60, .071, 8, 24)

function christmasWheel(group: T.Group) {
  part(group, cube, machine, 0, .12, 0, 8.7, .24, 4.3)
  part(group, cube, festiveGold, 0, .23, 0, 8.65, .078, 4.26)
  part(group, cube, pale, 0, .32, 0, 8.52, .15, 4.19)
  part(group, wheelEntrance, festiveGold, 0, 1.35, 1.78, 1, 1, 1)
  part(group, star, bulbs[2], 0, 2.58, 1.83, .9, .9, .9)
  for (const side of [-1, 1]) {
    part(group, cube, festiveRed, side * 1.14, .87, 1.78, .19, 1.02, .19)
    for (let stripe = 0; stripe < 4; stripe++) {
      part(group, cube, pale, side * 1.14, .52 + stripe * .22, 1.79, .21, .079, .21).rotation.z = .30
    }
    const tree = new T.Group()
    christmasTree(tree)
    tree.scale.setScalar(.37)
    tree.position.set(side * 3.40, .36, 1.26)
    group.add(tree)
    present(group, side * 2.49, .39, 1.43, .52, festiveRed, festiveGold, .23 * side)
    present(group, side * 2.92, .39, 1.62, .42, evergreen, pale, -.21 * side)
  }
  for (const side of [-1, 1]) for (const z of [-.68, .68]) {
    part(group, cube, machine, side * 1.12, 2.34, z, .28, 4.56, .27).rotation.z = side * .50
  }
  const rotor = new T.Group()
  rotor.position.y = WHEEL_HEIGHT
  group.add(rotor)
  for (const z of [-.22, .22]) {
    part(rotor, wheelRim, festiveRed, 0, 0, z, 1, 1, 1)
    part(rotor, wheelRim, festiveGold, 0, 0, z + Math.sign(z) * .03, .855, .855, .55)
  }
  part(rotor, round, festiveGold, 0, 0, .4, .41, .41, .21)
  part(rotor, wheelMedallion, festiveGold, 0, 0, .50, 1, 1, 1)
  part(rotor, star, bulbs[2], 0, 0, .62, 1.52, 1.52, 1)
  const cabins: T.Group[] = []
  const lights: T.Mesh[] = []
  for (const [radius, count] of [[WHEEL_RADIUS, 30], [WHEEL_RADIUS * .855, 18]]) {
    for (let i = 0; i < count; i++) {
      const angle = i * Math.PI * 2 / count
      lights.push(part(rotor, round, bulbs[i % bulbs.length], Math.sin(angle) * radius,
        Math.cos(angle) * radius, .35, .13, .13, .13))
    }
  }
  for (let i = 0; i < WHEEL_SEATS; i++) {
    const angle = i * Math.PI * 2 / WHEEL_SEATS
    part(rotor, cube, lightIce, Math.sin(angle) * WHEEL_RADIUS / 2, Math.cos(angle) * WHEEL_RADIUS / 2,
      0, .10, WHEEL_RADIUS, .12).rotation.z = -angle
    const cabin = new T.Group()
    cabin.scale.set(1.25, 1.28, 1.17)
    group.add(cabin)
    cabins.push(cabin)
    const trim = i % 2 ? evergreen : festiveRed
    part(cabin, cube, trim, 0, -.48, .24, 1.32, .15, 1.02)
    part(cabin, cube, trim, 0, -.29, .75, 1.31, .38, .12)
    part(cabin, cube, festiveGold, 0, -.09, .77, 1.35, .064, .13)
    part(cabin, star, bulbs[2], 0, -.28, .82, .50, .50, .50)
    for (const side of [-1, 1]) {
      part(cabin, cube, machine, side * .60, .13, .70, .09, 1.10, .09)
      part(cabin, cube, festiveGold, side * .60, .13, -.20, .09, 1.10, .09)
      part(cabin, cube, trim, side * .60, -.30, .25, .09, .37, .97)
    }
    part(cabin, cube, festiveGold, 0, .74, .26, 1.43, .13, 1.10)
    part(cabin, round, pale, 0, .80, .26, .74, .18, .58)
  }
  group.userData.wheel = {rotor, cabins, lights}
  animateDecoration(group, 0)
}

function penguinLaboratory(group: T.Group) {
  part(group, cube, machine, 0, .20, 0, 5.8, .40, 4.6)
  part(group, cube, pale, 0, .43, 0, 5.5, .17, 4.35)
  part(group, round, machine, 0, 2.47, -.12, 1.98, 2.13, 1.72)
  part(group, round, lightIce, 0, 2.20, 1.22, 1.35, 1.46, .49)
  part(group, round, machine, 0, 4.15, -.02, 1.51, 1.35, 1.39)
  part(group, cube, deep, 0, 4.32, 1.29, 2.43, .59, .27)
  part(group, cube, festiveGold, 0, 3.73, 1.47, .66, .23, .47)
  for (const side of [-1, 1]) {
    part(group, round, machine, side * 2.13, 2.55, -.16, .44, 1.27, .58).rotation.z = side * .32
    part(group, cube, machine, side * 1.18, .68, 1.12, 1.19, .36, 1.36)
    part(group, cube, bulbs[1], side * .62, 4.34, 1.444, .45, .20, .045)
    part(group, cube, bulbs[3], side * .90, 1.38, 1.83, .095, .74, .077)
  }
  part(group, cube, deep, 0, 1.39, 1.80, 1.60, 1.75, .30)
  part(group, cube, ice, 0, 1.36, 1.98, 1.26, 1.49, .10)
  part(group, cube, bulbs[1], 0, 1.31, 2.04, .045, 1.35, .04)
  part(group, cube, pale, 0, .54, 2.04, 1.73, .16, .51)
  part(group, cube, machine, .48, 5.47, -.17, .095, .64, .095)
  part(group, round, bulbs[1], .48, 5.81, -.17, .15, .15, .15)
}

export function decorationModel(kind: BuildKind) {
  const group = new T.Group()
  if (isChristmasStar(kind)) {
    const {size} = CHRISTMAS_STARS[kind]
    const materials = starMaterials.get(kind)!
    const mesh = part(group, floatingStar, materials.day, 0, 1.2 + size * .45, 0, size * 2, size * 2, size * 2)
    mesh.rotation.x = -.16
    const aura = new T.Sprite(materials.glow)
    aura.position.copy(mesh.position)
    aura.scale.setScalar(size * 4.7)
    aura.visible = false
    group.add(aura)
    group.userData.floatingStar = {mesh, aura, materials, height: mesh.position.y}
  } else if (kind === 'christmas-wheel') {
    christmasWheel(group)
  } else if (isStall(kind)) {
    stallModel(group, kind)
  } else if (kind === 'school') {
    penguinSchool(group)
  } else if (kind === 'laboratory') {
    penguinLaboratory(group)
  } else if (kind === 'snow-lamp' || kind === 'tall-lamp') {
    pathLamp(group, kind === 'tall-lamp')
  } else if (kind === 'sign') {
    part(group, cube, wood, 0, .55, 0, .16, 1.1, .17)
    part(group, cube, wood, 0, 1.09, .13, 1.25, .55, .16).rotation.z = .04
    part(group, cube, pale, 0, 1.36, .13, 1.27, .10, .22).rotation.z = .04
    for (let i = 0; i < 3; i++) part(group, cube, pale, -.12, 1.20 - i * .105, .22, .53 - i * .10, .035, .017)
  } else if (kind === 'planter') {
    part(group, pot, ceramic, 0, .24, 0, .69, .44, .69)
    part(group, round, pale, 0, .47, 0, .39, .075, .38)
    for (const side of [-1, 1]) {
      part(group, round, green, side * .11, .62, .03, .075, .23, .065).rotation.z = -side * .39
      part(group, round, pink, side * .15, .84, .04, .124, .12, .10)
    }
    part(group, round, pink, .02, 1.01, 0, .135, .13, .12)
  } else if (kind === 'sculpture') {
    part(group, cube, pale, 0, .13, 0, 1.37, .24, 1.12)
    part(group, pebble, ice, 0, .76, 0, .52, .58, .4)
    part(group, round, lightIce, 0, .72, .25, .29, .36, .20)
    part(group, pebble, ice, 0, 1.33, .11, .37, .32, .32)
    for (const side of [-1, 1]) part(group, pebble, lightIce, side * .47, .79, 0, .18, .34, .19).rotation.z = side * .33
    part(group, cone, lightIce, 0, 1.24, .47, .20, .24, .20).rotation.x = Math.PI / 2
  } else if (kind === 'christmas-tree') {
    christmasTree(group)
  } else if (kind === 'christmas-gifts') {
    present(group, -.33, 0, -.13, .83, festiveRed, festiveGold, -.16)
    present(group, .34, 0, .17, .67, evergreen, pale, .23)
    present(group, -.23, .64, -.13, .57, ice, festiveGold, .24)
    present(group, -.23, 0, .50, .42, festiveGold, festiveRed, -.28)
  } else if (kind === 'santa-sleigh') {
    santaSleigh(group)
  } else if (kind === 'snow-machine') {
    snowMachine(group)
  } else if (kind === 'filter') {
    part(group, cube, machine, 0, .21, 0, 1.78, .42, 1.63)
    part(group, cube, ice, 0, .64, -.20, 1.43, .57, 1.14)
    part(group, cube, machine, 0, .99, 0, 1.66, .19, 1.48)
    part(group, tankCylinder, pale, 0, 1.14, 0, .77, .14, .77)
    part(group, tankCylinder, seawater, 0, 1.59, 0, .62, .76, .62)
    part(group, tankCylinder, tank, 0, 1.75, 0, .71, 1.12, .71).renderOrder = 2
    part(group, tankCylinder, machine, 0, 2.30, 0, .76, .14, .76)
    for (const x of [-.64, .64]) {
      part(group, cube, machine, x, 1.74, -.28, .09, 1.14, .11)
      part(group, round, lightIce, x * .69, .76, .40, .075, .075, .045)
    }
    part(group, cube, machine, 0, .87, .79, .25, .21, .69)
    part(group, tankCylinder, pale, 0, .76, 1.10, .13, .16, .13)
    part(group, cube, pale, 0, .29, .81, .62, .09, .48)
  } else {
    const fishing = kind === 'fishing'
    part(group, round, ice, 0, .09, 0, 1.85, .18, 1.38)
    part(group, rim, pale, 0, .18, 0, 1.57, .37, 1.10)
    part(group, round, fishing ? deep : hollow, 0, .18, 0, 1.38, .065, .96)
    if (fishing) {
      group.scale.set(1.34, 1, 1.34)
      part(group, round, hollow, -.31, .234, .19, .47, .008, .11)
      part(group, pebble, lightIce, -1.45, .26, .50, .39, .28, .46).rotation.y = .47
      part(group, pebble, pale, 1.34, .23, -.62, .40, .19, .35)
    } else {
      part(group, cone, lightIce, 0, .40, 0, .93, .63, .93)
      const chips: T.Mesh[] = []
      for (let i = 0; i < 8; i++) chips.push(part(group, pebble, i % 2 ? ice : lightIce, 0, .7, 0, .15, .14, .12))
      group.userData.chips = chips
    }
  }
  return group
}

export function animateDecoration(group: T.Group, time: number, particles = true, night = 0) {
  const floating = group.userData.floatingStar
  if (floating) {
    const {mesh, aura, materials, height} = floating
    mesh.position.y = aura.position.y = height + Math.sin(time * 1.7 + group.position.x) * .12
    mesh.material = night > .1 ? materials.night : materials.day
    aura.visible = night > .1
  }
  const wheel = group.userData.wheel as {rotor: T.Group, cabins: T.Group[], lights: T.Mesh[]} | undefined
  if (wheel) {
    const turn = time * Math.PI * 2 / WHEEL_PERIOD
    wheel.rotor.rotation.z = turn
    wheel.cabins.forEach((cabin, index) => {
      const {x, y} = wheelCabinPosition(time, index)
      // Keep the platform aligned with the rider's feet as the cabin grows upward.
      cabin.position.set(x, y + .405 * (cabin.scale.y - 1), 0)
    })
    wheel.lights.forEach((lamp, index) => lamp.scale.setScalar(.10 + .05 * Math.sin(time * 4 + index * .8)))
  }
  const vendor = group.userData.vendor
  if (vendor) {
    const phase = time + group.position.x * .37 + group.position.z * .53
    vendor.owner.position.y = .24 + Math.sin(phase * 2.2) * .027
    vendor.head.rotation.y = Math.sin(phase * .86) * .29
    vendor.head.rotation.x = Math.sin(phase * 1.6) * .08
    vendor.arm.rotation.x = -.22 - Math.max(0, Math.sin(phase * .82)) ** 8 * .75
    for (const eye of vendor.eyes) eye.scale.y = phase % 4.1 > 3.95 ? .009 : .052
  }
  const lights = group.userData.lights as T.Mesh[] | undefined
  lights?.forEach((light, i) => light.scale.setScalar(.105 + Math.sin(time * 2.1 + i * 1.7) * .027))
  const snow = group.userData.snow as T.InstancedMesh | undefined
  if (snow && particles) {
    snow.count = snowflakeCount
    for (let i = 0; i < snow.count; i++) {
      const t = (time / 3.6 + i / snow.count) % 1
      const rise = Math.min(t / .29, 1)
      const fall = Math.max(0, (t - .29) / .71)
      const angle = i * 2.399 + fall * .55
      const drift = rise * .20 + fall * (1.65 + (i % 7) * .25)
      const height = 1.25 + rise * (2.55 + (i % 5) * .17) - fall ** 1.18 * 4.6
      snowflakeTransform.position.set(Math.cos(angle) * drift, Math.max(.06, height), Math.sin(angle) * drift)
      snowflakeTransform.rotation.set(i + time, angle, time * 1.5)
      snowflakeTransform.scale.setScalar((.045 + (i % 5) * .012) * (1 - .65 * fall ** 5))
      snowflakeTransform.updateMatrix()
      snow.setMatrixAt(i, snowflakeTransform.matrix)
    }
    snow.instanceMatrix.needsUpdate = true
  }
  const chips = group.userData.chips as T.Mesh[] | undefined
  if (!chips) return
  chips.forEach((chip, i) => {
    const t = (time * .63 + i / chips.length) % 1
    const angle = i * 2.40
    chip.position.set(Math.sin(angle) * t * 1.27, .38 + Math.sin(t * Math.PI) * 1.85, Math.cos(angle) * t * .91)
    chip.rotation.set(time * 1.5 + i, angle + time, time * .8)
  })
}

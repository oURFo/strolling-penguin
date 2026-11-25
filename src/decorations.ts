import * as T from 'three'
import { isStall, type BuildKind, type StallKind } from './buildings'

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
const snowflakeCount = 48
const snowflakeTransform = new T.Object3D()
const snowflakeMaterial = new T.MeshBasicMaterial({color: 0xf5fbff})
const charcoal = new T.MeshStandardMaterial({color: 0x283745, roughness: .86})
const grilled = new T.MeshStandardMaterial({color: 0xb47035, roughness: .85})
const orange = new T.MeshStandardMaterial({color: 0xeea14b})

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

export function decorationModel(kind: BuildKind) {
  const group = new T.Group()
  if (isStall(kind)) {
    stallModel(group, kind)
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

export function animateDecoration(group: T.Group, time: number, particles = true) {
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

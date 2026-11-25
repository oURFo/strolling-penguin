import * as T from 'three'
import type { BuildKind } from './buildings'

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

function part(group: T.Group, geometry: T.BufferGeometry, material: T.Material, x: number, y: number, z: number, w: number, h: number, d: number) {
  const mesh = new T.Mesh(geometry, material)
  mesh.position.set(x, y, z)
  mesh.scale.set(w, h, d)
  group.add(mesh)
  return mesh
}

export function decorationModel(kind: BuildKind) {
  const group = new T.Group()
  if (kind === 'sign') {
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

export function animateDecoration(group: T.Group, time: number) {
  const chips = group.userData.chips as T.Mesh[] | undefined
  if (!chips) return
  chips.forEach((chip, i) => {
    const t = (time * .63 + i / chips.length) % 1
    const angle = i * 2.40
    chip.position.set(Math.sin(angle) * t * 1.27, .38 + Math.sin(t * Math.PI) * 1.85, Math.cos(angle) * t * .91)
    chip.rotation.set(time * 1.5 + i, angle + time, time * .8)
  })
}

import type { Scene } from 'three'
import { Penguin, type Status } from './penguin'
import { Seal } from './seal'
import { Mammoth } from './mammoth'
import { SaberTooth } from './saber-tooth'

export function createAnimal(scene: Scene, x: number, z: number, status: Status, player = false,
  seed?: number, species: Penguin['species'] = 'penguin') {
  if (species === 'mammoth') return new Mammoth(scene, x, z, status, seed)
  if (species === 'saber-tooth') return new SaberTooth(scene, x, z, status, seed)
  if (species === 'seal') return new Seal(scene, x, z, status, seed)
  return new Penguin(scene, x, z, status, player, seed)
}

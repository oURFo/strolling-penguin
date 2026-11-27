import * as T from 'three'

const size = 48
const pixels = new Uint8Array(size * size * 4)
for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
  const radius = Math.hypot((x + .5) / size * 2 - 1, (y + .5) / size * 2 - 1)
  const i = (y * size + x) * 4
  pixels.fill(255, i, i + 3)
  pixels[i + 3] = Math.round(255 * Math.max(0, 1 - radius) ** 3)
}
const texture = new T.DataTexture(pixels, size, size)
texture.magFilter = T.LinearFilter
texture.minFilter = T.LinearFilter
texture.needsUpdate = true

export function glowMaterial(color: number, opacity: number) {
  return new T.SpriteMaterial({
    map: texture, color, opacity, transparent: true, depthWrite: false,
    blending: T.AdditiveBlending, toneMapped: false,
  })
}

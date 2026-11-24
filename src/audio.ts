const MUSIC_RATE = 22050
const BEAT = .82
const FULL_TURN = Math.PI * 2

function winterMusic(audio: AudioContext) {
  const chords = [
    [50, 57, 61, 66], [47, 54, 57, 62], [43, 50, 54, 59], [45, 52, 57, 61],
    [50, 57, 61, 66], [47, 54, 57, 62], [43, 50, 54, 59], [45, 52, 55, 61],
  ]
  const melody = [
    [78, 76, 73], [74, 71, 69], [71, 74, 78], [76, 73],
    [81, 78, 76], [74, 78, 74], [71, 69, 66], [67, 69, 73],
  ]
  const buffer = audio.createBuffer(1, Math.round(chords.length * 4 * BEAT * MUSIC_RATE), MUSIC_RATE)
  const samples = buffer.getChannelData(0)

  function note(pitch: number, start: number, level: number, length: number, bright: boolean) {
    const phaseStep = FULL_TURN * 440 * 2 ** ((pitch - 69) / 12) / MUSIC_RATE
    const offset = Math.round(start * MUSIC_RATE)
    const attack = bright ? .022 : .12
    const overtones = bright ? .24 : .10
    const decay = bright ? 2.1 : .9
    for (let i = 0; i < length * MUSIC_RATE; i++) {
      const t = i / MUSIC_RATE
      const envelope = Math.min(1, t / attack) * Math.exp(-t * decay) * Math.min(1, (length - t) / .34)
      const phase = i * phaseStep
      const sample = (Math.sin(phase) + overtones * Math.sin(phase * 2.005) * Math.exp(-t * 3)) * envelope * level
      samples[(offset + i) % samples.length] += sample
      if (bright) samples[(offset + i + 5292) % samples.length] += sample * .19
    }
  }

  chords.forEach((chord, bar) => {
    const start = bar * BEAT * 4
    note(chord[0], start, .27, 3.15, false)
    chord.slice(1).forEach((pitch, i) => note(pitch, start + BEAT * (.5 + i * .75), .17, 2.5, false))
    melody[bar].forEach((pitch, i) => note(pitch, start + BEAT * [.25, 1.75, 2.75][i], .24, 1.7, true))
  })
  return buffer
}

function snowSteps(audio: AudioContext) {
  return Array.from({length: 5}, (_, variant) => {
    const length = .15 + variant * .012
    const buffer = audio.createBuffer(1, Math.round(length * MUSIC_RATE), MUSIC_RATE)
    const samples = buffer.getChannelData(0)
    let fine = 0
    let low = 0
    let grain = 0
    for (let i = 0; i < samples.length; i++) {
      const t = i / MUSIC_RATE
      const noise = Math.random() * 2 - 1
      fine += (noise - fine) * .48
      low += (noise - low) * .10
      // Uneven little bursts suggest snow grains shifting as the foot presses down.
      grain *= .976
      if (Math.random() < .013) grain += .25 + Math.random() * .45
      const press = Math.min(1, t / .023) * (1 - t / length) ** 1.65
      const scuff = Math.exp(-((t - .068 - variant * .004) ** 2) / .00062)
      samples[i] = ((fine - low) * (.62 + .28 * scuff + .22 * Math.min(1, grain))
        + low * .18) * press
    }
    return buffer
  })
}

export class GameAudio {
  private context?: AudioContext
  private output?: GainNode
  private steps: AudioBuffer[] = []
  private muted = false

  get active() {
    return this.context !== undefined && !this.muted
  }

  activate() {
    if (this.muted || typeof AudioContext === 'undefined') return
    if (!this.context) {
      const audio = new AudioContext()
      this.context = audio
      this.output = audio.createGain()
      this.output.connect(audio.destination)
      this.steps = snowSteps(audio)
      const music = audio.createBufferSource()
      const level = audio.createGain()
      level.gain.value = .17
      music.buffer = winterMusic(audio)
      music.loop = true
      music.connect(level).connect(this.output)
      music.start()
    }
    if (this.context.state !== 'running') void this.context.resume().catch(() => {})
  }

  toggle() {
    this.muted = this.active
    if (!this.muted) this.activate()
    if (this.context && this.output) {
      this.output.gain.setTargetAtTime(this.muted ? 0 : 1, this.context.currentTime, .035)
    }
  }

  step(level = 1) {
    const audio = this.context
    if (!this.active || !audio || !this.output || audio.state !== 'running') return
    const step = audio.createBufferSource()
    step.buffer = this.steps[Math.floor(Math.random() * this.steps.length)]
    step.playbackRate.value = .92 + Math.random() * .17
    const volume = audio.createGain()
    volume.gain.value = .63 * .30 * level
    step.connect(volume).connect(this.output)
    step.start()
  }

  play(kind: 'honk' | 'join') {
    const audio = this.context
    const output = this.output
    if (!this.active || !audio || !output) return
    const at = audio.currentTime
    const pairs = kind === 'honk' ? [[390, 235], [350, 210]] : [[540, 650], [720, 810]]
    pairs.forEach(([start, end], i) => {
      const t = at + i * .145
      const voice = audio.createOscillator()
      const volume = audio.createGain()
      const filter = audio.createBiquadFilter()
      voice.type = kind === 'honk' ? 'triangle' : 'sine'
      filter.frequency.value = 1100
      voice.frequency.setValueAtTime(start, t)
      voice.frequency.exponentialRampToValueAtTime(end, t + .14)
      volume.gain.setValueAtTime(.001, t)
      volume.gain.exponentialRampToValueAtTime(kind === 'honk' ? .18 : .09, t + .025)
      volume.gain.exponentialRampToValueAtTime(.001, t + .19)
      voice.connect(filter).connect(volume).connect(output)
      voice.start(t)
      voice.stop(t + .20)
    })
  }
}

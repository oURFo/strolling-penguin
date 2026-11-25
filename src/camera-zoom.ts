export function bindCameraZoom(input: HTMLInputElement, output: HTMLOutputElement, storageKey: string) {
  try {
    const saved = localStorage.getItem(storageKey)
    if (saved !== null) input.value = saved
  } catch { /* Storage may be unavailable. */ }

  function update(persist = false) {
    const value = input.valueAsNumber
    output.value = value + '%'
    input.setAttribute('aria-valuetext', value + '%')
    if (persist) {
      try { localStorage.setItem(storageKey, String(value)) } catch { /* Continue without storage. */ }
    }
  }

  update()
  input.addEventListener('input', () => update())
  input.addEventListener('change', () => update(true))
  return {
    get scale() { return input.valueAsNumber / 100 },
    wheel(event: WheelEvent) {
      if (event.ctrlKey || event.metaKey || event.deltaY === 0) return
      event.preventDefault()
      input.valueAsNumber = Math.min(100, Math.max(50, input.valueAsNumber + Math.sign(event.deltaY) * 5))
      update(true)
    },
  }
}

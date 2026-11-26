const visitorKey = 'strolling-penguin-chat-uuid'
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function chatIdentity() {
  const fresh = crypto.randomUUID()
  try {
    const saved = localStorage.getItem(visitorKey)
    if (saved && uuidV4.test(saved)) return saved
    localStorage.setItem(visitorKey, fresh)
  } catch { /* Keep the generated ID for this session. */ }
  return fresh
}

export function setupChat(pauseInput: () => void) {
  const visitor = chatIdentity()
  const button = document.querySelector<HTMLButtonElement>('#open-chat')!
  const dialog = document.querySelector<HTMLDialogElement>('#chat-dialog')!
  const content = document.querySelector<HTMLElement>('#chat-content')!
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname)
  const url = import.meta.env.VITE_CHAT_ROOM_1?.trim() || (local ? 'http://127.0.0.1:4182/room/1' : '')
  if (!url) return dialog
  const endpoint = new URL(url, location.href)
  let frame: HTMLIFrameElement | undefined
  window.addEventListener('message', event => {
    if (!dialog.open || event.data?.type !== 'penguin-chat-ready' || !event.source || !('parent' in event.source)) return
    const googleFrame = endpoint.origin === 'https://script.google.com' &&
      /^https:\/\/[^/]+-script\.googleusercontent\.com$/.test(event.origin)
    if (event.origin !== endpoint.origin && !googleFrame) return
    let source = event.source as Window
    for (let depth = 0; depth < 4; depth++) {
      if (source === frame?.contentWindow) {
        event.source.postMessage({type: 'penguin-chat-identity', visitor}, {targetOrigin: event.origin})
        return
      }
      if (source === source.parent) return
      source = source.parent
    }
  })
  button.hidden = false
  button.onclick = () => {
    pauseInput()
    dialog.showModal()
    frame = document.createElement('iframe')
    frame.id = 'chat-frame'
    frame.title = '雪地聊天（實驗版） · 頻道 1'
    frame.src = endpoint.href
    content.append(frame)
    button.setAttribute('aria-expanded', 'true')
  }
  dialog.addEventListener('close', () => {
    frame?.remove()
    frame = undefined
    button.setAttribute('aria-expanded', 'false')
    button.focus()
  })
  return dialog
}

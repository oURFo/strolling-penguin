export function setupSaveSettings(pauseInput: () => void) {
  const dialog = document.querySelector<HTMLDialogElement>('#save-dialog')!
  const status = document.querySelector<HTMLElement>('#save-status')!
  const confirm = document.querySelector<HTMLButtonElement>('#confirm-persistent-save')!
  const storage = navigator.storage
  const supported = typeof storage?.persisted === 'function' && typeof storage.persist === 'function'
  let pending = false

  function showState(persistent: boolean, note = '') {
    status.textContent = persistent ? '目前使用持久自動存檔。' : '目前使用一般自動存檔。' + note
    confirm.hidden = persistent || !supported
    confirm.disabled = persistent || !supported || pending
  }

  async function refresh() {
    if (!supported) {
      showState(false, '此瀏覽器未提供持久儲存。')
      return
    }
    if (pending) return
    confirm.disabled = true
    status.textContent = '正在確認存檔狀態…'
    try {
      showState(await storage.persisted())
    } catch {
      showState(false, '暫時無法確認瀏覽器的持久儲存狀態。')
    }
  }

  document.getElementById('open-save')!.onclick = () => {
    pauseInput()
    dialog.showModal()
    void refresh()
  }
  dialog.addEventListener('close', () => document.getElementById('settings-toggle')?.focus())
  confirm.onclick = async () => {
    if (!supported || pending || confirm.disabled) return
    pending = true
    confirm.disabled = true
    status.textContent = '正在向瀏覽器申請持久儲存…'
    let granted = false
    let note = '瀏覽器未核准持久儲存。'
    try {
      granted = await storage.persist()
    } catch {
      note = '暫時無法申請持久儲存。'
    } finally {
      pending = false
      showState(granted, note)
    }
  }
  return dialog
}

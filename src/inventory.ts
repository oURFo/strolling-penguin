import { ITEMS, type ItemId } from './items'

const categories = ['裝備', '建築', '道具'] as const

export function setupInventory(pauseInput: () => void,
  count: (id: ItemId) => number, canUse: () => boolean, use: (id: ItemId) => boolean,
  sell: (id: ItemId) => boolean, thumbnail: (id: ItemId) => string) {
  const dialog = document.querySelector<HTMLDialogElement>('#inventory')!
  const tabs = dialog.querySelector('#inventory-categories')!
  const grid = dialog.querySelector('#inventory-items')!
  const empty = dialog.querySelector<HTMLElement>('#inventory-empty')!
  const details = dialog.querySelector<HTMLElement>('#inventory-details')!
  const action = dialog.querySelector<HTMLButtonElement>('#inventory-use')!
  const sellButton = dialog.querySelector<HTMLButtonElement>('#inventory-sell')!
  const confirmation = dialog.querySelector<HTMLElement>('#inventory-confirm')!
  const confirm = dialog.querySelector<HTMLButtonElement>('#inventory-confirm-sell')!
  let category: typeof categories[number] = '裝備'
  let launcher: HTMLButtonElement | undefined
  let placing = false
  const buttons = categories.map(value => {
    const tab = document.createElement('button')
    tab.type = 'button'
    tab.textContent = value
    tab.onclick = () => {
      category = value
      render()
    }
    tabs.append(tab)
    return tab
  })
  function render() {
    buttons.forEach((tab, index) => tab.setAttribute('aria-pressed', String(categories[index] === category)))
    grid.replaceChildren()
    details.hidden = true
    confirmation.hidden = true
    const visible = (Object.keys(ITEMS) as ItemId[]).filter(id => ITEMS[id].category === category && count(id) > 0)
    empty.hidden = visible.length > 0
    for (const id of visible) {
      const item = ITEMS[id]
      const cell = document.createElement('li')
      const button = document.createElement('button')
      button.type = 'button'
      const quantity = count(id)
      button.setAttribute('aria-label', `${item.name}，${quantity} 件`)
      const image = document.createElement('img')
      image.alt = ''
      image.src = thumbnail(id)
      const badge = document.createElement('span')
      badge.className = 'inventory-quantity'
      badge.setAttribute('aria-hidden', 'true')
      badge.textContent = String(quantity)
      button.append(image, badge)
      button.onclick = () => {
        details.querySelector('h3')!.textContent = item.name
        details.querySelector('p')!.textContent = item.description
        action.hidden = !canUse()
        action.onclick = () => {
          if (!use(id)) return
          placing = true
          dialog.close()
        }
        confirmation.hidden = true
        sellButton.onclick = () => {
          confirmation.querySelector('p')!.textContent = `要販售 1 件「${item.name}」嗎？可獲得 ${item.sellPrice} 枚金幣。`
          confirmation.hidden = false
        }
        confirm.onclick = () => { if (sell(id)) render() }
        details.hidden = false
      }
      cell.append(button)
      grid.append(cell)
    }
  }
  dialog.querySelector<HTMLButtonElement>('#inventory-cancel')!.onclick = () => {
    confirmation.hidden = true
    sellButton.focus()
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('.bag-launch')) {
    button.onclick = () => {
      pauseInput()
      launcher = button
      render()
      dialog.showModal()
    }
  }
  dialog.addEventListener('close', () => {
    if (placing) document.getElementById('territory-view')?.focus()
    else launcher?.focus()
    placing = false
  })
  return dialog
}

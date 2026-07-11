import { useState } from 'react'
import { battleStore } from '../store/battleStore'
import { blankCombatant } from '../store/createCombatant'
import { Modal } from './Modal'

export function AddBlank({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [maxHp, setMaxHp] = useState('10')
  const [ac, setAc] = useState('10')
  const [bonus, setBonus] = useState('0')
  const [isPC, setIsPC] = useState(false)

  const add = () => {
    if (!name.trim()) return
    battleStore.dispatch({
      type: 'addCombatant',
      combatant: blankCombatant({
        name: name.trim(),
        maxHp: Number(maxHp) || 10,
        armorClass: Number(ac) || 10,
        initiativeBonus: Number(bonus) || 0,
        isPC,
      }),
    })
    onClose()
  }

  return (
    <Modal title="Add combatant" onClose={onClose}>
      <div className="form-grid">
        <label>
          Name
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Max HP
          <input inputMode="numeric" value={maxHp} onChange={(e) => setMaxHp(e.target.value)} />
        </label>
        <label>
          AC
          <input inputMode="numeric" value={ac} onChange={(e) => setAc(e.target.value)} />
        </label>
        <label>
          Initiative bonus
          <input inputMode="numeric" value={bonus} onChange={(e) => setBonus(e.target.value)} />
        </label>
        <label className="check">
          <input type="checkbox" checked={isPC} onChange={(e) => setIsPC(e.target.checked)} />
          Player character
        </label>
      </div>
      <div className="modal-actions">
        <button type="button" className="primary" onClick={add}>
          Add
        </button>
      </div>
    </Modal>
  )
}

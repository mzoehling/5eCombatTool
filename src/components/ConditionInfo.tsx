import { describeCondition } from '../data/conditionInfo'
import { Modal } from './Modal'

/**
 * Rules text for a condition. Nothing else.
 *
 * This is the reader half of what used to be one component. Tapping "Prone" in a
 * monster's attack text is a question — *what does prone do?* — and it used to
 * answer with the rules plus a checkbox list of every combatant in the tracker
 * and an "Apply to 2" button: a reference work with an action form bolted on.
 * Setting a condition is a separate gesture with its own surface
 * (`ConditionsDialog`), reached from the row.
 */
export function ConditionInfo({ name, onClose }: { name: string; onClose: () => void }) {
  return (
    <Modal title={name} onClose={onClose}>
      <p className="condition-rules">{describeCondition(name) ?? 'Custom effect — no rules text.'}</p>
    </Modal>
  )
}

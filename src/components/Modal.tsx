import { mdiClose } from '@mdi/js'
import type { ReactNode } from 'react'
import './modal.css'
import { Icon } from './Icon'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  /** Extra classes on the dialog box, e.g. `modal-wide` / `modal-split`. */
  className?: string
}

export function Modal({ title, onClose, children, className }: ModalProps) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={className ? `modal ${className}` : 'modal'}
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="ghost" onClick={onClose} aria-label="Close">
            <Icon path={mdiClose} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

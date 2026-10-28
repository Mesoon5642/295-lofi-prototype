import { useEffect, useId, useRef } from 'react'
import Icon from './Icon.jsx'

// Modal frame for grown-up tasks (sign in, reading settings). Only the X closes
// it: clicking the backdrop does nothing, and Escape is blocked so a child
// can't skip past it. Always drawn in the standard font.
export default function AdultDialog({ title, onClose, initialFocusRef, children }) {
  const dialogRef = useRef(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open && typeof dialog.showModal === 'function') dialog.showModal()
    initialFocusRef?.current?.focus()
  }, [initialFocusRef])

  function handleCancel(event) {
    event.preventDefault()
  }

  // close() lets the browser return focus to the button that opened the dialog.
  function handleCloseClick() {
    const dialog = dialogRef.current
    if (dialog?.open) dialog.close()
    else onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      className="adult-dialog font-standard"
      aria-labelledby={titleId}
      closedby="none"
      onCancel={handleCancel}
      onClose={onClose}
    >
      <div className="adult-dialog__head">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="icon-button" onClick={handleCloseClick} aria-label="Close">
          <Icon name="close" size={24} />
        </button>
      </div>
      {children}
    </dialog>
  )
}

import { useEffect, useId, useRef } from 'react'

// Modal pause overlay built on <dialog>: the browser traps focus and makes
// the rest of the page inert. Escape and Continue both resume.
export default function PauseDialog({ onContinue }) {
  const dialogRef = useRef(null)
  const continueRef = useRef(null)
  const titleId = useId()
  const textId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open && typeof dialog.showModal === 'function') dialog.showModal()
    continueRef.current?.focus()
  }, [])

  function handleCancel(event) {
    event.preventDefault()
    onContinue()
  }

  return (
    <dialog
      ref={dialogRef}
      className="pause-dialog"
      aria-labelledby={titleId}
      aria-describedby={textId}
      onCancel={handleCancel}
      onClose={onContinue}
    >
      <h2 id={titleId}>Paused</h2>
      <p id={textId}>Take a break. Your place is saved.</p>
      <button
        ref={continueRef}
        type="button"
        className="btn btn--primary btn--big"
        onClick={onContinue}
      >
        Continue
      </button>
    </dialog>
  )
}

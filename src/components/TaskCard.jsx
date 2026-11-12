import { useId, useState } from 'react'

// The usability test task, shown on the child's screens while a session runs. It sits
// after <main>, so the screen's focus order is unchanged. Collapsing it hides the
// scenario from screen readers too; the toggle keeps its name. Starts open: the
// parent keys it by task, so each new task opens again.
export default function TaskCard({ taskNumber, taskTotal, scenario }) {
  const [open, setOpen] = useState(true)
  const bodyId = useId()

  return (
    <aside className="task-card" aria-label="Usability test task">
      <button
        type="button"
        className="task-card__toggle"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((current) => !current)}
      >
        Task {taskNumber} of {taskTotal}
      </button>
      <p id={bodyId} className="task-card__body" hidden={!open}>
        {scenario}
      </p>
    </aside>
  )
}

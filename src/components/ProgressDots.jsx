// "1 of 5" with simple dots. Shows place in the round, never a score.
export default function ProgressDots({ current, total }) {
  return (
    <div className="progress">
      <p className="progress__text">
        {current} of {total}
      </p>
      <ol className="progress__dots" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => {
          let state = ''
          if (i < current - 1) state = ' is-done'
          else if (i === current - 1) state = ' is-current'
          return <li key={i} className={`progress__dot${state}`} />
        })}
      </ol>
    </div>
  )
}

import Icon from './Icon.jsx'
import SampleBadge from './SampleBadge.jsx'
import { formatDate } from './formatDate.js'

const yesNo = (value) => (value ? 'Yes' : 'No')

// Parent/teacher table for one round (input: summarizeRound output).
export default function RoundDetail({ summary, headingId }) {
  return (
    <section className="panel" aria-labelledby={headingId}>
      <h2 id={headingId} className="panel__title">
        <span>Round on {formatDate(summary.completedAt ?? summary.startedAt)}</span>
        {summary.isSample && <SampleBadge />}
      </h2>
      <p>
        {summary.totalWords} words. Help used on {summary.hintCount}. Audio used on{' '}
        {summary.audioCount}.
      </p>
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Word details, scrolls sideways">
        <table className="detail-table">
          <caption className="visually-hidden">Each word in this round</caption>
          <thead>
            <tr>
              <th scope="col">Word</th>
              <th scope="col">Attempts</th>
              <th scope="col">Help used</th>
              <th scope="col">Audio used</th>
              <th scope="col">Answers chosen (in order)</th>
              <th scope="col">Explanation</th>
              <th scope="col">Needs practice</th>
            </tr>
          </thead>
          <tbody>
            {summary.words.map((w, i) => (
              <tr key={`${w.word}-${i}`}>
                <th scope="row" className="detail-table__word">
                  {w.word}
                </th>
                <td>{w.attempts}</td>
                <td>{yesNo(w.hintUsed)}</td>
                <td>{yesNo(w.audioUsed)}</td>
                <td>{w.selections.length > 0 ? w.selections.join(', ') : '—'}</td>
                <td>{w.explanation ?? '—'}</td>
                <td>
                  {w.needsPractice ? (
                    <span className="practice-flag">
                      <Icon name="flag" size={22} />
                      <span>Needs practice</span>
                    </span>
                  ) : (
                    <span>No</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

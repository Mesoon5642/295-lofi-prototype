import { imageUrl } from '../api/config.js'

// A picture from the image store (MongoDB, served by the API). No words appear inside
// the pictures, and the accessible name never reveals the answer.
export default function Picture({ pictureId, decorative = false, className = '' }) {
  return (
    <img
      className={`picture ${className}`.trim()}
      src={imageUrl(pictureId)}
      alt={decorative ? '' : 'Mystery picture'}
      width="200"
      height="200"
      draggable="false"
    />
  )
}

import { createContext } from 'react'

export const TextSizeContext = createContext({
  textSize: 'standard',
  setTextSize: () => {},
})

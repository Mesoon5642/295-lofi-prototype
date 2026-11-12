import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, SETTING_VALUES } from './settings.js'

describe('settings', () => {
  it('has the same keys in DEFAULT_SETTINGS and SETTING_VALUES', () => {
    expect(Object.keys(DEFAULT_SETTINGS).sort()).toEqual(Object.keys(SETTING_VALUES).sort())
  })

  it('every default is one of the allowed values', () => {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      expect(SETTING_VALUES[key]).toContain(value)
    }
  })

  it('allowed values are unique per setting', () => {
    for (const values of Object.values(SETTING_VALUES)) {
      expect(new Set(values).size).toBe(values.length)
    }
  })
})

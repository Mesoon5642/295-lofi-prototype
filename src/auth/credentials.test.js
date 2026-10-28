import { describe, expect, it } from 'vitest'
import { checkCredentials, checkParentPassword } from './credentials.js'

describe('checkCredentials', () => {
  it('accepts admin / admin', () => {
    expect(checkCredentials('admin', 'admin')).toBe(true)
  })

  it('ignores spaces around the username but not the password', () => {
    expect(checkCredentials('  admin ', 'admin')).toBe(true)
    expect(checkCredentials('admin', ' admin')).toBe(false)
  })

  it('rejects wrong, empty, or missing values', () => {
    expect(checkCredentials('admin', 'wrong')).toBe(false)
    expect(checkCredentials('Admin', 'admin')).toBe(false)
    expect(checkCredentials('', '')).toBe(false)
    expect(checkCredentials(undefined, undefined)).toBe(false)
  })
})

describe('checkParentPassword', () => {
  it('accepts only the exact parent/teacher password', () => {
    expect(checkParentPassword('admin')).toBe(true)
    expect(checkParentPassword(' admin')).toBe(false)
    expect(checkParentPassword('')).toBe(false)
    expect(checkParentPassword(undefined)).toBe(false)
  })
})

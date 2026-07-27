export function secureRandomIndex(length: number): number {
  if (!Number.isSafeInteger(length) || length <= 0) throw new RangeError('length must be a positive integer')
  const range = 2 ** 32
  const limit = Math.floor(range / length) * length
  const buffer = new Uint32Array(1)

  do {
    crypto.getRandomValues(buffer)
  } while ((buffer[0] ?? 0) >= limit)

  return (buffer[0] ?? 0) % length
}

export function generatePassword(length = 20): string {
  const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?'
  return Array.from({ length }, () => characters[secureRandomIndex(characters.length)]).join('')
}

const USERNAME_ADJECTIVES = ['Bright', 'Calm', 'Clever', 'Cosmic', 'Gentle', 'Lucky', 'Quiet', 'Swift', 'Vivid', 'Wise']
const USERNAME_NOUNS = ['Fox', 'Panda', 'Comet', 'Raven', 'Pixel', 'Otter', 'Nova', 'Maple', 'Cedar', 'Finch']

export function generateUsername(): string {
  const adjective = USERNAME_ADJECTIVES[secureRandomIndex(USERNAME_ADJECTIVES.length)]
  const noun = USERNAME_NOUNS[secureRandomIndex(USERNAME_NOUNS.length)]
  const suffix = secureRandomIndex(100)
  return `${adjective}${noun}${suffix}`
}

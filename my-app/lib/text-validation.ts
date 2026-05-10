const EMOJI_PATTERN =
  /[\p{Extended_Pictographic}\p{Regional_Indicator}\u{200D}\u{FE0F}\u{20E3}]/gu

export function stripEmoji(value: string) {
  return value.replace(EMOJI_PATTERN, "")
}

export function hasEmoji(value: string) {
  return stripEmoji(value) !== value
}

export const NAME_MIN_LENGTH = 20

export function validateDisplayName(value: string, label = "Name") {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return `${label} is required`
  }

  if (trimmedValue.length < NAME_MIN_LENGTH) {
    return `${label} must be at least ${NAME_MIN_LENGTH} characters.`
  }

  if (/^\d+$/.test(trimmedValue.replace(/\s+/g, ""))) {
    return `${label} cannot contain numbers only.`
  }

  return null
}

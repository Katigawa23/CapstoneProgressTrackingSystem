const EMOJI_PATTERN =
  /[\p{Extended_Pictographic}\p{Regional_Indicator}\u{200D}\u{FE0F}\u{20E3}]/gu

export function stripEmoji(value: string) {
  return value.replace(EMOJI_PATTERN, "")
}

export function hasEmoji(value: string) {
  return stripEmoji(value) !== value
}

export const TASK_SPRINT_NAME_MAX_LENGTH = 20

type ValidateDisplayNameOptions = {
  maxLength?: number
}

export function validateDisplayName(
  value: string,
  label = "Name",
  options: ValidateDisplayNameOptions = {}
) {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return `${label} is required`
  }

  if (options.maxLength && trimmedValue.length > options.maxLength) {
    return `${label} must be ${options.maxLength} characters or fewer.`
  }

  if (/^\d+$/.test(trimmedValue.replace(/\s+/g, ""))) {
    return `${label} cannot contain numbers only.`
  }

  return null
}

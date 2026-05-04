const EMOJI_PATTERN =
  /[\p{Extended_Pictographic}\p{Regional_Indicator}\u{200D}\u{FE0F}\u{20E3}]/gu

export function stripEmoji(value: string) {
  return value.replace(EMOJI_PATTERN, "")
}

export function hasEmoji(value: string) {
  return stripEmoji(value) !== value
}

/**
 * Smart quotes conversion utility
 * Converts straight quotes to typographic (curly) quotes
 */

const OPEN_DOUBLE_QUOTE = '\u201C' // "
const CLOSE_DOUBLE_QUOTE = '\u201D' // "
const OPEN_SINGLE_QUOTE = '\u2018' // '
const CLOSE_SINGLE_QUOTE = '\u2019' // '

/**
 * Convert straight quotes to smart quotes
 * @param text - Input text with straight quotes
 * @returns Text with smart quotes
 */
export function convertToSmartQuotes(text: string): string {
  let result = ''
  let inDoubleQuote = false
  let inSingleQuote = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const prevChar = i > 0 ? text[i - 1] : ''

    if (char === '"') {
      // Check if this should be an opening or closing quote
      const isOpeningContext =
        i === 0 ||
        prevChar === ' ' ||
        prevChar === '\n' ||
        prevChar === '\t' ||
        prevChar === '(' ||
        prevChar === '[' ||
        prevChar === '{' ||
        prevChar === OPEN_DOUBLE_QUOTE ||
        prevChar === OPEN_SINGLE_QUOTE

      if (isOpeningContext && !inDoubleQuote) {
        result += OPEN_DOUBLE_QUOTE
        inDoubleQuote = true
      } else {
        result += CLOSE_DOUBLE_QUOTE
        inDoubleQuote = false
      }
    } else if (char === "'") {
      // Check if this should be an opening or closing quote
      const isOpeningContext =
        i === 0 ||
        prevChar === ' ' ||
        prevChar === '\n' ||
        prevChar === '\t' ||
        prevChar === '(' ||
        prevChar === '[' ||
        prevChar === '{' ||
        prevChar === OPEN_DOUBLE_QUOTE ||
        prevChar === OPEN_SINGLE_QUOTE

      if (isOpeningContext && !inSingleQuote) {
        result += OPEN_SINGLE_QUOTE
        inSingleQuote = true
      } else {
        result += CLOSE_SINGLE_QUOTE
        inSingleQuote = false
      }
    } else {
      result += char
    }
  }

  return result
}

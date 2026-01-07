// Reading time calculation constants
const KOREAN_CHARS_PER_MIN = 600 // Korean characters per minute
const ENGLISH_WORDS_PER_MIN = 220 // English words per minute
const IMAGE_TIME_SEC = 5 // seconds per image
const CODE_LINE_TIME_SEC = 2 // seconds per code line

/**
 * Calculate reading time for mixed Korean/English content
 * - Korean: character-based (600 chars/min)
 * - English: word-based (220 words/min)
 * - Images: +5 sec each
 * - Code blocks: +2 sec per line
 */
export function calculateReadingTime(htmlContent: string): number {
  // Strip HTML tags for text analysis
  const textContent = htmlContent
    .replace(/<pre[\s\S]*?<\/pre>/gi, '') // Remove code blocks (counted separately)
    .replace(/<[^>]+>/g, ' ') // Remove HTML tags
    .replace(/&[a-z]+;/gi, ' ') // Remove HTML entities
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()

  // Count Korean characters (Hangul syllables: 가-힣)
  const koreanChars = (textContent.match(/[가-힣]/g) || []).length

  // Count English words (sequences of Latin letters)
  const englishWords = (textContent.match(/[A-Za-z]+/g) || []).length

  // Count images
  const imageCount = (htmlContent.match(/<img[^>]*>/gi) || []).length

  // Count code lines in <pre> blocks
  const codeBlocks = htmlContent.match(/<pre[\s\S]*?<\/pre>/gi) || []
  const codeLines = codeBlocks.reduce((total, block) => {
    const lines = block.split('\n').length
    return total + lines
  }, 0)

  // Calculate time in minutes
  const koreanTime = koreanChars / KOREAN_CHARS_PER_MIN
  const englishTime = englishWords / ENGLISH_WORDS_PER_MIN
  const imageTime = (imageCount * IMAGE_TIME_SEC) / 60
  const codeTime = (codeLines * CODE_LINE_TIME_SEC) / 60

  const totalTime = koreanTime + englishTime + imageTime + codeTime

  // Round: >= 0.5 rounds up, minimum 1 minute
  const rounded = totalTime >= 0.5 ? Math.ceil(totalTime) : Math.round(totalTime)
  return Math.max(1, rounded)
}

import DOMPurify, { Config } from 'dompurify'

// Configure DOMPurify for safe HTML rendering
const purifyConfig: Config = {
  // Allow common HTML elements for rich text content
  ALLOWED_TAGS: [
    // Text formatting
    'p', 'br', 'span', 'div',
    'strong', 'b', 'em', 'i', 'u', 's', 'del', 'mark', 'sub', 'sup',
    // Headings
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    // Lists
    'ul', 'ol', 'li',
    // Links and media
    'a', 'img', 'figure', 'figcaption',
    // Code
    'pre', 'code',
    // Tables
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption',
    // Blockquotes
    'blockquote',
    // Interactive elements (for code copy button)
    'button',
    // Other
    'hr', 'iframe',
  ],
  ALLOWED_ATTR: [
    // Global attributes
    'class', 'id', 'style', 'data-*', 'title',
    // Link attributes
    'href', 'target', 'rel',
    // Image attributes
    'src', 'alt', 'width', 'height', 'loading',
    // Table attributes
    'colspan', 'rowspan',
    // Media attributes
    'controls', 'autoplay', 'muted', 'loop',
    // Iframe attributes (for YouTube embeds)
    'src', 'frameborder', 'allow', 'allowfullscreen',
    // Data attributes for custom elements
    'data-youtube-video', 'data-type', 'data-latex', 'data-display', 'data-align', 'data-language',
    'data-copy-index',
  ],
  // Allow data: URLs for images (base64 encoded)
  ALLOW_DATA_ATTR: true,
  // Allow YouTube iframe embeds
  ADD_TAGS: ['iframe'],
  ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder'],
}

// Sanitize HTML content
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, purifyConfig) as string
}

// Sanitize and return for dangerouslySetInnerHTML
export function createSafeHtml(dirty: string): { __html: string } {
  return { __html: sanitizeHtml(dirty) }
}

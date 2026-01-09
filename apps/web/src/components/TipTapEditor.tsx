import { useEditor, EditorContent, NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, NodeViewProps } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Youtube from '@tiptap/extension-youtube'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { TextAlign } from '@tiptap/extension-text-align'
import { Highlight } from '@tiptap/extension-highlight'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { Extension, Node } from '@tiptap/core'
import { InputRule } from '@tiptap/core'
import { common, createLowlight } from 'lowlight'
import { useCallback, useEffect, useRef, useState, MouseEvent as ReactMouseEvent } from 'react'
import { api } from '../services/api'
import { useModal } from '../contexts/ModalContext'
import { useToast } from '../contexts/ToastContext'
import { SlashCommandsExtension } from './SlashCommands'
import 'tippy.js/dist/tippy.css'
import 'tippy.js/animations/shift-toward-subtle.css'

const lowlight = createLowlight(common)

// Resizable Image Component
function ResizableImageComponent({ node, updateAttributes, selected }: NodeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeDirection, setResizeDirection] = useState<'left' | 'right' | null>(null)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)

  const { src, alt, title, width, align } = node.attrs
  const imageWidth = width || '100%'
  const imageAlign = align || 'center'

  const handleMouseDown = (e: ReactMouseEvent, direction: 'left' | 'right') => {
    e.preventDefault()
    e.stopPropagation()

    setIsResizing(true)
    setResizeDirection(direction)
    startXRef.current = e.clientX

    const container = containerRef.current
    if (container) {
      startWidthRef.current = container.offsetWidth
    }
  }

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      const delta = resizeDirection === 'right'
        ? e.clientX - startXRef.current
        : startXRef.current - e.clientX

      const newWidth = Math.max(100, startWidthRef.current + delta * (resizeDirection === 'left' ? 2 : 2))
      const maxWidth = containerRef.current?.parentElement?.offsetWidth || 800
      const clampedWidth = Math.min(newWidth, maxWidth)

      updateAttributes({ width: `${clampedWidth}px` })
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      setResizeDirection(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, resizeDirection, updateAttributes])

  return (
    <NodeViewWrapper className={`resizable-image-wrapper align-${imageAlign}`}>
      <div
        ref={containerRef}
        className={`resizable-image-container ${selected ? 'is-selected' : ''} ${isResizing ? 'is-resizing' : ''}`}
        style={{ width: imageWidth }}
      >
        <img
          src={src}
          alt={alt || ''}
          title={title || ''}
          draggable={false}
        />
        {selected && (
          <>
            <div
              className="resize-handle resize-handle-left"
              onMouseDown={(e) => handleMouseDown(e, 'left')}
            />
            <div
              className="resize-handle resize-handle-right"
              onMouseDown={(e) => handleMouseDown(e, 'right')}
            />
            <div className="image-align-toolbar">
              <button
                type="button"
                className={imageAlign === 'left' ? 'active' : ''}
                onClick={() => updateAttributes({ align: 'left' })}
                title="왼쪽 정렬"
              >
                <span className="material-symbols-outlined">format_align_left</span>
              </button>
              <button
                type="button"
                className={imageAlign === 'center' ? 'active' : ''}
                onClick={() => updateAttributes({ align: 'center' })}
                title="가운데 정렬"
              >
                <span className="material-symbols-outlined">format_align_center</span>
              </button>
              <button
                type="button"
                className={imageAlign === 'right' ? 'active' : ''}
                onClick={() => updateAttributes({ align: 'right' })}
                title="오른쪽 정렬"
              >
                <span className="material-symbols-outlined">format_align_right</span>
              </button>
            </div>
          </>
        )}
      </div>
    </NodeViewWrapper>
  )
}

// Custom Resizable Image Extension
const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: element => element.getAttribute('width') || element.style.width || null,
        renderHTML: attributes => {
          if (!attributes.width) {
            return {}
          }
          return { width: attributes.width, style: `width: ${attributes.width}` }
        },
      },
      align: {
        default: 'center',
        parseHTML: element => element.getAttribute('data-align') || 'center',
        renderHTML: attributes => {
          return { 'data-align': attributes.align }
        },
      },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageComponent)
  },
})

// Markdown shortcuts extension (``` triggers code block immediately)
const MarkdownShortcuts = Extension.create({
  name: 'markdownShortcuts',

  addInputRules() {
    return [
      // ``` → Code Block (triggers on third backtick)
      new InputRule({
        find: /^```$/,
        handler: ({ range, chain }: { range: { from: number; to: number }; chain: () => any }) => {
          chain().deleteRange(range).setNode('codeBlock').run()
        },
      }),
      // ```language → Code Block with language (e.g., ```javascript)
      new InputRule({
        find: /^```(\w+)$/,
        handler: ({ range, chain, match }: { range: { from: number; to: number }; chain: () => any; match: RegExpMatchArray }) => {
          const language = match[1]?.toLowerCase() || ''
          chain().deleteRange(range).setNode('codeBlock', { language }).run()
        },
      }),
    ]
  },
})

// Supported languages
const LANGUAGES = [
  { value: '', label: 'Auto' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'php', label: 'PHP' },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'sql', label: 'SQL' },
  { value: 'bash', label: 'Bash' },
  { value: 'shell', label: 'Shell' },
  { value: 'json', label: 'JSON' },
  { value: 'xml', label: 'XML' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'scss', label: 'SCSS' },
  { value: 'yaml', label: 'YAML' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'dockerfile', label: 'Dockerfile' },
]

// Custom Code Block Component with language selector
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CodeBlockComponent({ node, updateAttributes }: any) {
  const currentLanguage = (node.attrs.language as string) || ''

  return (
    <NodeViewWrapper className="code-block-wrapper">
      <div className="code-block-header">
        <div className="code-block-dots">
          <span className="dot red" />
          <span className="dot yellow" />
          <span className="dot green" />
        </div>
        <select
          className="code-block-language"
          value={currentLanguage}
          onChange={(e) => updateAttributes({ language: e.target.value })}
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>
      <pre>
        <NodeViewContent className="hljs" />
      </pre>
    </NodeViewWrapper>
  )
}

// Extended CodeBlock with React component and custom keyboard shortcuts
const CustomCodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockComponent)
  },

  addKeyboardShortcuts() {
    return {
      // Ctrl+A / Cmd+A: Select only code block content when inside a code block
      'Mod-a': ({ editor }) => {
        const { state } = editor
        const { selection } = state
        const { $from } = selection

        // Check if cursor is inside a code block
        const codeBlockNode = $from.node($from.depth)
        if (codeBlockNode?.type.name === 'codeBlock') {
          // Find the code block's position
          const codeBlockPos = $from.before($from.depth)
          const codeBlockEnd = codeBlockPos + codeBlockNode.nodeSize

          // Select the content inside the code block (excluding the node boundaries)
          editor.commands.setTextSelection({
            from: codeBlockPos + 1,
            to: codeBlockEnd - 1,
          })
          return true // Prevent default behavior
        }

        // Let default Ctrl+A behavior happen for non-code-block content
        return false
      },

      // Escape: Exit code block or table and move cursor to a new paragraph below
      'Escape': ({ editor }) => {
        const { state } = editor
        const { selection } = state
        const { $from } = selection

        // Check if cursor is inside a code block
        const codeBlockNode = $from.node($from.depth)
        if (codeBlockNode?.type.name === 'codeBlock') {
          // Find the code block's end position
          const codeBlockPos = $from.before($from.depth)
          const codeBlockEnd = codeBlockPos + codeBlockNode.nodeSize

          // Insert a new paragraph after the code block and move cursor there
          editor
            .chain()
            .focus()
            .setTextSelection(codeBlockEnd)
            .insertContent({ type: 'paragraph' })
            .focus()
            .run()

          return true // Prevent default behavior
        }

        // Check if cursor is inside a table
        for (let d = $from.depth; d > 0; d--) {
          const node = $from.node(d)
          if (node?.type.name === 'table') {
            // Find the table's end position
            const tablePos = $from.before(d)
            const tableEnd = tablePos + node.nodeSize

            // Insert a new paragraph after the table and move cursor there
            editor
              .chain()
              .focus()
              .setTextSelection(tableEnd)
              .insertContent({ type: 'paragraph' })
              .focus()
              .run()

            return true // Prevent default behavior
          }
        }

        return false
      },
    }
  },
})

// Callout types configuration
const CALLOUT_TYPES = [
  { type: 'info', icon: '💡', label: '정보', bgLight: '#eff6ff', bgDark: '#1e3a5f', borderColor: '#3b82f6' },
  { type: 'warning', icon: '⚠️', label: '주의', bgLight: '#fffbeb', bgDark: '#422006', borderColor: '#f59e0b' },
  { type: 'error', icon: '🚨', label: '오류', bgLight: '#fef2f2', bgDark: '#450a0a', borderColor: '#ef4444' },
  { type: 'success', icon: '✅', label: '성공', bgLight: '#f0fdf4', bgDark: '#052e16', borderColor: '#22c55e' },
  { type: 'note', icon: '📝', label: '노트', bgLight: '#f8fafc', bgDark: '#1e293b', borderColor: '#64748b' },
  { type: 'tip', icon: '🔥', label: '팁', bgLight: '#fff7ed', bgDark: '#431407', borderColor: '#f97316' },
]

// Callout Component (Notion-style)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DEFAULT_CALLOUT = { type: 'info', icon: '💡', label: '정보', bgLight: '#eff6ff', bgDark: '#1e3a5f', borderColor: '#3b82f6' }

function CalloutComponent({ node, updateAttributes, deleteNode }: any) {
  const { type, icon } = node.attrs
  const [showIconPicker, setShowIconPicker] = useState(false)
  const calloutConfig = CALLOUT_TYPES.find(c => c.type === type) ?? DEFAULT_CALLOUT

  const commonEmojis = ['💡', '⚠️', '🚨', '✅', '📝', '🔥', '❓', '📌', '🎯', '⭐', '🚀', '💪', '👀', '🤔', '📢', '🔔']

  return (
    <NodeViewWrapper
      className="callout-wrapper"
      data-callout-type={type}
      style={{
        '--callout-bg-light': calloutConfig.bgLight,
        '--callout-bg-dark': calloutConfig.bgDark,
        '--callout-border': calloutConfig.borderColor,
      } as React.CSSProperties}
    >
      <div className="callout-icon-wrapper">
        <button
          type="button"
          className="callout-icon"
          onClick={() => setShowIconPicker(!showIconPicker)}
          title="아이콘 변경"
        >
          {icon}
        </button>
        {showIconPicker && (
          <div className="callout-icon-picker">
            {commonEmojis.map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  updateAttributes({ icon: emoji })
                  setShowIconPicker(false)
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
      <NodeViewContent className="callout-content" />
      <div className="callout-actions">
        <select
          className="callout-type-select"
          value={type}
          onChange={(e) => {
            const newType = e.target.value
            const newConfig = CALLOUT_TYPES.find(c => c.type === newType)
            updateAttributes({ type: newType, icon: newConfig?.icon || icon })
          }}
        >
          {CALLOUT_TYPES.map(c => (
            <option key={c.type} value={c.type}>{c.label}</option>
          ))}
        </select>
        <button
          type="button"
          className="callout-delete"
          onClick={deleteNode}
          title="삭제"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      </div>
    </NodeViewWrapper>
  )
}

// Callout Node Extension
const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',

  addAttributes() {
    return {
      type: { default: 'info' },
      icon: { default: '💡' },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-callout]',
        getAttrs: (dom) => {
          const element = dom as HTMLElement
          return {
            type: element.getAttribute('data-callout-type') || 'info',
            icon: element.getAttribute('data-callout-icon') || '💡',
          }
        },
        contentElement: '.callout-static-content',
      },
    ]
  },

  renderHTML({ node }) {
    const { type, icon } = node.attrs
    const config = CALLOUT_TYPES.find(c => c.type === type) ?? DEFAULT_CALLOUT
    return [
      'div',
      {
        'data-callout': '',
        'data-callout-type': type,
        'data-callout-icon': icon,
        class: 'callout-static',
        style: `--callout-bg-light: ${config.bgLight}; --callout-bg-dark: ${config.bgDark}; --callout-border: ${config.borderColor};`,
      },
      ['span', { class: 'callout-static-icon' }, icon],
      ['div', { class: 'callout-static-content' }, 0],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutComponent)
  },
})

// PullQuote Component (Large stylized quote)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PullQuoteComponent({ deleteNode }: any) {
  return (
    <NodeViewWrapper className="pullquote-wrapper">
      <div className="pullquote-mark pullquote-mark-open">"</div>
      <NodeViewContent className="pullquote-content" />
      <div className="pullquote-mark pullquote-mark-close">"</div>
      <button
        type="button"
        className="pullquote-delete"
        onClick={deleteNode}
        title="삭제"
      >
        <span className="material-symbols-outlined text-[16px]">close</span>
      </button>
    </NodeViewWrapper>
  )
}

// PullQuote Node Extension
const PullQuote = Node.create({
  name: 'pullQuote',
  group: 'block',
  content: 'block+',

  parseHTML() {
    return [{ tag: 'div[data-pullquote]' }]
  },

  renderHTML() {
    return [
      'div',
      { 'data-pullquote': '', class: 'pullquote-static' },
      ['span', { class: 'pullquote-static-mark-open' }, '"'],
      ['div', { class: 'pullquote-static-content' }, 0],
      ['span', { class: 'pullquote-static-mark-close' }, '"'],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(PullQuoteComponent)
  },
})

// Bookmark Component for link previews
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BookmarkComponent({ node, deleteNode }: any) {
  const { url, title, description, image, favicon, siteName } = node.attrs

  return (
    <NodeViewWrapper className="bookmark-wrapper" contentEditable={false}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="bookmark-card"
      >
        <div className="bookmark-content">
          <div className="bookmark-title">{title || url}</div>
          {description && (
            <div className="bookmark-description">{description}</div>
          )}
          <div className="bookmark-meta">
            {favicon && (
              <img src={favicon} alt="" className="bookmark-favicon" />
            )}
            <span className="bookmark-site">{siteName || new URL(url).hostname}</span>
          </div>
        </div>
        {image && (
          <div className="bookmark-image">
            <img src={image} alt="" />
          </div>
        )}
      </a>
      <button
        type="button"
        className="bookmark-delete"
        onClick={deleteNode}
        title="북마크 삭제"
      >
        <span className="material-symbols-outlined text-[16px]">close</span>
      </button>
    </NodeViewWrapper>
  )
}

// Bookmark Node Extension
const Bookmark = Node.create({
  name: 'bookmark',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      url: { default: null },
      title: { default: null },
      description: { default: null },
      image: { default: null },
      favicon: { default: null },
      siteName: { default: null },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-bookmark]',
        getAttrs: (dom) => {
          const element = dom as HTMLElement
          return {
            url: element.getAttribute('data-url'),
            title: element.getAttribute('data-title'),
            description: element.getAttribute('data-description'),
            image: element.getAttribute('data-image'),
            favicon: element.getAttribute('data-favicon'),
            siteName: element.getAttribute('data-sitename'),
          }
        },
      },
    ]
  },

  renderHTML({ node }) {
    const { url, title, description, image, favicon, siteName } = node.attrs
    const domain = url ? new URL(url).hostname.replace(/^www\./, '') : ''

    // Create bookmark card HTML structure for storage/preview
    return [
      'div',
      {
        'data-bookmark': '',
        'data-url': url,
        'data-title': title,
        'data-description': description,
        'data-image': image,
        'data-favicon': favicon,
        'data-sitename': siteName,
        class: 'bookmark-card-static',
      },
      [
        'a',
        {
          href: url,
          target: '_blank',
          rel: 'noopener noreferrer',
          class: 'bookmark-link',
        },
        [
          'div',
          { class: 'bookmark-content' },
          ['div', { class: 'bookmark-title' }, title || url],
          description ? ['div', { class: 'bookmark-description' }, description] : '',
          [
            'div',
            { class: 'bookmark-meta' },
            favicon ? ['img', { src: favicon, alt: '', class: 'bookmark-favicon' }] : '',
            ['span', { class: 'bookmark-site' }, siteName || domain],
          ],
        ],
        image
          ? [
              'div',
              { class: 'bookmark-image' },
              ['img', { src: image, alt: '' }],
            ]
          : '',
      ],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(BookmarkComponent)
  },
})

interface TipTapEditorProps {
  content: string
  onChange: (content: string) => void
  placeholder?: string
}

interface ToolbarButtonProps {
  onClick: () => void
  isActive?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
  stopPropagation?: boolean
}

function ToolbarButton({ onClick, isActive, disabled, title, children, stopPropagation }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={(e) => { if (stopPropagation) e.stopPropagation(); onClick() }}
      disabled={disabled}
      title={title}
      className={`p-2 rounded transition-colors ${
        isActive
          ? 'bg-primary/20 text-primary'
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  )
}

function ToolbarDivider() {
  return <div className="w-px h-6 bg-slate-200 dark:border-slate-700 mx-1" />
}

// HSL to RGB conversion
function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

// Hex to HSL conversion
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return { h: 0, s: 100, l: 50 }

  let r = parseInt(result[1]!, 16) / 255
  let g = parseInt(result[2]!, 16) / 255
  let b = parseInt(result[3]!, 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
}

interface AdvancedColorPickerProps {
  initialColor?: string
  onApply: (color: string) => void
  onCancel: () => void
}

function AdvancedColorPicker({ initialColor = '#ff0000', onApply, onCancel }: AdvancedColorPickerProps) {
  const initialHsl = hexToHsl(initialColor)
  const [hue, setHue] = useState(initialHsl.h)
  const [saturation, setSaturation] = useState(initialHsl.s)
  const [lightness, setLightness] = useState(initialHsl.l)
  const [isDraggingSL, setIsDraggingSL] = useState(false)
  const [isDraggingHue, setIsDraggingHue] = useState(false)
  const slPickerRef = useRef<HTMLDivElement>(null)
  const hueSliderRef = useRef<HTMLDivElement>(null)

  const currentColor = hslToHex(hue, saturation, lightness)

  const handleSLMouseDown = (e: ReactMouseEvent) => {
    e.preventDefault()
    setIsDraggingSL(true)
    updateSL(e.nativeEvent)
  }

  const handleHueMouseDown = (e: ReactMouseEvent) => {
    e.preventDefault()
    setIsDraggingHue(true)
    updateHue(e.nativeEvent)
  }

  const updateSL = useCallback((e: MouseEvent) => {
    if (!slPickerRef.current) return
    const rect = slPickerRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left))
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top))
    setSaturation(Math.round((x / rect.width) * 100))
    setLightness(Math.round(100 - (y / rect.height) * 100))
  }, [])

  const updateHue = useCallback((e: MouseEvent) => {
    if (!hueSliderRef.current) return
    const rect = hueSliderRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left))
    setHue(Math.round((x / rect.width) * 360))
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingSL) updateSL(e)
      if (isDraggingHue) updateHue(e)
    }

    const handleMouseUp = () => {
      setIsDraggingSL(false)
      setIsDraggingHue(false)
    }

    if (isDraggingSL || isDraggingHue) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDraggingSL, isDraggingHue, updateSL, updateHue])

  return (
    <div className="advanced-color-picker" onClick={(e) => e.stopPropagation()}>
      {/* Saturation-Lightness picker */}
      <div
        ref={slPickerRef}
        className="sl-picker"
        style={{
          background: `linear-gradient(to bottom, white, transparent, black),
                       linear-gradient(to right, #808080, hsl(${hue}, 100%, 50%))`
        }}
        onMouseDown={handleSLMouseDown}
      >
        <div
          className="sl-cursor"
          style={{
            left: `${saturation}%`,
            top: `${100 - lightness}%`
          }}
        />
      </div>

      {/* Hue slider */}
      <div
        ref={hueSliderRef}
        className="hue-slider"
        onMouseDown={handleHueMouseDown}
      >
        <div
          className="hue-cursor"
          style={{ left: `${(hue / 360) * 100}%` }}
        />
      </div>

      {/* Preview and buttons */}
      <div className="color-picker-footer">
        <div className="color-preview-row">
          <div
            className="color-preview-swatch"
            style={{ backgroundColor: currentColor }}
          />
          <span className="color-preview-hex">{currentColor.toUpperCase()}</span>
        </div>
        <div className="color-picker-buttons">
          <button type="button" className="color-picker-cancel" onClick={onCancel}>
            취소
          </button>
          <button
            type="button"
            className="color-picker-apply"
            onClick={() => onApply(currentColor)}
          >
            적용
          </button>
        </div>
      </div>
    </div>
  )
}

export default function TipTapEditor({ content, onChange, placeholder }: TipTapEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const linkInputRef = useRef<HTMLInputElement>(null)
  const youtubeInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [isLoadingBookmark, setIsLoadingBookmark] = useState(false)
  const [showYoutubeModal, setShowYoutubeModal] = useState(false)
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [showHighlightPicker, setShowHighlightPicker] = useState(false)
  const [showTextColorPicker, setShowTextColorPicker] = useState(false)
  const [showTableMenu, setShowTableMenu] = useState(false)
  const [showAdvancedHighlightPicker, setShowAdvancedHighlightPicker] = useState(false)
  const [showAdvancedTextColorPicker, setShowAdvancedTextColorPicker] = useState(false)
  const [recentHighlightColors, setRecentHighlightColors] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('recentHighlightColors')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [recentTextColors, setRecentTextColors] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('recentTextColors')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const highlightPickerRef = useRef<HTMLDivElement>(null)
  const textColorPickerRef = useRef<HTMLDivElement>(null)
  const tableMenuRef = useRef<HTMLDivElement>(null)
  const { alert } = useModal()
  const { showToast } = useToast()
  const [showTableBlockAlert, setShowTableBlockAlert] = useState(false)

  // Table drag handle state
  const [activeTableElement, setActiveTableElement] = useState<HTMLElement | null>(null)
  const [showRowHandle, setShowRowHandle] = useState(false)
  const [showColHandle, setShowColHandle] = useState(false)
  const [isDraggingRow, setIsDraggingRow] = useState(false)
  const [isDraggingCol, setIsDraggingCol] = useState(false)
  const [dragStartY, setDragStartY] = useState(0)
  const [dragStartX, setDragStartX] = useState(0)
  const [rowDelta, setRowDelta] = useState(0)
  const [colDelta, setColDelta] = useState(0)
  const appliedRowDeltaRef = useRef(0)
  const appliedColDeltaRef = useRef(0)
  const editorContainerRef = useRef<HTMLDivElement>(null)

  // Table row/column control state
  const [hoveredRow, setHoveredRow] = useState<{ table: HTMLElement; row: HTMLElement; index: number } | null>(null)
  const [hoveredCol, setHoveredCol] = useState<{ table: HTMLElement; colIndex: number; rect: DOMRect } | null>(null)
  const [showRowControlMenu, setShowRowControlMenu] = useState(false)
  const [showColControlMenu, setShowColControlMenu] = useState(false)
  const [rowColorPickerOpen, setRowColorPickerOpen] = useState(false)
  const [colColorPickerOpen, setColColorPickerOpen] = useState(false)
  const rowControlRef = useRef<HTMLDivElement>(null)
  const colControlRef = useRef<HTMLDivElement>(null)
  const cellControlRef = useRef<HTMLDivElement>(null)

  // Cell color control state
  const [hoveredCell, setHoveredCell] = useState<{ table: HTMLElement; cell: HTMLElement; row: HTMLElement; rowIndex: number; colIndex: number } | null>(null)
  const [showCellControlMenu, setShowCellControlMenu] = useState(false)

  // Row/Column colors
  const tableRowColors = [
    { name: '없음', color: null },
    { name: '노랑', color: '#fef9c3' },
    { name: '초록', color: '#dcfce7' },
    { name: '파랑', color: '#dbeafe' },
    { name: '분홍', color: '#fce7f3' },
    { name: '보라', color: '#ede9fe' },
    { name: '주황', color: '#ffedd5' },
    { name: '빨강', color: '#fee2e2' },
    { name: '회색', color: '#f1f5f9' },
  ]

  // Add to recent colors
  const addRecentHighlightColor = (color: string) => {
    setRecentHighlightColors(prev => {
      const filtered = prev.filter(c => c !== color)
      const updated = [color, ...filtered].slice(0, 5)
      localStorage.setItem('recentHighlightColors', JSON.stringify(updated))
      return updated
    })
  }

  const addRecentTextColor = (color: string) => {
    setRecentTextColors(prev => {
      const filtered = prev.filter(c => c !== color)
      const updated = [color, ...filtered].slice(0, 5)
      localStorage.setItem('recentTextColors', JSON.stringify(updated))
      return updated
    })
  }

  // Color palette for highlight and text colors
  const highlightColors = [
    { name: '노랑', color: '#fef08a' },
    { name: '초록', color: '#bbf7d0' },
    { name: '파랑', color: '#bfdbfe' },
    { name: '분홍', color: '#fbcfe8' },
    { name: '보라', color: '#ddd6fe' },
    { name: '주황', color: '#fed7aa' },
    { name: '빨강', color: '#fecaca' },
    { name: '청록', color: '#a5f3fc' },
  ]

  const textColors = [
    { name: '기본', color: null },
    { name: '빨강', color: '#dc2626' },
    { name: '주황', color: '#ea580c' },
    { name: '노랑', color: '#ca8a04' },
    { name: '초록', color: '#16a34a' },
    { name: '파랑', color: '#2563eb' },
    { name: '보라', color: '#7c3aed' },
    { name: '분홍', color: '#db2777' },
    { name: '회색', color: '#64748b' },
  ]

  // Close color pickers and table menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Use setTimeout to allow click events to complete first
      setTimeout(() => {
        if (highlightPickerRef.current && !highlightPickerRef.current.contains(e.target as globalThis.Node)) {
          setShowHighlightPicker(false)
          setShowAdvancedHighlightPicker(false)
        }
        if (textColorPickerRef.current && !textColorPickerRef.current.contains(e.target as globalThis.Node)) {
          setShowTextColorPicker(false)
          setShowAdvancedTextColorPicker(false)
        }
        if (tableMenuRef.current && !tableMenuRef.current.contains(e.target as globalThis.Node)) {
          setShowTableMenu(false)
        }
      }, 0)
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  // Close modals on ESC key
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showLinkModal) {
          setShowLinkModal(false)
          setLinkUrl('')
        }
        if (showYoutubeModal) {
          setShowYoutubeModal(false)
          setYoutubeUrl('')
        }
        if (showTableBlockAlert) {
          setShowTableBlockAlert(false)
        }
        // Close table control menus
        if (showRowControlMenu) {
          setShowRowControlMenu(false)
          setRowColorPickerOpen(false)
        }
        if (showColControlMenu) {
          setShowColControlMenu(false)
          setColColorPickerOpen(false)
        }
        if (showCellControlMenu) {
          setShowCellControlMenu(false)
        }
      }
    }
    document.addEventListener('keydown', handleEscKey)
    return () => document.removeEventListener('keydown', handleEscKey)
  }, [showLinkModal, showYoutubeModal, showTableBlockAlert, showRowControlMenu, showColControlMenu, showCellControlMenu])

  // Force re-render on selection change for toolbar highlight
  const [, setForceUpdate] = useState(0)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary hover:underline',
        },
      }),
      ResizableImage.configure({
        HTMLAttributes: {
          class: 'max-w-full rounded-lg',
        },
      }),
      Placeholder.configure({
        placeholder: placeholder || '내용을 작성하세요...',
      }),
      CustomCodeBlock.configure({
        lowlight,
      }),
      Youtube.configure({
        controls: true,
        nocookie: true,
        HTMLAttributes: {
          class: 'youtube-video',
        },
      }),
      SlashCommandsExtension,
      MarkdownShortcuts,
      Bookmark,
      Callout,
      PullQuote,
      Table.configure({
        resizable: true,
        allowTableNodeSelection: true,
        HTMLAttributes: {
          class: 'editor-table',
        },
      }),
      TableRow,
      TableHeader.extend({
        // 테이블 헤더 셀에서 heading 사용 불가 - paragraph만 허용
        content: 'paragraph+',
        addAttributes() {
          return {
            ...this.parent?.(),
            backgroundColor: {
              default: null,
              parseHTML: element => element.style.backgroundColor || null,
              renderHTML: attributes => {
                if (!attributes.backgroundColor) {
                  return {}
                }
                return { style: `background-color: ${attributes.backgroundColor}` }
              },
            },
          }
        },
      }),
      TableCell.extend({
        // 테이블 셀에서 heading 사용 불가 - paragraph만 허용
        content: 'paragraph+',
        addAttributes() {
          return {
            ...this.parent?.(),
            backgroundColor: {
              default: null,
              parseHTML: element => element.style.backgroundColor || null,
              renderHTML: attributes => {
                if (!attributes.backgroundColor) {
                  return {}
                }
                return { style: `background-color: ${attributes.backgroundColor}` }
              },
            },
          }
        },
        addKeyboardShortcuts() {
          return {
            'Mod-a': () => {
              const { state } = this.editor
              const { $from } = state.selection

              // Check if we're in a table cell
              for (let depth = $from.depth; depth > 0; depth--) {
                const node = $from.node(depth)
                if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
                  // Select all content within the cell
                  const cellStart = $from.start(depth)
                  const cellEnd = $from.end(depth)
                  this.editor.commands.setTextSelection({ from: cellStart, to: cellEnd })
                  return true
                }
              }
              return false
            },
          }
        },
      }),
      TextAlign.extend({
        addKeyboardShortcuts() {
          return {
            'Mod-Shift-l': () => this.editor.commands.setTextAlign('left'),
            'Mod-Shift-e': () => this.editor.commands.setTextAlign('center'),
            'Mod-Shift-r': () => this.editor.commands.setTextAlign('right'),
          }
        },
      }).configure({
        types: ['heading', 'paragraph'],
      }),
      Highlight.extend({
        addKeyboardShortcuts() {
          return {
            'Mod-Shift-h': () => this.editor.commands.toggleHighlight(),
          }
        },
      }).configure({
        multicolor: true,
      }),
      TextStyle,
      Color,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    onSelectionUpdate: () => {
      // Trigger re-render to update toolbar button highlights
      setForceUpdate((prev) => prev + 1)
    },
    onTransaction: () => {
      // Also trigger on any transaction (e.g., Ctrl+B formatting)
      setForceUpdate((prev) => prev + 1)
    },
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert max-w-none p-6 min-h-[500px] focus:outline-none',
      },
    },
  })

  // Check if cursor is inside a table cell
  const isInsideTableCell = useCallback(() => {
    if (!editor) return false
    const { $from } = editor.state.selection
    for (let depth = $from.depth; depth > 0; depth--) {
      const node = $from.node(depth)
      if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
        return true
      }
    }
    return false
  }, [editor])

  // Handle heading click with table check
  const handleHeadingClick = useCallback((level: 1 | 2 | 3) => {
    if (isInsideTableCell()) {
      setShowTableBlockAlert(true)
      return
    }
    editor?.chain().focus().toggleHeading({ level }).run()
  }, [editor, isInsideTableCell])

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  // Table drag handle and row/column control - detect mouse near table edges
  useEffect(() => {
    if (!editor || !editorContainerRef.current) return

    const ROW_CONTROL_THRESHOLD = 30 // pixels from left edge to show row control
    const COL_CONTROL_THRESHOLD = 30 // pixels from top edge to show column control
    const ROW_HEIGHT = 36 // height of one row in pixels
    const HANDLE_AREA = 40 // pixels below/right of table to show handle

    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingRow || isDraggingCol) return
      // Don't update hover state if menu is open
      if (showRowControlMenu || showColControlMenu || showCellControlMenu) return

      const tables = editorContainerRef.current?.querySelectorAll('.ProseMirror table')
      if (!tables || tables.length === 0) return

      let foundTable: HTMLElement | null = null
      let showRow = false
      let showCol = false
      let foundHoveredRow: { table: HTMLElement; row: HTMLElement; index: number } | null = null
      let foundHoveredCol: { table: HTMLElement; colIndex: number; rect: DOMRect } | null = null
      let foundHoveredCell: { table: HTMLElement; cell: HTMLElement; row: HTMLElement; rowIndex: number; colIndex: number } | null = null

      tables.forEach((table) => {
        const tableEl = table as HTMLElement
        const rect = tableEl.getBoundingClientRect()

        // Edge handles for adding rows/columns - show when mouse is below/right of table
        const isNearRight = e.clientX >= rect.right - 10 && e.clientX <= rect.right + HANDLE_AREA
        const isNearBottom = e.clientY >= rect.bottom - 10 && e.clientY <= rect.bottom + HANDLE_AREA
        const isWithinTableY = e.clientY >= rect.top && e.clientY <= rect.bottom + HANDLE_AREA
        const isWithinTableX = e.clientX >= rect.left && e.clientX <= rect.right + HANDLE_AREA

        if (isNearRight && isWithinTableY) {
          foundTable = tableEl
          showCol = true
        }
        if (isNearBottom && isWithinTableX) {
          foundTable = tableEl
          showRow = true
        }

        // Row control - detect hover near left edge of rows
        const isNearLeftEdge = e.clientX >= rect.left - ROW_CONTROL_THRESHOLD && e.clientX <= rect.left + 10
        if (isNearLeftEdge && isWithinTableY) {
          const rows = tableEl.querySelectorAll('tr')
          rows.forEach((row, index) => {
            const rowRect = (row as HTMLElement).getBoundingClientRect()
            if (e.clientY >= rowRect.top && e.clientY <= rowRect.bottom) {
              foundHoveredRow = { table: tableEl, row: row as HTMLElement, index }
            }
          })
        }

        // Column control - detect hover near top edge of columns
        const isNearTopEdge = e.clientY >= rect.top - COL_CONTROL_THRESHOLD && e.clientY <= rect.top + 10
        if (isNearTopEdge && isWithinTableX) {
          const firstRow = tableEl.querySelector('tr')
          if (firstRow) {
            const cells = firstRow.querySelectorAll('td, th')
            cells.forEach((cell, index) => {
              const cellRect = (cell as HTMLElement).getBoundingClientRect()
              if (e.clientX >= cellRect.left && e.clientX <= cellRect.right) {
                foundHoveredCol = { table: tableEl, colIndex: index, rect: cellRect }
              }
            })
          }
        }

        // Cell control - detect hover near right edge of cells
        const CELL_CONTROL_THRESHOLD = 12
        const rows = tableEl.querySelectorAll('tr')
        rows.forEach((row, rowIndex) => {
          const cells = (row as HTMLElement).querySelectorAll('td, th')
          cells.forEach((cell, colIndex) => {
            const cellRect = (cell as HTMLElement).getBoundingClientRect()
            const isNearCellRightEdge = e.clientX >= cellRect.right - CELL_CONTROL_THRESHOLD && e.clientX <= cellRect.right + 4
            const isWithinCellY = e.clientY >= cellRect.top + 4 && e.clientY <= cellRect.bottom - 4
            if (isNearCellRightEdge && isWithinCellY) {
              foundHoveredCell = {
                table: tableEl,
                cell: cell as HTMLElement,
                row: row as HTMLElement,
                rowIndex,
                colIndex
              }
            }
          })
        })
      })

      setActiveTableElement(foundTable)
      setShowRowHandle(showRow)
      setShowColHandle(showCol)
      setHoveredRow(foundHoveredRow)
      setHoveredCol(foundHoveredCol)
      setHoveredCell(foundHoveredCell)
    }

    const handleMouseMoveDrag = (e: MouseEvent) => {
      if (isDraggingRow && activeTableElement && editor) {
        const deltaY = e.clientY - dragStartY
        const newDelta = Math.round(deltaY / ROW_HEIGHT)
        setRowDelta(newDelta)

        // Apply changes in real-time
        const diff = newDelta - appliedRowDeltaRef.current
        if (diff > 0) {
          // Add rows at the bottom
          for (let i = 0; i < diff; i++) {
            // Focus on last row before adding
            const rows = activeTableElement.querySelectorAll('tr')
            const lastRow = rows[rows.length - 1]
            const lastCellP = lastRow?.querySelector('td:last-child p, th:last-child p')
            if (lastCellP) {
              try {
                const pos = editor.view.posAtDOM(lastCellP, 0)
                editor.chain().setTextSelection(pos).addRowAfter().run()
              } catch {}
            }
          }
          appliedRowDeltaRef.current = newDelta
        } else if (diff < 0) {
          // Remove rows from bottom (only if empty)
          for (let i = 0; i < Math.abs(diff); i++) {
            const rows = activeTableElement.querySelectorAll('tr')
            if (rows.length > 1) { // Keep at least one row
              const lastRow = rows[rows.length - 1]
              if (lastRow) {
                const cells = lastRow.querySelectorAll('td, th')
                const hasContent = Array.from(cells).some(cell => {
                  const text = (cell as HTMLElement).innerText.trim()
                  return text.length > 0
                })
                if (!hasContent) {
                  // Focus on last row and delete
                  const lastCellP = lastRow.querySelector('td:first-child p, th:first-child p')
                  if (lastCellP) {
                    try {
                      const pos = editor.view.posAtDOM(lastCellP, 0)
                      editor.chain().setTextSelection(pos).deleteRow().run()
                      appliedRowDeltaRef.current--
                    } catch {}
                  }
                } else {
                  break // Stop if row has content
                }
              }
            }
          }
        }
      }
      if (isDraggingCol && activeTableElement && editor) {
        const deltaX = e.clientX - dragStartX
        const newDelta = Math.round(deltaX / 80)
        setColDelta(newDelta)

        // Apply changes in real-time
        const diff = newDelta - appliedColDeltaRef.current
        if (diff > 0) {
          // Add columns at the right
          for (let i = 0; i < diff; i++) {
            // Focus on last column of first row before adding
            const firstRow = activeTableElement.querySelector('tr')
            const cells = firstRow?.querySelectorAll('td, th')
            const lastCell = cells?.[cells.length - 1]
            const lastCellP = lastCell?.querySelector('p')
            if (lastCellP) {
              try {
                const pos = editor.view.posAtDOM(lastCellP, 0)
                editor.chain().setTextSelection(pos).addColumnAfter().run()
              } catch {}
            }
          }
          appliedColDeltaRef.current = newDelta
        } else if (diff < 0) {
          // Remove columns from right (only if empty)
          for (let i = 0; i < Math.abs(diff); i++) {
            const firstRow = activeTableElement.querySelector('tr')
            const cells = firstRow?.querySelectorAll('td, th')
            if (cells && cells.length > 1) { // Keep at least one column
              const lastColIndex = cells.length - 1
              const rows = activeTableElement.querySelectorAll('tr')
              let hasContent = false
              rows.forEach(row => {
                const rowCells = row.querySelectorAll('td, th')
                const lastCell = rowCells[lastColIndex]
                if (lastCell) {
                  const text = (lastCell as HTMLElement).innerText.trim()
                  if (text.length > 0) hasContent = true
                }
              })
              if (!hasContent) {
                // Focus on last column and delete
                const lastCellP = cells[lastColIndex]?.querySelector('p')
                if (lastCellP) {
                  try {
                    const pos = editor.view.posAtDOM(lastCellP, 0)
                    editor.chain().setTextSelection(pos).deleteColumn().run()
                    appliedColDeltaRef.current--
                  } catch {}
                }
              } else {
                break // Stop if column has content
              }
            }
          }
        }
      }
    }

    const handleMouseUp = () => {
      if (isDraggingRow) {
        setIsDraggingRow(false)
        setRowDelta(0)
        appliedRowDeltaRef.current = 0
      }
      if (isDraggingCol) {
        setIsDraggingCol(false)
        setColDelta(0)
        appliedColDeltaRef.current = 0
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mousemove', handleMouseMoveDrag)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mousemove', handleMouseMoveDrag)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [editor, isDraggingRow, isDraggingCol, dragStartY, dragStartX, rowDelta, colDelta, activeTableElement, showRowControlMenu, showColControlMenu, showCellControlMenu])

  // Close row/column/cell control menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (rowControlRef.current && !rowControlRef.current.contains(e.target as globalThis.Node)) {
        setShowRowControlMenu(false)
        setRowColorPickerOpen(false)
      }
      if (colControlRef.current && !colControlRef.current.contains(e.target as globalThis.Node)) {
        setShowColControlMenu(false)
        setColColorPickerOpen(false)
      }
      if (cellControlRef.current && !cellControlRef.current.contains(e.target as globalThis.Node)) {
        setShowCellControlMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Table row operations
  const focusOnTableCell = useCallback((table: HTMLElement, rowIndex: number, colIndex: number) => {
    if (!editor) return
    const rows = table.querySelectorAll('tr')
    const targetRow = rows[rowIndex]
    if (targetRow) {
      const cells = targetRow.querySelectorAll('td, th')
      const targetCell = cells[colIndex] || cells[0]
      if (targetCell) {
        // Find the ProseMirror position for this cell
        const cellP = targetCell.querySelector('p')
        if (cellP) {
          const pos = editor.view.posAtDOM(cellP, 0)
          editor.chain().focus().setTextSelection(pos).run()
        }
      }
    }
  }, [editor])

  const handleInsertRowAbove = useCallback(() => {
    if (!editor || !hoveredRow) return
    const { table, index } = hoveredRow

    // Focus on a cell in the target row first
    focusOnTableCell(table, index, 0)

    // Check if this is the first row and has header
    const firstRow = table.querySelector('tr')
    const isFirstRowHeader = firstRow?.querySelector('th') !== null
    const isInsertingAboveFirstRow = index === 0

    if (isFirstRowHeader && isInsertingAboveFirstRow) {
      // When inserting above the header row:
      // 1. Turn OFF header row (old first row becomes regular)
      // 2. Insert new row
      // 3. Turn ON header row (new first row becomes header)
      editor.chain().focus().toggleHeaderRow().run() // Turn OFF
      editor.chain().focus().addRowBefore().run()    // Insert new row
      editor.chain().focus().toggleHeaderRow().run() // Turn ON for new first row
    } else {
      editor.chain().focus().addRowBefore().run()
    }

    setShowRowControlMenu(false)
    setHoveredRow(null)
  }, [editor, hoveredRow, focusOnTableCell])

  const handleInsertRowBelow = useCallback(() => {
    if (!editor || !hoveredRow) return
    const { table, index } = hoveredRow

    focusOnTableCell(table, index, 0)
    editor.chain().focus().addRowAfter().run()

    setShowRowControlMenu(false)
    setHoveredRow(null)
  }, [editor, hoveredRow, focusOnTableCell])

  const handleDeleteRow = useCallback(() => {
    if (!editor || !hoveredRow) return
    const { table, index } = hoveredRow

    // Check if we have more than one row
    const rowCount = table.querySelectorAll('tr').length
    if (rowCount <= 1) return

    focusOnTableCell(table, index, 0)
    editor.chain().focus().deleteRow().run()

    setShowRowControlMenu(false)
    setHoveredRow(null)
  }, [editor, hoveredRow, focusOnTableCell])

  const handleSetRowColor = useCallback((color: string | null) => {
    if (!editor || !hoveredRow) return
    const { row } = hoveredRow
    const cells = row.querySelectorAll('td, th')

    // Apply color to each cell in the row using TipTap commands
    cells.forEach((cell) => {
      const cellP = cell.querySelector('p')
      if (cellP) {
        try {
          const pos = editor.view.posAtDOM(cellP, 0)
          editor.chain().setTextSelection(pos).setCellAttribute('backgroundColor', color).run()
        } catch (e) {
          // Fallback to DOM manipulation if TipTap command fails
          (cell as HTMLElement).style.backgroundColor = color || ''
        }
      }
    })

    // Refocus on the first cell
    const firstCellP = cells[0]?.querySelector('p')
    if (firstCellP) {
      try {
        const pos = editor.view.posAtDOM(firstCellP, 0)
        editor.chain().focus().setTextSelection(pos).run()
      } catch {}
    }

    setRowColorPickerOpen(false)
    setShowRowControlMenu(false)
    setHoveredRow(null)
  }, [editor, hoveredRow])

  // Table column operations
  const handleInsertColLeft = useCallback(() => {
    if (!editor || !hoveredCol) return
    const { table, colIndex } = hoveredCol

    focusOnTableCell(table, 0, colIndex)
    editor.chain().focus().addColumnBefore().run()

    setShowColControlMenu(false)
    setHoveredCol(null)
  }, [editor, hoveredCol, focusOnTableCell])

  const handleInsertColRight = useCallback(() => {
    if (!editor || !hoveredCol) return
    const { table, colIndex } = hoveredCol

    focusOnTableCell(table, 0, colIndex)
    editor.chain().focus().addColumnAfter().run()

    setShowColControlMenu(false)
    setHoveredCol(null)
  }, [editor, hoveredCol, focusOnTableCell])

  const handleDeleteCol = useCallback(() => {
    if (!editor || !hoveredCol) return
    const { table, colIndex } = hoveredCol

    // Check if we have more than one column
    const firstRow = table.querySelector('tr')
    const colCount = firstRow ? firstRow.querySelectorAll('td, th').length : 0
    if (colCount <= 1) return

    focusOnTableCell(table, 0, colIndex)
    editor.chain().focus().deleteColumn().run()

    setShowColControlMenu(false)
    setHoveredCol(null)
  }, [editor, hoveredCol, focusOnTableCell])

  const handleSetColColor = useCallback((color: string | null) => {
    if (!editor || !hoveredCol) return
    const { table, colIndex } = hoveredCol
    const rows = table.querySelectorAll('tr')

    // Apply color to each cell in the column using TipTap commands
    rows.forEach(row => {
      const cells = row.querySelectorAll('td, th')
      const cell = cells[colIndex]
      if (cell) {
        const cellP = cell.querySelector('p')
        if (cellP) {
          try {
            const pos = editor.view.posAtDOM(cellP, 0)
            editor.chain().setTextSelection(pos).setCellAttribute('backgroundColor', color).run()
          } catch (e) {
            // Fallback to DOM manipulation if TipTap command fails
            (cell as HTMLElement).style.backgroundColor = color || ''
          }
        }
      }
    })

    // Refocus on a cell in the column
    const firstRow = rows[0]
    const firstCell = firstRow?.querySelectorAll('td, th')[colIndex]
    const firstCellP = firstCell?.querySelector('p')
    if (firstCellP) {
      try {
        const pos = editor.view.posAtDOM(firstCellP, 0)
        editor.chain().focus().setTextSelection(pos).run()
      } catch {}
    }

    setColColorPickerOpen(false)
    setShowColControlMenu(false)
    setHoveredCol(null)
  }, [editor, hoveredCol])

  // Cell operations
  const handleSetCellColor = useCallback((color: string | null) => {
    if (!editor || !hoveredCell) return
    const { cell } = hoveredCell

    // Apply color to the cell using TipTap commands
    const cellP = cell.querySelector('p')
    if (cellP) {
      try {
        const pos = editor.view.posAtDOM(cellP, 0)
        editor.chain().focus().setTextSelection(pos).setCellAttribute('backgroundColor', color).run()
      } catch (e) {
        // Fallback to DOM manipulation if TipTap command fails
        cell.style.backgroundColor = color || ''
      }
    }

    setShowCellControlMenu(false)
    setHoveredCell(null)
  }, [editor, hoveredCell])

  const handleImageUpload = useCallback(async (file: File) => {
    if (!editor) return

    setIsUploading(true)
    try {
      const result = await api.uploadImage(file)
      editor.chain().focus().setImage({ src: result.url }).run()

      // Show optimization toast
      const originalKB = (result.originalSize / 1024).toFixed(1)
      const optimizedKB = (result.size / 1024).toFixed(1)
      const savedPercent = (((result.originalSize - result.size) / result.originalSize) * 100).toFixed(1)

      showToast({
        type: 'success',
        title: '이미지 최적화 완료',
        message: `${originalKB}KB → ${optimizedKB}KB (${savedPercent}% 절감)\n${result.width} × ${result.height}px`,
      })
    } catch (error) {
      console.error('Image upload failed:', error)
      await alert({ message: error instanceof Error ? error.message : '이미지 업로드에 실패했습니다.', type: 'error' })
    } finally {
      setIsUploading(false)
    }
  }, [editor, alert, showToast])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleImageUpload(file)
    }
    // Reset input so same file can be selected again
    e.target.value = ''
  }, [handleImageUpload])

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const openLinkModal = useCallback(() => {
    if (!editor) return
    const previousUrl = editor.getAttributes('link').href || ''
    setLinkUrl(previousUrl)
    setShowLinkModal(true)
    setTimeout(() => linkInputRef.current?.focus(), 100)
  }, [editor])

  const closeLinkModal = useCallback(() => {
    setShowLinkModal(false)
    setLinkUrl('')
    editor?.chain().focus().run()
  }, [editor])

  const applyLink = useCallback(() => {
    if (!editor) return

    if (linkUrl === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run()
    }
    closeLinkModal()
  }, [editor, linkUrl, closeLinkModal])

  const removeLink = useCallback(() => {
    if (!editor) return
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    closeLinkModal()
  }, [editor, closeLinkModal])

  // Insert link as bookmark card
  const insertBookmark = useCallback(async () => {
    if (!editor || !linkUrl) return

    setIsLoadingBookmark(true)
    try {
      const metadata = await api.fetchUrlMetadata(linkUrl)
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'bookmark',
          attrs: {
            url: metadata.url,
            title: metadata.title,
            description: metadata.description,
            image: metadata.image,
            favicon: metadata.favicon,
            siteName: metadata.siteName,
          },
        })
        .run()
      closeLinkModal()
    } catch (error) {
      console.error('Failed to fetch bookmark metadata:', error)
      await alert({ message: '북마크 정보를 가져오는데 실패했습니다.', type: 'error' })
    } finally {
      setIsLoadingBookmark(false)
    }
  }, [editor, linkUrl, closeLinkModal, alert])

  // YouTube modal handlers
  const openYoutubeModal = useCallback(() => {
    setYoutubeUrl('')
    setShowYoutubeModal(true)
    setTimeout(() => youtubeInputRef.current?.focus(), 100)
  }, [])

  const closeYoutubeModal = useCallback(() => {
    setShowYoutubeModal(false)
    setYoutubeUrl('')
    editor?.chain().focus().run()
  }, [editor])

  const insertYoutube = useCallback(() => {
    if (!editor || !youtubeUrl) return

    editor.commands.setYoutubeVideo({
      src: youtubeUrl,
      width: 640,
      height: 360,
    })
    closeYoutubeModal()
  }, [editor, youtubeUrl, closeYoutubeModal])

  if (!editor) {
    return null
  }

  return (
    <div className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col max-h-[70vh]">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex-shrink-0 flex-wrap">
        {/* Headings */}
        <div className="flex items-center gap-1">
          <ToolbarButton
            onClick={() => handleHeadingClick(1)}
            isActive={editor.isActive('heading', { level: 1 })}
            title="Heading 1"
          >
            <span className="font-bold text-lg leading-none">H1</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => handleHeadingClick(2)}
            isActive={editor.isActive('heading', { level: 2 })}
            title="Heading 2"
          >
            <span className="font-bold text-base leading-none">H2</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => handleHeadingClick(3)}
            isActive={editor.isActive('heading', { level: 3 })}
            title="Heading 3"
          >
            <span className="font-bold text-sm leading-none">H3</span>
          </ToolbarButton>
        </div>

        <ToolbarDivider />

        {/* Text formatting */}
        <div className="flex items-center gap-1">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive('bold')}
            title="Bold"
          >
            <span className="material-symbols-outlined text-[20px]">format_bold</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive('italic')}
            title="Italic"
          >
            <span className="material-symbols-outlined text-[20px]">format_italic</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            isActive={editor.isActive('strike')}
            title="Strikethrough"
          >
            <span className="material-symbols-outlined text-[20px]">format_strikethrough</span>
          </ToolbarButton>
          {/* Text Color Picker */}
          <div className="relative" ref={textColorPickerRef}>
            <ToolbarButton
              onClick={() => setShowTextColorPicker(!showTextColorPicker)}
              stopPropagation
              isActive={editor.isActive('textStyle')}
              title="텍스트 색상"
            >
              <span className="material-symbols-outlined text-[20px]">format_color_text</span>
            </ToolbarButton>
            {showTextColorPicker && (
              <div className="color-picker-dropdown" onClick={(e) => e.stopPropagation()}>
                {recentTextColors.length > 0 && (
                  <>
                    <div className="color-picker-section-title">최근 사용</div>
                    <div className="color-picker-grid">
                      {recentTextColors.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className="color-picker-item"
                          style={{ backgroundColor: color }}
                          onClick={() => {
                            editor.chain().focus().setColor(color).run()
                            setShowTextColorPicker(false)
                          }}
                          title={color}
                        />
                      ))}
                    </div>
                    <div className="color-picker-section-title">기본 색상</div>
                  </>
                )}
                <div className="color-picker-grid">
                  {textColors.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      className={`color-picker-item ${!c.color ? 'color-reset' : ''}`}
                      style={c.color ? { backgroundColor: c.color } : undefined}
                      onClick={() => {
                        if (c.color) {
                          editor.chain().focus().setColor(c.color).run()
                          addRecentTextColor(c.color)
                        } else {
                          editor.chain().focus().unsetColor().run()
                        }
                        setShowTextColorPicker(false)
                      }}
                      title={c.name}
                    >
                      {!c.color && <span className="material-symbols-outlined text-[14px]">format_color_reset</span>}
                    </button>
                  ))}
                </div>
                {!showAdvancedTextColorPicker ? (
                  <div className="color-picker-custom">
                    <button
                      type="button"
                      className="color-picker-custom-label"
                      onClick={() => setShowAdvancedTextColorPicker(true)}
                    >
                      <span className="material-symbols-outlined text-[16px]">colorize</span>
                      <span>직접 선택</span>
                    </button>
                  </div>
                ) : (
                  <AdvancedColorPicker
                    initialColor="#dc2626"
                    onApply={(color) => {
                      editor.chain().focus().setColor(color).run()
                      addRecentTextColor(color)
                      setShowTextColorPicker(false)
                      setShowAdvancedTextColorPicker(false)
                    }}
                    onCancel={() => setShowAdvancedTextColorPicker(false)}
                  />
                )}
              </div>
            )}
          </div>
          {/* Highlight Color Picker */}
          <div className="relative" ref={highlightPickerRef}>
            <ToolbarButton
              onClick={() => setShowHighlightPicker(!showHighlightPicker)}
              stopPropagation
              isActive={editor.isActive('highlight')}
              title="형광펜 (Ctrl+Shift+H)"
            >
              <span className="material-symbols-outlined text-[20px]">ink_highlighter</span>
            </ToolbarButton>
            {showHighlightPicker && (
              <div className="color-picker-dropdown" onClick={(e) => e.stopPropagation()}>
                {recentHighlightColors.length > 0 && (
                  <>
                    <div className="color-picker-section-title">최근 사용</div>
                    <div className="color-picker-grid">
                      {recentHighlightColors.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className="color-picker-item"
                          style={{ backgroundColor: color }}
                          onClick={() => {
                            editor.chain().focus().toggleHighlight({ color }).run()
                            setShowHighlightPicker(false)
                          }}
                          title={color}
                        />
                      ))}
                    </div>
                    <div className="color-picker-section-title">기본 색상</div>
                  </>
                )}
                <div className="color-picker-grid">
                  {highlightColors.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      className="color-picker-item"
                      style={{ backgroundColor: c.color }}
                      onClick={() => {
                        editor.chain().focus().toggleHighlight({ color: c.color }).run()
                        addRecentHighlightColor(c.color)
                        setShowHighlightPicker(false)
                      }}
                      title={c.name}
                    />
                  ))}
                  <button
                    type="button"
                    className="color-picker-item color-reset"
                    onClick={() => {
                      editor.chain().focus().unsetHighlight().run()
                      setShowHighlightPicker(false)
                    }}
                    title="제거"
                  >
                    <span className="material-symbols-outlined text-[14px]">format_color_reset</span>
                  </button>
                </div>
                {!showAdvancedHighlightPicker ? (
                  <div className="color-picker-custom">
                    <button
                      type="button"
                      className="color-picker-custom-label"
                      onClick={() => setShowAdvancedHighlightPicker(true)}
                    >
                      <span className="material-symbols-outlined text-[16px]">colorize</span>
                      <span>직접 선택</span>
                    </button>
                  </div>
                ) : (
                  <AdvancedColorPicker
                    initialColor="#fef08a"
                    onApply={(color) => {
                      editor.chain().focus().toggleHighlight({ color }).run()
                      addRecentHighlightColor(color)
                      setShowHighlightPicker(false)
                      setShowAdvancedHighlightPicker(false)
                    }}
                    onCancel={() => setShowAdvancedHighlightPicker(false)}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        <ToolbarDivider />

        {/* Text alignment */}
        <div className="flex items-center gap-1">
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            isActive={editor.isActive({ textAlign: 'left' })}
            title="Align Left"
          >
            <span className="material-symbols-outlined text-[20px]">format_align_left</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            isActive={editor.isActive({ textAlign: 'center' })}
            title="Align Center"
          >
            <span className="material-symbols-outlined text-[20px]">format_align_center</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            isActive={editor.isActive({ textAlign: 'right' })}
            title="Align Right"
          >
            <span className="material-symbols-outlined text-[20px]">format_align_right</span>
          </ToolbarButton>
        </div>

        <ToolbarDivider />

        {/* Block elements */}
        <div className="flex items-center gap-1">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            isActive={editor.isActive('blockquote')}
            title="Quote"
          >
            <span className="material-symbols-outlined text-[20px]">format_quote</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().insertContent({
              type: 'callout',
              attrs: { type: 'info', icon: '💡' },
              content: [{ type: 'paragraph' }],
            }).run()}
            isActive={editor.isActive('callout')}
            title="Callout (/callout)"
          >
            <span className="material-symbols-outlined text-[20px]">lightbulb</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().insertContent({
              type: 'pullQuote',
              content: [{ type: 'paragraph' }],
            }).run()}
            isActive={editor.isActive('pullQuote')}
            title="Pull Quote (/pullquote)"
          >
            <span className="material-symbols-outlined text-[20px]">format_ink_highlighter</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            isActive={editor.isActive('codeBlock')}
            title="Code Block"
          >
            <span className="material-symbols-outlined text-[20px]">code_blocks</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={openLinkModal}
            isActive={editor.isActive('link')}
            title="Link"
          >
            <span className="material-symbols-outlined text-[20px]">link</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={openFilePicker}
            disabled={isUploading}
            title="Image"
          >
            {isUploading ? (
              <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-[20px]">image</span>
            )}
          </ToolbarButton>
          <ToolbarButton
            onClick={openYoutubeModal}
            title="YouTube"
          >
            <span className="material-symbols-outlined text-[20px]">smart_display</span>
          </ToolbarButton>
          <div className="relative" ref={tableMenuRef}>
            <ToolbarButton
              onClick={() => {
                if (editor.isActive('table')) {
                  setShowTableMenu(!showTableMenu)
                } else {
                  editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
                }
              }}
              isActive={editor.isActive('table')}
              title={editor.isActive('table') ? '표 편집' : '표 삽입'}
            >
              <span className="material-symbols-outlined text-[20px]">table</span>
              {editor.isActive('table') && (
                <span className="material-symbols-outlined text-[12px] ml-0.5">expand_more</span>
              )}
            </ToolbarButton>
            {showTableMenu && editor.isActive('table') && (
              <div className="table-menu-dropdown">
                <div className="table-menu-section">
                  <div className="table-menu-section-title">헤더 설정</div>
                  <button
                    type="button"
                    onClick={() => { editor.chain().focus().toggleHeaderRow().run(); setShowTableMenu(false) }}
                    className="table-menu-item"
                  >
                    <span className="material-symbols-outlined">table_rows</span>
                    헤더 행
                    {(() => {
                      const { $from } = editor.state.selection
                      for (let d = $from.depth; d > 0; d--) {
                        const node = $from.node(d)
                        if (node.type.name === 'table') {
                          const firstRow = node.firstChild
                          if (firstRow && firstRow.childCount > 1) {
                            // Check second cell (last cell) to distinguish from header column only
                            const lastCell = firstRow.child(firstRow.childCount - 1)
                            const hasHeaderRow = lastCell?.type.name === 'tableHeader'
                            return hasHeaderRow ? <span className="ml-auto text-blue-500">✓</span> : null
                          } else if (firstRow && firstRow.childCount === 1) {
                            // Single column table - check first cell
                            const hasHeaderRow = firstRow.firstChild?.type.name === 'tableHeader'
                            return hasHeaderRow ? <span className="ml-auto text-blue-500">✓</span> : null
                          }
                        }
                      }
                      return null
                    })()}
                  </button>
                  <button
                    type="button"
                    onClick={() => { editor.chain().focus().toggleHeaderColumn().run(); setShowTableMenu(false) }}
                    className="table-menu-item"
                  >
                    <span className="material-symbols-outlined">view_column</span>
                    헤더 열
                    {(() => {
                      const { $from } = editor.state.selection
                      for (let d = $from.depth; d > 0; d--) {
                        const node = $from.node(d)
                        if (node.type.name === 'table') {
                          // Check second row's first cell to distinguish from header row only
                          const secondRow = node.childCount > 1 ? node.child(1) : null
                          if (secondRow) {
                            const hasHeaderColumn = secondRow.firstChild?.type.name === 'tableHeader'
                            return hasHeaderColumn ? <span className="ml-auto text-blue-500">✓</span> : null
                          } else {
                            // Single row table - check first cell
                            const firstRow = node.firstChild
                            const hasHeaderColumn = firstRow?.firstChild?.type.name === 'tableHeader'
                            return hasHeaderColumn ? <span className="ml-auto text-blue-500">✓</span> : null
                          }
                        }
                      }
                      return null
                    })()}
                  </button>
                </div>
                <div className="table-menu-divider" />
                <button
                  type="button"
                  onClick={() => { editor.chain().focus().deleteTable().run(); setShowTableMenu(false) }}
                  className="table-menu-item table-menu-item-danger"
                >
                  <span className="material-symbols-outlined">delete_forever</span>
                  표 삭제
                </button>
              </div>
            )}
          </div>
        </div>

        <ToolbarDivider />

        {/* Lists */}
        <div className="flex items-center gap-1">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive('bulletList')}
            title="Bulleted List"
          >
            <span className="material-symbols-outlined text-[20px]">format_list_bulleted</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive('orderedList')}
            title="Numbered List"
          >
            <span className="material-symbols-outlined text-[20px]">format_list_numbered</span>
          </ToolbarButton>
        </div>

        <ToolbarDivider />

        {/* Undo/Redo */}
        <div className="flex items-center gap-1">
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Undo"
          >
            <span className="material-symbols-outlined text-[20px]">undo</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Redo"
          >
            <span className="material-symbols-outlined text-[20px]">redo</span>
          </ToolbarButton>
        </div>
      </div>

      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeLinkModal}
          />
          {/* Modal */}
          <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-xl p-6 w-full max-w-md mx-4 border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">link</span>
              링크 추가
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  URL
                </label>
                <input
                  ref={linkInputRef}
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      applyLink()
                    } else if (e.key === 'Escape') {
                      closeLinkModal()
                    }
                  }}
                  placeholder="https://example.com"
                  className="w-full bg-slate-100 dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-sm"
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {editor?.isActive('link') && (
                    <button
                      type="button"
                      onClick={removeLink}
                      className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      링크 제거
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closeLinkModal}
                    className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={insertBookmark}
                    disabled={!linkUrl || isLoadingBookmark}
                    className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                    title="북마크 카드로 삽입"
                  >
                    {isLoadingBookmark ? (
                      <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined text-[16px]">bookmark</span>
                    )}
                    북마크
                  </button>
                  <button
                    type="button"
                    onClick={applyLink}
                    disabled={!linkUrl}
                    className="px-4 py-2 text-sm font-bold text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    링크
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* YouTube Modal */}
      {showYoutubeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeYoutubeModal}
          />
          {/* Modal */}
          <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-xl p-6 w-full max-w-md mx-4 border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-red-500">smart_display</span>
              YouTube 영상 삽입
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  YouTube URL
                </label>
                <input
                  ref={youtubeInputRef}
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      insertYoutube()
                    } else if (e.key === 'Escape') {
                      closeYoutubeModal()
                    }
                  }}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full bg-slate-100 dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-sm"
                />
                <p className="mt-2 text-xs text-slate-500">
                  YouTube 영상 URL을 붙여넣으세요
                </p>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeYoutubeModal}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={insertYoutube}
                  disabled={!youtubeUrl}
                  className="px-4 py-2 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  삽입
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table Block Alert Modal */}
      {showTableBlockAlert && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowTableBlockAlert(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px] text-amber-600 dark:text-amber-400">warning</span>
              </div>
            </div>
            <h3 className="text-lg font-bold text-center text-slate-900 dark:text-white mb-2">
              표 안에서 사용 불가
            </h3>
            <p className="text-center text-slate-600 dark:text-slate-400 mb-4">
              제목(H1, H2, H3)은 표 셀 안에서 사용할 수 없습니다.
            </p>
            <button
              onClick={() => setShowTableBlockAlert(false)}
              className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-lg transition-colors"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* Editor Content - Scrollable */}
      <div ref={editorContainerRef} className="flex-1 overflow-y-auto min-h-[300px] relative">
        <EditorContent editor={editor} />

        {/* Table Row Handle (below table) */}
        {(showRowHandle || isDraggingRow) && activeTableElement && (
          <div
            className="table-row-handle"
            style={{
              position: 'fixed',
              left: activeTableElement.getBoundingClientRect().left,
              top: activeTableElement.getBoundingClientRect().bottom + 2,
              width: activeTableElement.getBoundingClientRect().width,
              height: '12px',
              cursor: isDraggingRow ? 'row-resize' : 'pointer',
            }}
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              // Focus on last row, last cell before starting drag
              if (activeTableElement && editor) {
                const rows = activeTableElement.querySelectorAll('tr')
                const lastRow = rows[rows.length - 1]
                const lastCellP = lastRow?.querySelector('td:last-child p, th:last-child p')
                if (lastCellP) {
                  try {
                    const pos = editor.view.posAtDOM(lastCellP, 0)
                    editor.chain().focus().setTextSelection(pos).run()
                  } catch {}
                }
              }
              setIsDraggingRow(true)
              setDragStartY(e.clientY)
              setRowDelta(0)
              appliedRowDeltaRef.current = 0
            }}
          >
            <div className="table-handle-inner table-handle-thin">
              <span className="material-symbols-outlined text-[12px]">
                {isDraggingRow ? (rowDelta > 0 ? 'add' : rowDelta < 0 ? 'remove' : 'drag_handle') : 'add'}
              </span>
            </div>
          </div>
        )}

        {/* Table Column Handle (right of table) */}
        {(showColHandle || isDraggingCol) && activeTableElement && (
          <div
            className="table-col-handle"
            style={{
              position: 'fixed',
              left: activeTableElement.getBoundingClientRect().right + 2,
              top: activeTableElement.getBoundingClientRect().top,
              width: '12px',
              height: activeTableElement.getBoundingClientRect().height,
              cursor: isDraggingCol ? 'col-resize' : 'pointer',
            }}
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              // Focus on first row, last cell before starting drag
              if (activeTableElement && editor) {
                const firstRow = activeTableElement.querySelector('tr')
                const lastCellP = firstRow?.querySelector('td:last-child p, th:last-child p')
                if (lastCellP) {
                  try {
                    const pos = editor.view.posAtDOM(lastCellP, 0)
                    editor.chain().focus().setTextSelection(pos).run()
                  } catch {}
                }
              }
              setIsDraggingCol(true)
              setDragStartX(e.clientX)
              setColDelta(0)
              appliedColDeltaRef.current = 0
            }}
          >
            <div className="table-handle-inner table-handle-vertical table-handle-thin">
              <span className="material-symbols-outlined text-[12px]">
                {isDraggingCol ? (colDelta > 0 ? 'add' : colDelta < 0 ? 'remove' : 'drag_handle') : 'add'}
              </span>
            </div>
          </div>
        )}

        {/* Row Control Button (left edge) */}
        {(hoveredRow || showRowControlMenu) && (
          <div
            ref={rowControlRef}
            className="table-row-control"
            style={{
              position: 'fixed',
              left: (hoveredRow?.row.getBoundingClientRect().left || 0) - 28,
              top: (hoveredRow?.row.getBoundingClientRect().top || 0) + ((hoveredRow?.row.getBoundingClientRect().height || 36) / 2) - 12,
            }}
          >
            <button
              type="button"
              className="table-control-btn"
              onClick={() => setShowRowControlMenu(!showRowControlMenu)}
            >
              <span className="material-symbols-outlined text-[16px]">drag_indicator</span>
            </button>
            {showRowControlMenu && (
              <div className="table-control-menu">
                <button type="button" className="table-control-menu-item" onClick={handleInsertRowAbove}>
                  <span className="material-symbols-outlined">keyboard_arrow_up</span>
                  위에 행 삽입
                </button>
                <button type="button" className="table-control-menu-item" onClick={handleInsertRowBelow}>
                  <span className="material-symbols-outlined">keyboard_arrow_down</span>
                  아래에 행 삽입
                </button>
                <div className="table-control-menu-divider" />
                <div className="table-control-color-section">
                  <button
                    type="button"
                    className="table-control-menu-item"
                    onClick={() => setRowColorPickerOpen(!rowColorPickerOpen)}
                  >
                    <span className="material-symbols-outlined">palette</span>
                    행 색상
                    <span className="material-symbols-outlined ml-auto text-[14px]">
                      {rowColorPickerOpen ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>
                  {rowColorPickerOpen && (
                    <div className="table-color-picker">
                      {tableRowColors.map((c) => (
                        <button
                          key={c.name}
                          type="button"
                          className="table-color-option"
                          style={{ backgroundColor: c.color || '#fff' }}
                          onClick={() => handleSetRowColor(c.color)}
                          title={c.name}
                        >
                          {!c.color && <span className="material-symbols-outlined text-[12px] text-slate-400">block</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="table-control-menu-divider" />
                <button type="button" className="table-control-menu-item table-control-menu-item-danger" onClick={handleDeleteRow}>
                  <span className="material-symbols-outlined">delete</span>
                  행 삭제
                </button>
              </div>
            )}
          </div>
        )}

        {/* Column Control Button (top edge) */}
        {(hoveredCol || showColControlMenu) && (
          <div
            ref={colControlRef}
            className="table-col-control"
            style={{
              position: 'fixed',
              left: (hoveredCol?.rect.left || 0) + ((hoveredCol?.rect.width || 80) / 2) - 12,
              top: (hoveredCol?.rect.top || 0) - 28,
            }}
          >
            <button
              type="button"
              className="table-control-btn"
              onClick={() => setShowColControlMenu(!showColControlMenu)}
            >
              <span className="material-symbols-outlined text-[16px]">drag_indicator</span>
            </button>
            {showColControlMenu && (
              <div className="table-control-menu table-control-menu-col">
                <button type="button" className="table-control-menu-item" onClick={handleInsertColLeft}>
                  <span className="material-symbols-outlined">keyboard_arrow_left</span>
                  왼쪽에 열 삽입
                </button>
                <button type="button" className="table-control-menu-item" onClick={handleInsertColRight}>
                  <span className="material-symbols-outlined">keyboard_arrow_right</span>
                  오른쪽에 열 삽입
                </button>
                <div className="table-control-menu-divider" />
                <div className="table-control-color-section">
                  <button
                    type="button"
                    className="table-control-menu-item"
                    onClick={() => setColColorPickerOpen(!colColorPickerOpen)}
                  >
                    <span className="material-symbols-outlined">palette</span>
                    열 색상
                    <span className="material-symbols-outlined ml-auto text-[14px]">
                      {colColorPickerOpen ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>
                  {colColorPickerOpen && (
                    <div className="table-color-picker">
                      {tableRowColors.map((c) => (
                        <button
                          key={c.name}
                          type="button"
                          className="table-color-option"
                          style={{ backgroundColor: c.color || '#fff' }}
                          onClick={() => handleSetColColor(c.color)}
                          title={c.name}
                        >
                          {!c.color && <span className="material-symbols-outlined text-[12px] text-slate-400">block</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="table-control-menu-divider" />
                <button type="button" className="table-control-menu-item table-control-menu-item-danger" onClick={handleDeleteCol}>
                  <span className="material-symbols-outlined">delete</span>
                  열 삭제
                </button>
              </div>
            )}
          </div>
        )}

        {/* Cell Control Button (right edge of cell) */}
        {(hoveredCell || showCellControlMenu) && (
          <div
            ref={cellControlRef}
            className="table-cell-control"
            style={{
              position: 'fixed',
              left: (hoveredCell?.cell.getBoundingClientRect().right || 0) - 20,
              top: (hoveredCell?.cell.getBoundingClientRect().top || 0) + ((hoveredCell?.cell.getBoundingClientRect().height || 36) / 2) - 10,
            }}
          >
            <button
              type="button"
              className="table-cell-control-btn"
              onClick={() => setShowCellControlMenu(!showCellControlMenu)}
            >
              <span className="material-symbols-outlined text-[14px]">palette</span>
            </button>
            {showCellControlMenu && (
              <div className="table-cell-color-menu">
                <div className="table-cell-color-title">셀 색상</div>
                <div className="table-color-picker">
                  {tableRowColors.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      className="table-color-option"
                      style={{ backgroundColor: c.color || '#fff' }}
                      onClick={() => handleSetCellColor(c.color)}
                      title={c.name}
                    >
                      {!c.color && <span className="material-symbols-outlined text-[12px] text-slate-400">block</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Styles for the editor */}
      <style>{`
        .ProseMirror {
          max-width: 750px;
          margin-left: auto;
          margin-right: auto;
          padding: 1rem;
        }
        .ProseMirror p.is-editor-empty:first-child::before {
          color: #9ca3af;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        .ProseMirror:focus {
          outline: none;
        }
        .ProseMirror h1 {
          font-size: 1.5rem;
          font-weight: 700;
          margin-top: 1.75rem;
          margin-bottom: 0.75rem;
        }
        .ProseMirror h2 {
          font-size: 1.25rem;
          font-weight: 700;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
        }
        .ProseMirror h3 {
          font-size: 1.125rem;
          font-weight: 600;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
        }
        @media (min-width: 768px) {
          .ProseMirror h1 {
            font-size: 2rem;
            margin-top: 2rem;
            margin-bottom: 1rem;
          }
          .ProseMirror h2 {
            font-size: 1.5rem;
            margin-top: 1.5rem;
          }
          .ProseMirror h3 {
            font-size: 1.25rem;
          }
        }
        .ProseMirror p {
          margin-bottom: 1rem;
          line-height: 1.8;
        }
        .ProseMirror > p:first-child {
          font-size: 1.125rem;
        }
        .ProseMirror ul,
        .ProseMirror ol {
          padding-left: 1.5rem;
          margin-bottom: 1rem;
        }
        /* Bulleted List - nested styles (repeating: disc → circle → square) */
        .ProseMirror ul { list-style-type: disc; }
        .ProseMirror ul ul { list-style-type: circle; }
        .ProseMirror ul ul ul { list-style-type: square; }
        .ProseMirror ul ul ul ul { list-style-type: disc; }
        .ProseMirror ul ul ul ul ul { list-style-type: circle; }
        .ProseMirror ul ul ul ul ul ul { list-style-type: square; }
        .ProseMirror ul ul ul ul ul ul ul { list-style-type: disc; }
        .ProseMirror ul ul ul ul ul ul ul ul { list-style-type: circle; }
        .ProseMirror ul ul ul ul ul ul ul ul ul { list-style-type: square; }
        /* Numbered List - nested styles (repeating: 1,2,3 → a,b,c → i,ii,iii) */
        .ProseMirror ol { list-style-type: decimal; }
        .ProseMirror ol ol { list-style-type: lower-alpha; }
        .ProseMirror ol ol ol { list-style-type: lower-roman; }
        .ProseMirror ol ol ol ol { list-style-type: decimal; }
        .ProseMirror ol ol ol ol ol { list-style-type: lower-alpha; }
        .ProseMirror ol ol ol ol ol ol { list-style-type: lower-roman; }
        .ProseMirror ol ol ol ol ol ol ol { list-style-type: decimal; }
        .ProseMirror ol ol ol ol ol ol ol ol { list-style-type: lower-alpha; }
        .ProseMirror ol ol ol ol ol ol ol ol ol { list-style-type: lower-roman; }
        /* List items can contain blocks */
        .ProseMirror li {
          position: relative;
        }
        .ProseMirror li > p {
          margin-bottom: 0.5rem;
        }
        .ProseMirror li > .code-block-wrapper,
        .ProseMirror li > .resizable-image-wrapper,
        .ProseMirror li > .bookmark-wrapper,
        .ProseMirror li > .callout-wrapper {
          margin: 0.5rem 0;
        }
        .ProseMirror blockquote {
          border-left: 4px solid #3182f6;
          padding: 1rem 1rem 1rem 1.5rem;
          margin: 1.5rem 0;
          font-style: italic;
          color: #64748b;
          background: #f8fafc;
          border-radius: 0 0.5rem 0.5rem 0;
        }
        .dark .ProseMirror blockquote {
          background: #1e293b;
          color: #94a3b8;
          border-left-color: #60a5fa;
        }
        .ProseMirror blockquote p {
          margin-bottom: 0 !important;
        }
        /* Terminal-style code block wrapper */
        .code-block-wrapper {
          position: relative;
          margin-bottom: 1rem;
          border-radius: 0.75rem;
          overflow: hidden;
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05);
        }
        .dark .code-block-wrapper {
          border-color: #30363d;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.3), 0 2px 4px -2px rgb(0 0 0 / 0.3);
        }
        /* Terminal header */
        .code-block-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.5rem 0.75rem;
          background: linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 100%);
          border-bottom: 1px solid #e2e8f0;
        }
        .dark .code-block-header {
          background: linear-gradient(180deg, #21262d 0%, #161b22 100%);
          border-bottom-color: #30363d;
        }
        /* Traffic light dots */
        .code-block-dots {
          display: flex;
          gap: 6px;
        }
        .code-block-dots .dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }
        .code-block-dots .dot.red { background: #ff5f57; }
        .code-block-dots .dot.yellow { background: #ffbd2e; }
        .code-block-dots .dot.green { background: #28c840; }
        /* Language selector */
        .code-block-language {
          background: transparent;
          border: 1px solid #cbd5e1;
          border-radius: 0.375rem;
          padding: 0.25rem 0.5rem;
          font-size: 0.75rem;
          font-weight: 500;
          color: #64748b;
          cursor: pointer;
          outline: none;
          transition: all 0.15s;
        }
        .code-block-language:hover {
          border-color: #94a3b8;
        }
        .code-block-language:focus {
          border-color: #3182f6;
          box-shadow: 0 0 0 2px rgba(49, 130, 246, 0.2);
        }
        .dark .code-block-language {
          border-color: #475569;
          color: #94a3b8;
          background: #1e293b;
        }
        .dark .code-block-language:hover {
          border-color: #64748b;
        }
        /* Code block content */
        .code-block-wrapper pre {
          margin: 0;
          padding: 1rem;
          background: #f8fafc;
          color: #1e293b;
          overflow-x: auto;
          font-family: 'SF Mono', 'Fira Code', 'Monaco', 'Consolas', monospace;
          font-size: 0.875rem;
          line-height: 1.6;
        }
        .dark .code-block-wrapper pre {
          background: #0d1117;
          color: #e6edf3;
        }
        .code-block-wrapper pre code {
          background: transparent;
          padding: 0;
          color: inherit;
          font-family: inherit;
        }
        /* Inline code */
        .ProseMirror code {
          background: #f1f5f9;
          padding: 0.125rem 0.375rem;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          font-family: 'SF Mono', 'Fira Code', 'Monaco', 'Consolas', monospace;
          color: #dc2626;
        }
        .dark .ProseMirror code {
          background: #1e293b;
          color: #f87171;
        }
        .code-block-wrapper code {
          background: transparent !important;
          color: inherit !important;
        }
        /* Syntax highlighting - Light mode */
        .code-block-wrapper .hljs-keyword,
        .code-block-wrapper .hljs-selector-tag,
        .code-block-wrapper .hljs-built_in {
          color: #a855f7;
        }
        .code-block-wrapper .hljs-string,
        .code-block-wrapper .hljs-attr {
          color: #22c55e;
        }
        .code-block-wrapper .hljs-comment {
          color: #94a3b8;
          font-style: italic;
        }
        .code-block-wrapper .hljs-function,
        .code-block-wrapper .hljs-title {
          color: #3b82f6;
        }
        .code-block-wrapper .hljs-number {
          color: #f59e0b;
        }
        .code-block-wrapper .hljs-variable,
        .code-block-wrapper .hljs-template-variable {
          color: #ef4444;
        }
        .code-block-wrapper .hljs-property {
          color: #0891b2;
        }
        .code-block-wrapper .hljs-operator {
          color: #64748b;
        }
        /* Syntax highlighting - Dark mode */
        .dark .code-block-wrapper .hljs-keyword,
        .dark .code-block-wrapper .hljs-selector-tag,
        .dark .code-block-wrapper .hljs-built_in {
          color: #c084fc;
        }
        .dark .code-block-wrapper .hljs-string,
        .dark .code-block-wrapper .hljs-attr {
          color: #4ade80;
        }
        .dark .code-block-wrapper .hljs-comment {
          color: #64748b;
          font-style: italic;
        }
        .dark .code-block-wrapper .hljs-function,
        .dark .code-block-wrapper .hljs-title {
          color: #60a5fa;
        }
        .dark .code-block-wrapper .hljs-number {
          color: #fbbf24;
        }
        .dark .code-block-wrapper .hljs-variable,
        .dark .code-block-wrapper .hljs-template-variable {
          color: #f87171;
        }
        .dark .code-block-wrapper .hljs-property {
          color: #22d3ee;
        }
        .dark .code-block-wrapper .hljs-operator {
          color: #94a3b8;
        }
        .ProseMirror img {
          max-width: 100%;
          height: auto;
          border-radius: 0.5rem;
          margin: 1rem 0;
        }
        /* Resizable Image */
        .resizable-image-wrapper {
          display: flex;
          justify-content: center;
          margin: 1rem 0;
        }
        .resizable-image-wrapper.align-left {
          justify-content: flex-start;
        }
        .resizable-image-wrapper.align-center {
          justify-content: center;
        }
        .resizable-image-wrapper.align-right {
          justify-content: flex-end;
        }
        .resizable-image-container {
          position: relative;
          display: inline-block;
          max-width: 100%;
          border-radius: 0.5rem;
          transition: box-shadow 0.15s;
        }
        .resizable-image-container img {
          display: block;
          width: 100%;
          height: auto;
          border-radius: 0.5rem;
          margin: 0 !important;
        }
        .resizable-image-container.is-selected {
          box-shadow: 0 0 0 3px rgba(49, 130, 246, 0.4);
        }
        .resizable-image-container.is-resizing {
          box-shadow: 0 0 0 3px rgba(49, 130, 246, 0.6);
        }
        .resize-handle {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 12px;
          height: 48px;
          background: #3182f6;
          border-radius: 6px;
          cursor: ew-resize;
          opacity: 0;
          transition: opacity 0.15s;
          z-index: 10;
        }
        .resizable-image-container.is-selected .resize-handle {
          opacity: 1;
        }
        .resizable-image-container.is-selected:hover .resize-handle {
          opacity: 1;
        }
        .resize-handle:hover {
          background: #1d4ed8;
        }
        .resize-handle-left {
          left: -6px;
        }
        .resize-handle-right {
          right: -6px;
        }
        .resize-handle::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 2px;
          height: 20px;
          background: white;
          border-radius: 1px;
        }
        /* Image Alignment Toolbar */
        .image-align-toolbar {
          position: absolute;
          bottom: -40px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 4px;
          padding: 4px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
          z-index: 20;
        }
        .dark .image-align-toolbar {
          background: #1e293b;
          border-color: #334155;
        }
        .image-align-toolbar button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border: none;
          background: transparent;
          border-radius: 4px;
          cursor: pointer;
          color: #64748b;
          transition: all 0.15s;
        }
        .image-align-toolbar button:hover {
          background: #f1f5f9;
          color: #334155;
        }
        .dark .image-align-toolbar button:hover {
          background: #334155;
          color: #e2e8f0;
        }
        .image-align-toolbar button.active {
          background: #3182f6;
          color: white;
        }
        .image-align-toolbar button .material-symbols-outlined {
          font-size: 18px;
        }
        /* Color Picker Dropdown */
        .color-picker-dropdown {
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          margin-top: 4px;
          padding: 8px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
          z-index: 9999;
          min-width: 180px;
        }
        .dark .color-picker-dropdown {
          background: #1e293b;
          border-color: #334155;
        }
        .color-picker-section-title {
          font-size: 10px;
          font-weight: 600;
          color: #94a3b8;
          text-transform: uppercase;
          margin-bottom: 6px;
          letter-spacing: 0.05em;
        }
        .color-picker-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 4px;
          margin-bottom: 8px;
        }
        .color-picker-item {
          width: 28px;
          height: 28px;
          border: 2px solid transparent;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .color-picker-item:hover {
          transform: scale(1.1);
          border-color: #3182f6;
        }
        .color-picker-item.color-reset {
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
        }
        .dark .color-picker-item.color-reset {
          background: #334155;
          border-color: #475569;
        }
        .color-picker-item.color-reset .material-symbols-outlined {
          color: #64748b;
        }
        .color-picker-custom {
          padding-top: 8px;
          border-top: 1px solid #e2e8f0;
        }
        .dark .color-picker-custom {
          border-top-color: #334155;
        }
        .color-picker-custom-label {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 8px;
          font-size: 12px;
          color: #64748b;
          cursor: pointer;
          border-radius: 4px;
          transition: background 0.15s;
        }
        .color-picker-custom-label:hover {
          background: #f1f5f9;
          color: #334155;
        }
        .dark .color-picker-custom-label:hover {
          background: #334155;
          color: #e2e8f0;
        }
        .color-picker-custom-label input[type="color"] {
          position: absolute;
          opacity: 0;
          width: 0;
          height: 0;
        }
        /* Advanced Color Picker */
        .advanced-color-picker {
          padding-top: 8px;
          border-top: 1px solid #e2e8f0;
        }
        .dark .advanced-color-picker {
          border-top-color: #334155;
        }
        .sl-picker {
          width: 200px;
          height: 150px;
          border-radius: 6px;
          position: relative;
          cursor: crosshair;
          margin-bottom: 10px;
        }
        .sl-cursor {
          position: absolute;
          width: 14px;
          height: 14px;
          border: 2px solid white;
          border-radius: 50%;
          box-shadow: 0 0 0 1px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(0,0,0,0.3);
          transform: translate(-50%, -50%);
          pointer-events: none;
        }
        .hue-slider {
          width: 200px;
          height: 14px;
          border-radius: 7px;
          background: linear-gradient(to right,
            hsl(0, 100%, 50%),
            hsl(60, 100%, 50%),
            hsl(120, 100%, 50%),
            hsl(180, 100%, 50%),
            hsl(240, 100%, 50%),
            hsl(300, 100%, 50%),
            hsl(360, 100%, 50%)
          );
          position: relative;
          cursor: pointer;
          margin-bottom: 12px;
        }
        .hue-cursor {
          position: absolute;
          top: 50%;
          width: 6px;
          height: 18px;
          background: white;
          border: 1px solid rgba(0,0,0,0.3);
          border-radius: 3px;
          transform: translate(-50%, -50%);
          pointer-events: none;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        .color-picker-footer {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .color-preview-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .color-preview-swatch {
          width: 32px;
          height: 32px;
          border-radius: 6px;
          border: 1px solid rgba(0,0,0,0.1);
        }
        .color-preview-hex {
          font-size: 12px;
          font-family: monospace;
          color: #64748b;
        }
        .dark .color-preview-hex {
          color: #94a3b8;
        }
        .color-picker-buttons {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }
        .color-picker-cancel {
          padding: 6px 12px;
          font-size: 12px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          background: white;
          color: #64748b;
          cursor: pointer;
          transition: all 0.15s;
        }
        .color-picker-cancel:hover {
          background: #f1f5f9;
          color: #334155;
        }
        .dark .color-picker-cancel {
          background: #334155;
          border-color: #475569;
          color: #94a3b8;
        }
        .dark .color-picker-cancel:hover {
          background: #475569;
          color: #e2e8f0;
        }
        .color-picker-apply {
          padding: 6px 12px;
          font-size: 12px;
          border: none;
          border-radius: 6px;
          background: #3182f6;
          color: white;
          cursor: pointer;
          transition: all 0.15s;
        }
        .color-picker-apply:hover {
          background: #1d6ce0;
        }
        /* Table Menu Dropdown */
        .table-menu-dropdown {
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          margin-top: 4px;
          padding: 8px 0;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
          z-index: 9999;
          min-width: 180px;
        }
        .dark .table-menu-dropdown {
          background: #1e293b;
          border-color: #334155;
        }
        .table-menu-section {
          padding: 0 4px;
        }
        .table-menu-section-title {
          font-size: 10px;
          font-weight: 600;
          color: #94a3b8;
          text-transform: uppercase;
          padding: 4px 12px;
          letter-spacing: 0.05em;
        }
        .table-menu-item {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 8px 12px;
          font-size: 13px;
          color: #334155;
          background: none;
          border: none;
          cursor: pointer;
          transition: background 0.15s;
          border-radius: 4px;
        }
        .table-menu-item:hover {
          background: #f1f5f9;
        }
        .dark .table-menu-item {
          color: #e2e8f0;
        }
        .dark .table-menu-item:hover {
          background: #334155;
        }
        .table-menu-item .material-symbols-outlined {
          font-size: 18px;
          color: #64748b;
        }
        .dark .table-menu-item .material-symbols-outlined {
          color: #94a3b8;
        }
        .table-menu-item-danger {
          color: #dc2626;
        }
        .table-menu-item-danger:hover {
          background: #fef2f2;
        }
        .dark .table-menu-item-danger {
          color: #f87171;
        }
        .dark .table-menu-item-danger:hover {
          background: rgba(248, 113, 113, 0.1);
        }
        .table-menu-item-danger .material-symbols-outlined {
          color: #dc2626;
        }
        .dark .table-menu-item-danger .material-symbols-outlined {
          color: #f87171;
        }
        .table-menu-divider {
          height: 1px;
          background: #e2e8f0;
          margin: 8px 0;
        }
        .dark .table-menu-divider {
          background: #334155;
        }
        /* Table Drag Handles */
        .table-row-handle,
        .table-col-handle {
          z-index: 100;
          background: linear-gradient(135deg, #3182f6 0%, #60a5fa 100%);
          border-radius: 4px;
          opacity: 0.9;
          transition: opacity 0.15s, transform 0.1s;
          user-select: none;
        }
        .table-row-handle:hover,
        .table-col-handle:hover {
          opacity: 1;
          transform: scale(1.02);
        }
        .table-row-handle:active,
        .table-col-handle:active {
          transform: scale(0.98);
        }
        .table-handle-inner {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          color: white;
          gap: 4px;
        }
        .table-handle-vertical {
          flex-direction: column;
          writing-mode: vertical-rl;
          text-orientation: mixed;
        }
        .table-handle-delta {
          font-size: 10px;
          font-weight: 600;
          padding: 2px 4px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 3px;
          min-width: 20px;
          text-align: center;
        }
        /* Table Row/Column/Cell Controls */
        .table-row-control,
        .table-col-control,
        .table-cell-control {
          z-index: 100;
        }
        .table-control-btn {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          cursor: pointer;
          color: #64748b;
          transition: all 0.15s;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        .table-control-btn:hover {
          background: #f1f5f9;
          color: #334155;
          border-color: #cbd5e1;
        }
        .dark .table-control-btn {
          background: #1e293b;
          border-color: #334155;
          color: #94a3b8;
        }
        .dark .table-control-btn:hover {
          background: #334155;
          color: #e2e8f0;
          border-color: #475569;
        }
        .table-cell-control-btn {
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          cursor: pointer;
          color: #94a3b8;
          transition: all 0.15s;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }
        .table-cell-control-btn:hover {
          background: #f1f5f9;
          color: #64748b;
          border-color: #cbd5e1;
        }
        .dark .table-cell-control-btn {
          background: #1e293b;
          border-color: #334155;
          color: #64748b;
        }
        .dark .table-cell-control-btn:hover {
          background: #334155;
          color: #94a3b8;
        }
        .table-control-menu {
          position: absolute;
          left: 28px;
          top: 0;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          min-width: 160px;
          padding: 4px;
          z-index: 101;
        }
        .table-control-menu-col {
          left: 0;
          top: 28px;
        }
        .dark .table-control-menu {
          background: #1e293b;
          border-color: #334155;
        }
        .table-control-menu-item {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 8px 10px;
          font-size: 13px;
          color: #334155;
          background: none;
          border: none;
          cursor: pointer;
          border-radius: 4px;
          transition: background 0.15s;
        }
        .table-control-menu-item:hover {
          background: #f1f5f9;
        }
        .dark .table-control-menu-item {
          color: #e2e8f0;
        }
        .dark .table-control-menu-item:hover {
          background: #334155;
        }
        .table-control-menu-item .material-symbols-outlined {
          font-size: 18px;
          color: #64748b;
        }
        .dark .table-control-menu-item .material-symbols-outlined {
          color: #94a3b8;
        }
        .table-control-menu-item-danger {
          color: #dc2626;
        }
        .table-control-menu-item-danger:hover {
          background: #fef2f2;
        }
        .dark .table-control-menu-item-danger {
          color: #f87171;
        }
        .dark .table-control-menu-item-danger:hover {
          background: rgba(248, 113, 113, 0.1);
        }
        .table-control-menu-item-danger .material-symbols-outlined {
          color: #dc2626;
        }
        .dark .table-control-menu-item-danger .material-symbols-outlined {
          color: #f87171;
        }
        .table-control-menu-divider {
          height: 1px;
          background: #e2e8f0;
          margin: 4px 0;
        }
        .dark .table-control-menu-divider {
          background: #334155;
        }
        .table-control-color-section {
          position: relative;
        }
        .table-color-picker {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 4px;
          padding: 8px;
          background: #f8fafc;
          border-radius: 4px;
          margin: 4px;
        }
        .dark .table-color-picker {
          background: #0f172a;
        }
        .table-color-option {
          width: 24px;
          height: 24px;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .table-color-option:hover {
          transform: scale(1.1);
          border-color: #3182f6;
        }
        .dark .table-color-option {
          border-color: #475569;
        }
        .table-cell-color-menu {
          position: absolute;
          right: 24px;
          top: 0;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          padding: 8px;
          z-index: 101;
        }
        .dark .table-cell-color-menu {
          background: #1e293b;
          border-color: #334155;
        }
        .table-cell-color-title {
          font-size: 11px;
          font-weight: 600;
          color: #64748b;
          margin-bottom: 8px;
          padding: 0 4px;
        }
        .dark .table-cell-color-title {
          color: #94a3b8;
        }
        .ProseMirror a {
          color: #3182f6;
          text-decoration: underline;
          text-underline-offset: 2px;
          transition: color 0.15s;
        }
        .ProseMirror a:hover {
          color: #1d4ed8;
        }
        .dark .ProseMirror a {
          color: #60a5fa;
        }
        .dark .ProseMirror a:hover {
          color: #93c5fd;
        }
        /* YouTube Video */
        .ProseMirror .youtube-video,
        .ProseMirror div[data-youtube-video] {
          position: relative;
          width: 100%;
          max-width: 640px;
          margin: 1rem 0;
          border-radius: 0.75rem;
          overflow: hidden;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
        }
        .ProseMirror .youtube-video iframe,
        .ProseMirror div[data-youtube-video] iframe {
          width: 100%;
          height: auto;
          aspect-ratio: 16 / 9;
          border: none;
          border-radius: 0.75rem;
        }
        .dark .ProseMirror .youtube-video,
        .dark .ProseMirror div[data-youtube-video] {
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.3), 0 2px 4px -2px rgb(0 0 0 / 0.3);
        }
        /* Highlight */
        .ProseMirror mark {
          padding: 0.125rem 0.25rem;
          border-radius: 0.25rem;
        }
        .ProseMirror mark:not([data-color]) {
          background-color: #fef08a;
        }
        .dark .ProseMirror mark:not([data-color]) {
          background-color: #854d0e;
          color: #fef9c3;
        }
        /* Table */
        .ProseMirror .tableWrapper {
          overflow-x: auto;
          margin: 1rem 0;
        }
        .ProseMirror table {
          border-collapse: collapse;
          table-layout: fixed;
          width: 100%;
        }
        .ProseMirror td,
        .ProseMirror th {
          border: 1px solid #e2e8f0;
          padding: 0.5rem 0.75rem;
          vertical-align: middle;
          position: relative;
          min-width: 80px;
          max-width: 300px;
          line-height: 1.4;
          font-size: 0.9375rem;
          min-height: 36px;
          height: auto;
          word-wrap: break-word;
          word-break: break-word;
          overflow-wrap: break-word;
        }
        .ProseMirror td p,
        .ProseMirror th p {
          margin: 0;
          line-height: 1.4;
          min-height: 1.4em;
        }
        .dark .ProseMirror td,
        .dark .ProseMirror th {
          border-color: #334155;
        }
        /* Header cells - bold text with default background */
        .ProseMirror th {
          font-weight: 600;
          text-align: left;
          background-color: #f1f5f9;
        }
        .dark .ProseMirror th {
          background-color: #334155;
        }
        /* Allow inline style to override default header background */
        .ProseMirror th[style*="background-color"] {
          background-color: unset;
        }
        .ProseMirror .selectedCell:after {
          z-index: 2;
          position: absolute;
          content: "";
          left: 0; right: 0; top: 0; bottom: 0;
          background: rgba(49, 130, 246, 0.15);
          pointer-events: none;
        }
        .ProseMirror .column-resize-handle {
          position: absolute;
          right: -2px;
          top: 0;
          bottom: -2px;
          width: 4px;
          background: #3182f6;
          cursor: col-resize;
        }
        .ProseMirror.resize-cursor {
          cursor: col-resize;
        }
        /* Bookmark Card */
        .bookmark-wrapper {
          position: relative;
          margin: 1rem 0;
        }
        .bookmark-card {
          display: flex;
          text-decoration: none !important;
          border: 1px solid #e2e8f0;
          border-radius: 0.75rem;
          overflow: hidden;
          background: #fff;
          transition: all 0.2s;
        }
        .bookmark-card:hover {
          border-color: #cbd5e1;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        }
        .bookmark-card * {
          text-decoration: none !important;
        }
        .dark .bookmark-card {
          border-color: #334155;
          background: #1e293b;
        }
        .dark .bookmark-card:hover {
          border-color: #475569;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.3);
        }
        .bookmark-content {
          flex: 1;
          padding: 1rem;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }
        .bookmark-title {
          font-weight: 600;
          font-size: 0.9375rem;
          color: #0f172a;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          line-height: 1.4;
        }
        .dark .bookmark-title {
          color: #f1f5f9;
        }
        .bookmark-description {
          font-size: 0.8125rem;
          color: #64748b;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          line-height: 1.5;
        }
        .dark .bookmark-description {
          color: #94a3b8;
        }
        .bookmark-meta {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: auto;
          padding-top: 0.25rem;
        }
        .bookmark-favicon {
          width: 16px;
          height: 16px;
          border-radius: 2px;
          flex-shrink: 0;
        }
        .bookmark-site {
          font-size: 0.75rem;
          color: #94a3b8;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .bookmark-image {
          width: 140px;
          flex-shrink: 0;
          background: #f1f5f9;
          display: flex;
          align-items: center;
        }
        .dark .bookmark-image {
          background: #0f172a;
        }
        .bookmark-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          margin: 0 !important;
          border-radius: 0 !important;
        }
        .bookmark-delete {
          position: absolute;
          top: 0.5rem;
          right: 0.5rem;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.9);
          border: 1px solid #e2e8f0;
          border-radius: 50%;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.2s;
          color: #64748b;
        }
        .bookmark-wrapper:hover .bookmark-delete {
          opacity: 1;
        }
        .bookmark-delete:hover {
          background: #fee2e2;
          border-color: #fecaca;
          color: #dc2626;
        }
        .dark .bookmark-delete {
          background: rgba(30, 41, 59, 0.9);
          border-color: #334155;
          color: #94a3b8;
        }
        .dark .bookmark-delete:hover {
          background: rgba(127, 29, 29, 0.5);
          border-color: #7f1d1d;
          color: #f87171;
        }
        /* Callout Block */
        .callout-wrapper {
          position: relative;
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          margin: 1rem 0;
          padding: 1rem;
          border-radius: 0.75rem;
          border-left: 4px solid var(--callout-border);
          background: var(--callout-bg-light);
        }
        .dark .callout-wrapper {
          background: var(--callout-bg-dark);
        }
        .callout-icon-wrapper {
          position: relative;
          flex-shrink: 0;
        }
        .callout-icon {
          font-size: 1.25rem;
          line-height: 1;
          cursor: pointer;
          background: none;
          border: none;
          padding: 0.25rem;
          border-radius: 0.375rem;
          transition: background 0.15s;
        }
        .callout-icon:hover {
          background: rgba(0, 0, 0, 0.1);
        }
        .dark .callout-icon:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        .callout-icon-picker {
          position: absolute;
          top: 100%;
          left: 0;
          z-index: 20;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.25rem;
          padding: 0.5rem;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
        }
        .dark .callout-icon-picker {
          background: #1e293b;
          border-color: #334155;
        }
        .callout-icon-picker button {
          padding: 0.375rem;
          font-size: 1.125rem;
          border: none;
          background: none;
          border-radius: 0.25rem;
          cursor: pointer;
          transition: background 0.15s;
        }
        .callout-icon-picker button:hover {
          background: #f1f5f9;
        }
        .dark .callout-icon-picker button:hover {
          background: #334155;
        }
        .callout-content {
          flex: 1;
          min-width: 0;
        }
        .callout-content p {
          margin: 0 !important;
        }
        .callout-actions {
          position: absolute;
          top: 0.5rem;
          right: 0.5rem;
          display: flex;
          align-items: center;
          gap: 0.25rem;
          opacity: 0;
          transition: opacity 0.2s;
        }
        .callout-wrapper:hover .callout-actions {
          opacity: 1;
        }
        .callout-type-select {
          font-size: 0.75rem;
          padding: 0.25rem 0.5rem;
          border: 1px solid #e2e8f0;
          border-radius: 0.375rem;
          background: white;
          cursor: pointer;
          outline: none;
        }
        .callout-type-select:focus {
          border-color: #3182f6;
        }
        .dark .callout-type-select {
          background: #1e293b;
          border-color: #334155;
          color: #e2e8f0;
        }
        .callout-delete {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 50%;
          cursor: pointer;
          color: #64748b;
          transition: all 0.15s;
        }
        .callout-delete:hover {
          background: #fee2e2;
          border-color: #fecaca;
          color: #dc2626;
        }
        .dark .callout-delete {
          background: #1e293b;
          border-color: #334155;
          color: #94a3b8;
        }
        .dark .callout-delete:hover {
          background: rgba(127, 29, 29, 0.5);
          border-color: #7f1d1d;
          color: #f87171;
        }
        /* PullQuote Block */
        .pullquote-wrapper {
          position: relative;
          margin: 2rem 0;
          padding: 2rem 3rem;
          text-align: center;
        }
        .pullquote-mark {
          position: absolute;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 5rem;
          line-height: 1;
          color: #3182f6;
          opacity: 0.3;
          user-select: none;
        }
        .pullquote-mark-open {
          top: 0;
          left: 0;
        }
        .pullquote-mark-close {
          bottom: -0.5rem;
          right: 0;
        }
        .pullquote-content {
          position: relative;
          z-index: 1;
        }
        .pullquote-content p {
          margin: 0 !important;
          font-size: 1.5rem;
          font-weight: 500;
          font-style: italic;
          line-height: 1.6;
          color: #334155;
        }
        .dark .pullquote-content p {
          color: #e2e8f0;
        }
        .pullquote-delete {
          position: absolute;
          top: 0.5rem;
          right: 0.5rem;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 50%;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.2s;
          color: #64748b;
        }
        .pullquote-wrapper:hover .pullquote-delete {
          opacity: 1;
        }
        .pullquote-delete:hover {
          background: #fee2e2;
          border-color: #fecaca;
          color: #dc2626;
        }
        .dark .pullquote-delete {
          background: #1e293b;
          border-color: #334155;
          color: #94a3b8;
        }
        .dark .pullquote-delete:hover {
          background: rgba(127, 29, 29, 0.5);
          border-color: #7f1d1d;
          color: #f87171;
        }

        /* Slash Menu Styles */
        .slash-menu {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 0.75rem;
          box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
          max-height: 320px;
          overflow-y: auto;
          padding: 0.5rem;
          min-width: 280px;
        }
        .dark .slash-menu {
          background: #1e293b;
          border-color: #334155;
          box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.4), 0 8px 10px -6px rgb(0 0 0 / 0.3);
        }
        .slash-menu-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2rem 1rem;
          color: #94a3b8;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 0.75rem;
          box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.1);
          min-width: 200px;
        }
        .dark .slash-menu-empty {
          background: #1e293b;
          border-color: #334155;
        }
        .slash-menu-empty p {
          margin: 0.5rem 0 0;
          font-size: 0.875rem;
        }
        .slash-menu-category {
          margin-bottom: 0.5rem;
        }
        .slash-menu-category:last-child {
          margin-bottom: 0;
        }
        .slash-menu-category-title {
          font-size: 0.6875rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #94a3b8;
          padding: 0.375rem 0.75rem 0.25rem;
        }
        .slash-menu-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: none;
          background: transparent;
          border-radius: 0.5rem;
          cursor: pointer;
          text-align: left;
          transition: background 0.1s;
        }
        .slash-menu-item:hover,
        .slash-menu-item.is-selected {
          background: #f1f5f9;
        }
        .dark .slash-menu-item:hover,
        .dark .slash-menu-item.is-selected {
          background: #334155;
        }
        .slash-menu-item-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: #f1f5f9;
          border-radius: 0.375rem;
          color: #64748b;
          font-size: 18px;
          flex-shrink: 0;
        }
        .dark .slash-menu-item-icon {
          background: #475569;
          color: #94a3b8;
        }
        .slash-menu-item.is-selected .slash-menu-item-icon {
          background: #3182f6;
          color: white;
        }
        .slash-menu-item-content {
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
          min-width: 0;
        }
        .slash-menu-item-title {
          font-size: 0.875rem;
          font-weight: 500;
          color: #1e293b;
        }
        .dark .slash-menu-item-title {
          color: #f1f5f9;
        }
        .slash-menu-item-description {
          font-size: 0.75rem;
          color: #94a3b8;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Tippy tooltip overrides */
        .tippy-box {
          background: transparent;
          border: none;
          max-width: none !important;
        }
        .tippy-content {
          padding: 0;
        }
      `}</style>
    </div>
  )
}

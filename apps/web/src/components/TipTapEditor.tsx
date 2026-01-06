import { useEditor, EditorContent, NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Youtube from '@tiptap/extension-youtube'
import { Extension, Node } from '@tiptap/core'
import { InputRule } from '@tiptap/core'
import { common, createLowlight } from 'lowlight'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../services/api'

const lowlight = createLowlight(common)

// Custom slash commands extension for headings
const SlashCommands = Extension.create({
  name: 'slashCommands',

  addInputRules() {
    return [
      // /1 + space → H1
      new InputRule({
        find: /^\/1\s$/,
        handler: ({ range, chain }: { range: { from: number; to: number }; chain: () => any }) => {
          chain().deleteRange(range).setNode('heading', { level: 1 }).run()
        },
      }),
      // /2 + space → H2
      new InputRule({
        find: /^\/2\s$/,
        handler: ({ range, chain }: { range: { from: number; to: number }; chain: () => any }) => {
          chain().deleteRange(range).setNode('heading', { level: 2 }).run()
        },
      }),
      // /3 + space → H3
      new InputRule({
        find: /^\/3\s$/,
        handler: ({ range, chain }: { range: { from: number; to: number }; chain: () => any }) => {
          chain().deleteRange(range).setNode('heading', { level: 3 }).run()
        },
      }),
      // /code + space → Code Block
      new InputRule({
        find: /^\/code\s$/,
        handler: ({ range, chain }: { range: { from: number; to: number }; chain: () => any }) => {
          chain().deleteRange(range).setNode('codeBlock').run()
        },
      }),
      // /quote + space → Blockquote
      new InputRule({
        find: /^\/quote\s$/,
        handler: ({ range, chain }: { range: { from: number; to: number }; chain: () => any }) => {
          chain().deleteRange(range).setNode('blockquote').run()
        },
      }),
      // /ul + space → Bullet List
      new InputRule({
        find: /^\/ul\s$/,
        handler: ({ range, chain }: { range: { from: number; to: number }; chain: () => any }) => {
          chain().deleteRange(range).toggleBulletList().run()
        },
      }),
      // /ol + space → Ordered List
      new InputRule({
        find: /^\/ol\s$/,
        handler: ({ range, chain }: { range: { from: number; to: number }; chain: () => any }) => {
          chain().deleteRange(range).toggleOrderedList().run()
        },
      }),
      // /hr + space → Horizontal Rule
      new InputRule({
        find: /^\/hr\s$/,
        handler: ({ range, chain }: { range: { from: number; to: number }; chain: () => any }) => {
          chain().deleteRange(range).setHorizontalRule().run()
        },
      }),
      // /callout + space → Callout block
      new InputRule({
        find: /^\/callout\s$/,
        handler: ({ range, chain }: { range: { from: number; to: number }; chain: () => any }) => {
          chain().deleteRange(range).insertContent({
            type: 'callout',
            attrs: { type: 'info', icon: '💡' },
            content: [{ type: 'paragraph' }],
          }).run()
        },
      }),
      // /pullquote + space → PullQuote block
      new InputRule({
        find: /^\/pullquote\s$/,
        handler: ({ range, chain }: { range: { from: number; to: number }; chain: () => any }) => {
          chain().deleteRange(range).insertContent({
            type: 'pullQuote',
            content: [{ type: 'paragraph' }],
          }).run()
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

      // Escape: Exit code block and move cursor to a new paragraph below
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
}

function ToolbarButton({ onClick, isActive, disabled, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
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
      Image.configure({
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
      SlashCommands,
      Bookmark,
      Callout,
      PullQuote,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert max-w-none p-6 min-h-[500px] focus:outline-none',
      },
    },
  })

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  const handleImageUpload = useCallback(async (file: File) => {
    if (!editor) return

    setIsUploading(true)
    try {
      const { url } = await api.uploadImage(file)
      editor.chain().focus().setImage({ src: url }).run()
    } catch (error) {
      console.error('Image upload failed:', error)
      alert(error instanceof Error ? error.message : '이미지 업로드에 실패했습니다.')
    } finally {
      setIsUploading(false)
    }
  }, [editor])

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
      alert('북마크 정보를 가져오는데 실패했습니다.')
    } finally {
      setIsLoadingBookmark(false)
    }
  }, [editor, linkUrl, closeLinkModal])

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
    <div className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 overflow-x-auto">
        {/* Headings */}
        <div className="flex items-center gap-1">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            isActive={editor.isActive('heading', { level: 1 })}
            title="Heading 1"
          >
            <span className="font-bold text-lg leading-none">H1</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            isActive={editor.isActive('heading', { level: 2 })}
            title="Heading 2"
          >
            <span className="font-bold text-base leading-none">H2</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
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

      {/* Editor Content */}
      <EditorContent editor={editor} />

      {/* Styles for the editor */}
      <style>{`
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
          font-size: 2rem;
          font-weight: 700;
          margin-top: 2rem;
          margin-bottom: 1rem;
        }
        .ProseMirror h2 {
          font-size: 1.5rem;
          font-weight: 700;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
        }
        .ProseMirror h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
        }
        .ProseMirror p {
          margin-bottom: 1rem;
        }
        .ProseMirror ul,
        .ProseMirror ol {
          padding-left: 1.5rem;
          margin-bottom: 1rem;
        }
        .ProseMirror ul {
          list-style-type: disc;
        }
        .ProseMirror ol {
          list-style-type: decimal;
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
      `}</style>
    </div>
  )
}

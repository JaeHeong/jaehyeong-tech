import { useEditor, EditorContent, NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Youtube from '@tiptap/extension-youtube'
import { Extension } from '@tiptap/core'
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
                <div>
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
                    onClick={applyLink}
                    className="px-4 py-2 text-sm font-bold text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
                  >
                    적용
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
          padding-left: 1rem;
          margin-left: 0;
          margin-right: 0;
          font-style: italic;
          color: #64748b;
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
      `}</style>
    </div>
  )
}

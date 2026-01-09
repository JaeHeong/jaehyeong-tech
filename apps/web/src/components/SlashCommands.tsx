import { Extension } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import Suggestion, { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion'
import tippy, { Instance as TippyInstance } from 'tippy.js'
import { SlashMenu, SlashMenuItem, SlashMenuRef } from './SlashMenu'

// Define all slash commands
export const slashMenuItems: SlashMenuItem[] = [
  // 기본 블록
  {
    title: '제목 1',
    description: '큰 제목',
    icon: 'title',
    category: '기본 블록',
    keywords: ['h1', 'heading', 'title', '제목'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run()
    },
  },
  {
    title: '제목 2',
    description: '중간 제목',
    icon: 'title',
    category: '기본 블록',
    keywords: ['h2', 'heading', 'subtitle', '제목'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run()
    },
  },
  {
    title: '제목 3',
    description: '작은 제목',
    icon: 'title',
    category: '기본 블록',
    keywords: ['h3', 'heading', '제목'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run()
    },
  },
  {
    title: '글머리 기호 목록',
    description: '순서 없는 목록',
    icon: 'format_list_bulleted',
    category: '기본 블록',
    keywords: ['ul', 'bullet', 'list', '목록'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run()
    },
  },
  {
    title: '번호 매기기 목록',
    description: '순서 있는 목록',
    icon: 'format_list_numbered',
    category: '기본 블록',
    keywords: ['ol', 'number', 'list', '목록'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run()
    },
  },
  {
    title: '인용구',
    description: '인용문 블록',
    icon: 'format_quote',
    category: '기본 블록',
    keywords: ['quote', 'blockquote', '인용'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('blockquote').run()
    },
  },
  {
    title: '구분선',
    description: '가로 구분선',
    icon: 'horizontal_rule',
    category: '기본 블록',
    keywords: ['hr', 'divider', 'horizontal', '구분'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run()
    },
  },

  // 코드 블록
  {
    title: '코드 블록',
    description: '코드 블록 (자동 감지)',
    icon: 'code_blocks',
    category: '코드',
    keywords: ['code', 'codeblock', '코드'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('codeBlock').run()
    },
  },
  {
    title: 'JavaScript',
    description: 'JavaScript 코드',
    icon: 'javascript',
    category: '코드',
    keywords: ['js', 'javascript', 'node'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('codeBlock', { language: 'javascript' }).run()
    },
  },
  {
    title: 'TypeScript',
    description: 'TypeScript 코드',
    icon: 'code',
    category: '코드',
    keywords: ['ts', 'typescript'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('codeBlock', { language: 'typescript' }).run()
    },
  },
  {
    title: 'Python',
    description: 'Python 코드',
    icon: 'code',
    category: '코드',
    keywords: ['py', 'python'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('codeBlock', { language: 'python' }).run()
    },
  },
  {
    title: 'Java',
    description: 'Java 코드',
    icon: 'code',
    category: '코드',
    keywords: ['java'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('codeBlock', { language: 'java' }).run()
    },
  },
  {
    title: 'Bash',
    description: 'Bash/Shell 스크립트',
    icon: 'terminal',
    category: '코드',
    keywords: ['bash', 'shell', 'sh', 'terminal', '터미널'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('codeBlock', { language: 'bash' }).run()
    },
  },
  {
    title: 'SQL',
    description: 'SQL 쿼리',
    icon: 'database',
    category: '코드',
    keywords: ['sql', 'database', 'query', '쿼리'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('codeBlock', { language: 'sql' }).run()
    },
  },
  {
    title: 'HTML',
    description: 'HTML 마크업',
    icon: 'html',
    category: '코드',
    keywords: ['html', 'markup'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('codeBlock', { language: 'html' }).run()
    },
  },
  {
    title: 'CSS',
    description: 'CSS 스타일',
    icon: 'css',
    category: '코드',
    keywords: ['css', 'style', '스타일'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('codeBlock', { language: 'css' }).run()
    },
  },
  {
    title: 'JSON',
    description: 'JSON 데이터',
    icon: 'data_object',
    category: '코드',
    keywords: ['json', 'data'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('codeBlock', { language: 'json' }).run()
    },
  },
  {
    title: 'YAML',
    description: 'YAML 설정',
    icon: 'settings',
    category: '코드',
    keywords: ['yaml', 'yml', 'config'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('codeBlock', { language: 'yaml' }).run()
    },
  },
  {
    title: 'Go',
    description: 'Go 코드',
    icon: 'code',
    category: '코드',
    keywords: ['go', 'golang'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('codeBlock', { language: 'go' }).run()
    },
  },
  {
    title: 'Rust',
    description: 'Rust 코드',
    icon: 'code',
    category: '코드',
    keywords: ['rust', 'rs'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('codeBlock', { language: 'rust' }).run()
    },
  },
  {
    title: 'C',
    description: 'C 코드',
    icon: 'code',
    category: '코드',
    keywords: ['c'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('codeBlock', { language: 'c' }).run()
    },
  },
  {
    title: 'C++',
    description: 'C++ 코드',
    icon: 'code',
    category: '코드',
    keywords: ['cpp', 'c++'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('codeBlock', { language: 'cpp' }).run()
    },
  },

  // 특수 블록
  {
    title: '콜아웃',
    description: '강조 박스 (정보, 경고 등)',
    icon: 'lightbulb',
    category: '특수 블록',
    keywords: ['callout', 'info', 'warning', 'alert', '콜아웃', '정보'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent({
        type: 'callout',
        attrs: { type: 'info', icon: '💡' },
        content: [{ type: 'paragraph' }],
      }).run()
    },
  },
  {
    title: '풀 인용구',
    description: '강조된 큰 인용문',
    icon: 'format_ink_highlighter',
    category: '특수 블록',
    keywords: ['pullquote', 'highlight', '인용'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent({
        type: 'pullQuote',
        content: [{ type: 'paragraph' }],
      }).run()
    },
  },
]

// Filter items based on query
const filterItems = (items: SlashMenuItem[], query: string): SlashMenuItem[] => {
  const lowerQuery = query.toLowerCase()
  return items.filter((item) => {
    const titleMatch = item.title.toLowerCase().includes(lowerQuery)
    const descMatch = item.description.toLowerCase().includes(lowerQuery)
    const keywordMatch = item.keywords?.some((keyword) =>
      keyword.toLowerCase().includes(lowerQuery)
    )
    return titleMatch || descMatch || keywordMatch
  })
}

// Create the extension
export const SlashCommandsExtension = Extension.create({
  name: 'slashCommands',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({ editor, range, props }: { editor: any; range: any; props: SlashMenuItem }) => {
          props.command({ editor, range })
        },
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        items: ({ query }: { query: string }) => filterItems(slashMenuItems, query),
        render: () => {
          let component: ReactRenderer<SlashMenuRef> | null = null
          let popup: TippyInstance[] | null = null

          return {
            onStart: (props: SuggestionProps<SlashMenuItem>) => {
              component = new ReactRenderer(SlashMenu, {
                props: {
                  items: props.items,
                  command: (item: SlashMenuItem) => {
                    props.command(item)
                  },
                },
                editor: props.editor,
              })

              if (!props.clientRect) {
                return
              }

              popup = tippy('body', {
                getReferenceClientRect: props.clientRect as () => DOMRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
                offset: [0, 4],
                animation: 'shift-toward-subtle',
                arrow: false,
                maxWidth: 'none',
              })
            },

            onUpdate: (props: SuggestionProps<SlashMenuItem>) => {
              component?.updateProps({
                items: props.items,
                command: (item: SlashMenuItem) => {
                  props.command(item)
                },
              })

              if (props.clientRect && popup?.[0]) {
                popup[0].setProps({
                  getReferenceClientRect: props.clientRect as () => DOMRect,
                })
              }
            },

            onKeyDown: (props: SuggestionKeyDownProps) => {
              if (props.event.key === 'Escape') {
                popup?.[0]?.hide()
                return true
              }

              return component?.ref?.onKeyDown(props) ?? false
            },

            onExit: () => {
              popup?.[0]?.destroy()
              component?.destroy()
            },
          }
        },
      }),
    ]
  },
})

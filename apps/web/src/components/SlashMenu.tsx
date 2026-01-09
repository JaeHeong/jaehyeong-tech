import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'

export interface SlashMenuItem {
  title: string
  description: string
  icon: string
  command: (props: { editor: any; range: any }) => void
  category: string
  keywords?: string[]
}

interface SlashMenuProps {
  items: SlashMenuItem[]
  command: (item: SlashMenuItem) => void
}

export interface SlashMenuRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

export const SlashMenu = forwardRef<SlashMenuRef, SlashMenuProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0)
    const menuRef = useRef<HTMLDivElement>(null)
    const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

    // Group items by category
    const groupedItems = items.reduce<Record<string, SlashMenuItem[]>>((acc, item) => {
      const category = item.category
      if (!acc[category]) {
        acc[category] = []
      }
      acc[category]!.push(item)
      return acc
    }, {})

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index]
        if (item) {
          command(item)
        }
      },
      [items, command]
    )

    const upHandler = useCallback(() => {
      setSelectedIndex((prevIndex) => (prevIndex + items.length - 1) % items.length)
    }, [items.length])

    const downHandler = useCallback(() => {
      setSelectedIndex((prevIndex) => (prevIndex + 1) % items.length)
    }, [items.length])

    const enterHandler = useCallback(() => {
      selectItem(selectedIndex)
    }, [selectItem, selectedIndex])

    useEffect(() => {
      setSelectedIndex(0)
    }, [items])

    // Scroll selected item into view
    useEffect(() => {
      const selectedItem = itemRefs.current[selectedIndex]
      if (selectedItem && menuRef.current) {
        selectedItem.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        })
      }
    }, [selectedIndex])

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === 'ArrowUp') {
          upHandler()
          return true
        }

        if (event.key === 'ArrowDown') {
          downHandler()
          return true
        }

        if (event.key === 'Enter') {
          enterHandler()
          return true
        }

        if (event.key === 'Tab') {
          // Tab cycles through items
          if (event.shiftKey) {
            upHandler()
          } else {
            downHandler()
          }
          return true
        }

        return false
      },
    }))

    if (items.length === 0) {
      return (
        <div className="slash-menu-empty">
          <span className="material-symbols-outlined text-slate-400">search_off</span>
          <p>검색 결과 없음</p>
        </div>
      )
    }

    let currentIndex = 0

    return (
      <div ref={menuRef} className="slash-menu">
        {Object.entries(groupedItems).map(([category, categoryItems]) => (
          <div key={category} className="slash-menu-category">
            <div className="slash-menu-category-title">{category}</div>
            {categoryItems.map((item) => {
              const itemIndex = currentIndex++
              return (
                <button
                  key={item.title}
                  ref={(el) => { itemRefs.current[itemIndex] = el }}
                  type="button"
                  className={`slash-menu-item ${selectedIndex === itemIndex ? 'is-selected' : ''}`}
                  onClick={() => selectItem(itemIndex)}
                  onMouseEnter={() => setSelectedIndex(itemIndex)}
                >
                  <span className="slash-menu-item-icon material-symbols-outlined">
                    {item.icon}
                  </span>
                  <div className="slash-menu-item-content">
                    <span className="slash-menu-item-title">{item.title}</span>
                    <span className="slash-menu-item-description">{item.description}</span>
                  </div>
                </button>
              )
            })}
          </div>
        ))}
      </div>
    )
  }
)

SlashMenu.displayName = 'SlashMenu'

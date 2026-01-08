import { useState, useRef, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface MenuItem {
  path: string
  icon: string
  label: string
  exact?: boolean
  isLogout?: boolean
}

const menuItems: MenuItem[] = [
  { path: '/admin', icon: 'dashboard', label: '대시보드', exact: true },
  { path: '/admin/analytics', icon: 'analytics', label: '보고서' },
  { path: '/admin/posts', icon: 'article', label: '게시물' },
  { path: '/admin/categories', icon: 'category', label: '카테고리' },
  { path: '/admin/tags', icon: 'sell', label: '태그' },
  { path: '/admin/pages', icon: 'description', label: '페이지' },
  { path: '/admin/drafts', icon: 'edit_note', label: '임시저장' },
  { path: '/admin/comments', icon: 'chat', label: '댓글' },
  { path: '/admin/management', icon: 'storage', label: '시스템' },
  { path: '/admin/settings', icon: 'settings', label: '설정' },
  { path: '#logout', icon: 'logout', label: '로그아웃', isLogout: true },
]

const ITEM_COUNT = menuItems.length
const ANGLE_PER_ITEM = 360 / ITEM_COUNT
const PRIMARY_COLOR = '#3182f6'

export default function RadialWheelMenu() {
  const location = useLocation()
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const dragStartRef = useRef<{ y: number; rotation: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const isActive = (path: string, exact?: boolean) => {
    if (exact) return location.pathname === path
    return location.pathname.startsWith(path)
  }

  // 메뉴 열릴 때 힌트 표시 후 사라지기
  useEffect(() => {
    if (isOpen) {
      setShowHint(true)
      const timer = setTimeout(() => setShowHint(false), 2000)
      return () => clearTimeout(timer)
    } else {
      setShowHint(false)
    }
  }, [isOpen])

  // 바깥 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (isOpen && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [isOpen])

  // 드래그 핸들러들
  const handleDragStart = useCallback((clientY: number) => {
    setIsDragging(true)
    dragStartRef.current = { y: clientY, rotation }
  }, [rotation])

  const handleDragMove = useCallback((clientY: number) => {
    if (!dragStartRef.current) return
    const deltaY = clientY - dragStartRef.current.y
    const newRotation = dragStartRef.current.rotation + deltaY * 0.5
    setRotation(newRotation)
  }, [])

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
    dragStartRef.current = null
  }, [])

  // 전역 마우스/터치 이벤트
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (isDragging) handleDragMove(e.clientY)
    }
    const onMouseUp = () => {
      if (isDragging) handleDragEnd()
    }
    const onTouchMove = (e: TouchEvent) => {
      if (isDragging && e.touches[0]) handleDragMove(e.touches[0].clientY)
    }
    const onTouchEnd = () => {
      if (isDragging) handleDragEnd()
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('touchmove', onTouchMove)
    window.addEventListener('touchend', onTouchEnd)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [isDragging, handleDragMove, handleDragEnd])

  // 배경 원 드래그 시작 (마우스)
  const handleWheelMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    handleDragStart(e.clientY)
  }

  // 배경 원 드래그 시작 (터치)
  const handleWheelTouchStart = (e: React.TouchEvent) => {
    e.preventDefault()
    const touch = e.touches[0]
    if (touch) handleDragStart(touch.clientY)
  }

  // 버튼 클릭 핸들러
  const handleButtonClick = () => {
    setIsOpen(!isOpen)
  }

  // 메뉴 아이템 클릭 핸들러
  const handleMenuItemClick = (item: MenuItem) => {
    if (item.isLogout) {
      logout()
    } else {
      navigate(item.path)
    }
    setIsOpen(false)
  }

  const menuRadius = 110

  return (
    <div
      ref={menuRef}
      className="fixed left-0 top-1/2 -translate-y-1/2 z-50 lg:hidden"
    >
      {/* 뒤쪽 메뉴 원 (날개) */}
      <div
        className={`absolute top-1/2 -translate-y-1/2 transition-all duration-500 ease-out ${
          isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-50 pointer-events-none'
        }`}
        style={{
          left: '-110px',
          width: '220px',
          height: '220px',
        }}
      >
        {/* 드래그 영역 (배경 원) */}
        <div
          className="absolute inset-0 rounded-full backdrop-blur-md border-2 shadow-2xl cursor-grab active:cursor-grabbing"
          style={{
            background: 'rgba(15, 23, 42, 0.95)',
            borderColor: 'rgba(51, 65, 85, 0.5)',
            boxShadow: `0 0 40px rgba(0,0,0,0.3), inset 0 0 30px rgba(255,255,255,0.05), 0 0 60px ${PRIMARY_COLOR}20`,
            touchAction: 'none',
          }}
          onMouseDown={handleWheelMouseDown}
          onTouchStart={handleWheelTouchStart}
        />

        {/* 메뉴 아이템들 (클릭 영역) */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          {menuItems.map((item, index) => {
            const angle = (index * ANGLE_PER_ITEM - 90) * (Math.PI / 180)
            const x = Math.cos(angle) * menuRadius + 110
            const y = Math.sin(angle) * menuRadius + 110
            const active = !item.isLogout && isActive(item.path, item.exact)

            return (
              <button
                key={item.path}
                type="button"
                onClick={() => handleMenuItemClick(item)}
                className="menu-item absolute flex flex-col items-center justify-center pointer-events-auto"
                style={{
                  left: `${x}px`,
                  top: `${y}px`,
                  transform: `translate(-50%, -50%) rotate(${-rotation}deg)`,
                  width: '56px',
                  height: '56px',
                }}
              >
                <div
                  className="flex flex-col items-center justify-center rounded-full p-1.5 transition-all active:scale-95"
                  style={{
                    width: '48px',
                    height: '48px',
                    background: active
                      ? PRIMARY_COLOR
                      : item.isLogout
                        ? 'rgba(239, 68, 68, 0.2)'
                        : 'rgba(51, 65, 85, 0.5)',
                    color: active
                      ? '#ffffff'
                      : item.isLogout
                        ? '#f87171'
                        : '#cbd5e1',
                    transform: active ? 'scale(1.1)' : 'scale(1)',
                    boxShadow: active ? `0 0 20px ${PRIMARY_COLOR}60` : 'none',
                  }}
                >
                  <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                  <span className="text-[8px] font-medium mt-0.5 leading-none">{item.label}</span>
                </div>
              </button>
            )
          })}
        </div>

        {/* 중앙 장식 링 */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full pointer-events-none"
          style={{
            border: `2px solid rgba(51, 65, 85, 0.3)`,
            background: `radial-gradient(circle, ${PRIMARY_COLOR}15 0%, transparent 70%)`,
          }}
        />
      </div>

      {/* 앞쪽 버튼 (항상 보임) */}
      <button
        type="button"
        onClick={handleButtonClick}
        className="relative flex items-center justify-center rounded-full shadow-lg transition-all duration-300"
        style={{
          width: isOpen ? '56px' : '48px',
          height: isOpen ? '56px' : '48px',
          left: isOpen ? '-28px' : '-24px',
          background: isOpen ? PRIMARY_COLOR : 'rgba(30, 41, 59, 0.9)',
          color: '#ffffff',
          boxShadow: isOpen
            ? `0 4px 20px ${PRIMARY_COLOR}60, inset 0 0 10px rgba(255,255,255,0.1)`
            : '0 4px 15px rgba(0,0,0,0.3)',
        }}
      >
        <span
          className="material-symbols-outlined transition-transform duration-300"
          style={{
            fontSize: isOpen ? '24px' : '20px',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          {isOpen ? 'close' : 'menu'}
        </span>
      </button>

      {/* 드래그 힌트 (2초 후 사라짐) */}
      <div
        className={`absolute left-20 top-1/2 -translate-y-1/2 text-xs whitespace-nowrap pointer-events-none transition-opacity duration-500 ${
          showHint ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ color: '#94a3b8' }}
      >
        ↕ 드래그로 회전
      </div>
    </div>
  )
}

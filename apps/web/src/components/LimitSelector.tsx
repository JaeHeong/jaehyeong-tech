interface LimitSelectorProps {
  defaultLimit: number
  isAll: boolean
  onToggle: () => void
  className?: string
}

export default function LimitSelector({
  defaultLimit,
  isAll,
  onToggle,
  className = '',
}: LimitSelectorProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400">
        표시: {defaultLimit}
      </span>
      <button
        type="button"
        onClick={onToggle}
        className={`text-[10px] md:text-xs px-2 py-1 rounded-md font-medium transition-colors ${
          isAll
            ? 'bg-primary text-white'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
        }`}
      >
        ALL
      </button>
    </div>
  )
}

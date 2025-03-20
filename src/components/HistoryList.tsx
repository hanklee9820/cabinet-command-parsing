interface HistoryItemProps {
  command: string
  timestamp: string
  onRetry: () => void
}

const HistoryItem = ({ command, timestamp, onRetry }: HistoryItemProps) => (
  <div className="p-4 bg-[#1E293B]/30 hover:bg-[#1E293B]/50 transition-all rounded-lg">
    <div className="flex items-center justify-between">
      <div className="space-y-1">
        <p className="text-[#E2E8F0] font-mono text-sm">{command}</p>
        <p className="text-[#64748B] text-xs">{timestamp}</p>
      </div>
      <button
        onClick={onRetry}
        className="px-3 py-1 text-sm text-[#7C3AED] hover:text-[#6D28D9] 
                   hover:bg-[#7C3AED]/10 rounded-lg transition-colors"
      >
        重试
      </button>
    </div>
  </div>
)

interface HistoryListProps {
  items: Array<{
    command: string
    timestamp: string
  }>
  onRetry: (command: string) => void
}

export const HistoryList = ({ items, onRetry }: HistoryListProps) => {
  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-[#94A3B8]">
        暂无历史记录
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <HistoryItem
          key={index}
          command={item.command}
          timestamp={item.timestamp}
          onRetry={() => onRetry(item.command)}
        />
      ))}
    </div>
  )
} 
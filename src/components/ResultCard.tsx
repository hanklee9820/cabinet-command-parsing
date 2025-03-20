interface ResultItemProps {
  label: string
  value: string | number
}

const ResultItem = ({ label, value }: ResultItemProps) => (
  <div className="flex justify-between items-center py-2">
    <span className="text-[#94A3B8]">{label}</span>
    <span className="text-[#E2E8F0] font-medium">{value}</span>
  </div>
)

interface ResultCardProps {
  commandType: string
  operation: string
  details: string
  isValid: boolean
  isResponse?: boolean
  status?: number
}

export const ResultCard = ({ commandType, operation, details, isValid, isResponse, status }: ResultCardProps) => {
  return (
    <div className="p-6 bg-gradient-to-br from-[#1E293B] to-[#0F172A] rounded-xl shadow-lg border border-white/10">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-[#E2E8F0]">
            {isResponse ? '返回数据解析' : '指令解析'}
          </h3>
          <span className={`px-3 py-1 rounded-full text-sm ${
            isValid 
              ? 'bg-green-500/20 text-green-400' 
              : 'bg-red-500/20 text-red-400'
          }`}>
            {isValid ? '校验通过' : '校验失败'}
          </span>
        </div>
        
        <div className="space-y-2">
          <ResultItem label="类型" value={commandType} />
          <ResultItem label="操作" value={operation} />
          <ResultItem label="说明" value={details} />
          {isResponse && status !== undefined && (
            <ResultItem 
              label="门锁状态" 
              value={status === 1 ? '开启' : '关闭'} 
            />
          )}
        </div>
      </div>
    </div>
  )
} 
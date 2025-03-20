import { useState } from 'react'

interface CommandInputProps {
  onParse: (command: string) => void
}

export const CommandInput = ({ onParse }: CommandInputProps) => {
  const [command, setCommand] = useState('')

  const handleParse = () => {
    if (command.trim()) {
      onParse(command.trim())
    }
  }

  return (
    <div className="w-full space-y-4">
      <div className="relative">
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="输入十六进制指令，例如：F3 00 08 11 11 01 00 00 00 01 08"
          className="w-full px-4 py-3 bg-[#1E293B]/50 backdrop-blur-lg rounded-xl border border-white/10 
                     text-[#E2E8F0] placeholder-[#64748B] focus:outline-none focus:ring-2 
                     focus:ring-[#7C3AED]/50 transition-all"
        />
        <button
          onClick={handleParse}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-[#7C3AED] 
                     text-white rounded-lg hover:bg-[#6D28D9] transition-colors
                     focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/50"
        >
          解析
        </button>
      </div>
      <p className="text-sm text-[#94A3B8]">
        支持空格分隔或连续输入的十六进制指令
      </p>
    </div>
  )
} 
import { useState } from 'react'
import { CommandInput } from './components/CommandInput'
import { ResultCard } from './components/ResultCard'
import { HistoryList } from './components/HistoryList'
import './App.css'

interface CommandHistory {
  command: string
  timestamp: string
}

interface ParseResult {
  commandType: string
  operation: string
  details: string
  isValid: boolean
  isResponse?: boolean  // 是否是返回数据
  status?: number      // 门锁状态
}

// 将十六进制字符串转换为字节数组
function hexStringToBytes(hex: string): number[] {
  const bytes: number[] = []
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16))
  }
  return bytes
}

// 计算门锁指令的LRC校验码（使用异或运算）
function calculateDoorLRC(data: number[]): number {
  // 排除包头F3，从第二个字节开始计算
  const dataWithoutHeader = data.slice(1)
  let xor = 0
  for (const b of dataWithoutHeader) {
    xor = xor ^ (b & 0xFF)
  }
  // 确保结果是一个字节（0-255）
  return xor & 0xFF
}

function App() {
  const [result, setResult] = useState<ParseResult | null>(null)
  const [history, setHistory] = useState<CommandHistory[]>([])

  const parseCommand = (command: string) => {
    // 移除所有空格并转换为大写
    const cleanCommand = command.replace(/\s+/g, '').toUpperCase()
    
    // 简单的指令解析逻辑（示例）
    let commandType = '未知'
    let operation = '未知'
    let details = '无法解析的指令'
    let isValid = false

    // 检查是否是门锁指令
    if (cleanCommand.startsWith('F3')) {
      commandType = '门锁控制'
      
      const bytes = hexStringToBytes(cleanCommand)
      const data = bytes.slice(0, -1)
      const receivedLRC = bytes[bytes.length - 1]
      const calculatedLRC = calculateDoorLRC(data)
      isValid = calculatedLRC === receivedLRC

      // 判断是发送指令还是返回数据
      const isResponse = bytes[1] === 0x00 && bytes[2] === 0x09
      
      if (isResponse) {
        // 解析返回数据
        if (bytes[3] === 0x11 && bytes[4] === 0x11) {
          operation = '开门返回'
          const lockNumber = bytes[7]
          const lockStatus = bytes[10]  // 新增：获取门锁状态
          
          if (lockNumber >= 1 && lockNumber <= 80) {
            details = `${lockNumber}号门锁 - ${lockStatus === 1 ? '已打开' : '已关闭'}`
          } else {
            details = `无效的门锁编号：${lockNumber}`
            isValid = false
          }
          
          // 验证返回数据格式
          if (bytes[5] !== 0x01 || bytes[6] !== 0x00 || bytes[8] !== 0x00 || bytes[9] !== 0x01) {
            details = '返回数据格式错误'
            isValid = false
          }
          
          // 保存门锁状态
          const newResult: ParseResult = {
            commandType,
            operation,
            details,
            isValid,
            isResponse: true,
            status: lockStatus
          }

          setResult(newResult)
          
          // 添加到历史记录
          setHistory(prev => [{
            command,
            timestamp: new Date().toLocaleString()
          }, ...prev].slice(0, 10))
        } else if (bytes[3] === 0x11 && bytes[4] === 0x10) {
          operation = '查询状态返回'
          const lockNumber = bytes[7]
          const lockStatus = bytes[10]
          
          if (lockNumber >= 1 && lockNumber <= 80) {
            details = `${lockNumber}号门锁状态：${lockStatus === 1 ? '开启' : '关闭'}`
          } else {
            details = `无效的门锁编号：${lockNumber}`
            isValid = false
          }
          
          // 验证返回数据格式
          if (bytes[5] !== 0x01 || bytes[6] !== 0x00 || bytes[8] !== 0x00 || bytes[9] !== 0x01) {
            details = '返回数据格式错误'
            isValid = false
          }
          
          // 保存门锁状态
          const newResult: ParseResult = {
            commandType,
            operation,
            details,
            isValid,
            isResponse: true,
            status: lockStatus
          }

          setResult(newResult)
          
          // 添加到历史记录
          setHistory(prev => [{
            command,
            timestamp: new Date().toLocaleString()
          }, ...prev].slice(0, 10))
        }
      } else {
        // 原有的发送指令解析逻辑保持不变
        if (cleanCommand.includes('1111')) {
          commandType = '门锁控制'
          
          // 将指令转换为字节数组
          const bytes = hexStringToBytes(cleanCommand)
          
          // 解析指令内容
          // 0xF3: 包头(1字节)
          // 0x0008: 长度(2字节)
          // 0x1111: 命令码(2字节)
          // 0x01: 地址编码(1字节)
          // 0x0000: 返回码(2字节)
          // 0x00: 序列号(1字节)
          // 0x01: 固定值(1字节)
          // LRC: 校验码(1字节)
          operation = '开门'
          const lockNumber = bytes[5]  // 修正：使用第6个字节作为门锁编号
          if (lockNumber >= 1 && lockNumber <= 80) {
            details = `打开${lockNumber}号门锁`
          } else {
            details = `无效的门锁编号：${lockNumber}（有效范围：1-80）`
            isValid = false
          }
        } else if (cleanCommand.includes('1110')) {
          commandType = '门锁控制'
          
          // 将指令转换为字节数组
          const bytes = hexStringToBytes(cleanCommand)
          
          // 解析指令内容
          // 0xF3: 包头(1字节)
          // 0x0008: 长度(2字节)
          // 0x1110: 命令码(2字节)
          // 0x01: 地址编码(1字节)
          // 0x0000: 返回码(2字节)
          // 0x00: 序列号(1字节)
          // 0x01: 固定值(1字节)
          // LRC: 校验码(1字节)
          operation = '查询状态'
          const lockNumber = bytes[5]  // 修正：使用第6个字节作为门锁编号
          if (lockNumber >= 1 && lockNumber <= 80) {
            details = `查询${lockNumber}号门锁状态`
          } else {
            details = `无效的门锁编号：${lockNumber}（有效范围：1-80）`
            isValid = false
          }
        }

        // 验证指令长度
        if (bytes[1] !== 0x00 || bytes[2] !== 0x08) {
          details = '指令长度错误'
          isValid = false
        }

        // 验证地址编码
        if (bytes[3] !== 0x11 || bytes[4] !== (cleanCommand.includes('1111') ? 0x11 : 0x10)) {
          details = '命令码错误'
          isValid = false
        }

        // 验证返回码和序列号
        if (bytes[6] !== 0x00 || bytes[7] !== 0x00 || bytes[8] !== 0x00) {
          details = '返回码或序列号错误'
          isValid = false
        }

        // 验证固定值
        if (bytes[9] !== 0x01) {
          details = '固定值错误'
          isValid = false
        }

        const newResult: ParseResult = {
          commandType,
          operation,
          details,
          isValid,
          isResponse: false  // 默认为发送指令
        }

        setResult(newResult)
        
        // 添加到历史记录
        setHistory(prev => [{
          command,
          timestamp: new Date().toLocaleString()
        }, ...prev].slice(0, 10))
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#0F172A] text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="text-center">
          <h1 className="text-3xl font-bold text-[#E2E8F0] mb-2">
            智能医疗耗材柜指令解析工具
          </h1>
          <p className="text-[#94A3B8]">
            输入十六进制指令，快速解析指令含义并验证
          </p>
        </header>

        <main className="space-y-8">
          <section>
            <CommandInput onParse={parseCommand} />
          </section>

          {result && (
            <section>
              <ResultCard {...result} />
            </section>
          )}

          <section>
            <h2 className="text-xl font-semibold text-[#E2E8F0] mb-4">
              历史记录
            </h2>
            <HistoryList
              items={history}
              onRetry={parseCommand}
            />
          </section>
        </main>
      </div>
    </div>
  )
}

export default App

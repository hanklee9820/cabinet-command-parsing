import { useState } from 'react'
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
  // 移除所有空格
  hex = hex.replace(/\s+/g, '');
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

// 解析指令
function parseCommand(command: string): ParseResult | null {
  // 清理输入，移除空格
  const cleanCommand = command.replace(/\s+/g, '');
  
  // 确保有足够长度
  if (cleanCommand.length < 10) {
    return null;
  }
  
  // 将字符串转换为字节数组
  const bytes = hexStringToBytes(command);
  
  // 检查包头
  if (bytes[0] !== 0xF3) {
    return null;
  }
  
  // 提取关键字段
  const length = (bytes[1] << 8) | bytes[2];
  const commandCode = (bytes[3] << 8) | bytes[4];
  const address = bytes[5];
  const lockNumber = bytes[8];
  
  // 检查是否是响应
  const isResponse = length === 0x0009;
  
  // 获取命令类型
  let commandType = '';
  let operation = '';
  
  if (commandCode === 0x1111) {
    commandType = '0x1111';
    operation = '开门操作';
  } else if (commandCode === 0x1110) {
    commandType = '0x1110';
    operation = '查询状态';
  } else {
    return null;
  }
  
  // 获取状态（如果是响应）
  const status = isResponse ? bytes[9] : undefined;
  
  // 验证校验码
  const calculatedLRC = calculateDoorLRC(bytes.slice(0, -1));
  const isValid = calculatedLRC === bytes[bytes.length - 1];
  
  return {
    commandType,
    operation,
    details: `${address}号柜 ${lockNumber}号锁`,
    isValid,
    isResponse,
    status
  };
}

function App() {
  const [command, setCommand] = useState<string>('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [history, setHistory] = useState<CommandHistory[]>([]);

  const handleParseCommand = () => {
    if (!command) return;
    
    const result = parseCommand(command);
    setParseResult(result);
    
    // 添加到历史记录
    const newHistory: CommandHistory = {
      command,
      timestamp: new Date().toLocaleTimeString()
    };
    setHistory([newHistory, ...history].slice(0, 10));
  };
  
  return (
    <div className="bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 min-h-screen">
      {/* 主工作区 */}
      <main className="container mx-auto p-4 space-y-6">
        {/* 标题区 */}
        <header className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            智能医疗柜协议解析台
          </h1>
          <p className="text-gray-400">Version 2.3 Protocol Analyzer</p>
        </header>

        {/* 指令解析工作区 - 宽屏两列布局 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 指令输入区 */}
          <section className="glass-morphism rounded-2xl p-6 neon-border">
            <h2 className="text-xl font-semibold text-blue-400 mb-4">原始指令输入</h2>
            <div className="space-y-4">
              <textarea 
                className="w-full h-32 bg-gray-800/40 rounded-lg p-4 text-blue-400 font-mono 
                           focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-500"
                placeholder="输入或粘贴指令（示例：F3 00 08 11 11 01 00 00 00 01 08）"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
              />
              <button 
                className="w-full py-3 bg-blue-600/40 hover:bg-blue-700/50 rounded-lg transition-colors text-white"
                onClick={handleParseCommand}
              >
                解析指令
              </button>
            </div>
          </section>

          {/* 解析结果展示 */}
          <section className="glass-morphism rounded-2xl p-6 neon-border">
            <h2 className="text-xl font-semibold text-purple-400 mb-4">协议解析结果</h2>
            {parseResult ? (
              <div className="space-y-6">
                {/* 字段解析 */}
                <div className="bg-gray-800/20 rounded-xl p-4">
                  <h3 className="text-sm text-gray-400 mb-3">字段解析</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {/* 发送指令解析示例 */}
                    <div className="text-gray-300">包头</div>
                    <div className="font-mono text-blue-400">0xF3</div>
                    
                    <div className="text-gray-300">长度</div>
                    <div className="font-mono">
                      {parseResult.isResponse ? '0x0009' : '0x0008'} 
                      <span className="text-gray-400 ml-2">
                        ({parseResult.isResponse ? '9' : '8'} bytes)
                      </span>
                    </div>
                    
                    <div className="text-gray-300">命令码</div>
                    <div className="font-mono text-purple-400">
                      {parseResult.commandType} 
                      <span className="text-gray-400 ml-2">({parseResult.operation})</span>
                    </div>
                    
                    <div className="text-gray-300">地址编码</div>
                    <div className="font-mono">
                      0x{parseResult.details.split(' ')[0].replace('号柜', '')} 
                      <span className="text-gray-400 ml-2">({parseResult.details.split(' ')[0]})</span>
                    </div>
                    
                    <div className="text-gray-300">锁编号</div>
                    <div className="font-mono text-green-400">
                      0x{parseResult.details.split(' ')[1].replace('号锁', '')} 
                      <span className="text-gray-400 ml-2">({parseResult.details.split(' ')[1]})</span>
                    </div>
                    
                    <div className="text-gray-300">校验码</div>
                    <div className="font-mono">
                      0x{hexStringToBytes(command)[hexStringToBytes(command).length - 1].toString(16).padStart(2, '0')} 
                      <span className={`ml-2 ${parseResult.isValid ? 'text-green-400' : 'text-red-400'}`}>
                        (LRC校验{parseResult.isValid ? '通过' : '失败'})
                      </span>
                    </div>
                  </div>
                </div>

                {/* 状态结果 */}
                {parseResult.isResponse && (
                  <div className={`${parseResult.status === 1 ? 'bg-green-900/20 border-green-500/30' : 'bg-red-900/20 border-red-500/30'} rounded-xl p-4 border`}>
                    <div className="flex items-center space-x-3">
                      {parseResult.status === 1 ? (
                        <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                      ) : (
                        <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                      )}
                      <div>
                        <h3 className={`font-medium ${parseResult.status === 1 ? 'text-green-400' : 'text-red-400'}`}>
                          {parseResult.status === 1 ? '操作成功' : '操作失败'}
                        </h3>
                        <p className="text-sm text-gray-400 mt-1">
                          {parseResult.details} {parseResult.status === 1 ? '已开启' : '未开启'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 返回指令解析示例 */}
                {parseResult.isResponse && (
                  <div className="bg-gray-800/20 rounded-xl p-4">
                    <h3 className="text-sm text-gray-400 mb-3">返回数据解析</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="text-gray-300">状态码</div>
                      <div className="font-mono">
                        0x{parseResult.status?.toString(16).padStart(2, '0')} 
                        <span className={`ml-2 ${parseResult.status === 1 ? 'text-green-400' : 'text-red-400'}`}>
                          ({parseResult.status === 1 ? '已开启' : '未开启'})
                        </span>
                      </div>
                      
                      <div className="text-gray-300">数据长度</div>
                      <div className="font-mono">0x0009 <span className="text-gray-400 ml-2">(9 bytes)</span></div>
                      
                      <div className="text-gray-300">校验结果</div>
                      <div className="font-mono">
                        0x{hexStringToBytes(command)[hexStringToBytes(command).length - 1].toString(16).padStart(2, '0')} 
                        <span className={`ml-2 ${parseResult.isValid ? 'text-green-400' : 'text-red-400'}`}>
                          (LRC校验{parseResult.isValid ? '通过' : '失败'})
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // 没有解析结果时显示空状态提示
              <div className="h-64 flex items-center justify-center text-gray-500">
                <p>请输入指令并点击解析按钮</p>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}

export default App

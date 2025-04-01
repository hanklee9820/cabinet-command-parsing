/**
 * 智能医疗耗材柜指令解析器
 * 支持门锁控制器和重力传感器指令解析
 */

class ProtocolParser {
  /**
   * 解析指令
   * @param {string} hexString - 16进制字符串，格式如："F3 00 08 11 11 01 00 00 00 01 08"
   * @returns {Object} 解析结果
   */
  parse(hexString) {
    // 移除所有空格并转换为字节数组
    const hexValues = hexString.replace(/\s+/g, '').match(/.{1,2}/g);
    
    if (!hexValues || hexValues.length < 3) {
      return { success: false, message: "指令格式错误或长度不足" };
    }
    
    // 将16进制字符串转换为数值数组
    const bytes = hexValues.map(hex => parseInt(hex, 16));
    
    // 调试输出转换后的字节数组
    console.log("原始16进制字符串:", hexString);
    console.log("解析后的字节数组:", bytes.map(b => "0x" + b.toString(16).padStart(2, '0')));
    
    // 根据包头判断指令类型
    const header = bytes[0];
    
    // 门锁控制器指令以0xF3开头
    if (header === 0xF3) {
      return this.parseDoorCommand(bytes);
    } 
    // 重力传感器指令的第一个字节是地址（0x00-0xFF），第二个字节是功能码
    else if (bytes.length >= 2 && 
      (bytes[1] === 0x05 || // 读数据功能码
       bytes[1] === 0x06 || // 读数据返回功能码
       bytes[1] === 0x63 || // 写数据功能码
       bytes[1] === 0x64)   // 写数据返回功能码
    ) {
      return this.parseWeightCommand(bytes);
    } else {
      return { 
        success: false, 
        message: "未知的指令类型，包头: 0x" + header.toString(16).padStart(2, '0')
      };
    }
  }
  
  /**
   * 解析门锁控制器指令
   */
  parseDoorCommand(bytes) {
    // 打印输入的字节数组（16进制形式）
    console.log("解析门锁指令的原始字节:", bytes.map(b => "0x" + b.toString(16).padStart(2, '0')));
    
    // 校验LRC（使用字节级别校验，排除第一位和校验位）
    // 传入整个数组，在calculateDoorLRC中会排除第一位
    const calculatedLRC = this.calculateDoorLRC(bytes.slice(0, -1));
    const receivedLRC = bytes[bytes.length - 1];
    
    console.log(`校验结果: 计算值=0x${calculatedLRC.toString(16)}, 接收值=0x${receivedLRC.toString(16)}`);
    
    if (calculatedLRC !== receivedLRC) {
      return {
        success: false,
        message: "LRC校验失败",
        details: {
          calculated: calculatedLRC,
          received: receivedLRC
        }
      };
    }
    
    // 解析长度
    const length = (bytes[1] << 8) | bytes[2];
    
    // 解析命令码
    const commandCode = (bytes[3] << 8) | bytes[4];
    let commandName = "";
    
    if (commandCode === 0x1111) {
      commandName = "开门操作";
    } else if (commandCode === 0x1110) {
      commandName = "查询锁状态";
    }
    
    // 解析地址编码
    const address = bytes[5];
    
    // 解析返回码
    const returnCode = (bytes[6] << 8) | bytes[7];
    
    // 解析序列号
    const sequence = bytes[8];
    
    // 解析锁编号
    const lockNumber = bytes[9];
    
    // 判断是否为返回数据（通过长度判断）
    const isResponse = length === 9;
    
    // 创建基本详情对象
    const details = {
      header: "0x" + bytes[0].toString(16).padStart(2, '0'),
      length: "0x" + length.toString(16).padStart(4, '0') + ` (${length} bytes)`,
      commandCode: "0x" + commandCode.toString(16).padStart(4, '0') + ` (${commandName})`,
      address: "0x" + address.toString(16).padStart(2, '0') + ` (${address}号柜)`,
      returnCode: "0x" + returnCode.toString(16).padStart(4, '0'),
      sequence: "0x" + sequence.toString(16).padStart(2, '0'),
      lockNumber: "0x" + lockNumber.toString(16).padStart(2, '0') + ` (${lockNumber}号锁)`,
      lrc: "0x" + receivedLRC.toString(16).padStart(2, '0') + " (LRC校验通过)"
    };
    
    // 只在响应数据中添加状态字段
    if (isResponse) {
      // 倒数第二位是状态码（1表示开启，0表示关闭）
      const status = bytes[10];
      console.log(`状态码: 0x${status.toString(16)} (${status === 1 ? "开启" : "关闭"})`);
      details.status = "0x" + status.toString(16).padStart(2, '0') + ` (${status === 1 ? "已开启" : "已关闭"})`;
    }
    
    return {
      success: true,
      type: "门锁控制器",
      isResponse,
      command: {
        code: "0x" + commandCode.toString(16).padStart(4, '0'),
        name: commandName
      },
      details: details,
      rawBytes: bytes.map(b => "0x" + b.toString(16).padStart(2, '0'))
    };
  }
  
  /**
   * 解析重力传感器指令
   */
  parseWeightCommand(bytes) {
    // 打印输入的字节数组（16进制形式）
    console.log("解析重量指令的原始字节:", bytes.map(b => "0x" + b.toString(16).padStart(2, '0')));
    
    // 如果是返回数据（长度大于9且第二个字节是0x06）
    if (bytes.length >= 9 && bytes[1] === 0x06) {
      // 如果是单个返回数据
      if (bytes.length === 9) {
        const address = bytes[0];
        const statusByte = bytes[3];
        const x4Byte = bytes[4];
        const x3x2x1 = (bytes[5] << 16) | (bytes[6] << 8) | bytes[7];
        const receivedLRC = bytes[8];
        const calculatedLRC = this.calculateWeightLRC(bytes.slice(0, -1));
        
        // 计算重量
        const isPositive = (x4Byte & 0x80) === 0;
        const divisionCode = x4Byte & 0x0F;
        const divisionValue = this.getDivisionValue(divisionCode);
        const divisionCount = x3x2x1;
        const weight = divisionCount * divisionValue * (isPositive ? 1 : -1);
        
        // 解析状态字节
        const statusInfo = this.parseStatusByte(statusByte);
        
        return {
          success: true,
          type: "重力传感器",
          isResponse: true,
          command: {
            name: "读传感器重量"
          },
          details: {
            address: "0x" + address.toString(16).padStart(2, '0') + ` (${address}号传感器)`,
            weight: weight.toFixed(1),
            lrcStatus: calculatedLRC === receivedLRC ? "校验通过" : "校验失败",
            statusByte: "0x" + statusByte.toString(16).padStart(2, '0'),
            x4Byte: "0x" + x4Byte.toString(16).padStart(2, '0'),
            x3x2x1: "0x" + x3x2x1.toString(16).padStart(6, '0'),
            divisionCode,
            divisionValue,
            divisionCount,
            isPositive,
            receivedLRC: "0x" + receivedLRC.toString(16).padStart(2, '0'),
            calculatedLRC: "0x" + calculatedLRC.toString(16).padStart(2, '0'),
            status: statusInfo
          },
          rawBytes: bytes.map(b => "0x" + b.toString(16).padStart(2, '0'))
        };
      }
      
      // 如果是多个返回数据
      const chunks = [];
      for (let i = 0; i < bytes.length; i += 9) {
        if (i + 9 <= bytes.length) {
          chunks.push(bytes.slice(i, i + 9));
        }
      }
      
      // 解析每个数据块
      const weightResults = chunks.map(chunk => {
        console.log("解析重量指令的Chunk字节:", chunk.map(b => "0x" + b.toString(16).padStart(2, '0')));
        // 校验每个数据块的LRC
        const calculatedLRC = this.calculateWeightLRC(chunk.slice(0, -1));  // 只排除最后一位LRC
        const receivedLRC = chunk[chunk.length - 1];
        
        const address = chunk[0];
        const statusByte = chunk[3];
        const x4Byte = chunk[4];
        const x3x2x1 = (chunk[5] << 16) | (chunk[6] << 8) | chunk[7];
        
        // 计算重量
        const isPositive = (x4Byte & 0x80) === 0;
        const divisionCode = x4Byte & 0x0F;
        const divisionValue = this.getDivisionValue(divisionCode);
        const divisionCount = x3x2x1;
        const weight = divisionCount * divisionValue * (isPositive ? 1 : -1);
        
        // 解析状态字节
        const statusInfo = this.parseStatusByte(statusByte);
        
        return {
          address: "0x" + address.toString(16).padStart(2, '0') + ` (${address}号传感器)`,
          weight: weight.toFixed(1) + "g",
          lrcStatus: calculatedLRC === receivedLRC ? "校验通过" : "校验失败",
          statusByte: "0x" + statusByte.toString(16).padStart(2, '0'),
          x4Byte: "0x" + x4Byte.toString(16).padStart(2, '0'),
          x3x2x1: "0x" + x3x2x1.toString(16).padStart(6, '0'),
          divisionCode,
          divisionValue,
          divisionCount,
          isPositive,
          receivedLRC: "0x" + receivedLRC.toString(16).padStart(2, '0'),
          calculatedLRC: "0x" + calculatedLRC.toString(16).padStart(2, '0'),
          status: statusInfo
        };
      });
      
      return {
        success: true,
        type: "重力传感器",
        isResponse: true,
        command: {
          name: "读传感器重量"
        },
        details: {
          multipleResults: true,
          weights: weightResults
        },
        rawBytes: bytes.map(b => "0x" + b.toString(16).padStart(2, '0'))
      };
    }
    
    // 如果是发送指令
    // 校验LRC（使用字节级别校验）
    const dataForLRC = bytes.slice(0, -1);  // 排除最后一位LRC
    const calculatedLRC = this.calculateWeightLRC(dataForLRC);
    const receivedLRC = bytes[bytes.length - 1];
    
    console.log("重量指令LRC校验详情:");
    console.log("- 原始数据:", bytes.map(b => "0x" + b.toString(16).padStart(2, '0')));
    console.log("- 计算范围:", dataForLRC.map(b => "0x" + b.toString(16).padStart(2, '0')));
    console.log(`- 计算结果: 0x${calculatedLRC.toString(16).padStart(2, '0')} (${calculatedLRC})`);
    console.log(`- 接收的LRC: 0x${receivedLRC.toString(16).padStart(2, '0')} (${receivedLRC})`);
    
    if (calculatedLRC !== receivedLRC) {
      return {
        success: false,
        message: "LRC校验失败",
        details: {
          calculated: calculatedLRC,
          received: receivedLRC
        }
      };
    }
    
    // 解析地址
    const address = bytes[0];
    
    // 解析功能码
    const functionCode = bytes[1];
    
    let commandType = "";
    let isResponse = false;
    let result = {};
    let statusDesc = "";
    
    // 根据功能码判断指令类型
    if (functionCode === 0x05) {
      // 读取操作
      const registerAddress = bytes[2];
      if (registerAddress === 0x02) {
        commandType = "读传感器重量";
      } else if (registerAddress === 0x2E) {
        commandType = "读取鉴别率";
      }
    } else if (functionCode === 0x06) {
      // 读取操作的返回数据
      const registerAddress = bytes[2];
      if (registerAddress === 0x02) {
        commandType = "读传感器重量";
      } else if (registerAddress === 0x2E) {
        commandType = "读取鉴别率";
        isResponse = true;
        const discriminationRate = bytes[3];
        result = {
          success: true,
          discriminationRate: discriminationRate
        };
        statusDesc = `0x${address.toString(16).padStart(2, '0')} (${address}号传感器) 当前鉴别率: ${discriminationRate}`;
      }
    } else if (functionCode === 0x63) {
      const command = bytes[2];
      if (command === 0x06) {
        commandType = "去皮置零/校准";
        
        if (bytes.length >= 5 && bytes[1] === 0x64) {
          isResponse = true;
          const success = bytes[3] === 0x05;
          result = {
            success
          };
        }
      } else if (command === 0x2E) {
        commandType = "设置鉴别率";
        const rate = bytes[3];
        if (rate === 0) {
          result = {
            rate,
            rateDesc: "停止补偿跟踪"
          };
        } else {
          result = {
            rate,
            rateDesc: `${rate}倍分度值`
          };
        }
        statusDesc = `0x${address.toString(16).padStart(2, '0')} (${address}号传感器) 设置鉴别率: ${rate === 0 ? "停止补偿跟踪" : rate + "倍分度值"}`;
      }
    } else if (functionCode === 0x64) {
      // 写数据返回
      const command = bytes[2];
      if (command === 0x2E) {
        commandType = "设置鉴别率";
        isResponse = true;
        const success = bytes[3] === 0x05;
        result = {
          success
        };
        statusDesc = `0x${address.toString(16).padStart(2, '0')} (${address}号传感器) ${success ? "设置成功" : "设置失败"}`;
      }
    }
    
    return {
      success: true,
      type: "重力传感器",
      isResponse,
      command: {
        name: commandType
      },
      details: {
        address: "0x" + address.toString(16).padStart(2, '0') + ` (${address === 0 ? "全部地址" : address + "号传感器"})`,
        functionCode: "0x" + functionCode.toString(16).padStart(2, '0'),
        lrc: "0x" + receivedLRC.toString(16).padStart(2, '0') + " (LRC校验通过)",
        ...result,
        statusDesc
      },
      rawBytes: bytes.map(b => "0x" + b.toString(16).padStart(2, '0'))
    };
  }
  
  /**
   * 获取分度值
   */
  getDivisionValue(code) {
    const divisionValues = {
      0: 1000,    // 1kg = 1000g
      1: 100,     // 0.1kg = 100g
      2: 10,      // 0.01kg = 10g
      3: 1,       // 0.001kg = 1g
      4: 2,       // 0.002kg = 2g (文档示例中使用)
      5: 5,       // 0.005kg = 5g
      6: 200,     // 0.2kg = 200g
      7: 500,     // 0.5kg = 500g
      8: 50,      // 0.05kg = 50g
      9: 0.5      // 0.0005kg = 0.5g
    };
    
    return divisionValues[code] || 1; // 默认返回1g
  }
  
  /**
   * 解析状态字节
   */
  parseStatusByte(statusByte) {
    return {
      标定允许: (statusByte & 0x80) !== 0,  // bit7: 标定允许
      固定值1: (statusByte & 0x40) !== 0,   // bit6: 固定值1
      固定值0: (statusByte & 0x20) !== 0,   // bit5: 固定值0
      故障: (statusByte & 0x10) !== 0,      // bit4: 故障
      量程溢出: (statusByte & 0x08) !== 0,   // bit3: 量程溢出
      开机零位异常: (statusByte & 0x04) !== 0, // bit2: 开机零位异常
      稳定: (statusByte & 0x02) !== 0,      // bit1: 稳定
      零位: (statusByte & 0x01) !== 0       // bit0: 零位
    };
  }
  
  /**
   * 计算门锁指令的LRC校验码（使用异或运算 除第一位和校验位）
   * 注意：JavaScript中所有数值内部都是以数值形式存储的，无论它们如何表示
   * 这里我们需要确保异或运算在字节级别上正确执行
   */
  calculateDoorLRC(data) {
    // 根据文档，门锁指令使用异或运算，排除第一位和校验位
    // 只计算data[1]到data[data.length-1]
    let xor = 0;
    
    // 调试输出数据
    console.log("计算LRC的输入数据(排除第一位):", data.slice(1).map(b => "0x" + b.toString(16).padStart(2, '0')));
    
    // 从索引1开始，排除第一位
    for (let i = 1; i < data.length; i++) {
      const b = data[i];
      const oldXor = xor;
      // 确保每次异或操作都在字节范围内进行（0-255）
      xor = (xor ^ b) & 0xFF;
      console.log(`异或操作: 0x${oldXor.toString(16).padStart(2, '0')} ^ 0x${b.toString(16).padStart(2, '0')} = 0x${xor.toString(16).padStart(2, '0')}`);
    }
    
    console.log("计算得到的LRC: 0x" + xor.toString(16).padStart(2, '0'));
    return xor;
  }
  
  /**
   * 计算重量指令的LRC校验码（使用相加 除包头和校验位）
   * 注意：JavaScript中所有数值内部都是以数值形式存储的
   * 确保加法运算在字节级别上正确执行
   */
  calculateWeightLRC(data) {
    // 计算除了LRC校验码之外的所有字节（包括第一位）的和
    let sum = 0;
    
    // 调试输出数据（排除最后一位LRC）
    console.log("计算重量LRC的输入数据(排除最后一位LRC):", data.map(b => "0x" + b.toString(16).padStart(2, '0')));
    
    // 计算除了最后一位LRC之外的所有字节的和
    for (let i = 0; i < data.length; i++) {
      const b = data[i];
      const oldSum = sum;
      // 加法后保留低8位
      sum = (sum + b) & 0xFF;
      console.log(`加法操作: 0x${oldSum.toString(16).padStart(2, '0')} + 0x${b.toString(16).padStart(2, '0')} = 0x${sum.toString(16).padStart(2, '0')}`);
    }
    
    console.log("计算得到的重量LRC: 0x" + sum.toString(16).padStart(2, '0'));
    // 取低8位
    return sum;
  }
}

// 导出解析器
window.ProtocolParser = new ProtocolParser(); 
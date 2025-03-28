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
    
    if (header === 0xF3) {
      return this.parseDoorCommand(bytes);
    } else if (header === 0xF3) {
      return this.parseDoorCommand(bytes);
    } else if (
      // 重力传感器的第二个字节是功能码，用这个来判断
      bytes.length >= 2 && 
      (bytes[1] === 0x05 || // 读数据功能码
       bytes[1] === 0x06 || // 读数据返回功能码
       bytes[1] === 0x63 || // 写数据功能码
       bytes[1] === 0x64)   // 写数据返回功能码
    ) {
      return this.parseWeightCommand(bytes);
    } else {
      return { 
        success: false, 
        message: "未知的指令类型，包头:" + header.toString(16) 
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
      // 按9字节分割数据
      const chunks = [];
      for (let i = 0; i < bytes.length; i += 9) {
        if (i + 9 <= bytes.length) {
          chunks.push(bytes.slice(i, i + 9));
        }
      }
      
      // 解析每个数据块
      const weightResults = chunks.map(chunk => {
        // 校验每个数据块的LRC
        const calculatedLRC = this.calculateWeightLRC(chunk.slice(0, -1));
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
          address: address,
          weight: weight.toFixed(3),
          lrcValid: calculatedLRC === receivedLRC,
          rawData: {
            statusByte: "0x" + statusByte.toString(16).padStart(2, '0'),
            x4Byte: "0x" + x4Byte.toString(16).padStart(2, '0'),
            x3x2x1: "0x" + x3x2x1.toString(16).padStart(6, '0'),
            divisionCode,
            divisionValue,
            divisionCount,
            isPositive,
            receivedLRC: "0x" + receivedLRC.toString(16).padStart(2, '0'),
            calculatedLRC: "0x" + calculatedLRC.toString(16).padStart(2, '0')
          },
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
          weights: weightResults.map(r => ({
            address: "0x" + r.address.toString(16).padStart(2, '0') + ` (${r.address}号传感器)`,
            weight: r.weight + "kg",
            lrcStatus: r.lrcValid ? "校验通过" : "校验失败",
            ...r.rawData,
            status: r.status
          }))
        },
        rawBytes: bytes.map(b => "0x" + b.toString(16).padStart(2, '0'))
      };
    }
    
    // 如果是发送指令
    // 校验LRC（使用字节级别校验）
    const calculatedLRC = this.calculateWeightLRC(bytes.slice(0, -1));
    const receivedLRC = bytes[bytes.length - 1];
    
    console.log(`重量校验结果: 计算值=0x${calculatedLRC.toString(16).padStart(2, '0')}, 接收值=0x${receivedLRC.toString(16).padStart(2, '0')}`);
    
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
    
    // 根据功能码判断指令类型
    if (functionCode === 0x05) {
      // 读取操作
      const registerAddress = bytes[2];
      if (registerAddress === 0x02) {
        commandType = "读传感器重量";
      } else if (registerAddress === 0x2E) {
        commandType = "读取鉴别率";
        
        if (bytes.length >= 5 && bytes[1] === 0x06) {
          isResponse = true;
          const discriminationRate = bytes[3];
          result = {
            discriminationRate
          };
        }
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
        
        if (bytes.length >= 5 && bytes[1] === 0x64) {
          isResponse = true;
          const success = bytes[3] === 0x05;
          result = {
            success,
            rate
          };
        } else {
          result = {
            rate
          };
        }
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
        ...result
      },
      rawBytes: bytes.map(b => "0x" + b.toString(16).padStart(2, '0'))
    };
  }
  
  /**
   * 获取分度值
   */
  getDivisionValue(code) {
    const divisionValues = {
      0: 1,      // 1kg
      1: 0.1,    // 0.1kg
      2: 0.01,   // 0.01kg
      3: 0.001,  // 0.001kg
      4: 0.002,  // 0.002kg (文档示例中使用)
      5: 0.005,  // 0.005kg
      6: 0.2,    // 0.2kg
      7: 0.5,    // 0.5kg
      8: 0.05,   // 0.05kg
      9: 0.0005  // 0.0005kg
    };
    
    return divisionValues[code] || 0.001; // 默认返回0.001kg
  }
  
  /**
   * 解析状态字节
   */
  parseStatusByte(statusByte) {
    return {
      calibrationAllowed: (statusByte & 0x80) !== 0,  // bit7: 标定允许
      fixed1: (statusByte & 0x40) !== 0,             // bit6: 固定值1
      fixed0: (statusByte & 0x20) !== 0,             // bit5: 固定值0
      fault: (statusByte & 0x10) !== 0,              // bit4: 故障
      overflow: (statusByte & 0x08) !== 0,           // bit3: 量程溢出
      zeroAbnormal: (statusByte & 0x04) !== 0,       // bit2: 开机零位异常
      stable: (statusByte & 0x02) !== 0,             // bit1: 稳定
      zeroPosition: (statusByte & 0x01) !== 0        // bit0: 零位
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
    // 根据文档，重量指令使用相加运算，排除第一个字节
    let sum = 0;
    
    // 调试输出数据
    console.log("计算重量LRC的输入数据(排除第一位):", data.slice(1).map(b => "0x" + b.toString(16).padStart(2, '0')));
    
    // 从索引1开始，排除第一位
    for (let i = 1; i < data.length; i++) {
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
# 智能医疗耗材柜协议解析工具

这是一个用于解析智能医疗耗材柜通信协议的工具，支持门锁控制器和重力传感器指令的解析。

## 功能特点

- 支持门锁控制器指令解析
  - 开门操作(0x1111)
  - 查询锁状态(0x1110)
- 支持重力传感器指令解析
  - 读传感器重量
  - 去皮置零/校准
  - 设置/读取鉴别率
- 实时解析和验证指令格式
- 直观的用户界面，显示解析结果
- LRC校验支持

## 使用方法

1. 打开 `docs/index.html` 文件
2. 在输入框中输入或粘贴十六进制指令（如 `F3 00 08 11 11 01 00 00 00 01 08`）
3. 点击"解析指令"按钮
4. 查看解析结果

## 开发说明

- `protocol-parser.js` - 核心解析逻辑
- `index.html` - 主界面
- `test.html` - 测试工具
- `doc/指令文档.md` - 协议文档

## 运行测试

打开 `docs/test.html` 文件运行预设的测试用例，验证解析算法的正确性。


# 智能医疗耗材柜通信流程指令文档 V2.3

## 一、通信基础配置

### 1.1 通用校验规则
**LRC（垂直效验码校验）计算规则：**
1. 计算范围：整个数据帧中除LRC自身外的所有字节
2. 计算方法：
   ```kotlin
   /**
     * 计算门锁指令的LRC校验码（使用异或运算 16进制的运算 除第一位和校验位）
     */
    private fun calculateDoorLRC(data: ByteArray): Byte {
        var xor = 0
        for (b in data) {
            xor = xor xor (b.toInt() and 0xFF)
        }
        return xor.toByte()
    }
    /**
     * 计算重量指令的LRC校验码（使用相加 除校验位）垂直码
     */
   fun calculateWeightLRC(data: ByteArray): Byte {
       var sum = 0
       for (b in data) {
           sum += b.toInt() and 0xFF
       }
       return (sum and 0xFF).toByte()
   }
   ```
3. 校验位置：数据帧最后一个字节
4. 异常处理：
   - 丢弃校验失败的数据帧
   - 连续3次校验失败应触发硬件报警
   - 错误日志需记录原始16进制数据

## 二、门锁控制器指令集

### 2.1 开门操作(0x1111)

| 项目 | 发送指令 | 返回数据 |
|------|----------|-----------|
| 格式 | 0xF3 + 0x0008 + 0x1111 + 0x01 + 0x0000 + 0x00 + n + LRC | 0xF3 + 0x0009 + 0x1111 + 0x01 + 0x0000 + 0x00 + n + status + LRC |
| 示例 | F3 00 08 11 11 01 00 00 00 01 08 | F3 00 09 11 11 01 00 00 00 01 01 08 |
| 说明 | - 0xF3: 包头<br>- 0x0008: 长度<br>- 0x1111: 命令码(开门)<br>- 0x01: 地址编码(号柜)<br>- 0x0000: 返回码<br>- 0x00: 序列号<br>- n: 锁编号(1-80)<br>- LRC: 校验码 | - 0xF3: 包头<br>- 0x0009: 长度<br>- 0x1111: 命令码(开门)<br>- 0x01: 地址编码(号柜)<br>- 0x0000: 返回码<br>- 0x00: 序列号<br>- n: 锁编号(1-80)<br>- status: 1是打开状态，0是关闭状态<br>- LRC: 校验码 |

### 2.2 查询锁状态(0x1110)

| 项目 | 发送指令 | 返回数据 |
|------|----------|-----------|
| 格式 | 0xF3 + 0x0008 + 0x1110 + 0x01 + 0x0000 + 0x00 + n + LRC | 0xF3 + 0x0009 + 0x1110 + 0x01 + 0x0000 + 0x00 + n + status + LRC |
| 示例 | F3 00 08 11 10 01 00 00 00 01 09 | F3 00 09 11 10 01 00 00 00 02 01 0A |
| 说明 | - 0xF3: 包头<br>- 0x0008: 长度<br>- 0x1110: 命令码(查询状态)<br>- 0x01: 地址编码(号柜)<br>- 0x0000: 返回码<br>- 0x00: 序列号<br>- n: 锁编号(1-80)<br>- LRC: 校验码 | - 0xF3: 包头<br>- 0x0009: 长度<br>- 0x1110: 命令码(查询状态)<br>- 0x01: 地址编码(号柜)<br>- 0x0000: 返回码<br>- 0x00: 序列号<br>- n: 锁编号(1-80)<br>- status: 1是打开状态，0是关闭状态<br>- LRC: 校验码 |

## 三、重力传感器指令集

### 3.1 读传感器重量

| 项目 | 发送指令 | 返回数据 |
|------|----------|-----------|
| 格式 | 01 + 05 + 02 + 05 + 0D | 每个传感器按地址顺序返回数据 |
| 示例 | 01 05 02 05 0D | 01 06 02 02 64 00 00 a7 36 |
| 说明 | - 01: 地址<br>- 05: 读数据功能码<br>- 02: 寄存器地址<br>- 05: 固定信息码<br>- 0D: 校验码 | - 01是地址 00为广播<br> - 06是功能码<br> - 02是寄存器<br> - 02是状态字节<br> - 64是分度值和负号<br> - 00 00 a7是分度数<br> - 36是效验码 |

> 当地址为00则获取全部传感器重量。放回数据为多条，如：
> 01 06 02 02 64 00 00 a7 36<br>02 06 02 02 64 00 00 a8 37<br>

#### 重量计算示例

以返回数据 01 06 02 02 64 00 00 a7 36 为例：

1. **数据解析**
   - 地址：01（传感器1）
   - 状态字节：02（二进制 00000010）
   - X4字节：64（十六进制）
   - X3X2X1：00 00 a7（十六进制）

2. **符号判断**
   - X4最高位：bit7=0 → 正数

3. **分度值计算**
   - 取X4低7位：64(hex) → 0x64 & 0x7F = 0x64（实际协议规定直接取十六进制最后一位）
   - 分度值代号：4（来自十六进制最后一位）
   - 查附表二得分度值d=0.002kg

4. **分度数计算（关键修正）**
   - 合并X3X2X1：00 00 a7 → 0x0000a7 = 167(dec)
   - **直接使用原始值**：分度数 = 167（无需左移）

5. **最终重量**
   - 重量 = 分度数 × 分度值 = 167 × 0.002 = 0.334kg

### 附表一、状态信息(St)字节定义

| bit7 | bit6 | bit5 | bit4 | bit3 | bit2 | bit1 | bit0 |
|------|------|------|------|------|------|------|------|
| 标定允许 | 1 | 0 | 故障 | 量程溢出 | 开机零位异常 | 稳定 | 零位 |

示例：St值为C2(11000010)表示：
- bit7(1): 标定允许
- bit6(1): 固定值1
- bit5(0): 固定值0
- bit4(0): 无故障
- bit3(0): 未溢出
- bit2(0): 零位正常
- bit1(1): 稳定
- bit0(0): 非零位

### 3.2 去皮置零/校准

| 项目 | 发送指令 | 返回数据 |
|------|----------|-----------|
| 格式 | 00 + 63 + 06 + 01 + 6A | n + 64 + 06 + 05 + LRC |
| 示例 | 00 63 06 01 6A | 01 64 06 05 70 |
| 说明 | - 00: 广播地址<br>- 63: 写数据功能码<br>- 06: 写指令<br>- 01: 信息码<br>- 6A: 校验码<br>- 注：断电不保存 | - n: 传感器地址<br>- 64: 写数据功能码+1<br>- 06: 写指令<br>- 05: 执行成功<br>- LRC: 校验码 |
> 00: 广播地址（全部） 01：01地址

### 3.3 设置鉴别率

| 项目 | 发送指令 | 返回数据 |
|------|----------|-----------|
| 格式 | 00 + 63 + 2E + X1 + LRC | n + 64 + 2E + 05 + LRC |
| 示例 | 01 63 2E 05 96 | 01 64 2E 05 92 |
| 说明 | - 01: 地址<br>- 63: 写数据功能码<br>- 2E: 鉴别率命令<br>- X1: 鉴别率值(0-99)<br>&nbsp;&nbsp;0: 停止补偿跟踪<br>&nbsp;&nbsp;1-99: 对应1-99倍分度值<br>- LRC: 校验码 | - n: 传感器地址<br>- 64: 写数据功能码+1<br>- 2E: 鉴别率命令<br>- 05: 执行成功，其他值表示失败<br>- LRC: 校验码 |
> 00: 广播地址（全部） 01：01地址

### 3.4 读取鉴别率

| 项目 | 发送指令 | 返回数据 |
|------|----------|-----------|
| 格式 | 00 + 05 + 2E + 05 + 38 | n + 06 + 2E + x1 + LRC |
| 示例 | 01 05 2E 05 38 | 01 06 2E 05 3A |
| 说明 | - 01: 地址<br>- 05: 读数据功能码<br>- 2E: 鉴别率命令<br>- 05: 信息码<br>- 38: 校验码 | - n: 传感器地址<br>- 06: 读数据功能码+1<br>- 2E: 鉴别率命令<br>- x1: 当前鉴别率值(0-99)<br>- LRC: 校验码 |
> 00: 广播地址（全部） 01：01地址


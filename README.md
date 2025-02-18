# 股海沉浮 (Into The Waves) - 股票投资卡牌游戏

## 项目整体目标
股海沉浮旨在通过融合股票投资与卡牌游戏机制，为玩家提供一个既有策略性又具娱乐性的投资模拟平台。玩家可以在游戏中体验真实的股票市场波动，通过手中的卡牌进行交易和决策，提升投资技巧，同时享受竞技对战的乐趣。

## 包含的功能模块
- **玩家管理模块**：处理玩家的基本信息、手牌、现金和持有的股票。
- **卡牌系统模块**：管理不同类型的卡牌及其效果，包括交易卡、事件卡和策略卡。
- **股票市场模块**：模拟真实的股票市场，包括股票价格的动态变动和市场事件。
- **游戏引擎模块**：控制游戏的流程和回合，包括玩家的回合操作和胜负判定。
- **用户交互模块**：通过命令行界面与玩家进行交互，接收玩家的输入并展示游戏信息。

## 各模块的运作方式
### 玩家管理模块
- **玩家类（Player）**：记录玩家的姓名、手牌、现金余额和持有的股票数量。
- **操作方法**：
  - 绘牌：从牌库中抽取卡牌加入玩家手牌。
  - 出牌：玩家选择一张手牌进行使用，触发卡牌效果。
  - 购买股票：玩家使用现金购买指定数量的股票。

### 卡牌系统模块
- 游戏中的卡牌分为三类：交易卡、事件卡和天灾卡。
  - 交易卡：用于买卖特定股票，支持做多和做空操作
  - 事件卡：影响市场或特定行业，如"行业利好"可使指定行业上涨
  - 天灾卡：具有破坏性的负面事件，抽到时会触发补偿机制
- 每个玩家每回合抽一张牌，打出一张牌。
- 抽到天灾卡时会自动进入天灾区并重新抽牌。
- 卡牌通过 CSV 文件配置，包含以下属性：
  - name: 卡牌名称
  - type: 卡牌类型（交易/事件/天灾）
  - effect: 效果标识符
  - power: 效果强度系数
  - description: 卡牌描述
  - tags: 关联标签（用于卡牌筛选）

### 股票市场模块
- **股票类（Stock）**：记录每只股票的名称、标签、当前价格和波动率。
- **价格更新**：通过正态分布生成股票价格的涨跌幅，模拟真实市场波动。
- **波动率调整**：根据股票的标签（如"成长"、"成熟"）动态调整其波动率。

### 游戏引擎模块
- **回合控制**：管理游戏的整体流程，包括玩家的回合操作和价格更新。
- **胜负判定**：在游戏结束时，根据玩家的净资产确定胜者。

### 用户交互模块
- **命令行界面**：通过命令行与玩家交互，显示游戏信息并接收玩家输入。
- **输入处理**：根据玩家的选择执行相应的游戏操作，如出牌或购买股票。

## 关键的开发进度
- **v0.1.0 (当前版本)**
  - 基础对战框架搭建
  - 核心卡牌系统开发
  - 股票市场价格动态更新功能实现
  - 简单的命令行用户界面

- **短期计划**
  - [ ] 增加AI对手模式，提升游戏挑战性
  - [ ] 实现网络对战功能，支持玩家在线对战
  - [ ] 增加可视化图表，直观展示股票价格变动

## 卡牌类型
- 天灾卡：抽到时进入天灾区，永久生效直到游戏结束
- 事件卡：立即生效的一次性效果
- 交易卡：执行股票交易操作

## 游戏核心的运行流程

### 游戏初始化阶段

#### 股票系统初始化（IntoTheWaves.js）

```javascript
initializeAllStocks() {
  return [
    new Stock("英伟达", ["半导体", "消费电子", "成长", "北美洲"]),
    // ...其他股票
  ];
}
```

- 创建15只预设股票，每只股票带有行业标签
- 生成初始价格（10-200之间的随机数）
- 根据标签设置初始波动率（成长股1.5倍，初创公司2倍等）


#### 卡牌系统初始化（CardLoader.js + cards.csv）

```javascript
async loadCardsFromCSV('./data/cards.csv') // 加载基础卡牌
```

- 从CSV读取卡牌配置（行业利好卡、天灾卡等）
- 自动生成股票交易卡（每个活跃股票生成5张交易卡）

#### 玩家初始化（Player.js）

```javascript
constructor(name) {
  this.cash = 50000; // 初始资金
  this.stocks = {};  // 股票持仓
}
```


### 核心游戏循环

#### 抽牌阶段

```javascript
players.forEach(player => player.drawCard(this.deck));
```
- 每个玩家抽1张牌
- 天灾卡会自动进入灾难区（不会加入手牌）

#### 玩家行动阶段

```javascript
async playerTurn(player) {
  const card = player.playCard(index);
  await card.applyEffect(player, game);
}
```

- 交易卡示例流程：
  ```javascript
  // 在 TradeCard 类中
  async applyEffect() {
    const action = await game.askForInput("B/S"); // 买卖选择
    if(action === 'B') player.buyStock(...);
    if(action === 'S') player.sellStock(...);
  }
  ```

#### 市场结算阶段

```javascript
updateStockPrices() {
  stock.updatePrice(); // 调用股票的价格更新算法
}
```

- 使用截断正态分布生成价格波动
- 波动幅度受股票标签影响（初创公司波动更大）

#### 资产统计阶段

```javascript
displayPlayerAssets() {
  // 计算本回合盈亏和总盈亏
}
```

### 核心子系统交互

#### 卡牌效果系统

```javascript
// CardFactory.js 中的效果分发
switch(config.effect) {
  case 'industry_boost': // 行业利好
    targetIndustry.stocks.forEach(boostPrice);
  case 'pandemic':       // 疫情爆发
    medicalStocks.crash();
}
```

#### 股票交易系统（Player.js）

- 多空混合持仓处理：

```javascript
buyStock() {
  // 处理空转多的情况
  if(currentQty < 0) {
    const coverQty = Math.min(quantity, -currentQty);
    // ...平仓计算
  }
}
```

#### 风险控制系统

- 卖空限制警告：

```javascript
sellStock() {
  console.log("警告：卖空操作可能导致无限亏损！");
}
```

### 数据流动示例

#### 使用行业利好卡：

```
玩家选择行业 -> 从cards.csv读取0.2的power值 -> 遍历该行业股票 -> 股价上涨20%
```

#### 股票交易过程：

```
交易卡应用 -> 调用Player的buyStock/sellStock -> 更新stockCosts成本记录 -> 影响calculateNetWorth资产计算
```

## 关键算法解析

#### 股票波动算法（Stock.js）

```javascript
truncatedNormal() {
  // 生成正态分布随机数
  let num = Math.sqrt(-2*Math.log(u)) * Math.cos(2*Math.PI*v); 
  num *= this.volatility; // 应用波动率
  return Math.max(-1, Math.min(1, num)); // 限制在±100%
}
```

#### 成本价计算（Player.js）
```javascript
getStockCost() {
  // 做空时股数为负，计算绝对值
  return totalQty > 0 ? totalCost / totalQty : 0;
}
```

### 扩展机制

#### 天灾卡系统（DisasterCard.js）

- 特殊抽卡规则：抽到天灾卡会自动进入灾难区
- 全局影响效果：如太阳风暴影响太空类股票

#### 动态波动率（Stock.js）

```javascript
adjustVolatilityByTags() {
  // 根据标签实时调整波动率
  if(tags.includes("成长")) volatilityModifier *= 1.5;
}
```

这个系统通过卡牌驱动+股票模拟的核心机制，结合精心设计的数值系统和风险控制，实现了策略性与随机性的平衡。玩家需要兼顾短期操作（利用交易卡套利）和长期布局（使用事件卡影响市场趋势）。

## 本地部署

### 环境要求

- Node.js >= 14.0.0
- npm >= 6.0.0

### 安装依赖

```bash
git clone https://github.com/yourusername/IntoTheWaves.git
cd IntoTheWaves
npm install
```

### 运行游戏

```bash
node IntoTheWaves.js
```
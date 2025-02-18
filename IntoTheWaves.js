// IntoTheWaves 股票投资卡牌游戏模型

// 新增依赖
const CardLoader = require('./src/CardLoader');
const { createCardInstance } = require('./src/CardFactory');
const Player = require('./Player');  // 添加导入语句
const Table = require('cli-table3');

// 在类顶部添加颜色常量
const COLORS = {
  Reset: "\x1b[0m",
  Green: "\x1b[32m",
  Red: "\x1b[31m",
  Cyan: "\x1b[36m"
};

// 在颜色常量后添加格式化函数
const formatNumber = (num, decimals = 0) => {
  return num.toFixed(decimals)
           .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

class Card {
  constructor(name) {
    this.name = name;
  }

  async applyEffect(player, game) {
    // 基类的空实现
  }
}

class StockCard extends Card {
  constructor(stockName) {
    super(stockName);
    this.stockName = stockName;
  }

  async applyEffect(player, game) {
    console.log(`当前 ${this.stockName} 的价格是: ${game.stockPrices[this.stockName]}`);
    const quantity = parseInt(await game.askForInput(`${player.name}，您想购买多少股 ${this.stockName}？`));
    if (player.buyStock(this.stockName, quantity, game.stockPrices[this.stockName])) {
      console.log(`${player.name} 成功购买 ${quantity} 股 ${this.stockName}`);
    } else {
      console.log(`${player.name} 现金不足，无法购买`);
    }
  }
}

class Stock {
  constructor(name, tags) {
    this.name = name;
    this.tags = tags;
    this.price = this.generateInitialPrice();
    this.volatility = 0.3; // 添加波动率参数
  }

  generateInitialPrice() {
    // 生成10200之间的随机数，保留两位小数
    return Math.round((Math.random() * 190 + 10) * 100) / 100;
  }

  // 新增正态分布生成方法
  truncatedNormal() {
    let u = 0, v = 0;
    while(u === 0) u = Math.random();
    while(v === 0) v = Math.random();
    let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    num *= this.volatility; // 使用股票自身波动率
    return Math.max(-1, Math.min(1, num)); // 限制在±100%之间
  }

  /**
   * 更新股票价格（核心算法）
   * 使用截断正态分布生成价格波动
   * 波动范围：-100% 到 +100%
   * 实际波动率由volatility参数控制
   */
  updatePrice() {
    // 生成正态分布随机数
    const change = this.truncatedNormal();
    
    // 计算新价格（不低于0.01元）
    let newPrice = this.price * (1 + change);
    newPrice = Math.max(newPrice, 0.01);
    
    // 更新价格并保留两位小数
    this.price = Math.round(newPrice * 100) / 100;
    
    // 根据标签动态调整波动率
    this.adjustVolatilityByTags();
  }

  /**
   * 根据股票标签调整波动率
   * - 成长股：波动率 ×1.5
   * - 衰退股：波动率 ×0.8
   * - 初创公司：波动率 ×2.0
   * - 成熟企业：波动率 ×0.7
   * 波动率范围限制在0.1-0.5之间
   */
  adjustVolatilityByTags() {
    let volatilityModifier = 1.0;
    if (this.tags.includes("成长")) volatilityModifier *= 1.5;
    if (this.tags.includes("衰退")) volatilityModifier *= 0.8;
    if (this.tags.includes("初创")) volatilityModifier *= 2.0;
    if (this.tags.includes("成熟")) volatilityModifier *= 0.7;
    
    this.volatility = Math.min(Math.max(0.1, 0.3 * volatilityModifier), 0.5);
  }

  // 在Stock类中添加测试方法
  testPriceDistribution() {
    const results = [];
    for(let i=0; i<1000; i++){
      const originalPrice = 100;
      this.price = originalPrice;
      this.updatePrice();
      const change = (this.price - originalPrice)/originalPrice;
      results.push(change);
    }
    console.log(`最大涨幅: ${Math.max(...results).toFixed(2)}`);
    console.log(`最大跌幅: ${Math.min(...results).toFixed(2)}`);
    console.log(`平均波动: ${(results.reduce((a,b)=>a+b,0)/1000).toFixed(4)}`);
  }
}

const readline = require('readline');

class IntoTheWaves {
  async initialize() {
    this.allStocks = this.initializeAllStocks();
    this.activeStocks = this.selectRandomStocks(6);
    this.stockPrices = this.initializeStockPrices();
    this.previousStockPrices = {...this.stockPrices};
    this.players = [new Player("玩家1"), new Player("玩家2")];
    this.currentRound = 0;
    this.totalRounds = 3;
    this.deck = await this.createDeck();
    console.log('生成的股票交易卡示例:', this.deck[0]);
    return this;
  }

  /**
   * 创建游戏牌库
   * @param {number} size - 牌库容量
   * @returns {Array<Card>} 洗牌后的卡牌数组
   */
  async createDeck() {
    // 加载基础卡牌配置
    const baseCards = await CardLoader.loadCardsFromCSV('./data/cards.csv');
    if (!baseCards.length) throw new Error('基础卡牌配置加载失败');
    
    // 生成股票交易卡
    const stockCards = this.activeStocks.flatMap(stock => {
      return Array(5).fill().map(() => ({
        name: `${stock.name}交易卡`,
        type: '交易',
        effect: 'stock_trade',
        stockName: stock.name,
        power: 1.0,
        description: `交易${stock.name}股票`,
        tags: ['股票交易', ...stock.tags]
      }));
    });
    if (!stockCards.length) throw new Error('股票卡生成失败');
    
    return this.shuffleDeck([...baseCards, ...stockCards].map(config => createCardInstance(config)));
  }

  shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  dealInitialHands() {
    const initialHandSize = 6;
    for (let i = 0; i < initialHandSize; i++) {
      this.players.forEach(player => player.drawCard(this.deck));
    }
  }

  initializeAllStocks() {
    return [
      new Stock("英伟达", ["半导体", "消费电子", "成长", "北美洲"]),
      new Stock("西方石油", ["石油", "成熟", "北美洲"]),
      new Stock("宁德时代", ["光伏", "电池", "汽车", "成熟", "亚洲"]),
      new Stock("墨氏烧烤", ["食品", "成长", "北美洲"]),
      new Stock("贵州茅台", ["酒", "衰退", "亚洲"]),
      new Stock("欧莱雅", ["美妆", "成熟", "欧洲"]),
      new Stock("万科", ["房地产", "衰退", "亚洲"]),
      new Stock("波音", ["运输", "成熟", "北美洲"]),
      new Stock("苹果", ["半导体", "消费电子", "成熟", "北美洲"]),
      new Stock("辉瑞", ["医药", "成熟", "北美洲"]),
      new Stock("特斯拉", ["汽车", "电池", "消费电子", "成长", "北美洲"]),
      new Stock("法拉第未来", ["汽车", "初创", "北美洲"]),
      new Stock("温氏股份", ["养殖", "成熟", "亚洲"]),
      new Stock("阿斯麦", ["半导体", "成熟", "欧洲"]),
      new Stock("山东黄金", ["贵金属", "成熟", "亚洲"])
    ];
  }

  selectRandomStocks(count) {
    const shuffled = [...this.allStocks].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 6); // 固定选择6只股票
  }

  initializeStockPrices() {
    return this.activeStocks.reduce((prices, stock) => {
      prices[stock.name] = stock.price;
      return prices;
    }, {});
  }

  displayActiveStocks(isRoundStart = true) {
    console.log("\n当前活跃股列表：");
    const table = new Table({
      head: [
        '\x1b[37m股票名称\x1b[0m',
        '\x1b[37m当前价格\x1b[0m',
        '\x1b[37m涨跌幅\x1b[0m',
        '\x1b[37m波动率\x1b[0m'
      ],
      colWidths: [16, 12, 12, 12],
      colAligns: ['left', 'right', 'right', 'right'],
      style: { 
        'padding-left': 1,
        'padding-right': 1,
        compact: true
      },
      chars: { 
        'top': '', 'top-mid': '', 'top-left': '', 'top-right': '',
        'bottom': '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '',
        'left': '', 'left-mid': '', 'mid': '', 'mid-mid': '',
        'right': '', 'right-mid': '', 'middle': '' 
      }
    });
    
    this.activeStocks.forEach(stock => {
      const currentPrice = this.stockPrices[stock.name];
      const previousPrice = this.previousStockPrices[stock.name];
      let changePercent = isRoundStart ? 0 : 
        ((currentPrice - previousPrice) / previousPrice * 100).toFixed(2);
      let changeSymbol = changePercent > 0 ? '↑' : (changePercent < 0 ? '↓' : '-');
      const changeColor = changeSymbol === '↑' ? COLORS.Green : 
                        changeSymbol === '↓' ? COLORS.Red : COLORS.Reset;
      
      table.push([
        stock.name,
        formatNumber(currentPrice, 2),
        `${changeColor}${changeSymbol}${Math.abs(changePercent)}%${COLORS.Reset}`,
        `${Math.round(stock.volatility*100)}%`
      ]);
    });
    console.log(table.toString());
  }

  updateStockPrices() {
    this.previousStockPrices = {...this.stockPrices};
    this.activeStocks.forEach(stock => {
      stock.updatePrice();
      this.stockPrices[stock.name] = stock.price;
    });
  }

  askForInput(question) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }

  async playerTurn(player) {
    console.log(`\n${player.name}的回合`);
    console.log("当前手牌：");
    player.hand.forEach((card, index) => {
      console.log(`${index + 1}. ${card.name}`);
    });

    const cardIndex = parseInt(await this.askForInput('请选择要打出的卡（输入序号）：')) - 1;
    if (cardIndex < 0 || cardIndex >= player.hand.length) {
      console.log(`${player.name} 选择了无效的牌`);
      return;
    }

    const playedCard = player.playCard(cardIndex);
    console.log(`${player.name} 打出了 ${playedCard.name}`);
    await playedCard.applyEffect(player, this);
  }

  /**
   * 执行单个回合逻辑
   */
  async playRound() {
    // 回合计数器递增
    this.currentRound++;
    
    // 在回合开始时记录持仓
    this.players.forEach(player => {
      player.previousStocks = {...player.stocks};
    });
    
    // 阶段1: 抽牌阶段
    this.players.forEach(player => {
      console.log(`\n${player.name} 开始抽牌`);
      player.drawCard(this.deck, this);
    });

    // 阶段2: 玩家行动阶段
    await this.playerTurn(this.players[0]);
    await this.playerTurn(this.players[1]);

    // 阶段3: 市场结算
    this.updateStockPrices();
    this.displayActiveStocks(false);
    
    // 阶段4: 资产统计
    this.players.forEach(player => {
      this.displayPlayerAssets(player);
    });
  }

  displayPlayerAssets(player, isFirstRound = false) {
    const currentNetWorth = player.calculateNetWorth(this.stockPrices);
    const previousNetWorth = player.previousNetWorth || currentNetWorth;
    const change = currentNetWorth - previousNetWorth;
    const changePercent = previousNetWorth === 0 ? 0 : (change / previousNetWorth * 100).toFixed(2);
    
    const color = change >= 0 ? COLORS.Green : COLORS.Red;
    const changeText = isFirstRound ? '' : `${color}${change >= 0 ? '+' : ''}${change.toFixed(2)} (${changePercent}%)${COLORS.Reset}`;

    console.log(`\n${player.name} 资产明细:`);
    console.log(`现金: ${COLORS.Cyan}${formatNumber(player.cash, 2).padStart(12)}${COLORS.Reset}`);
    
    const sortedStocks = Object.entries(player.stocks)
      .filter(([_, qty]) => qty !== 0)
      .sort((a, b) => (b[1] * this.stockPrices[b[0]]) - (a[1] * this.stockPrices[a[0]]));

    if (sortedStocks.length > 0) {
      console.log('股票持仓:');
      const table = new Table({
        head: [
          '\x1b[37m股票名称\x1b[0m', 
          '\x1b[37m持股数\x1b[0m',
          '\x1b[37m成本价\x1b[0m',
          '\x1b[37m最新价\x1b[0m',
          '\x1b[37m本回合盈亏\x1b[0m',
          '\x1b[37m总盈亏\x1b[0m'
        ],
        colWidths: [14, 12, 14, 14, 20, 20],
        colAligns: ['left', 'right', 'right', 'right', 'right', 'right'],
        style: { 
          'padding-left': 1,
          'padding-right': 1,
          compact: true
        },
        chars: { 
          'top': '', 'top-mid': '', 'top-left': '', 'top-right': '',
          'bottom': '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '',
          'left': '', 'left-mid': '', 'mid': '', 'mid-mid': '',
          'right': '', 'right-mid': '', 'middle': '' 
        }
      });
      
      sortedStocks.forEach(([stock, qty]) => {
        const currentPrice = this.stockPrices[stock];
        const costPerShare = player.getStockCost(stock);
        
        // 本回合盈亏计算
        const previousPrice = this.previousStockPrices[stock] || currentPrice;
        const roundProfit = (currentPrice - previousPrice) * qty;
        const roundProfitPercent = previousPrice !== 0 ? 
          ((currentPrice - previousPrice) / previousPrice * 100).toFixed(1) : '0.0';
        
        // 总盈亏计算
        const totalProfit = (currentPrice - costPerShare) * qty;
        const totalProfitPercent = costPerShare !== 0 ? 
          ((currentPrice - costPerShare) / costPerShare * 100).toFixed(1) : '0.0';

        const roundProfitColor = roundProfit >= 0 ? COLORS.Green : COLORS.Red;
        const totalProfitColor = totalProfit >= 0 ? COLORS.Green : COLORS.Red;

        table.push([
          stock,
          qty.toFixed(0),
          formatNumber(costPerShare, 2),
          formatNumber(currentPrice, 2),
          `${roundProfitColor}${formatNumber(roundProfit, 2)} (${roundProfitPercent}%)${COLORS.Reset}`,
          `${totalProfitColor}${formatNumber(totalProfit, 2)} (${totalProfitPercent}%)${COLORS.Reset}`
        ]);
      });
      console.log(table.toString());
    } else {
      console.log('股票持仓: 无');
    }

    if (!isFirstRound) {
      console.log(
        `总资产: ${COLORS.Cyan}${formatNumber(currentNetWorth, 2).padStart(12)}${COLORS.Reset} ` +
        `[ ${change >= 0 ? COLORS.Green : COLORS.Red}` +
        `${formatNumber(change, 2)}${COLORS.Reset} | ` +
        `${change >= 0 ? COLORS.Green : COLORS.Red}` +
        `${Math.abs(changePercent).toFixed(2)}%${COLORS.Reset} ]`
      );
    }
  }

  async play() {
    console.log(`初始牌库数量: ${this.deck.length}`);
    
    // 初始发牌每人4张
    for (let i = 0; i < 4; i++) {
      this.players.forEach(player => {
        if (this.deck.length > 0) {
          player.drawCard(this.deck);
        }
      });
    }

    console.log("\n游戏开始！");
    this.displayActiveStocks();
    
    // 初始资产统计
    this.players.forEach(player => {
      player.previousNetWorth = player.calculateNetWorth(this.stockPrices);
      player.previousStocks = {}; // 初始化为空持仓
      this.displayPlayerAssets(player, true);
    });
    
    for (let i = 0; i < this.totalRounds; i++) {
      await this.playRound();
    }
    
    console.log("\n游戏结束");
    this.players.sort((a, b) => b.calculateNetWorth(this.stockPrices) - a.calculateNetWorth(this.stockPrices));
    console.log(`获胜者是 ${this.players[0].name}，资产: ${this.players[0].calculateNetWorth(this.stockPrices)}`);
  }
}

// 修改游戏启动方式
async function runGame() {
  try {
    const game = await new IntoTheWaves().initialize();
    await game.play();
  } catch (error) {
    console.error('游戏启动失败:', error);
  }
}

// 启动游戏
runGame();

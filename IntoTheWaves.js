// IntoTheWaves 股票投资卡牌游戏模型

// 新增依赖
const CardLoader = require('./src/CardLoader');
const { createCardInstance } = require('./src/CardFactory');
const Player = require('./Player');  // 添加导入语句
const Table = require('cli-table3');
const inquirer = require('inquirer'); // 添加inquirer依赖
const StockLoader = require('./src/StockLoader');

// 在类顶部添加颜色常量
const COLORS = {
  Reset: "\x1b[0m",
  Green: "\x1b[32m",
  Red: "\x1b[31m",
  Cyan: "\x1b[36m",
  Yellow: "\x1b[33m",
  Blue: "\x1b[34m",
  Magenta: "\x1b[35m"
};

// 在颜色常量后添加格式化函数
const formatNumber = (num, decimals = 0) => {
  return num.toFixed(decimals)
           .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

// 添加股票类别波动率范围定义
const VOLATILITY_RANGES = {
  "初创": { min: 0.3, max: 0.4 },   // 高风险高波动
  "成长": { min: 0.1, max: 0.3 },  // 中高波动
  "成熟": { min: -0.1, max: 0.1 }, // 中低波动
  "衰退": { min: 0.05, max: 0.2 }    // 低波动但有不确定性
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
    
    // 根据标签确定波动率范围并随机生成初始波动率
    this.volatilityRange = this.determineVolatilityRange();
    this.volatility = this.generateInitialVolatility();
  }

  /**
   * 根据股票标签确定波动率范围
   * @returns {Object} 包含min和max的波动率范围对象
   */
  determineVolatilityRange() {
    // 默认范围
    let range = { min: 0.2, max: 0.4 };
    
    // 现在需要专门检查stage标签(成长阶段)
    for (const tag of this.tags) {
      if (VOLATILITY_RANGES[tag]) {
        range = VOLATILITY_RANGES[tag];
        break; // 优先使用找到的第一个类别范围
      }
    }
    
    return range;
  }
  
  /**
   * 在股票的波动率范围内随机生成初始波动率
   * @returns {number} 初始波动率
   */
  generateInitialVolatility() {
    const { min, max } = this.volatilityRange;
    return min + Math.random() * (max - min);
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
   * 根据股票标签调整波动率，但保持在股票类别的合理范围内
   */
  adjustVolatilityByTags() {
    let volatilityModifier = 1.0;
    
    // 应用标签修饰符，现在明确检查stage标签
    if (this.tags.includes("成长")) volatilityModifier *= 1.2;
    if (this.tags.includes("衰退")) volatilityModifier *= 0.9;
    if (this.tags.includes("初创")) volatilityModifier *= 1.3;
    if (this.tags.includes("成熟")) volatilityModifier *= 0.8;
    
    // 计算新的波动率
    let newVolatility = this.volatility * volatilityModifier;
    
    // 确保波动率保持在该股票类别的范围内
    const { min, max } = this.volatilityRange;
    this.volatility = Math.min(Math.max(min, newVolatility), max);
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
    this.allStocks = await this.initializeAllStocks();
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
    console.log(`活跃股票数量: ${this.activeStocks.length}`);
    if (this.activeStocks.length > 0) {
      console.log('活跃股票示例:', this.activeStocks[0]);
    }
    
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
    
    console.log(`生成的股票卡数量: ${stockCards.length}`);
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

  async initializeAllStocks() {
    const stocksData = await StockLoader.loadStocksFromCSV('./data/stocks.csv');
    console.log(`加载到${stocksData.length}只股票`);
    // 打印一个股票示例看看结构
    if (stocksData.length > 0) {
      console.log('股票数据示例:', stocksData[0]);
    }
    return stocksData.map(data => new Stock(data.name, data.tags));
  }

  selectRandomStocks(count) {
    console.log(`全部股票数量: ${this.allStocks.length}`);
    const shuffled = [...this.allStocks].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, count);
    console.log(`选择了${selected.length}只股票`);
    return selected;
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
        '\x1b[37m波动率\x1b[0m',
        '\x1b[37m类别\x1b[0m'
      ],
      colWidths: [16, 12, 12, 12, 16],
      colAligns: ['left', 'right', 'right', 'right', 'left'],
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
      
      // 获取股票类别
      const category = stock.tags.find(tag => 
        ["初创", "成长", "成熟", "衰退"].includes(tag)
      ) || "未分类";
      
      table.push([
        stock.name,
        formatNumber(currentPrice, 2),
        `${changeColor}${changeSymbol}${Math.abs(changePercent)}%${COLORS.Reset}`,
        `${Math.round(stock.volatility*100)}%`,
        category
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

  /**
   * 使用inquirer实现交互式选择
   * @param {string} message - 提示信息
   * @param {Array} choices - 选项数组
   * @returns {Promise<string>} 用户选择的选项
   */
  async askForSelection(message, choices) {
    const result = await inquirer.prompt([
      {
        type: 'list',
        name: 'selected',
        message: message,
        choices: choices,
        pageSize: 10 // 一次显示的选项数量
      }
    ]);
    return result.selected;
  }

  /**
   * 使用inquirer实现数字输入
   * @param {string} message - 提示信息
   * @param {number} defaultValue - 默认值
   * @returns {Promise<number>} 用户输入的数字
   */
  async askForNumber(message, defaultValue = 0) {
    const result = await inquirer.prompt([
      {
        type: 'number',
        name: 'value',
        message: message,
        default: defaultValue,
        validate: (input) => {
          if (isNaN(input)) {
            return '请输入有效的数字';
          }
          return true;
        }
      }
    ]);
    return result.value;
  }

  /**
   * 使用inquirer实现确认选择
   * @param {string} message - 提示信息
   * @returns {Promise<boolean>} 用户选择结果
   */
  async askForConfirmation(message) {
    const result = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: message,
        default: false
      }
    ]);
    return result.confirmed;
  }

  async playerTurn(player) {
    console.log(`\n${COLORS.Cyan}${player.name}的回合${COLORS.Reset}`);
    
    if (player.hand.length === 0) {
      console.log(`${player.name} 没有手牌，跳过出牌阶段`);
      return;
    }
    
    // 使用循环允许玩家在取消操作后重新选择手牌
    let cardPlayed = false;
    
    while (!cardPlayed) {
      // 准备手牌选项，添加颜色和描述信息
      const cardChoices = player.hand.map((card, index) => {
        // 根据卡牌类型设置不同颜色
        let cardColor = COLORS.Reset;
        if (card.type === '交易') cardColor = COLORS.Green;
        else if (card.type === '事件') cardColor = COLORS.Yellow;
        else if (card.type === '天灾') cardColor = COLORS.Red;
        
        // 构建选项显示文本
        const displayText = `${cardColor}${card.name}${COLORS.Reset} - ${card.description || '无描述'}`;
        
        return {
          name: displayText,
          value: index,
          short: card.name
        };
      });
      
      // 如果没有手牌，退出循环
      if (cardChoices.length === 0) {
        console.log(`${player.name} 没有手牌，跳过出牌阶段`);
        return;
      }
      
      // 使用交互式选择
      const cardIndex = await this.askForSelection(`${player.name}，请选择要打出的卡牌:`, cardChoices);
      
      // 打出选中的卡牌
      const playedCard = player.playCard(cardIndex);
      console.log(`${player.name} 打出了 ${COLORS.Cyan}${playedCard.name}${COLORS.Reset}`);
      
      // 应用卡牌效果，并检查是否需要重新选择
      const effectCompleted = await playedCard.applyEffect(player, this);
      
      // 如果卡牌效果完成，则结束循环
      if (effectCompleted !== false) {
        cardPlayed = true;
      } else {
        console.log(`${COLORS.Yellow}返回手牌选择阶段${COLORS.Reset}`);
      }
    }
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
    // 检查是否已安装inquirer
    try {
      require.resolve('inquirer');
    } catch (e) {
      console.log('正在安装必要的依赖...');
      console.log('请运行: npm install inquirer');
      process.exit(1);
    }
    
    const game = await new IntoTheWaves().initialize();
    await game.play();
  } catch (error) {
    console.error('游戏启动失败:', error);
  }
}

// 启动游戏
runGame();

// ITW_stockPrice.js - 股票价格变动算法测试项目

const fs = require('fs');
const csv = require('csv-parser');
const inquirer = require('inquirer');
const Table = require('cli-table3');

// 颜色常量
const COLORS = {
  Reset: "\x1b[0m",
  Green: "\x1b[32m",
  Red: "\x1b[31m",
  Cyan: "\x1b[36m",
  Yellow: "\x1b[33m",
  Blue: "\x1b[34m",
  Magenta: "\x1b[35m"
};

// 格式化函数
const formatNumber = (num, decimals = 0) => {
  return num.toFixed(decimals)
           .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

// 股票类别波动率范围定义
const VOLATILITY_RANGES = {
  "初创": { min: 0.3, max: 0.4 },   // 高风险高波动
  "成长": { min: 0.1, max: 0.3 },  // 中高波动
  "成熟": { min: -0.1, max: 0.1 }, // 中低波动
  "衰退": { min: 0.05, max: 0.2 }    // 低波动但有不确定性
};

// 股票类
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

  // 正态分布生成方法
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
    
    return change; // 返回变动百分比
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
}

/**
 * 从CSV加载股票数据
 */
async function loadStocksFromCSV(filePath) {
  return new Promise((resolve, reject) => {
    const stocks = [];
    console.log(`开始读取股票文件: ${filePath}`);
    
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        // 处理BOM问题 - 获取实际的name键名
        const nameKey = Object.keys(row).find(key => key === 'name' || key === '\ufeffname' || key.includes('name'));
        
        // 转换CSV行数据为股票数据对象
        const stock = {
          name: nameKey ? row[nameKey] : null,
          // 确保所有字段存在且被正确读取
          tags: [row.field, row.business, row.stage].filter(tag => tag && tag.trim() !== '')
        };
        
        // 跳过无效行
        if (!stock.name) return;
        
        stocks.push(stock);
      })
      .on('end', () => {
        console.log(`CSV文件读取完成，加载了${stocks.length}只股票`);
        resolve(stocks);
      })
      .on('error', (error) => {
        console.error('CSV文件读取错误:', error);
        reject(error);
      });
  });
}

class StockSimulator {
  constructor() {
    this.currentRound = 0;
    this.allStocks = [];
    this.activeStocks = [];
    this.stockPrices = {};
    this.previousStockPrices = {};
  }

  async initialize() {
    // 加载所有股票数据
    const stocksData = await loadStocksFromCSV('./data/stocks.csv');
    this.allStocks = stocksData.map(data => new Stock(data.name, data.tags));
    
    // 选择本局活跃股票
    this.selectRandomStocks(6);
    
    // 初始化价格
    this.stockPrices = this.initializeStockPrices();
    this.previousStockPrices = {...this.stockPrices};
    
    this.currentRound = 0;
    
    console.log(`游戏初始化完成，选择了${this.activeStocks.length}只股票`);
    return this;
  }

  selectRandomStocks(count) {
    const shuffled = [...this.allStocks].sort(() => 0.5 - Math.random());
    this.activeStocks = shuffled.slice(0, count);
    console.log(`选择了${this.activeStocks.length}只股票`);
  }

  initializeStockPrices() {
    return this.activeStocks.reduce((prices, stock) => {
      prices[stock.name] = stock.price;
      return prices;
    }, {});
  }

  updateStockPrices() {
    this.previousStockPrices = {...this.stockPrices};
    this.activeStocks.forEach(stock => {
      stock.updatePrice();
      this.stockPrices[stock.name] = stock.price;
    });
    this.currentRound++;
  }

  displayActiveStocks() {
    console.log(`\n第 ${this.currentRound} 回合 当前活跃股列表：`);
    const table = new Table({
      head: [
        '\x1b[37m股票名称\x1b[0m',
        '\x1b[37m当前价格\x1b[0m',
        '\x1b[37m涨跌幅\x1b[0m',
        '\x1b[37m波动率\x1b[0m',
        '\x1b[37m类别\x1b[0m',
        '\x1b[37m行业\x1b[0m',
        '\x1b[37m业务\x1b[0m'
      ],
      colWidths: [18, 12, 12, 10, 8, 12, 15],
      colAligns: ['left', 'right', 'right', 'right', 'left', 'left', 'left'],
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
      
      let changePercent = this.currentRound === 0 ? 0 : 
        ((currentPrice - previousPrice) / previousPrice * 100).toFixed(2);
      let changeSymbol = changePercent > 0 ? '↑' : (changePercent < 0 ? '↓' : '-');
      const changeColor = changeSymbol === '↑' ? COLORS.Green : 
                        changeSymbol === '↓' ? COLORS.Red : COLORS.Reset;
      
      // 获取股票类别和标签
      const stage = stock.tags.find(tag => 
        ["初创", "成长", "成熟", "衰退"].includes(tag)
      ) || "未分类";
      
      const field = stock.tags.find(tag => 
        !["初创", "成长", "成熟", "衰退"].includes(tag)
      ) || "";
      
      const business = stock.tags.find((tag, index) => 
        index === 1 && !["初创", "成长", "成熟", "衰退"].includes(tag)
      ) || "";
      
      table.push([
        stock.name,
        formatNumber(currentPrice, 2),
        `${changeColor}${changeSymbol}${Math.abs(changePercent)}%${COLORS.Reset}`,
        `${Math.round(stock.volatility*100)}%`,
        stage,
        field,
        business
      ]);
    });
    console.log(table.toString());
  }

  async showStockDetails(stockName) {
    const stock = this.activeStocks.find(s => s.name === stockName);
    if (!stock) {
      console.log(`未找到股票: ${stockName}`);
      return;
    }

    console.log(`\n${COLORS.Cyan}===== ${stock.name} 详细信息 =====${COLORS.Reset}`);
    console.log(`当前价格: ${formatNumber(stock.price, 2)}`);
    console.log(`波动率: ${Math.round(stock.volatility*100)}%`);
    console.log(`波动率范围: ${Math.round(stock.volatilityRange.min*100)}% - ${Math.round(stock.volatilityRange.max*100)}%`);
    console.log(`类别: ${stock.tags.join(', ')}`);
    
    // 模拟未来10个回合的价格波动
    console.log(`\n${COLORS.Yellow}===== 价格波动模拟 (10回合) =====${COLORS.Reset}`);
    const simulationTable = new Table({
      head: ['回合', '价格', '涨跌幅'],
      colWidths: [10, 10, 10],
    });
    
    let simulatedPrice = stock.price;
    for (let i = 1; i <= 10; i++) {
      // 创建临时股票对象进行模拟
      const tempStock = new Stock(stock.name, stock.tags);
      tempStock.price = simulatedPrice;
      tempStock.volatility = stock.volatility;
      tempStock.volatilityRange = {...stock.volatilityRange};
      
      const change = tempStock.updatePrice();
      const changePercent = (change * 100).toFixed(2);
      const changeSymbol = change > 0 ? '↑' : (change < 0 ? '↓' : '-');
      const color = change > 0 ? COLORS.Green : (change < 0 ? COLORS.Red : COLORS.Reset);
      
      simulationTable.push([
        i, 
        formatNumber(tempStock.price, 2),
        `${color}${changeSymbol}${Math.abs(changePercent)}%${COLORS.Reset}`
      ]);
      
      simulatedPrice = tempStock.price;
    }
    
    console.log(simulationTable.toString());
    
    // 等待用户按键返回
    await inquirer.prompt([
      {
        type: 'input',
        name: 'continue',
        message: '按Enter键返回主菜单...'
      }
    ]);
  }

  async mainMenu() {
    while (true) {
      this.displayActiveStocks();
      
      const choices = [
        ...this.activeStocks.map(s => ({ name: `查看 ${s.name} 详情`, value: `stock_${s.name}` })),
        { name: '进入下一回合', value: 'next_round' },
        { name: '重新开始游戏', value: 'restart' },
        { name: '退出', value: 'exit' }
      ];
      
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: '请选择操作:',
          choices: choices,
          pageSize: 20
        }
      ]);
      
      if (action.startsWith('stock_')) {
        const stockName = action.substring(6);
        await this.showStockDetails(stockName);
      } else if (action === 'next_round') {
        this.updateStockPrices();
      } else if (action === 'restart') {
        await this.initialize();
      } else if (action === 'exit') {
        console.log('感谢使用股价模拟器，再见！');
        process.exit(0);
      }
    }
  }
}

async function runSimulator() {
  try {
    const simulator = await new StockSimulator().initialize();
    await simulator.mainMenu();
  } catch (error) {
    console.error('程序启动失败:', error);
  }
}

// 启动模拟器
runSimulator();
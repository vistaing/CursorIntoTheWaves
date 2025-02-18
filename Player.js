class Player {
  constructor(name) {
    this.name = name;
    this.hand = [];
    this.cash = 50000;
    this.stocks = {};
    this.stockCosts = {}; // {股票名: [总成本, 总股数]}
    this.previousStocks = {};
    this.previousNetWorth = 50000;
  }

  /**
   * 抽卡处理（支持天灾卡补偿机制）
   * @param {Array} deck - 牌库
   * @param {IntoTheWaves} game - 游戏实例
   * @param {number} retryLimit=5 - 最大补偿次数防止死循环
   */
  drawCard(deck, game, retryLimit = 5) {
    if (retryLimit <= 0) {
      console.log('达到最大补偿次数');
      return;
    }
    
    if (deck.length === 0) {
      console.log('牌库已空');
      return;
    }

    const card = deck.pop();
    if (!card) {
      console.log('抽到空卡');
      return;
    }

    if (card.type === '天灾卡') {
      console.log(`⚠️ 抽到天灾卡：${card.name}`);
      game.disasterZone.push(card);
      this.drawCard(deck, game, retryLimit - 1);
    } else {
      this.hand.push(card);
      console.log(`抽到普通卡：${card.name}`);
    }
  }

  async playerTurn(player) {
    console.log(`\n${player.name}的回合`);
    console.log(`当前手牌（${player.hand.length}张）：`); // 显示手牌数量
    // ...后续代码不变...
  }

  sellStock(stockName, quantity, price) {
    const current = this.stocks[stockName] || 0;
    const originalQty = current;
    this.stocks[stockName] = current - quantity;
    
    // 处理多转空的情况
    if (originalQty > 0 && quantity > originalQty) {
      // 平多单部分
      const closeQty = originalQty;
      const shortQty = quantity - originalQty;
      
      // 平多单成本
      const costPerShare = this.getStockCost(stockName);
      this.stockCosts[stockName][0] -= costPerShare * closeQty;
      this.stockCosts[stockName][1] -= closeQty;
      
      // 新增空单成本
      this.stockCosts[stockName][0] += price * shortQty;
      this.stockCosts[stockName][1] -= shortQty;
    } else if (quantity > 0) {
      if (!this.stockCosts[stockName]) {
        this.stockCosts[stockName] = [0, 0];
      }
      this.stockCosts[stockName][0] += price * quantity;
      this.stockCosts[stockName][1] -= quantity;
    }
    
    this.cash += quantity * price;
    return true;
  }

  calculateNetWorth(stockPrices) {
    return this.cash + Object.entries(this.stocks).reduce((total, [stock, qty]) => {
      return total + (qty * stockPrices[stock]);
    }, 0);
  }

  playCard(index) {
    if (index >= 0 && index < this.hand.length) {
      return this.hand.splice(index, 1)[0];
    }
    return null;
  }

  buyStock(stockName, quantity, price) {
    const cost = quantity * price;
    if (this.cash >= cost) {
      this.cash -= cost;
      const currentQty = this.stocks[stockName] || 0;
      
      // 处理空转多的情况
      if (currentQty < 0) {
        const coverQty = Math.min(quantity, -currentQty);
        const remainQty = quantity - coverQty;
        
        // 平空单部分
        const costPerShare = this.getStockCost(stockName);
        this.stockCosts[stockName][0] -= costPerShare * coverQty;
        this.stockCosts[stockName][1] += coverQty;
        
        // 新增多单部分
        if (remainQty > 0) {
          this.stockCosts[stockName][0] += price * remainQty;
          this.stockCosts[stockName][1] += remainQty;
        }
      } else {
        if (!this.stockCosts[stockName]) {
          this.stockCosts[stockName] = [0, 0];
        }
        this.stockCosts[stockName][0] += cost;
        this.stockCosts[stockName][1] += quantity;
      }
      
      this.stocks[stockName] = (this.stocks[stockName] || 0) + quantity;
      return true;
    }
    return false;
  }

  getStockCost(stockName) {
    if (!this.stockCosts[stockName] || this.stockCosts[stockName][1] === 0) {
      return 0;
    }
    // 做空时股数为负，计算绝对值
    const totalQty = Math.abs(this.stockCosts[stockName][1]);
    return totalQty > 0 ? this.stockCosts[stockName][0] / totalQty : 0;
  }
}

module.exports = Player;

// 测试代码
const p = new Player("测试");
console.log('方法检查:', {
  sellStock: typeof p.sellStock,
  buyStock: typeof p.buyStock
}); 
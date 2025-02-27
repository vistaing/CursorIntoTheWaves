/**
 * 卡牌对象工厂 - 根据配置创建具体卡牌实例
 */
class CardFactory {
  /**
   * 创建卡牌实例
   * @param {Object} config - 卡牌配置对象 
   * @returns {BaseCard|null} 卡牌实例或null（当类型无效时）
   */
  static create(config) {
    // 根据卡牌类型分发到具体子类
    switch(config.type) {
      case '交易': return new TradeCard(config);
      case '事件': return new EventCard(config);
      case '天灾': return new DisasterCard(config);
      default: 
        console.warn(`未知卡牌类型: ${config.type}`);
        return null;
    }
  }
}

/**
 * 卡牌基类 - 定义卡牌通用属性和接口
 */
class BaseCard {
  /**
   * @param {Object} config - 包含以下属性的配置对象:
   *  {string} name - 卡牌名称
   *  {string} type - 卡牌类型
   *  {string} effect - 效果标识符
   *  {number} power - 效果强度
   *  {string} description - 描述文本
   *  {Array} tags - 标签数组
   */
  constructor(config) {
    this.name = config.name;
    this.type = config.type || '未知';
    this.effect = config.effect;
    this.power = config.power;
    this.description = config.description || '无描述';
    this.tags = config.tags || [];
    this.stockName = config.stockName || '';
  }

  /**
   * 应用卡牌效果（抽象方法）
   * @param {Player} player - 使用卡牌的玩家
   * @param {IntoTheWaves} game - 游戏实例
   * @throws {Error} 必须由子类实现
   */
  async applyEffect(player, game) {
    throw new Error('必须在子类中实现 applyEffect 方法');
  }
  
  /**
   * 获取卡牌详细信息（用于显示）
   * @returns {string} 卡牌详细信息
   */
  getDetails() {
    return `${this.name} [${this.type}] - ${this.description}`;
  }
}

/**
 * 交易卡 - 处理股票买卖相关操作
 */
class TradeCard extends BaseCard {
  /**
   * 执行股票交易
   * @param {Player} player - 当前玩家
   * @param {IntoTheWaves} game - 游戏实例
   * @returns {boolean} 是否完成交易，false表示需要重新选择手牌
   */
  async applyEffect(player, game) {
    if (!this.stockName) {
      console.error('交易卡配置错误：缺少股票名称');
      return true; // 错误情况下仍然视为完成
    }

    console.log('当前股票信息:', { stockName: this.stockName, currentPrice: game.stockPrices[this.stockName] });

    // 使用新的交互方式选择操作
    const action = await game.askForSelection(
      `当前${this.stockName}价格 ${game.stockPrices[this.stockName]}，请选择操作:`,
      [
        { name: '买入 (B)', value: 'B' },
        { name: '卖出 (S)', value: 'S' },
        { name: '取消', value: 'C' }
      ]
    );
    
    if (action === 'C') {
      console.log('取消交易，返回手牌选择');
      // 将卡牌放回玩家手中
      player.hand.push(this);
      return false; // 返回false表示需要重新选择手牌
    }

    if (action === 'B') {
      const maxQty = Math.floor(player.cash / game.stockPrices[this.stockName]);
      const qty = await game.askForNumber(
        `最多可买${maxQty}股，输入购买数量:`,
        Math.min(100, maxQty)
      );
      
      if (qty <= 0) {
        console.log('取消购买，返回手牌选择');
        player.hand.push(this);
        return false;
      }
      
      if (player.buyStock(this.stockName, qty, game.stockPrices[this.stockName])) {
        console.log(`${player.name} 成功购买 ${qty} 股 ${this.stockName}`);
      } else {
        console.log(`${player.name} 现金不足，无法购买`);
        // 交易失败也返回手牌选择
        player.hand.push(this);
        return false;
      }
    } else if (action === 'S') {
      const heldQty = player.stocks[this.stockName] || 0;
      
      // 提示卖空风险
      if (heldQty <= 0) {
        const confirmed = await game.askForConfirmation('警告：卖空操作可能导致无限亏损！是否继续?');
        if (!confirmed) {
          console.log('取消卖出，返回手牌选择');
          player.hand.push(this);
          return false;
        }
      }
      
      const qty = await game.askForNumber(
        `当前持仓${heldQty}股（输入卖出数量，可超过持仓进行卖空）:`,
        heldQty > 0 ? heldQty : 100
      );
      
      if (qty <= 0) {
        console.log('取消卖出，返回手牌选择');
        player.hand.push(this);
        return false;
      }
      
      player.sellStock(this.stockName, qty, game.stockPrices[this.stockName]);
      console.log(`${player.name} 成功卖出 ${qty} 股 ${this.stockName}`);
    }
    
    return true; // 交易完成
  }
}

class EventCard extends BaseCard {
  // 事件卡的效果实现需要根据具体需求来实现
  async applyEffect(player, game) {
    console.log(`触发事件: ${this.description}`);
    // 根据事件类型实现具体效果
  }
}

class DisasterCard extends BaseCard {
  constructor(config) {
    super(config);
    this.active = true;
  }

  async applyEffect(player, game) {
    console.log(`触发天灾: ${this.description}`);
    // 实现天灾卡效果...
  }
}

module.exports = {
  createCardInstance: CardFactory.create,
  BaseCard,
  TradeCard,
  EventCard,
  DisasterCard
}; 
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
    this.type = config.type;
    this.effect = config.effect;
    this.power = config.power;
    this.description = config.description;
    this.tags = config.tags;
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
}

/**
 * 交易卡 - 处理股票买卖相关操作
 */
class TradeCard extends BaseCard {
  /**
   * 执行股票交易
   * @param {Player} player - 当前玩家
   * @param {IntoTheWaves} game - 游戏实例
   */
  async applyEffect(player, game) {
    if (!this.stockName) {
      console.error('交易卡配置错误：缺少股票名称');
      return;
    }

    console.log('当前股票信息:', { stockName: this.stockName, currentPrice: game.stockPrices[this.stockName] });

    let action = '';
    try {
      action = (await game.askForInput(
        `当前${this.stockName}价格 ${game.stockPrices[this.stockName]}，请选择操作 (B/S): `
      ) || '').toUpperCase().trim();
      
      if (!['B', 'S'].includes(action)) {
        console.log('无效操作，请输入 B 或 S');
        return;
      }
    } catch (error) {
      console.error('输入处理出错:', error);
      return;
    }

    if (action === 'B') {
      const maxQty = Math.floor(player.cash / game.stockPrices[this.stockName]);
      const qty = parseInt(await game.askForInput(
        `最多可买${maxQty}股，输入购买数量: `
      ));
      player.buyStock(this.stockName, qty, game.stockPrices[this.stockName]);
    } else if (action === 'S') {
      console.log('警告：卖空操作可能导致无限亏损！');
      const heldQty = player.stocks[this.stockName] || 0;
      const qty = parseInt(await game.askForInput(
        `当前持仓${heldQty}股（输入卖出数量，可超过持仓进行卖空）: `
      ));
      if (isNaN(qty)) {
        console.log('无效数量');
        return;
      }
      player.sellStock(this.stockName, qty, game.stockPrices[this.stockName]); // 需要实现sellStock方法
    }
  }
}

class EventCard extends BaseCard {
  // 事件卡的效果实现需要根据具体需求来实现
}

class DisasterCard extends BaseCard {
  constructor(config) {
    super(config);
    this.active = true;
  }

  async applyEffect(player, game) {
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
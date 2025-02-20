const fs = require('fs');
const csv = require('csv-parser');

/**
 * 卡牌配置加载器 - 负责从CSV文件加载卡牌配置数据
 */
class CardLoader {
  /**
   * 从CSV文件加载卡牌配置
   * @param {string} filePath - CSV文件路径
   * @returns {Promise<Array>} 卡牌配置对象的数组
   */
  static async loadCardsFromCSV(filePath) {
    return new Promise((resolve, reject) => {
      const cards = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          // 转换CSV行数据为卡牌配置对象
          const card = {
            name: row.name,        // 卡牌名称
            type: row.type,        // 卡牌类型（交易/事件/策略）
            effect: row.effect || 'none',    // 效果标识符（用于效果映射）
            power: parseFloat(row.power),  // 效果强度系数
            description: row.description, // 卡牌描述
            tags: (row.tags || '').split(','),     // 关联标签（用于卡牌筛选）
          };
          
          // 跳过无效行
          if (!card.name) return;
          
          cards.push(card);
        })
        .on('end', () => resolve(cards))
        .on('error', reject);
    });
  }
}

module.exports = CardLoader; 
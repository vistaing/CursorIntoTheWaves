const fs = require('fs');
const csv = require('csv-parser');

/**
 * 股票数据加载器 - 从CSV文件加载股票数据
 */
class StockLoader {
  /**
   * 从CSV文件加载股票数据
   * @param {string} filePath - CSV文件路径
   * @returns {Promise<Array>} 股票数据对象的数组
   */
  static async loadStocksFromCSV(filePath) {
    return new Promise((resolve, reject) => {
      const stocks = [];
      console.log(`开始读取股票文件: ${filePath}`);
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          // 调试: 打印一行CSV数据看看结构
          if (stocks.length === 0) {
            console.log('CSV行数据样例:', row);
          }
          
          // 处理BOM问题 - 获取实际的name键名
          const nameKey = Object.keys(row).find(key => key === 'name' || key === '\ufeffname' || key.includes('name'));
          
          // 转换CSV行数据为股票数据对象
          const stock = {
            name: nameKey ? row[nameKey] : null,
            // 确保所有字段存在且被正确读取
            tags: [row.field, row.business, row.stage].filter(tag => tag && tag.trim() !== '')
          };
          
          // 跳过无效行
          if (!stock.name) {
            console.log('跳过无效行:', row);
            return;
          }
          
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
}

module.exports = StockLoader; 
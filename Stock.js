constructor(name, tags) {
  this.name = name;
  this.tags = tags;
  this.price = this.generateInitialPrice();
  this.volatility = this.calculateBaseVolatility();
}

calculateBaseVolatility() {
  const VOLATILITY_RANGES = {
    '初创': [0.4, 0.6],  // 40%-60%
    '成长': [0.3, 0.4],  // 30%-40%
    '成熟': [0.2, 0.3],  // 20%-30%
    '衰退': [0.5, 0.7]   // 50%-70%
  };
  
  const category = this.tags.find(tag => VOLATILITY_RANGES[tag]);
  if (category) {
    const [min, max] = VOLATILITY_RANGES[category];
    return Math.random() * (max - min) + min;
  }
  return 0.3; // 默认值
}

adjustVolatilityByTags() {
  let volatilityModifier = 1.0;
  if (this.tags.includes("成长")) volatilityModifier *= 1.5;
  if (this.tags.includes("衰退")) volatilityModifier *= 0.8;
  if (this.tags.includes("初创")) volatilityModifier *= 2.0;
  if (this.tags.includes("成熟")) volatilityModifier *= 0.7;
  
  this.volatility = Math.min(Math.max(0.1, this.volatility * volatilityModifier), 0.7);
} 
// 4人のパーティメンバー定義（バスターズの4ロール構成）
export const PARTY_DATA = [
  {
    id: 'attacker',
    name: 'アタッカー',
    role: 'ATTACKER',
    color: 0xff4757, // 赤
    cssColor: '#ff4757',
    maxHp: 140,
    speed: 9.5,
    attackRange: 3.2,
    attackDamage: 24,
    attackCooldown: 0.45,
    skill1Name: 'ダッシュ',
    skill2Name: '回転斬り',
    ultName: '百烈斬り'
  },
  {
    id: 'tank',
    name: 'タンク',
    role: 'TANK',
    color: 0xffa502, // オレンジ
    cssColor: '#ffa502',
    maxHp: 260,
    speed: 7.2,
    attackRange: 2.8,
    attackDamage: 18,
    attackCooldown: 0.6,
    skill1Name: 'ガード',
    skill2Name: '挑発',
    ultName: '鉄壁バリア'
  },
  {
    id: 'healer',
    name: 'ヒーラー',
    role: 'HEALER',
    color: 0x2ed573, // 緑
    cssColor: '#2ed573',
    maxHp: 120,
    speed: 8.5,
    attackRange: 9.0, // 遠距離
    attackDamage: 14,
    attackCooldown: 0.65,
    skill1Name: 'ステップ',
    skill2Name: '回復の陣',
    ultName: '全体大回復'
  },
  {
    id: 'ranger',
    name: 'レンジャー',
    role: 'RANGER',
    color: 0x1e90ff, // 青
    cssColor: '#1e90ff',
    maxHp: 130,
    speed: 10.0,
    attackRange: 8.5, // 遠距離
    attackDamage: 19,
    attackCooldown: 0.5,
    skill1Name: 'ワープ',
    skill2Name: '足止め術',
    ultName: '雷撃の術'
  }
];

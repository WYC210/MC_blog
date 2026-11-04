export default {
  name: 'Wyc',
  // 64×64 PNG, 4px arms, ≤ 18000 bytes. docs/avatar.md
  skin: '',
  languages: ['zh', 'en'],
  weather: { city: '上海', cityEn: 'Shanghai', latitude: 31.23, longitude: 121.47, timezone: 'Asia/Shanghai' },
  start: { weather: 'auto', time: 'auto' },
  dock: ['blog', 'about', 'mailbox', 'phone'],
  // Optional NPC based on the showcase character.
  resident: { enabled: true, name: 'Terry', skin: 'assets/terry-skin.png' },
  computer: {
    apps: [
      { id: 'github', name: 'GitHub', en: 'GitHub', category: 'dev', icon: 'github', url: 'https://github.com/WYC210' },
      { id: 'game-1', name: '余烬行囊', en: 'Ember Satchel', category: 'games', icon: 'works', url: 'https://game.wyc21.com/' },
      { id: 'game-2', name: 'echoes', en: 'echoes', category: 'dev', icon: 'works', url: 'https://blog.wyc21.com/' },
      { id: 'game-3', name: '我的游戏 3', en: 'My game 3', category: 'games', icon: 'works', url: '' },
    ],
  },
  mailbox: { endpoint: '', email: 'wyc@linux.do', turnstileSitekey: '' },
  badge: true,
};

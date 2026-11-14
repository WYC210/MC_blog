export const RESIDENT_WELCOME = [
  '你好，欢迎来到我的世界，随意参观吧。想聊些什么？',
  'Hello, welcome to my world. Feel free to explore! What would you like to talk about?',
];

export const RESIDENT_TOPICS = [
  {
    id: 'qin-legend',
    label: ['秦岛有什么传说？', 'What is the legend of Qin Island?'],
    answer: [
      '传说，如果有人夺取秦始皇的玉玺，就可以唤醒沉睡的兵马俑。你可以留意雕像附近那位四处走动的秦始皇，靠近他试着互动。不过……惊动禁卫之后，可要小心啦！这是我在这个世界里藏下的一段奇遇。',
      'Legend has it that taking Qin Shi Huang’s imperial seal can awaken the sleeping terracotta warriors. Look for the Emperor wandering near the statue and try interacting with him. But beware of stirring his guards! This is a little adventure hidden in my world.',
    ],
  },
  {
    id: 'home-fun',
    label: ['主岛有什么好玩的？', 'What can I do on the main island?'],
    answer: [
      '东边可以看看大耳狗摩天轮，北岸可以乘过山车，海边可以钓鱼、开快艇，也可以找张躺椅歇一会儿。工作台的家里有钢琴和电脑，乐魂一楼是健身房，二楼是我的交易研究室。想少走几步，就打开手机里的旅行社选一个目的地。',
      'See the Cinnamoroll Ferris wheel to the east, ride the north-shore coaster, fish by the sea, take the motorboat out, or relax on a lounger. The workbench home has a piano and a computer. LeHun has a gym downstairs and my market research room upstairs. The phone’s travel agency can take you to a destination quickly.',
    ],
  },
  {
    id: 'night-concert',
    label: ['晚上有活动吗？', 'Does anything happen at night?'],
    answer: [
      '有呀！入夜后，主岛北边的喷泉旁会有音乐晚会，能听到电吹管、小提琴和合奏。记得在右上角开启声音。走近乐队，可以为他们鼓掌，休息时还能点一首合奏。我有空也会过去听一会儿。',
      'Yes! After nightfall, a concert gathers by the fountain in the north of the main island, with wind synth, violin and duets. Enable sound in the top-right corner. Approach the band to applaud, or request a duet during a break. I sometimes stop by to listen too.',
    ],
  },
  {
    id: 'qin-cinema',
    label: ['秦岛电影院在哪里？', 'Where is the Qin Island cinema?'],
    answer: [
      '沿秦岛中轴走到求仙殿，登上台阶，影院就在一楼西侧。找张椅子坐下，就能观看原创像素短片《始皇临海求仙》。电脑靠近座椅按 F，手机点“坐下”；观影时可以暂停、重播或切换中英字幕，按 Esc 或点“退出观影”就能起身。',
      'Follow Qin Island’s central path to the Immortality Palace and climb the steps. The cinema is on the west side of the ground floor. Sit down to watch the original pixel film The Emperor’s Quest by the Sea. Press F near a seat, or tap Sit down on a phone. You can pause, replay, switch subtitle languages, and leave with Esc or Leave cinema.',
    ],
  },
  {
    id: 'great-wall',
    label: ['投影长城怎么看？', 'How do I explore the projected Great Wall?'],
    answer: [
      '也在求仙殿一楼，往后墙走，会看到一张长长的投影桌。青蓝色山体上有微缩长城和关隘，走近按 F，或者点互动提示，就能查看长城全景、搜索不同城段、阅读资料来源，还能开启自动巡展。看完电影顺路去看看吧。',
      'It is also on the palace ground floor, at the long projection table by the rear wall. Miniature walls and passes rise over blue-green mountains. Press F nearby or tap the prompt to explore the panorama, search wall sections, read sources, or start an automatic tour. It makes a nice stop after the film.',
    ],
  },
  {
    id: 'about-host',
    label: ['聊聊你和这个世界', 'Tell me about you and this world'],
    answer: [
      '我是这个世界现在的开发者，住在主岛那个工作台造型的家里。平时会散步、钓鱼、出海，偶尔去乐魂二楼研究行情，或者到秦岛找找奇闻。这里还有不少值得慢慢发现的小细节，随意参观，想聊天就来找我。',
      'I am the current developer of this world, and I live in the workbench-shaped home on the main island. I walk, fish and go boating, sometimes study charts upstairs at LeHun, and look for unusual stories on Qin Island. There are plenty of small details to discover. Explore at your own pace, and come back for a chat anytime.',
    ],
  },
];

export function residentWithinTalkingDistance(player, resident) {
  return (player.mode === 'ground' || player.mode === 'rest') &&
    resident.state !== 'sleeping' && resident.state !== 'boating' && resident.state !== 'swim' &&
    !resident.vehicle && Math.abs(player.y - resident.y) <= 1.2 &&
    Math.hypot(player.pos.x - resident.pos.x, player.pos.z - resident.pos.z) <= 3.8;
}

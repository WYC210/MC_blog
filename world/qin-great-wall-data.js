const government = (id, name, en) => ({ name: `秦皇岛市政府 · ${name}`, en: `Qinhuangdao Government · ${en}`, url: `https://www.qhd.gov.cn/index/news/details.html?id=${id}` });

export const WALL_SOURCES = {
  overview: government('630044', '秦皇岛因长城而更加雄奇', 'The Great Wall of Qinhuangdao'),
  coast: government('535561', '行走万里长城，见证保护传承', 'Great Wall heritage and conservation'),
  jiaoshan: government('630041', '角山', 'Jiaoshan'),
  dongjiakou: government('577102', '董家口村：古村落焕发新生机', 'Dongjiakou village'),
  banchangyu: government('597032', '板厂峪环长城登山活动', 'Banchangyu Great Wall'),
  jielingkou: government('528050', '界岭口关城保护修缮', 'Jielingkou conservation'),
  liujiakou: government('539882', '明长城刘家口关城修缮', 'Liujiakou Ming Great Wall'),
  survey: government('148722', '长城保护工作调研', 'Great Wall conservation survey'),
  lengkou: government('488528', '冷口防御战', 'The defence of Lengkou'),
  naziyu: government('563964', '走进拿子峪村', 'Naziyu village'),
  chongyukou: government('602276', '河北卢龙：长城脚下果飘香', 'Chongyukou at the foot of the Wall'),
  huachangyu: government('520080', '青龙县长城旅游文化节', 'Qinglong Great Wall culture'),
  yiyuankou: government('489009', '界岭口、义院口之战', 'Jielingkou and Yiyuankou'),
  north: government('565200', '走进北营子村', 'Beiyingzi and the northern wing'),
  jiumenkou: { name: '辽宁省文旅厅 · 九门口长城', en: 'Liaoning Culture and Tourism · Jiumenkou', url: 'https://whly.ln.gov.cn/whly/wlzt/lnww/zdwwbhdw/F0F4FF30DC5145AEB429C7D3C012C803/index.shtml' },
};

export const WALL_REGIONS = [
  { id: 'all', name: '全部', en: 'All' },
  { id: 'coast', name: '山海雄关', en: 'Coast & passes' },
  { id: 'mountain', name: '山地长城', en: 'Mountain walls' },
  { id: 'west', name: '西部关隘', en: 'Western passes' },
  { id: 'nearby', name: '周边关联', en: 'Across the border' },
];

export const WALL_STOPS = [
  { id: 'laolongtou', name: '老龙头', en: 'Laolongtou', region: 'coast', area: '山海关区', areaEn: 'Shanhaiguan', point: [0.91, 0.89], feature: '长城入海', featureEn: 'Wall meets the sea',
    text: '明长城的东部入海处。城墙从陆地伸向渤海，展示山海关防御体系连接陆防与海防的一端。', textEn: 'The eastern seaward end of the Ming Great Wall, where the wall reaches into the Bohai Sea and connects land and coastal defences.', sources: ['overview', 'coast'] },
  { id: 'south-wing', name: '南翼长城', en: 'Southern Wing', region: 'coast', area: '山海关区', areaEn: 'Shanhaiguan', point: [0.86, 0.79], feature: '关城南翼', featureEn: 'Southern defences',
    text: '山海关长城的重要组成部分。与关城、北翼共同理解“一体两翼”的防御格局；本展项不把翼城误当作另一条独立长城。', textEn: 'Part of the Shanhaiguan defensive system. Explore it alongside the main pass and northern wing, rather than as a separate Great Wall.', sources: ['coast', 'north'] },
  { id: 'shanhaiguan', name: '山海关', en: 'Shanhaiguan', region: 'coast', area: '山海关区', areaEn: 'Shanhaiguan', point: [0.82, 0.70], feature: '天下第一关', featureEn: 'First Pass under Heaven',
    text: '山与海之间的关城，是观察城墙、关门和两翼防御关系的核心节点。展览以关城长城为对象，而非把整个城区视为长城遗址。', textEn: 'The fortified pass between the mountains and the sea. This exhibit focuses on its walls, gates and relationship with the two defensive wings.', sources: ['coast', 'north'] },
  { id: 'north-wing', name: '北翼长城', en: 'Northern Wing', region: 'coast', area: '山海关区 · 北营子', areaEn: 'Beiyingzi, Shanhaiguan', point: [0.77, 0.61], feature: '翼城与村落', featureEn: 'Fortification & village',
    text: '北营子村保存了北翼城的历史记忆。城门、城墙及附近敌台共同组成山海关防御体系，长城保护也与村落生活相连。', textEn: 'Beiyingzi preserves the memory of the northern wing. Gates, walls and nearby towers connect the history of defence with the life of a wall-side village.', sources: ['north'] },
  { id: 'jiaoshan', name: '角山长城', en: 'Jiaoshan', region: 'coast', area: '山海关区', areaEn: 'Shanhaiguan', point: [0.81, 0.49], feature: '长城登山', featureEn: 'From the plain to the peaks',
    text: '角山是长城从山海关向北延伸所跨越的第一座山峰。城墙顺着山脊攀升，适合在沙盘中对比平原关城与山地城墙的形态。', textEn: 'Jiaoshan is the first mountain crossed by the wall north of Shanhaiguan. Its climbing walls contrast with the fortified plain below.', sources: ['jiaoshan', 'coast'] },
  { id: 'sandaoguan', name: '三道关长城', en: 'Sandaoguan', region: 'coast', area: '山海关区', areaEn: 'Shanhaiguan', point: [0.73, 0.38], feature: '山谷关隘', featureEn: 'Mountain pass',
    text: '山海关北部山地长城的重要点段。与角山一起展示城墙怎样借助山势与谷口构成防御，模型为地形意象而非实测复原。', textEn: 'A mountain section of the Shanhaiguan system. Together with Jiaoshan it illustrates how ridges and valleys shape a defensive wall.', sources: ['coast'] },
  { id: 'yiyuankou', name: '义院口长城', en: 'Yiyuankou', region: 'mountain', area: '海港区', areaEn: 'Haigang', point: [0.67, 0.27], feature: '古关与抗战记忆', featureEn: 'Pass & wartime memory',
    text: '长城关口与周边山地共同构成区域防线。义院口也承载着长城抗战的历史，本展项将古代营建与近代战事区分介绍。', textEn: 'A historic pass in a mountain defence network, also associated with the twentieth-century defence of the Great Wall.', sources: ['yiyuankou', 'naziyu'] },
  { id: 'dongjiakou', name: '董家口长城', en: 'Dongjiakou', region: 'mountain', area: '海港区 · 驻操营镇', areaEn: 'Zhucaoying, Haigang', point: [0.60, 0.14], feature: '敌楼与守护村落', featureEn: 'Towers & guardian villages',
    text: '城墙与敌楼沿山脊展开，山脚村落与长城守护故事紧密相连。展示的不只是城墙，也包括与遗产共同生活的人。', textEn: 'Walls and towers trace mountain ridges above a village closely connected to the care and memory of the Great Wall.', sources: ['dongjiakou'] },
  { id: 'banchangyu', name: '板厂峪长城', en: 'Banchangyu', region: 'mountain', area: '海港区 · 驻操营镇', areaEn: 'Zhucaoying, Haigang', point: [0.56, 0.31], feature: '险峻山脊', featureEn: 'Steep mountain ridges',
    text: '板厂峪的长城与陡峭山地相依，具有“倒挂长城”等景观。沙盘用起伏山脊表现因山就势的建造方式，不提供野外穿越路线。', textEn: 'A rugged wall landscape known for steep, seemingly hanging sections. The model illustrates ridge-following construction, not a hiking route.', sources: ['banchangyu'] },
  { id: 'naziyu', name: '拿子峪长城', en: 'Naziyu', region: 'mountain', area: '海港区 · 驻操营镇', areaEn: 'Zhucaoying, Haigang', point: [0.66, 0.43], feature: '金边长城', featureEn: 'Golden-edged wall',
    text: '墙体上部嵌有黄色条石，夕照下呈现金边效果。村落附近还有水门洞遗址、旱门和烽火台，体现关隘与聚落的联系。', textEn: 'Yellow stone near the top of the wall catches the evening light. Water-gate remains, a land gate and towers connect the wall with its village.', sources: ['naziyu'] },
  { id: 'huachangyu', name: '花场峪长城', en: 'Huachangyu', region: 'mountain', area: '青龙满族自治县 · 祖山镇', areaEn: 'Zushan, Qinglong', point: [0.47, 0.23], feature: '长城与山村', featureEn: 'Wall-side mountain village', aliases: '花厂峪',
    text: '青龙祖山镇的长城文化村落，也见“花厂峪”写法。这里把长城风景、乡村生活与地方民俗联系在一起。', textEn: 'A Great Wall culture village in Zushan, Qinglong, also written 花厂峪. Its wall landscape is connected with village life and local traditions.', sources: ['huachangyu'] },
  { id: 'chengziyu', name: '城子峪长城', en: 'Chengziyu', region: 'mountain', area: '秦皇岛北部山地', areaEn: 'Northern Qinhuangdao hills', point: [0.41, 0.14], feature: '山脊遗存', featureEn: 'Ridge-top heritage',
    text: '秦皇岛市政府展示的代表性长城点段之一。与董家口、界岭口一起，从不同山地景观理解秦皇岛明长城。', textEn: 'One of the wall sections featured by the city government, illustrating the mountain landscapes of the Qinhuangdao Ming Great Wall.', sources: ['overview'] },
  { id: 'jielingkou', name: '界岭口长城', en: 'Jielingkou', region: 'west', area: '抚宁区 · 大新寨镇', areaEn: 'Daxinzhai, Funing', point: [0.43, 0.44], feature: '关城保护', featureEn: 'Conserving a pass',
    text: '关城、敌台与砖窑遗址共同构成长城文化景观。以保护修缮与考古为线索，认识长城不仅有墙体，还有营建和驻防遗存。', textEn: 'A heritage landscape of a pass, towers and kiln remains. Conservation and archaeology reveal the building and garrison history beyond the wall itself.', sources: ['jielingkou'] },
  { id: 'chongyukou', name: '重峪口长城', en: 'Chongyukou', region: 'west', area: '卢龙县 · 燕河营镇', areaEn: 'Yanheying, Lulong', point: [0.34, 0.54], feature: '长城脚下的村落', featureEn: 'Life beneath the wall',
    text: '卢龙长城沿线的村落节点。长城脚下的果园与乡村生活，展示文化遗产与当代生产生活并存的景观。', textEn: 'A wall-side village in Lulong where orchards and daily rural life form part of a living heritage landscape.', sources: ['chongyukou'] },
  { id: 'liujiakou', name: '刘家口长城', en: 'Liujiakou', region: 'west', area: '卢龙县', areaEn: 'Lulong', point: [0.29, 0.37], feature: '水关与关城', featureEn: 'Water gate & pass',
    text: '明长城刘家口关城包含水关楼、东尖楼和城墙等遗存。2023年的修缮报道记录了这些构件，是理解长城关城结构的实例。', textEn: 'A Ming pass with a water-gate tower, an eastern tower and wall sections, documented in a 2023 conservation report.', sources: ['liujiakou'] },
  { id: 'taolinkou', name: '桃林口长城', en: 'Taolinkou', region: 'west', area: '卢龙县', areaEn: 'Lulong', point: [0.22, 0.49], feature: '西部关口', featureEn: 'Western pass',
    text: '卢龙境内的长城关口，是秦皇岛长城保护调研涉及的重要点段。不要把桃林口水库的整个游览范围都等同于长城遗址。', textEn: 'A wall section in Lulong documented in a conservation survey. The nearby reservoir destination is not itself the extent of the wall remains.', sources: ['survey'] },
  { id: 'lengkou', name: '冷口长城', en: 'Lengkou', region: 'west', area: '青龙与迁安交界一带', areaEn: 'Qinglong–Qian’an border area', point: [0.15, 0.33], feature: '边界古关', featureEn: 'Border pass',
    text: '位于青龙与迁安相接一带的古关，兼具长城防御与近代抗战记忆。本展项按秦皇岛侧关联展示，不将迁安境内遗存整体计入秦皇岛。', textEn: 'A border-area pass associated with the Wall and its twentieth-century defence. Only its Qinhuangdao connection is represented; Qian’an is not counted as Qinhuangdao.', sources: ['lengkou'] },
  { id: 'chengzilingkou', name: '城子岭口长城', en: 'Chengzilingkou', region: 'west', area: '青龙满族自治县', areaEn: 'Qinglong', point: [0.09, 0.18], feature: '市域明长城西端', featureEn: 'Western end within the city',
    text: '秦皇岛市政府介绍市域明长城时，以青龙城子岭口为西端，与东端的老龙头呼应。这是市域范围的端点，不是整条万里长城的西端。', textEn: 'The city government describes Chengzilingkou as the western end of the Ming wall within Qinhuangdao, not the western end of the entire Great Wall.', sources: ['overview'] },
  { id: 'luohandong', name: '罗汉洞长城', en: 'Luohandong', region: 'west', area: '青龙满族自治县', areaEn: 'Qinglong', point: [0.27, 0.13], feature: '青龙山地遗存', featureEn: 'Qinglong mountain heritage',
    text: '青龙境内的长城遗存，见于河北省文物部门在秦皇岛开展的保护调研。作为山地遗产节点展示，不标注未经核实的建造年代或开放状态。', textEn: 'A Qinglong wall section documented in a provincial conservation survey. No unverified construction date or visitor-access status is assigned.', sources: ['survey'] },
  { id: 'jiumenkou', name: '九门口长城', en: 'Jiumenkou', region: 'nearby', area: '辽宁省绥中县 · 非秦皇岛市域', areaEn: 'Suizhong, Liaoning · outside Qinhuangdao', point: [0.91, 0.29], feature: '九座水门', featureEn: 'Nine water openings', nearby: true,
    text: '原名一片石关，城桥跨河并形成九座水门，是山海关防御体系的关联关隘。它位于辽宁，单列作周边延伸展示，不计入秦皇岛市域点段。', textEn: 'Also known as Yipianshi Pass, its river-spanning fortification has nine water openings. It belongs to Liaoning and is shown only as a neighbouring connection.', sources: ['jiumenkou'] },
];

export const WALL_PATHS = [
  ['chengzilingkou', 'lengkou', 'taolinkou', 'liujiakou', 'chongyukou', 'jielingkou', 'huachangyu', 'chengziyu', 'dongjiakou', 'banchangyu', 'yiyuankou', 'naziyu', 'sandaoguan', 'jiaoshan', 'north-wing', 'shanhaiguan', 'south-wing', 'laolongtou'],
  ['chengzilingkou', 'luohandong', 'chengziyu'],
  ['sandaoguan', 'jiumenkou'],
];

export const WALL_LOCAL_COUNT = WALL_STOPS.filter(stop => !stop.nearby).length;

export function wallMatches(stop, region, query) {
  return (region === 'all' || stop.region === region)
    && `${stop.name} ${stop.en} ${stop.area} ${stop.areaEn} ${stop.feature} ${stop.featureEn} ${stop.aliases || ''} 明长城 Ming Great Wall`.toLowerCase().includes(query.trim().toLowerCase());
}

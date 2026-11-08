# 秦皇岛长城：实景建模资料调查（第一阶段）

核对日期：2026-11-08。对象为当前投影桌的 20 个展项。此阶段只调查、记录和评估证据，不修改三维模型、展台、自动轮播或站点数据。

后续进展：经用户确认，10 个 A 级展项已进入局部参考建模，见 [实现说明](qin-great-wall-modeling.md)。本文保留第一阶段调查时的评估与旧模型问题记录，不表示这些问题在后续版本仍全部存在。

## 结论与使用边界

- 核查 52 个资料入口：49 个取得页面或文件，3 个未取得原文。49 个入口包括政府文章、景区资料、媒体图文、两份 PDF、平台首页和两处全景页面，不等于 49 份测绘成果。
- 下载并逐张查看 51 张候选图像，包含照片、节目画面、导览示意和不适合作为几何依据的配图；不是 51 张都可用，更不都是航拍。图片来源、像素大小和审阅意见见 `qin-great-wall-references.json`。
- 10 个展项具备开始“代表性局部、低多边形参考建模”的依据；6 个只能确定局部特征，4 个应先补证或解决身份问题。没有任何一项达到完整、可量测、全范围三维复原的证据标准。
- 本轮没有取得覆盖所有展项的 DEM、带坐标墙线、完整敌台点位、摄影测量模型或全套建筑测绘图。照片能约束外观，不自动提供绝对坐标、背面形状和尺寸。
- 建议下一阶段采用“公开资料所示的遗存/修缮状态”，逐段标明参考年份；不要把各年代照片混合后称为“2026 年最新实景”，也不要自行补成完整明代城池。
- 尚未得到照片用于网站发布的授权。本轮仅保留本地研究参考，不把新闻摄影、截图或第三方全景切片直接打包到网站。

## 证据等级

- **A：可开始局部参考建模。** 有可靠的对象说明及已查看、可对应对象的形态照片；仍须限定取景范围和不可见部分。
- **B：局部有据，整体不足。** 只有单一视角、关联文字、旧照片或未能检查的影像入口；不能编造完整路线。
- **C：先补证。** 对象身份、范围或形态不足以支持有辨识度的模型。

等级是本次建模证据评估，不是景区评级、文物价值等级或开放状态判断。

## 20 个展项逐项调查

| 当前展项 / ID | 等级 | 已确认的参考内容 | 图片/文字依据 | 建模前仍缺什么 |
|---|---|---|---|---|
| 老龙头 `laolongtou` | A | 入海石城、靖卤台、宁海城、澄海楼等不能简化为海面上一条细墙；城台、海岸、后方楼阁有明显层次 | [景区组成][shg-laolongtou]、[全景路线与照片][shg-laolongtou-route]；已查看海侧、城内及导览图 | 可靠北向、比例尺、城岸线坐标；导览画不是测绘图 |
| 南翼长城 `south-wing` | C | 官方保护工作使用“南翼长城段”；历史体系又有“南翼城”，两者不能未经辨析就视为同一矩形城堡 | [保护段落清单][south-wall-protection]、[体系报道][coast-system]、[历史材料][shg-earthen-study] | 明确展示的是关城至海岸的墙段还是南翼城遗址；需对应平面及现存照片 |
| 山海关 `shanhaiguan` | A | 镇东楼是东门，厚大城台、拱券门洞、坡道和上部箭楼是主要形态；不能套用普通敌楼 | [景区建筑资料及多张照片][shg-zhendong]、[一关景区范围][shg-pass] | 完整关城平面、瓮城范围、各朝修缮区别；部分宣传配图不宜推断周边地形 |
| 北翼长城 `north-wing` | B | 北营子与北翼城有关；腰铺九号敌台位于北翼城北侧，不能把该敌台直接当成北翼城城门 | [村落调查][north-wing]、[河北省文物局介绍][north-tower] | 北翼城边界/城门遗址实景及敌台各立面；文物局页面原图本次未下载成功 |
| 角山 `jiaoshan` | A | 已查看山脊长城和陡阶照片，墙体随裸岩与山脊急剧升降，和普通缓坡丘陵不同 | [近景照片][jiaoshan-photo]、[山体全景][jiaoshan-current]、[景区介绍][shg-jiaoshan] | 敌台编号与对应位置、局部连续航拍、未拍到的背坡；不能直接把网页山高当模型相对高差 |
| 三道关 `sandaoguan` | B | 可确认峡谷绝壁和“倒挂”墙段；已查看巡护报道中的陡墙及残石近景，不能画成三座相同门楼并排 | [三重关口的文字说明][sandaoguan]、[明确注明三道关的巡护照片][shg-sandaoguan] | 三重关口各自的位置、留存状态和完整剖面；巡护者使用无人机不意味着报道照片均为航拍 |
| 义院口 `yiyuankou` | B | 景区资料明确提到顶尖楼、关城遗址；保护员报道提及水门与拿子峪的关联 | [阅读路线中对应条目][shg-reading-route]、[保护员访谈][naziyu-photos] | 顶尖楼可识别的正侧面、关城/水门现状及位置；已找到的配图不能逐一绑定到构件 |
| 董家口 `dongjiakou` | A | 山脊墙体、密集敌台、堡与村落关系、门额雕花是区分特征；不能只有普通方塔 | [村落与雕刻介绍][dongjiakou-village]、[山脊照片][dongjiakou-cloud]、[另一远景][dongjiakou-snow] | 雕花门额高清近照、具体敌台编号、堡的可靠平面；文字统计不等于坐标清单 |
| 板厂峪 `banchangyu` | A | 险峻山墙、柱状岩壁、砖窑遗址可形成有辨识度的主题；窑址是山下独立对象，不应贴到城楼上 | [央广实地报道与配图][banchangyu-cnr]、[雪景照片][banchangyu-snow]、[修缮记录][banchangyu-repair] | 代表性墙段完整轮廓、窑址平面和各敌台身份；不同报道范围和统计口径需分开 |
| 拿子峪 `naziyu` | A | “金边”是墙体上部的黄色条石，不是金色金属；小型旱门、山谷通道及不同位置烽火台有文字和照片支持 | [市政府报道][naziyu]、[秦皇岛发布图文][naziyu-photos]；已查看旱门、山谷、墙身等 5 张图 | 条石带具体分布、楼层和各楼坐标；原文对“墙筋”作用是解释/推测，不应写成定论 |
| 花厂峪/花场峪 `huachangyu` | C | 找到青龙祖山镇花厂峪的村史、山地节目画面；另有海港段花厂峪—拿子峪—义院口叙述 | [青龙官方活动][huachangyu-festival]、[地方电视专题][huachangyu-hebtv]、[海港段关联报道][naziyu-photos] | 必须先用权威地名/地图区分行政归属、同名/异写、墙段两侧村落，不能把两套资料混做一个景点 |
| 城子峪 `chengziyu` | A | 山地空心敌楼、局部残墙与植被有多幅照片；应保留缺损，不统一补齐垛口 | [云海照片][chengziyu-cloud]、[春景照片][chengziyu-blossom]、[中新网稿件转载及近景][chengziyu-report] | 完整墙线、具体敌台编号及未见立面；云雾遮挡处不能凭想象补出墙体 |
| 界岭口 `jielingkou` | A | 洋河峡谷两侧金台/银台的扇形墩台、月城门洞、夯筑/砖石遗存有修缮报道，不能只放一个普通山口城门 | [2025 年修缮影像][jielingkou-2025]、[2023 年工程范围][jielingkou-repair]、[保护规划征求意见稿][funing-plan] | 两台相对方向、全平面和尺寸；应确定采用修缮前还是修缮后的一个时间版本 |
| 重峪口 `chongyukou` | B | 卢龙专题中的明确图注展示山脊拱门、残墙与残楼，比“果园村落”介绍更直接 | [卢龙专题照片][lulong]、[市政府村落报道][chongyukou] | 至少另一侧关门照片和附近墙线；不能用果园新闻证明完整关城形制 |
| 刘家口 `liujiakou` | A | 有明确图注的水关楼、岭上长城照片；2023 年修缮涉及水关楼、东尖楼及墙体 | [2022 年图文][lulong]、[2023 年修缮完工记录][liujiakou-repair] | 页面标注 2022 年，但配图拍摄日期及后续替换情况未核实；需新旧对应，不宣称当前最新外貌 |
| 桃林口 `taolinkou` | B | 已查看水面转弯、岸坡与敌楼同框的图注照片，具备水陆相接的景观关系 | [卢龙专题“桃林口长城湿地”图][lulong]、[保护调查记录][survey] | 关口与水库/湿地的准确范围、真实水门形态；不能因为邻水就给模型加一座水关门楼 |
| 冷口 `lengkou` | C | 找到历史与交通走廊叙述，但本次查看的配图是雕像，不能作关门实景 | [冷口历史][lengkou-history]、[文化报道][lengkou] | 青龙侧/迁安侧遗存分别在哪里、关门是否尚存、对应年月的真实照片 |
| 城子岭口 `chengzilingkou` | C | 市域概述把它作为明长城市域范围的西端；不等于已有具体遗存的模型依据 | [秦皇岛概述][overview] | 确切点位、行政边界、关口残存形态、正侧面/航拍；不得把“城子峪”照片借来代替 |
| 罗汉洞 `luohandong` | B | 市政府图文将石碑沟长城又称罗汉洞长城，给出段落范围并配山脊墙照片 | [2024 年图文][luohandong-cloud]、[2017 年修缮巡查][luohandong-repair] | 同名范围与代表性敌楼的对应、连续墙线和更多视角；不应把整个相邻山系都归入该展项 |
| 九门口 `jiumenkou` | A | 辽宁文旅资料同时提供结构说明、尺寸和照片；城桥、河道、关城及两侧围城是整体关系 | [辽宁省文旅厅][jiumenkou] | 完整测绘平面、各敌楼精确点位和当下修缮情况；地处辽宁，继续单列为周边关联 |

## 可以直接约束下一版的细节

### 1. 九门口：桥墩不是十根普通立柱

[辽宁文旅资料][jiumenkou]明确说明河中 8 个梭形桥墩形成 9 个水门，并描述两侧围城。文中另给出墙体宽 4.8 米、高 4.5 米，一片石关城约南北 185 米、东西 135 米，以及围城每边 12.6 米等数据。这些是该页对应对象的尺寸，不是所有长城的通用尺寸。

当前模型的 10 个同形 `bridge-pier` 实例，至多可理解为把 8 个河中桥墩和 2 个岸侧支承混在一起的抽象示意；后续必须区分桥墩、桥台/岸墙，表现拱券水门和梭形迎水端，不能直接解释成“真实有十个桥墩”。

### 2. 山海关：先做镇东楼，不泛化成整座古城

[景区建筑资料][shg-zhendong]给出：城台长 44 米、宽 30.4 米、高 11.75 米；门洞高 7.5 米、宽 5.8 米；上部箭楼长约 20 米、宽 10.1 米、高 13.7 米，并描述三面箭窗。可先据此约束城台与楼体的相对体量，再结合正面照片处理门洞、窗和屋顶。

这些数值暂为单一景区资料记载，应交叉核验，不能当作现成测绘成果。本文不以宣传照片里山体的视觉远近推定关城紧贴山脚；有些配图取景/处理方式不明，应排除出地形控制图。

### 3. 老龙头：海防组合而非“墙尾入海”一个方块

[官方路线资料][shg-laolongtou-route]可确认城内外几个核心构件，已查看的海侧与城内照片可约束入海段、城台和楼阁关系。导览图能辅助辨认组成，但属于游览示意，不能据图量测或直接当正射影像。

### 4. 山地长城要保留差异

- 角山：陡阶、裸岩和急升的墙线，见两张[市政府照片][jiaoshan-photo]及[全景][jiaoshan-current]。
- 三道关：峡谷、陡壁上落差很大的墙段，见[巡护实景][shg-sandaoguan]；不能用一座对称门楼概括“三道”。
- 董家口：山脊敌楼与堡村关系，有[雕花/门额描述][dongjiakou-village]；雕刻细节尚缺可辨识近图。
- 板厂峪：[央广图文][banchangyu-cnr]显示独特岩壁与窑址，不能只换一组圆滑山峰。

### 5. 不要把残存遗迹擅自“修完整”

[刘家口及重峪口旧图][lulong]、[界岭口修缮图][jielingkou-2025]和[城子峪报道][chengziyu-report]显示的遗存状态不同。门洞残边、顶部缺损、修缮补砌应当分别记录；无证据时不要批量补屋顶、补齐所有女墙和垛口。

## 已发现的资料陷阱与待纠错项

1. **南翼长城与南翼城不可直接互换。** 当前代码的 `wing` 模板暗示一座明确平面城堡，实际展项范围尚未确认。
2. **花厂峪的对象身份尚未解决。** 既有代码使用青龙资料，另有海港段报道使用相同/近似名称；没有坐标前禁止合并两套地形与敌楼信息。
3. **城子峪不等于城子岭口。** 不能因名称相似、同在市域长城体系就互用图片。
4. **同一文章也可能自相矛盾。** [卢龙专题][lulong]开头与后文对三个关口东西排列的表述方向相反。仅采用明确图注和可核验构件，不据该叙述建立顺序。
5. **敌台统计不能直接生成实例数。** [2015 年板厂峪报道][banchangyu-repair]写敌台总数 20，但列举的保存状态分项合计只有 16；不能据此补造缺少的四座及位置。
6. **图片的上传目录不是拍摄日期。** 若页面标注日期与 URL 中的日期不同，两者都不足以证明拍摄年份；保存页面发布日期，拍摄日期不明就留空。
7. **配图和标题并非一对一测绘标注。** 新闻组图中的节目封面、纪念馆、游客照片、园林、雕像和宣传图，不能计为对应墙段形态证据。
8. **拿子峪条石的用途不是定论。** [报道][naziyu-photos]区分了事实描述和保护员推测。颜色/层位可参考，推测的受力原理不可写成已验证事实。
9. **“板厂峪塔”是独立古塔条目。** [方志资料][banchangyu-tower]不等于长城敌台资料，本轮只作为排除歧义的来源，不移植到敌楼模型。
10. **规划文件有状态限制。** [界岭口 PDF][funing-plan]封面明确是《保护规划（2022—2035 年）》规划文本“征求意见稿”，不是批准版或精密测绘图。
11. **文件名线索不能替代正文。** 本轮另一个 8 页扫描 PDF 实际题名是[《山海关夯土长城保护棚架及相关问题》][shg-earthen-study]，不是长城认定表；原始发表年份未在本轮核实。
12. **当前地图连线仍是艺术示意。** `WALL_PATHS` 的次序、分支和 `point` 坐标不能成为下一版真实地理线路的数据来源；必须另取地理依据。

## 全景、视频与数据线索

- [山海关景区 360 虚拟游目录][shg-vr]链接到[老龙头全景][laolongtou-vr]和[天下第一关全景][shanhaiguan-vr]。已验证页面可返回相应标题，但本轮未完成所有点位的交互浏览或角度标定；列为下一步多视角补证入口，不计为已审阅全景数据。
- [河北省文物局的腰铺九号敌台页面][north-tower]是可靠的结构关系和视频线索。正文已核对，页面内两张相关图片的直接请求返回错误，不能声称已查看这些画面或视频。
- [中国长城遗产平台][heritage-platform]页面标明中国文化遗产研究院主办并提供地图入口。这里只核实平台入口，没有取得其墙线数据、授权或精度说明。
- 3 个未取得原文的文件线索记录在 JSON 的 `access: unavailable` 条目：研究展板链接 404、境外镜像 PDF 超时、青龙规划文件链接 404。不从这些文件提取结论，也不冒充已读测绘资料。
- 尚缺：能关联遗址编号的平面/立面图、带坐标原始墙线、明确精度和使用条件的 DEM、可用于发布的照片授权、修缮前后同机位照片。

## 下一阶段的最小验收标准

这部分是后续建议，不表示本阶段已经执行。

1. 先确定展示单位：一段可辨识墙线或一个有据可查的核心建筑，而不是强行还原整条景区范围。
2. 每个模型绑定至少一份身份/构件依据和两幅互补视角；不足两幅时明确标为有限视角参考，不补不可见细节。
3. 标出可证实、照片比例推估、艺术简化三类内容。不同类别不能用同一种“精确复原”说明。
4. 对真实尺寸先保持长宽高比例，再统一缩小到桌面；不能把同一座塔或同一段墙为铺满 32 米桌面而只拉长 X 轴。
5. 有年代差异时选择一个明确参考版本；不混合修缮前残楼、修缮后垛口和历史想象屋顶。
6. 第一批优先老龙头、镇东楼、角山、九门口，再处理界岭口、拿子峪及其他 A 级展项。C 级不替换成新的猜测模型。

## 文件与复核方式

- 永久清单：`docs/qin-great-wall-references.json`。保留原文 URL、出版日期（可确认时）、访问结果、展项关联及 51 张图的查看记录；不保存全文转载。
- 本机工作底稿：`tools/.check/qin-wall-research/`。包括网页快照、两份成功下载的 PDF、原始候选图片、访问记录和抓取脚本；被 Git 忽略，不成为线上资源。
- 本机图片联系表：`contact-1.jpg` 至 `contact-5.jpg`。每格带来源 ID 与图片序号，可通过 JSON 找到原文和图片地址。
- 研究资料不是图片再发布许可。新闻图片本轮仅用于识别构件和评估证据，不直接作为项目贴图。

## 原文索引

各链接的访问记录及日期见 JSON；引用政府网站不代表其转载文章中的每一个数字都已独立验证。

[overview]: https://www.qhd.gov.cn/index/news/details.html?id=630044
[coast-system]: https://www.qhd.gov.cn/index/news/details.html?id=535561
[jiaoshan-photo]: https://www.qhd.gov.cn/index/news/details.html?id=564890
[jiaoshan-current]: https://www.qhd.gov.cn/index/news/details.html?id=630041
[dongjiakou-village]: https://www.qhd.gov.cn/index/news/details.html?id=577102
[dongjiakou-snow]: https://www.qhd.gov.cn/index/news/details.html?id=613982
[dongjiakou-cloud]: https://www.qhd.gov.cn/index/news/details.html?id=604954
[banchangyu-snow]: https://www.qhd.gov.cn/index/news/details.html?id=576102
[banchangyu-repair]: https://www.qhd.gov.cn/index/news/details.html?id=138038
[banchangyu-kiln]: https://www.qhd.gov.cn/index/news/details.html?id=542694
[banchangyu-tower]: https://www.qhd.gov.cn/index/news/details.html?id=464582
[naziyu]: https://www.qhd.gov.cn/index/news/details.html?id=563964
[north-wing]: https://www.qhd.gov.cn/index/news/details.html?id=565200
[liujiakou-repair]: https://www.qhd.gov.cn/index/news/details.html?id=539882
[jielingkou-repair]: https://www.qhd.gov.cn/index/news/details.html?id=528050
[huachangyu-festival]: https://www.qhd.gov.cn/index/news/details.html?id=520080
[huachangyu-tour]: https://www.qhd.gov.cn/index/news/details.html?id=599294
[chengziyu-cloud]: https://www.qhd.gov.cn/index/news/details.html?id=598924
[chengziyu-blossom]: https://www.qhd.gov.cn/index/news/details.html?id=591124
[chongyukou]: https://www.qhd.gov.cn/index/news/details.html?id=602276
[survey]: https://www.qhd.gov.cn/index/news/details.html?id=148722
[luohandong-cloud]: https://www.qhd.gov.cn/index/news/details.html?id=562706
[luohandong-repair]: https://www.qhd.gov.cn/index/news/details.html?id=184230
[lengkou-history]: https://www.qhd.gov.cn/index/news/details.html?id=488528
[shg-laolongtou]: https://www.shgjq.com/jdjs/380.jhtml
[shg-laolongtou-route]: https://www.shgjq.com/ywgl/587.jhtml
[shg-pass]: https://www.shgjq.com/jdjs/377.jhtml
[shg-jiaoshan]: https://www.shgjq.com/jdjs/852.jhtml
[shg-jiaoshan-old]: https://www.shgjq.com/zbjd/422.jhtml
[shg-reading-route]: https://www.shgjq.com/xwzx/865.jhtml
[sandaoguan]: https://www.visitbeijing.com.cn/article/4NryJRgg14H?device=amp
[lengkou]: https://www.visitbeijing.com.cn/article/47QkOcZ16mq
[lulong]: https://xinwen.bjd.com.cn/content/s6209f677e4b0dc2473e11370.html
[jielingkou-2025]: https://heb.hebccw.cn/system/2025/12/14/102133555.shtml
[jiumenkou]: https://whly.ln.gov.cn/whly/wlzt/lnww/zdwwbhdw/F0F4FF30DC5145AEB429C7D3C012C803/index.shtml
[funing-plan]: https://www.chinafuning.gov.cn/main/file/2023-12-11/1702262981094297ec9de8c54718c285018c56c7c1e614bc.pdf
[shg-earthen-study]: https://www.cactch.org.cn/webfile/upload/2021/02-10/23-48-430658-1470603176.pdf
[naziyu-photos]: https://finance.sina.cn/2022-06-28/detail-imizmscu9116593.d.html
[north-tower]: https://wenwu.hebei.gov.cn/system/2023/10/17/030258281.shtml
[shg-zhendong]: https://www.shgjq.com/xwzx/283.jhtml
[banchangyu-cnr]: https://china.cnr.cn/gdgg/20230516/t20230516_526252934.shtml
[huachangyu-hebtv]: https://web.cmc.hebtv.com/cms/rmt0336/0/0rmhlm/qy/jswh/whdj/11627604.shtml
[chengziyu-report]: https://finance.sina.com.cn/jjxw/2023-05-04/doc-imysqnxz3415182.shtml
[shg-vr]: https://www.shgjq.com/360xny/index.jhtml
[south-wall-protection]: https://www.qhd.gov.cn/index/news/details.html?id=518201
[heritage-platform]: https://www.greatwallheritage.cn/
[laolongtou-vr]: https://988pxejfs.wasee.com/wt/988pxejfs
[shanhaiguan-vr]: https://071zzbdtn.wasee.com/wt/071zzbdtn
[shg-sandaoguan]: https://www.shgjq.com/xwzx/823.jhtml

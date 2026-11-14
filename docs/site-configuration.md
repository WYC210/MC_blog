# 网站配置说明

本文说明 Homecraft 网站中需要根据个人信息填写的内容。项目的主要配置分为三部分：网站公开信息、首页内容和功能配置。

## 一、网站公开信息

文件：`homecraft.json`

```json
{
  "version": 1,
  "name": {
    "zh": "Wyc的世界",
    "en": "Wyc Home"
  },
  "url": "https://www.wyc21.com/",
  "logo": "assets/logo.png",
  "intro": {
    "zh": "惬意的海岛",
    "en": "Cozy Island"
  },
  "lang": ["zh", "en"],
  "homecraft": true
}
```

字段说明：

- `version`：协议版本，目前保持为 `1`。
- `name`：网站名称，会显示在传送门、世界目录和返回按钮中。可以写成字符串，也可以分别配置中英文。
- `url`：网站完整公开地址。部署到 Cloudflare Pages 后，填写 `https://项目名.pages.dev/` 或自己的域名。
- `logo`：网站 Logo，建议使用 128×128 左右的正方形图片，大小不超过 100KB。
- `intro`：网站的一句话介绍，建议不超过 120 个字符，会显示在 Homecraft 世界目录中。
- `lang`：网站公开信息支持的语言，可填写 `zh`、`en` 或两者。
- `homecraft`：表示网站支持 Homecraft 传送门协议，保持为 `true`。

`url`、`logo` 和 `intro` 在本地预览时可以为空，但申请加入公共世界目录时建议全部填写。

## 二、首页文字内容

文件：`index.html`

需要根据个人信息修改以下内容：

### 页面标题

```html
<title>暖屿</title>
<meta name="description" content="在AI时代重新定义思考">
<meta property="og:title" content="暖屿">
<meta property="og:description" content="在AI时代重新定义思考">
```

这些内容用于浏览器标签页、搜索引擎和分享链接预览。

### 关于我

将下面的模板文字替换为自己的介绍，并同时修改中文和英文版本：

```html
<p>我是 Wyc，专注 音乐相关开发：自研原生安卓曲谱播放，支持简谱五线谱转换，变速不变调，性能消耗极小内存占用＜80MB，峰值 CPU＜15%，实测4G 运存老旧安卓机流畅运行。欢迎进来逛逛，顺手留个言。</p>
```

### 个人主页

将 `Add your website link` 替换为实际主页链接。例如：

```html
<div class="placeholder-card">
  <a href="https://www.wyc21.com" target="_blank" rel="noopener">
    访问我的个人主页
  </a>
</div>
```

### 联系方式

将 `Add your contact details` 和 `Add your GitHub link` 替换为真实内容，并为链接添加 `href`：

```html
<p>你可以通过以下方式联系我。</p>
<li data-app="github">
  <span>GitHub</span>
  <a href="https://github.com/WYC210" target="_blank" rel="noopener">
    @WYC210
  </a>
  <p>我的开源项目</p>
</li>
```

如果不使用 GitHub，可以删除这一项，或者改成其他支持的联系方式。

## 三、人物和网站功能

文件：`home.config.js`

```js
export default {
  name: '暖屿',
  skin: 'assets/me.png',
  languages: ['zh', 'en'],
  weather: { city: '上海', cityEn: 'Shanghai', latitude: 31.23, longitude: 121.47, timezone: 'Asia/Shanghai' },
  dock: ['blog', 'about', 'mailbox', 'phone'],
  mailbox: {
    endpoint: '',
    email: 'wyc@linux.do',
    turnstileSitekey: '',
  },
  badge: true,
};
```

字段说明：

- `name`：手机资料页、人物资料和部分界面中显示的名称。
- `skin`：人物皮肤路径。皮肤必须是 64×64、标准四像素手臂的 PNG，建议保存为 `assets/me.png`。单个文件不能超过 18KB。
- `languages`：网站界面语言。只需要中文时可设置为 `['zh']`，只需要英文时可设置为 `['en']`。
- `weather`：实时天气配置。设置为 `null` 时不请求天气；配置城市后会根据经纬度获取实时天气，不需要 API Key。
- `dock`：底部 Dock 快捷入口。这里填写页面或功能对应的 ID，建议先保留项目中已有的配置。
- `mailbox`：留言板配置，见下一节。
- `badge`：是否显示 Homecraft 标识。`true` 显示，`false` 隐藏。
- `resident`：住在工作台房屋中的站长 NPC 配置。`enabled` 控制是否启用；`name`、`skin` 不填写时继承站点顶层同名配置，目前为 Wyc 与站长皮肤，不再使用原作者的身份或示例皮肤。自定义皮肤仍使用 64×64 的 Minecraft 皮肤 PNG，站点也未配置皮肤时使用默认人物，不影响跨站访客的皮肤。
- 站长夜间睡在工作台卧室已有的床上，白天经南门台阶外出。中文招呼为“你好，欢迎来到我的世界，随意参观吧”，英文界面使用对应译文。迁居后旧版居民存档会安全重置，避免继续出现在 IKUN；新的活动进度仍按原方式保存。
- 当前站长皮肤为 `assets/me.png`：青衫书生，墨发束髻、米白交领、墨色腰封、玉坠与布靴。首次直接访问的玩家和工作台住户共用这套皮肤，关于头像及手机头像随配置同步；跨站访客仍保留自己的皮肤。它是原创的 64×64 标准四像素手臂 PNG，不修改引擎模型；可安装 Pillow 后运行 `python tools/create-scholar-skin.py` 重新生成。

实时天气示例：

```js
weather: {
  city: '上海',
  cityEn: 'Shanghai',
  latitude: 31.23,
  longitude: 121.47,
  timezone: 'Asia/Shanghai',
},
```

### 与开发者对话

靠近清醒的站长 NPC（同层、约 3.8 米内），按 F、点“和 Wyc 聊一聊”或点击人物，即可打开选项式对话。话题包括秦岛玉玺与兵马俑传说、主岛娱乐设施、喷泉夜间音乐晚会、求仙殿电影院、长城投影桌，以及开发者介绍。对白是本地固定内容，不调用聊天 API；修改 `world/resident-dialogue-data.js` 可增添双语话题。姓名随 `home.config.js` 的站长配置显示。

聊天时 NPC 暂停走动与场景自语；按 Esc、F 或“结束对话”后继续活动。睡觉、驾船、跨楼层或其他剧情弹窗中不会发起对话；秦始皇本人的隐藏交互保留优先级。选择传说只提供线索，不会自动夺玺或唤醒军阵。界面复用引擎 GUI 样式，支持中英切换、键盘焦点和手机滚动。

运行 `npm run check:resident-dialogue -- http://127.0.0.1:端口/` 检查双端选项、对话输入隔离、布局、区域事件恢复与渲染预算。

### 海边钓鱼

走到南岸任一块木板上停下，会出现“钓鱼”提示。按 **F** 或点击提示抛竿；浮漂下沉、出现“鱼儿咬钩了”时，再按 **F** 或点击“收竿”。提前收竿或错过咬钩不会获得鱼。

移动、跳跃、飞行、打开地图或页面会取消钓鱼，也可以按 **Esc** 主动取消。本次收获只在当前访问中计数，刷新后重置。手机端按钮位于左下角快捷栏上方，避开右下角小地图。

木板的位置由 `world/layout.js` 中的 `BOARDWALK` 定义，模型和钓鱼范围共用这份数据；抛竿、等待和收鱼逻辑在 `world/fishing.js`，界面样式在 `world/fishing.css`。

### 摩托艇驾驶

靠近海上的红白色摩托艇，在水面按 **F** 或点击“驾驶摩托艇”上艇。电脑端 **W/S** 前进和倒退，**A/D** 转向，**Shift** 加速，**空格** 刹车；按 **F** 或 **Esc** 下艇。

手机端使用左侧圆形轮盘：上推前进、下拉倒退、左右拖动转向，拖动幅度控制力度，松手回中。右侧保留“加速”和“刹车”，下艇按钮位于快捷栏上方，避开小地图。打开地图、手机或页面时暂停驾驶输入。

摩托艇按实际地形检测水域和碰撞，不使用矩形海岸边界；靠岸后可以低速转向、倒退离开。驾驶逻辑和样式分别在 `world/jet-ski.js`、`world/jet-ski.css`。

## 四、留言板配置

### 方式一：使用邮箱 App

这是最简单的方式，只需要填写收件邮箱：

```js
mailbox: {
  endpoint: '',
  email: 'wyc@linux.do',
  turnstileSitekey: '',
},
```

访客提交留言后，浏览器会打开访客自己的邮件 App，并自动填写收件人、标题和留言内容。

### 方式二：通过网页直接发送

如果希望访客不离开网站直接发送，需要部署 `backend/mailbox` Worker，并配置：

```js
mailbox: {
  endpoint: 'https://mailbox.example.com/send',
  email: 'your-email@example.com',
  turnstileSitekey: 'Cloudflare Turnstile 的 Site Key',
},
```

完整步骤：

1. 在 Cloudflare 中开启 Email Routing，并验证收件地址。
2. 创建 Managed Turnstile 验证组件，并允许当前网站域名。
3. 配置 `backend/mailbox/wrangler.jsonc` 中的网站地址、发件人和收件人。
4. 使用 `wrangler secret put` 配置 Turnstile 私钥等 Worker Secret。
5. 部署 Worker，并把 Worker 的 `/send` 地址填入 `mailbox.endpoint`。

Turnstile 的 Site Key 可以放在前端，Secret Key 只能放在 Cloudflare Worker Secret 中，不能写入网站代码。

## 五、Cloudflare Pages 部署配置

文件：`.github/workflows/cloudflare.yml`

提交到 `main` 或 `master` 后，GitHub Actions 会自动执行：

1. 运行 `bash tools/build.sh` 构建网站。
2. 生成 `dist/` 目录。
3. 使用 Wrangler 将 `dist/` 部署到 Cloudflare Pages。

GitHub 仓库需要配置以下内容：

Secrets：

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Repository Variable：

- `CLOUDFLARE_PAGES_PROJECT`：Cloudflare Pages 项目名称。

首次推送时，Wrangler CLI 会根据 `CLOUDFLARE_PAGES_PROJECT` 自动创建 Cloudflare Pages 项目；之后每次推送到 `main` 或 `master` 就会自动部署。

## 六、当前项目优先填写清单

建议按下面顺序完善：

1. 修改 `homecraft.json` 中的 `name` 和 `intro`。
2. 将模板 Logo 替换为自己的图片，并修改 `logo`。
3. 修改 `index.html` 中的标题、关于我和联系方式。
4. 填写个人主页、GitHub 或其他联系方式。
5. 在 `home.config.js` 中填写 `name`。
6. 准备自己的 64×64 皮肤并填写 `skin`。
7. 需要留言时填写邮箱，或部署留言 Worker。
8. Cloudflare Pages 部署后填写 `homecraft.json` 中的 `url`。

修改后可以运行：

```bash
npm run check
```

检查网站元数据、人物皮肤、桌面端和移动端启动情况。

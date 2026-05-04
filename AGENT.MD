# AGENT.MD

## 项目概览

- 名称：`PauseCat`
- 类型：Chrome 扩展（Manifest V3）
- 目标：统计用户在已配置分心网站上的连续活跃浏览时长；达到阈值后展示全屏猫咪休息遮罩，持续指定休息时间。

## 运行架构

- `manifest.json`
  - MV3 入口与权限配置。
  - `background.service_worker`：`scripts/background.js`
  - `content_scripts`：`scripts/content.js`（匹配 `<all_urls>`）
  - 弹窗页面：`options.html`
- `scripts/background.js`
  - 预设网站、默认配置、计时逻辑、休息状态流转的唯一真实来源。
  - 处理消息：`heartbeat`、`get-break-status`、`get-presets`。
  - 使用 `chrome.alarms`、`chrome.idle`、`chrome.tabs`、`chrome.storage`。
- `scripts/content.js`
  - 接收休息指令并在页面上下文中渲染/移除阻断遮罩。
  - 定时向 background 发送 heartbeat 获取休息状态。
- `scripts/options.js`
  - 设置页逻辑：读取/保存配置、预设开关、自定义域名管理。
  - 必须与 background 的配置归一化逻辑保持 schema 兼容。
- `options.html` + `styles/options.css`
  - 弹窗 UI 结构与样式。
- `assets/icons/*`
  - 扩展图标资源（`16/32/48/128`）。

## 不可破坏的行为约束

- 不得单边修改消息协议；若改动必须同时更新发送端与接收端：
  - `heartbeat`
  - `get-break-status`
  - `get-presets`
  - `show-break`
  - `hide-break`
- 未显式提供迁移逻辑时，不得变更以下设置键：
  - `browseMinutes`、`breakMinutes`、`enabledPresets`、`customDomains`
- 未显式提供迁移逻辑时，不得变更以下状态键：
  - `accumulatedSeconds`、`activeTabId`、`activeDomain`、`lastAccountedAt`、`breakEndAt`
- 仅在以下条件同时成立时，才允许累计活跃浏览时间：
  - 用户非 idle
  - 当前标签页是最近聚焦窗口中的激活标签页
  - 当前域名命中已启用目标网站
- 休息进行中时，必须停止累计浏览时长，并在目标站点持续保持遮罩阻断。
- 仅做 UI 美化时，不得改变已有设置逻辑与存储格式。

## 实施规范

- 优先做最小改动，保证行为不变。
- `git commit` 提交信息统一使用中文（建议格式：`类型: 简要说明`，例如：`feat: 新增抖音预设站点`）。
- 预设站点变更必须双向同步：
  - `scripts/background.js` 的 `PRESETS`
  - `scripts/options.js` 的 `DEFAULT_SETTINGS.enabledPresets` 与 `FALLBACK_PRESETS`
- 如新增/调整预设站点：
  - 更新 background 的站点标签与域名
  - 更新 options 默认启用项
  - 更新 README 里的预设站点说明
- 如调整品牌命名：
  - 更新 `manifest.json`（`name`、`action.default_title`）
  - 更新 `options.html`（页面标题与主标题）
  - 更新 README 标题与项目描述
- 未明确要求时，不引入构建工具链；本项目保持纯静态 JS/CSS/HTML。

## 手工验证清单

1. 在 `chrome://extensions` 中启用开发者模式并加载项目目录。
2. 打开弹窗，确认设置可读取和保存。
3. 勾选/取消预设网站后，关闭再打开弹窗，确认状态持久化。
4. 添加/删除自定义域名，确认状态持久化。
5. 在目标网站等待达到浏览阈值，确认：
   - 遮罩出现
   - 倒计时更新
   - 休息结束后遮罩自动消失
6. 在非目标网站确认不会被遮罩阻断。
7. 涉及品牌或图标改动时，确认：
   - 工具栏图标显示正常
   - 扩展管理页卡片图标显示正常
   - 控制台无图标路径缺失警告

## 给后续 Agent 的备注

- 当前仓库无自动化测试，回归质量主要依赖上述手工检查。
- 行为、预设或品牌发生变化时，建议同步更新 `README.md`。

# PauseCat

[中文](./README.zh-CN.md) | [English](./README.en.md)

PauseCat 是一个基于 Chrome Manifest V3 的扩展。在达到可配置的专注时长后，它会用全屏猫咪打断分心网站，提醒你短暂休息。

## 展示

### 配置界面预览

![PauseCat UI](./assets/showcase/image.png)

### 演示视频

[▶ 观看演示视频](https://v.douyin.com/QgjBFYeYzaI/)

## 本地安装

1. 拉取代码到本地：

   ```bash
   git clone https://github.com/RED523/PauseCat.git
   ```

   也可以在 GitHub 页面点击 **Code** -> **Download ZIP**，下载后解压。
2. 打开 Chrome，进入 `chrome://extensions`。
3. 开启右上角的 **Developer mode（开发者模式）**。
4. 点击 **Load unpacked（加载已解压的扩展程序）**。
5. 选择刚刚拉取或解压后的 `PauseCat` 文件夹。
6. 安装完成后，点击 Chrome 工具栏中的 PauseCat 图标进行设置。

## 设置

- 默认浏览时长：`60` 分钟。
- 默认休息时长：`5` 分钟。
- 预设网站：X/Twitter、YouTube、Reddit、bilibili、知乎、抖音。
- 自定义域名会匹配该域名及其子域名。例如：`example.com` 会匹配 `www.example.com`。

## 计时规则

只有当前聚焦的 Chrome 窗口中的活动标签页会计时。后台标签页、非目标网站、未聚焦的 Chrome 窗口，以及系统空闲/锁屏时间都不会累计浏览时长。

## 猫咪素材

将已获授权的循环猫咪视频放在 `assets/cat.webm` 或 `assets/cat.mp4`。在最终视频素材就位前，扩展内置 CSS 动画兜底，休息流程仍可测试。

## 扩展图标

扩展图标位于 `assets/icons/`，PNG 尺寸为 `16`、`32`、`48`、`128`，采用“几何猫脸”品牌风格。

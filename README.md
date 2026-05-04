# PauseCat

PauseCat是一个基于 Chrome Manifest V3 的扩展。在达到可配置的专注时长后，它会用全屏猫咪打断分心网站，提醒你短暂休息。

## Install locally

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder: `/Users/zzm/development/self/cat`.

## Settings

- Default browse time: `60` minutes.
- Default break time: `5` minutes.
- Preset sites: X/Twitter, YouTube, Reddit, bilibili, 知乎, 抖音.
- Custom domains match the domain and its subdomains. For example, `example.com` matches `www.example.com`.

## Timing behavior

Only the active tab in the focused Chrome window counts. Background tabs, non-target websites, unfocused Chrome windows, and idle/locked system time do not accumulate browsing time.

## Cat asset

Place a licensed looping cat video at `assets/cat.webm` or `assets/cat.mp4`. The extension has a CSS animation fallback so the break flow remains testable before the final video is added.

## App icon

Extension icons are in `assets/icons/` with PNG sizes `16`, `32`, `48`, and `128`, using the "geometric cat face" brand style.

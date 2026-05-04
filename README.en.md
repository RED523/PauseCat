# PauseCat

[中文](./README.zh-CN.md) | [English](./README.en.md)

PauseCat is a Chrome Manifest V3 extension. After a configurable focus duration, it interrupts distracting websites with a full-screen cat to remind you to take a short break.

## Install Locally

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder: `/Users/zzm/development/self/cat`.

## Settings

- Default browse time: `60` minutes.
- Default break time: `5` minutes.
- Preset sites: X/Twitter, YouTube, Reddit, bilibili, Zhihu, Douyin.
- Custom domains match the domain and its subdomains. For example, `example.com` matches `www.example.com`.

## Timing Behavior

Only the active tab in the focused Chrome window counts. Background tabs, non-target websites, unfocused Chrome windows, and idle/locked system time do not accumulate browsing time.

## Cat Asset

Place a licensed looping cat video at `assets/cat.webm` or `assets/cat.mp4`. The extension includes a CSS animation fallback, so the break flow remains testable before the final video is added.

## App Icon

Extension icons are in `assets/icons/` with PNG sizes `16`, `32`, `48`, and `128`, using the "geometric cat face" brand style.

# PauseCat

[中文](./README.zh-CN.md) | [English](./README.en.md)

PauseCat is a Chrome Manifest V3 extension. After a configurable focus duration, it interrupts distracting websites with a full-screen cat to remind you to take a short break.

## Install Locally

1. Clone the repository locally:

   ```bash
   git clone https://github.com/RED523/PauseCat.git
   ```

   You can also click **Code** -> **Download ZIP** on GitHub, then unzip the downloaded file.
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked**.
5. Select the `PauseCat` folder you cloned or unzipped.
6. After installation, click the PauseCat icon in the Chrome toolbar to configure it.

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

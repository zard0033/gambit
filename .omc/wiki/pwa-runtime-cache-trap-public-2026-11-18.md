---
title: "pwa-runtime-cache-trap 改 public/ 檔案內容卻不改網址，舊裝置永遠拿不到（2026-11-18）"
tags: ["pwa", "service-worker", "fonts", "cache"]
created: 2026-11-18T12:17:37.450Z
updated: 2026-11-18T12:17:37.450Z
sources: []
links: []
category: debugging
confidence: medium
schemaVersion: 1
---

# pwa-runtime-cache-trap 改 public/ 檔案內容卻不改網址，舊裝置永遠拿不到（2026-11-18）

# pwa-runtime-cache-trap 改 public/ 檔案內容卻不改網址，舊裝置永遠拿不到（2026-11-18）

`vite.config.ts` 對 `/fonts/` 與 `/stockfish/` 用 Workbox `CacheFirst`（fonts 存一年）。Workbox 換新版 service worker 時只清 precache，**runtime cache 不清**。這兩個資料夾在 `public/`，Vite 不加 hash，所以只要網址不變，裝過或開過網站的裝置（含 iPhone 主畫面 PWA）會一直用舊檔。

- 實例：重切 Sarasa 子集補缺字，第一版只換了檔案內容，push 前 review 才抓到「修了但舊裝置看不到」。
- 做法：改這兩個資料夾的檔案內容時，網址一定要變。Sarasa 由 `scripts/subset-sarasa.py` 在 `src/assets/fonts.css` 寫入 `?v=<sha256 前 8 碼>`，`tests/smoke/font-coverage.test.ts` 驗 hash 與檔案一致。Workbox 比對快取預設包含 query，所以 query 就夠，不必改檔名。
- 換 Stockfish 版本時同理（目前檔名帶版本號，換版會自然換網址）。
- ADR-0016 原本寫「每次部署會換一組新的 runtime cache」是錯的，已加 amendment。


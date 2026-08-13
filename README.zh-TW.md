# Gambit

[English](README.md) · [繁體中文](README.zh-TW.md)

**線上 Demo：**[zard0033.github.io/gambit](https://zard0033.github.io/gambit/)。用 Google 帳號登入，或以訪客身分繼續。

一個我自己寫來自己用的單機西洋棋訓練工具：跟 Stockfish 對弈、賽後拿到兩趟分析，再針對你剛剛漏掉的那些手練習，用盲測題目的形式出給你，事先不告訴你裡面到底有沒有東西。

它只有一個使用者。這不是要遮掩的缺點，是我刻意設計出來的限制：我只需要對自己負責，所以當自己的使用經驗告訴我產品判斷錯了，我可以直接動手改，不用先說服任何人。

**這個 repo 真正想講的是這件事。** 2026 年 8 月，我拿實際引擎數據回頭驗證自己寫的定位文件，發現裡面三個核心主張有兩個站不住腳，接下來一週砍掉了大約三萬三千行（程式碼、測試、規劃文件全算在內）。[事情是怎麼發生的 →](#我親手推翻的判斷)

---

## 我親手推翻的判斷

這個產品最早的定位文件裡，有三個我從沒真正驗證過的主張：

1. app 完全沒有訓練玩家「察覺」漏掉戰術的機制：整個學習階段是空的。
2. 一個特定的引擎訊號（最佳手與次佳手的分差 ≥150 centipawn）能可靠標出「這裡有戰術」。
3. app 最大的結構性問題是一套「三層架構」，修掉它是當務之急。

我沒有直接相信這個論證，而是拿程式碼和真實引擎輸出逐條核對。

- **第一條根本是錯的。** 「察覺」那個階段本來就存在，是我自己看漏了程式碼。
- **第二條撐不過實測。** 我把 Stockfish 的 MultiPV 輸出接上真實對局跑。四個 seed 測下來，≥150cp 這個訊號整體觸發率只有 7% 到 30%；其中一整盤棋裡，在最該有用的 17 個開局／中局回合裡**觸發零次**。少數幾次觸發，還都是已經有強制殺的殘局裡連號出現。這個訊號量的不是「這裡有沒有戰術」，量的是「最佳手唯不唯一」，而這兩件事在真正精彩的局面裡幾乎是相反的。
- **第三條方向沒錯，但小到不成比例。** 把「三層架構」這個論證一路推到底，它只判死了原始碼裡 0.65% 的份量，遠不是它被包裝出來的那個結構性大修。

完整推導過程、事後寫下（附日期，讓自己之後不能悄悄改標準）的可證偽預測、以及完整決策記錄：[`production/positioning-v2-2026-08-02.md`](production/positioning-v2-2026-08-02.md)

接下來一週，我實際動手砍了這些：

| Commit | 砍掉什麼 | 刪除行數 |
| --- | --- | --- |
| [`607aba9`](https://github.com/zard0033/gambit/commit/607aba9) | 改寫產品定位；清掉圍繞舊定位堆出來的流程文件與空想規劃內容 | 25,736（245 個檔案） |
| [`b6ed26c`](https://github.com/zard0033/gambit/commit/b6ed26c) | 一個「棋誌」記錄功能，它的四道完成判定沒有一道真的讀盤面 | 3,406（62 個檔案） |
| [`7b1223`](https://github.com/zard0033/gambit/commit/7b1223) | 一整套關卡地圖與解鎖外殼，結果只是為了送出 30 個題目 | 1,195（38 個檔案） |
| [`e2cb898`](https://github.com/zard0033/gambit/commit/e2cb898) | 包在賽後分析外面的一層 slideshow／回放敘事介面 | 2,730（45 個檔案） |

*（刪除行數取自各 commit 的 `git show --stat`；每個 commit 也各有少量新增行數，來自檔案改名與設定調整，完整 diff 見連結的 commit。）*

四個 commit、五天、一份重寫過的定位文件。留下來的是一條迴圈：下棋 → 兩趟賽後分析 → 找出漏掉的手 → 盲測練習 → 再下一盤。

---

## 這個 app 做什麼

- **跟 Stockfish 18 對弈**（WASM，完全跑在瀏覽器端，每步不必打伺服器來回），難度可調
- **兩趟賽後分析**，逐手對照你走的手與最佳手
- **判斷場**：用你自己漏掉的強制勝局面出成盲測題，混入誘餌，事先不說有沒有答案
- **30 題精選戰術練習**，供對局之外的刻意練習
- **匯出對局**：一鍵複製這盤棋的 PGN，附上一段可直接貼給 AI 或強者討論的提示詞
- **可安裝的 PWA**，首次載入後可離線使用；支援 Google 登入或訪客模式，透過 Supabase 同步

## 為什麼要做這個

兩個目標，我不打算假裝它們是同一件事：

- **（A）真的把棋下好。** 用這個標準衡量，花在寫這個 app 上的時間是淨虧損：同樣的時數拿去 lichess 刷題、下真實對局，棋力增幅幾乎確定更高。這個 app 只有幾十個精選局面，lichess 有數十萬個。
- **（B）有一個值得做的工程專案。** 這才是我實際行為揭露出來的目標：0 個真實使用者，卻寫了一萬五千行以上的 TypeScript 與 Vue。這個目標本身完全站得住腳，只是每次要幫功能定範圍時，得誠實講出來，不能每次都拿「這對學棋有幫助」來包裝。

完整推理過程，包含我要求自己遵守的預測，都在 [`production/positioning-v2-2026-08-02.md`](production/positioning-v2-2026-08-02.md)。

---

## 技術棧

| 層 | 技術 |
| --- | --- |
| 前端 | Vue 3（Composition API）＋ Vue Router ＋ Pinia |
| 語言 / 建置 | TypeScript ＋ Vite |
| 樣式 | Tailwind CSS ＋ reka-ui（shadcn 模式） |
| 棋盤 | vue3-chessboard（chessground）＋ chess.js |
| 引擎 | Stockfish 18 Lite（單執行緒 WASM，NNUE），跑在 Web Worker 裡 |
| 後端 | Supabase（PostgreSQL ＋ Google OAuth） |
| 測試 | Vitest（單元測試）＋ Playwright（E2E） |
| 部署 | GitHub Pages，透過 GitHub Actions |

## 本機執行

```bash
npm install
npm run dev        # 開發伺服器
npm run build      # 型別檢查 + production build
npm run test       # 單元測試（Vitest）
npm run test:e2e   # E2E 測試（Playwright）
npm run typecheck  # 僅型別檢查
```

需要 Node 26 以上。Supabase client 在 import 當下就會建立，需要原生 WebSocket 實作，舊版 Node 沒有這個。

## repo 數字

這些是可以直接對照查驗的數字，不是估算：

- 318 個 commit，橫跨 2026 年 2 月到 8 月
- 80 個測試檔（單元測試 ＋ E2E）
- 目前 `src/` 應用程式原始碼約 15,650 行

## License

License 是 MIT，細節見 [`LICENSE`](LICENSE)。這個 repo 起於 [Claude Code Game Studios](https://github.com/Donchitos/Claude-Code-Game-Studios) 的 fork；`.claude/` 底下的 agent／skill 工具鏈沿用自那個模板。

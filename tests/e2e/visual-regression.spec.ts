import { test, expect, type Page } from '@playwright/test'

// UI 視覺守門：每個路由在桌機/手機兩個 viewport 下，(1) 結構不變量斷言（CI 硬閘，決定性、零 flake），
// (2) 像素回歸比對（本機 push 前跑，抓任何肉眼可見的視覺退步）。Vitest 跑在無渲染的 happy-dom、
// 既有 E2E 只驗功能流程，兩者都看不見破版——這支補上「畫面長得對不對」的自動守門。
// 涵蓋範圍：路由初始載入的靜態畫面。互動觸發的狀態（拖子、tap-to-move、slideshow）不在此列。

const ROUTES: readonly [name: string, path: string][] = [
  ['home', '/'],
  ['play', '/play'], // 直接進入會就地開啟對局設定彈窗
  ['learn', '/learn'],
  ['concepts', '/learn/concepts'],
  ['concept-deepen', '/learn/concept/pin'],
  ['lesson', '/learn/pawn-basics'], // 第一課，未上鎖
  ['practice', '/practice/l1-capture-queen'],
  ['history', '/history'],
  ['sign-in', '/sign-in'],
  ['not-found', '/definitely-not-a-route'],
]

const VIEWPORTS: readonly [name: string, size: { width: number; height: number }][] = [
  ['desktop', { width: 1280, height: 800 }],
  ['mobile', { width: 390, height: 844 }], // iPhone 目標視窗
]

async function settle(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(600)
}

// 在頁面內量測破版訊號。回傳的每個陣列/數字皆為決定性、平台無關。
function scanDefects(): { overflow: number; blackTokens: string[]; badBoards: string[] } {
  const doc = document.documentElement
  const out = { overflow: Math.max(doc.scrollWidth - doc.clientWidth, 0), blackTokens: [] as string[], badBoards: [] as string[] }

  // 手寫 var(--…) 顏色 token 解析失敗會 fallback 成純黑（rgb(0,0,0)）。設計系統所有真實色票（#103029、
  // #2A2A2E、#8F6200…）都不是純黑，故「恰好純黑」是決定性的 fallback 訊號（見 technical-preferences）。
  const tokenEls = document.querySelectorAll<HTMLElement>('[style*="var(--"], [fill^="var("], [stroke^="var("]')
  for (const el of tokenEls) {
    const cs = getComputedStyle(el)
    const props = el instanceof SVGElement ? ['fill', 'stroke'] : ['color', 'background-color']
    for (const p of props) {
      if (cs.getPropertyValue(p) === 'rgb(0, 0, 0)') { out.blackTokens.push(`<${el.tagName.toLowerCase()}> ${p}`); break }
    }
  }

  // 棋盤必為正方形。抓「單頁初始載入即非方」的破版（如 .main-wrap 被釘 700px width）。注意：這種每頁
  // 獨立 goto 的掃描抓不到「進棋憶後跨頁 CSS 汙染」那類 session 內累積的 bug——整頁 goto 會重置注入的
  // stylesheet。那個 class 由本檔最下方的「棋憶 CSS 汙染」跨導航回歸測試專門守備。
  for (const b of document.querySelectorAll('cg-board')) {
    const r = b.getBoundingClientRect()
    if (r.width > 0 && Math.abs(r.width / r.height - 1) > 0.02) out.badBoards.push(`${Math.round(r.width)}x${Math.round(r.height)}`)
  }
  return out
}

test.describe('UI 視覺守門', () => {
  test.beforeEach(async ({ page }) => {
    // 首頁時段場景（NeveSceneHeader）依 new Date().getHours() 選天色 bucket，會讓像素基準隨本機時刻漂移。
    // 固定到 15:00（afternoon bucket，clean pale daylight）使基準決定性。setFixedTime 只釘死 Date、
    // 不凍結 setTimeout/rAF，故進場淡入動畫照跑（reducedMotion 下本就直接點亮）。須在 goto 前設。
    await page.clock.setFixedTime(new Date('2026-07-10T15:00:00'))
    // 訪客模式進站（跳過 landing gate），並關動效讓截圖穩定
    await page.addInitScript(() => sessionStorage.setItem('gambit:guest-entry', '1'))
    await page.emulateMedia({ reducedMotion: 'reduce' })
  })

  // ── 結構不變量：CI 硬閘。決定性、跨平台一致、零基準圖依賴。 ──
  for (const [vpName, size] of VIEWPORTS) {
    test.describe(`結構不變量 · ${vpName}`, () => {
      test.use({ viewport: size })

      for (const [name, path] of ROUTES) {
        test(`${name}：無破版且載入無錯誤`, async ({ page }) => {
          const pageErrors: string[] = []
          page.on('pageerror', (e) => pageErrors.push(String(e)))

          await page.goto(path, { waitUntil: 'domcontentloaded' })
          await settle(page)

          // 用 poll 等到穩定態：進場時輪播 slide 的 JS 佈局在 CPU 滿載下可能暫態溢出（單機 <300ms 就消失）。
          // 真正持續的破版會 poll 到 timeout 而失敗——仍抓得到真 bug，只濾掉 mount 暫態。
          await expect
            .poll(async () => await page.evaluate(scanDefects), {
              timeout: 10000, // webkit 慢機/滿載下進場動畫 settle 較久，給足穩定窗；真破版仍 poll 到 timeout 而失敗
              message: '穩定後應無破版：橫向溢出 / var() 色票變純黑 / 非正方形棋盤',
            })
            .toEqual({ overflow: 0, blackTokens: [], badBoards: [] })

          expect(pageErrors, '載入時未捕捉的 JS 例外').toEqual([])
        })
      }
    })
  }

  // ── 像素回歸：本機 push 前跑（你「親眼看到之前」那道關）。基準圖依 OS/瀏覽器而異，CI 略過。 ──
  test.describe('像素回歸', () => {
    test.skip(!!process.env.CI, '像素基準圖依平台而異——本機 push 前跑，CI 只跑結構不變量')

    for (const [vpName, size] of VIEWPORTS) {
      test.describe(vpName, () => {
        test.use({ viewport: size })

        for (const [name, path] of ROUTES) {
          test(`${name}`, async ({ page, browserName }) => {
            test.skip(browserName !== 'chromium', '像素基準圖只在 chromium 維護一份')
            await page.goto(path, { waitUntil: 'domcontentloaded' })
            await settle(page)
            await expect(page).toHaveScreenshot(`${vpName}-${name}.png`, {
              animations: 'disabled',
              // 吸收 sub-pixel 抗鋸齒差異，但別鬆到吞掉真的改版。曾經是 0.02——2026-08-05 實測
              // 那個值會**靜默放行**首頁少掉一整張 StatCard ＋一整列 peek（量到 21,808/1,024,000
              // ＝0.0213，只超標 6%）。原因是本站奶油卡疊在奶油底上，YIQ 色差小、多數變動像素
              // 根本不被計入。收緊當下另有 5 張基線一起轉紅——都是 0.02 藏著的既有漂移，
              // 非噪音（diff 圖是卡片位移，不是散點）；全數重生後連跑兩輪 24/24 綠。
              maxDiffPixelRatio: 0.005,
            })
          })
        }
      })
    }
  })

})

// A non-loopback Web origin cannot reach the loopback-only settings API, so the
// notice could never persist its acknowledgement there and used to reappear on
// every load. The fork gates it off on a memory-mode scope: no welcome dialog
// ever blocks a remote origin.
import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  launchWebScaffold, watchConsole, webSnapshotMode,
  WELCOME_NOTICE_COPY,
  type WebScaffold,
} from './scaffold.ts'
import { ZH_BROWSER_LOCALE } from './support.ts'

const MODE = webSnapshotMode()

describe.skipIf(MODE === 'record')('web e2e: remote welcome notice', () => {
  let scaffold: WebScaffold
  let browser: Browser
  let page: Page
  let tripwire: ReturnType<typeof watchConsole>

  beforeAll(async () => {
    scaffold = await launchWebScaffold({
      remoteAuthority: 'remote.localhost',
      welcomeNoticePending: true,
    })
    browser = await chromium.launch()
    page = await browser.newPage({
      viewport: { width: 1440, height: 960 },
      locale: ZH_BROWSER_LOCALE,
    })
    tripwire = watchConsole(page)
    await page.goto(scaffold.baseUrl, { waitUntil: 'load' })
    await page.waitForSelector('#root', { timeout: 30_000 })
  }, 120_000)

  afterAll(async () => {
    await browser?.close()
    await scaffold?.close()
  })

  it('never blocks a remote origin behind a notice it could not remember', async () => {
    // The onboarding step decides synchronously from the memory-mode scope; give
    // it a poll's grace, then assert the notice is absent and the app is usable.
    await expect.poll(
      () => page.getByRole('dialog', { name: WELCOME_NOTICE_COPY.zh.title }).count(),
      { timeout: 5_000 },
    ).toBe(0)
    expect(await page.locator('#root').evaluate(root => (root as HTMLElement).inert)).toBe(false)

    // The notice must stay gone across a reload, not merely be dismissed once.
    await page.reload({ waitUntil: 'load' })
    await page.waitForSelector('#root', { timeout: 30_000 })
    expect(await page.getByRole('dialog', { name: WELCOME_NOTICE_COPY.zh.title }).count()).toBe(0)
    expect(tripwire.pageErrors).toEqual([])
  }, 60_000)
})

// E2E capture: open :3280, dismiss notice, create a session, open 执行图,
// then screenshot every 3s while the harness runs a real stack brief.
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const dir = process.argv[2]
mkdirSync(dir, { recursive: true })
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } })
await page.goto('http://127.0.0.1:3280', { waitUntil: 'load' })
await page.waitForTimeout(2000)
for (const label of ['Continue', 'Configure later']) {
  const btn = page.getByRole('button', { name: label, exact: true })
  try {
    await btn.waitFor({ timeout: 5000 })
    await btn.click()
    await page.waitForTimeout(800)
  } catch { /* that dialog not shown this boot */ }
}
await page.waitForSelector('[class*="_mask_"]', { state: 'detached', timeout: 8000 }).catch(() => {})
// Reuse the session created during setup (tabs are session-scoped).
await page.getByText('观察执行图', { exact: true }).first().click()
await page.waitForTimeout(2000)
const tab = page.getByText('Live Graph', { exact: true }).first()
await tab.waitFor({ timeout: 15000 })
await tab.click()
await page.waitForTimeout(2000)
await page.screenshot({ path: `${dir}/t000-idle.png` })
console.log('READY')
for (let i = 1; i <= 60; i++) {
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${dir}/t${String(Math.round(i * 1.5)).padStart(3, '0')}.png` })
}
await browser.close()

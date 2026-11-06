import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import {
  assembleQwenUsage,
  clampPercent,
  cookieHeaderFromList,
  findBrowser,
  hasQwenTicket,
  inferMinimaxTier,
  loginProfileDir,
  normalizeCookie,
  parseMinimax,
  parseZai,
  unwrapZelda,
} from '../index.js'

// ---- Qwen: monthly-only plan (the live pro shape) ----
const qwenMonthly = assembleQwenUsage({
  usage: { data: { DataV2: { data: { data: { per1MonthPercentage: 0.2336, per1MonthResetTime: 1795190400000 } } } } },
  subscription: { data: { DataV2: { data: { data: { specCode: 'pro', status: 'VALID', remainingDays: 44 } } } } },
  quota: { data: { DataV2: { data: { data: { pro: { five_hour: 12000, monthly: 180000 } } } } } },
})
assert.equal(qwenMonthly.plan, 'Token Plan pro')
assert.equal(qwenMonthly.monthPercent, 23)
assert.equal(qwenMonthly.monthTotal, 180000)
assert.equal(qwenMonthly.fiveHourPercent, undefined)
assert.equal(qwenMonthly.remainingDays, 44)

// ---- Qwen: 5h + weekly windows ----
const qwenWindows = assembleQwenUsage({
  usage: { data: { DataV2: { data: { data: { per5HourPercentage: 0.2, per1WeekPercentage: 0.5 } } } } },
  subscription: { data: { DataV2: { data: { data: { specCode: 'Lite' } } } } },
  quota: { data: { DataV2: { data: { data: { lite: { five_hour: 1000, weekly: 4000 } } } } } },
})
assert.equal(qwenWindows.fiveHourPercent, 20)
assert.equal(qwenWindows.weekPercent, 50)
assert.equal(qwenWindows.fiveHourUsed, 200)
assert.equal(qwenWindows.monthPercent, undefined)

// ---- Z.ai: live shape (token limits carry percentage only) ----
const zai = parseZai(
  { code: 200, data: [{ productName: 'GLM Coding Pro', status: 'VALID', nextRenewTime: '2027-03-28' }], success: true },
  { code: 200, data: { limits: [
    { type: 'TOKENS_LIMIT', unit: 3, number: 5, percentage: 7, nextResetTime: 1793951648159 },
    { type: 'TOKENS_LIMIT', unit: 6, number: 1, percentage: 1, nextResetTime: 1794450268998 },
    { type: 'TIME_LIMIT', unit: 5, number: 1, usage: 1000, currentValue: 0, remaining: 1000, percentage: 0, nextResetTime: 1795854643998 },
  ], level: 'pro' }, success: true },
)
assert.equal(zai.plan, 'GLM Coding Pro')
assert.equal(zai.status, 'VALID')
assert.equal(zai.level, 'pro')
assert.equal(zai.sessionPercent, 7)
assert.equal(zai.weekPercent, 1)
assert.equal(zai.searchesTotal, 1000)
assert.equal(zai.searchesUsed, 0)
assert.equal(zai.searchesRemaining, 1000)
assert.ok(typeof zai.sessionResetAt === 'string')

// ---- MiniMax: live shape (percent-based, counts zero) ----
const mm = parseMinimax({
  model_remains: [
    { model_name: 'general', current_interval_total_count: 0, current_interval_usage_count: 0, current_interval_remaining_percent: 100, end_time: 1793959200000, current_weekly_remaining_percent: 100, weekly_end_time: 1794182400000, current_interval_status: 1 },
    { model_name: 'video', current_interval_remaining_percent: 100, current_weekly_remaining_percent: 100 },
  ],
  base_resp: { status_code: 0, status_msg: 'success' },
})
assert.equal(mm.sessionPercent, 0)
assert.equal(mm.weekPercent, 0)
assert.ok(typeof mm.sessionResetAt === 'string')
// percent-based plan: no count, so no tier and no count display
assert.equal(mm.plan, 'Coding Plan')
assert.equal(mm.tier, undefined)
assert.equal(mm.sessionTotal, undefined)
assert.equal(mm.sessionUsed, undefined)

// MiniMax count-based plan -> tier inferred, used derived from percent
const mm2 = parseMinimax({
  model_remains: [{ model_name: 'general', current_interval_total_count: 1000, current_interval_usage_count: 250, current_interval_remaining_percent: 75, end_time: 1793959200000, current_weekly_remaining_percent: 60, weekly_end_time: 1794182400000 }],
  base_resp: { status_code: 0 },
})
assert.equal(mm2.sessionPercent, 25)
assert.equal(mm2.weekPercent, 40)
assert.equal(mm2.sessionUsed, 250)
assert.equal(mm2.sessionTotal, 1000)
assert.equal(mm2.tier, 'Max')
assert.equal(mm2.plan, 'Coding Plan Max')

// explicit plan title wins over inference
const mm3 = parseMinimax({ current_subscribe_title: 'MiniMax Coding Plan: Ultra', model_remains: [{ model_name: 'general', current_interval_total_count: 2000, current_interval_remaining_percent: 50 }], base_resp: { status_code: 0 } })
assert.equal(mm3.plan, 'Ultra')
assert.equal(mm3.tier, 'Ultra')

// tier inference table (GLOBAL prompts, CN model-calls, and the /15 fallback)
assert.equal(inferMinimaxTier(100, false), 'Starter')
assert.equal(inferMinimaxTier(300, false), 'Plus')
assert.equal(inferMinimaxTier(1000, false), 'Max')
assert.equal(inferMinimaxTier(2000, false), 'Ultra')
assert.equal(inferMinimaxTier(15000, false), 'Max') // 15000/15 = 1000 -> Max
assert.equal(inferMinimaxTier(600, true), 'Starter')
assert.equal(inferMinimaxTier(1500, true), 'Plus')
assert.equal(inferMinimaxTier(4500, true), 'Max')
assert.equal(inferMinimaxTier(0, false), undefined)
assert.equal(inferMinimaxTier(undefined, false), undefined)

// MiniMax auth error
assert.throws(() => parseMinimax({ base_resp: { status_code: 1004, status_msg: 'auth' } }), /auth/)

// ---- cookie filtering ----
const header = cookieHeaderFromList([
  { name: 'login_qwencloud_ticket', value: 'ticket', domain: '.qwencloud.com' },
  { name: 'SID', value: 'nope', domain: '.google.com' },
  { name: 'bad name', value: 'x', domain: '.qwencloud.com' },
  { name: 'login_qwencloud_ticket', value: 'second', domain: '.qwencloud.com' },
])
assert.equal(header, 'login_qwencloud_ticket=ticket')
assert.equal(hasQwenTicket([{ name: 'login_qwencloud_ticket', value: 'v', domain: '.qwencloud.com' }]), true)
assert.equal(hasQwenTicket([{ name: 'cna', value: 'v', domain: '.qwencloud.com' }]), false)

// ---- misc ----
assert.equal(clampPercent(7), 7)
assert.equal(clampPercent(1), 1)
assert.equal(clampPercent(23.36), 23)
assert.equal(clampPercent(undefined), undefined)
assert.equal(normalizeCookie('Cookie: a=b; c=d'), 'a=b; c=d')
assert.throws(() => normalizeCookie('sk-sp-example'), /API key/)
assert.equal(loginProfileDir(), path.join(os.homedir(), '.dsh', 'coding-plan-usage', 'edge-profile'))
assert.equal(typeof findBrowser(), 'string')
assert.ok(unwrapZelda({ data: { DataV2: { data: { data: { x: 1 } } } } }).x === 1)

console.log('PASS qwen, zai, minimax, cookie, percent, paths')

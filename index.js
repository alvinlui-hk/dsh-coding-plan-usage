/**
 * Coding Plan usage — Host half.
 *
 * Three providers, one card each on Settings → Models:
 *
 * - Qwen Token Plan: the inference API key cannot read quota, so sign-in opens
 *   a dedicated browser profile, reads only qwencloud.com cookies over a
 *   localhost debugger, and stores them in a DSH credential record.
 * - Z.ai GLM Coding Plan and MiniMax Coding Plan: usage is read with the
 *   provider API key, resolved from the DSH credential store (the same
 *   ZAI_API_KEY / MINIMAX_API_KEY the pi-ai provider uses). No browser.
 *
 * Secrets never leave this process except as request headers to the provider's
 * own API. Nothing is returned to the page but numbers and status codes.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { createServer } from 'node:net'
import os from 'node:os'
import path from 'node:path'

export const inject = ['webServer', 'credentials']

// ---- credential addresses ----
const QWEN_SESSION_KEY = 'coding-plan-usage/qwen-session'
const LEGACY_QWEN_KEY = 'qwen-plan-usage/session'
const ZAI_KEY_RECORD = 'coding-plan-usage/zai-key'
const MINIMAX_KEY_RECORD = 'coding-plan-usage/minimax-key'
const ZAI_REF = 'ZAI_API_KEY'
const MINIMAX_REF = 'MINIMAX_API_KEY'

// ---- Qwen endpoints ----
const QWEN_BILLING_URL = 'https://home.qwencloud.com/billing/subscription/token-plan-individual'
const QWEN_USER_INFO_URL = 'https://home.qwencloud.com/tool/user/info.json'
const QWEN_BAILIAN_URL = 'https://cs-data.qwencloud.com/data/api.json'
const QWEN_COMMODITY_CODE = 'sfm_tokenplansolo_public_intl'
const QWEN_USAGE_API = 'zeldaHttp.apikeyMgr./tokenplan/personal/api/v2/usage'
const QWEN_SUBSCRIPTION_API = 'zeldaHttp.apikeyMgr./tokenplan/personal/api/v2/subscription'
const QWEN_QUOTA_API = 'zeldaHttp.apikeyMgr./tokenplan/personal/api/v2/quota-config'

// ---- Z.ai endpoints ----
const ZAI_SUBSCRIPTION_URL = 'https://api.z.ai/api/biz/subscription/list'
const ZAI_QUOTA_URL = 'https://api.z.ai/api/monitor/usage/quota/limit'

// ---- MiniMax endpoints (global, then CN fallback) ----
const MINIMAX_URLS = [
  'https://api.minimax.io/v1/api/openplatform/coding_plan/remains',
  'https://api.minimax.io/v1/coding_plan/remains',
  'https://api.minimaxi.com/v1/api/openplatform/coding_plan/remains',
]

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000
const CACHE_TTL_MS = 60_000
const COOKIE_LIMIT = 32_768
// A specific, unreachable origin. Node's WebSocket sends no Origin and is
// accepted; a browser page (which always sends Origin) is refused, so a
// malicious site cannot reach the debugger even via DNS rebinding.
const DEBUGGER_ALLOWED_ORIGIN = 'http://127.0.0.1:1'

class PlanError extends Error {
  constructor(code, message) {
    super(message ?? code)
    this.name = 'PlanError'
    this.code = code
  }
}

// ---------------------------------------------------------------------------
// shared helpers
// ---------------------------------------------------------------------------

function safeMessage(error) {
  return String(error instanceof Error ? error.message : error)
    .replace(/sk-[A-Za-z0-9._-]{6,}/g, 'sk-REDACTED')
    .replace(/(Bearer\s+)\S+/gi, '$1REDACTED')
    .replace(/sec_token=[^&\s]+/gi, 'sec_token=REDACTED')
    .slice(0, 180)
}

function errorCode(error) {
  if (error instanceof PlanError) return error.code
  const message = safeMessage(error)
  if (/ConsoleNeedLogin|HTTP 401|HTTP 403|HTTP 302|invalid api key|unauthorized/i.test(message)) return 'SIGN_IN_REQUIRED'
  return message || 'UPSTREAM_FAILED'
}

function finiteNumber(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : undefined
}

/** Clamp a value that is already a 0–100 percentage. */
export function clampPercent(value) {
  const numeric = finiteNumber(value)
  if (numeric === undefined) return undefined
  const clamped = Math.max(0, Math.min(100, numeric))
  return clamped < 10 ? Math.round(clamped * 10) / 10 : Math.round(clamped)
}

/** Interpret a value that may be a 0–1 fraction or a 0–100 percentage. */
function usageFraction(value) {
  const numeric = finiteNumber(value)
  if (numeric === undefined || numeric < 0) return undefined
  return Math.max(0, Math.min(1, numeric <= 1 ? numeric : numeric / 100))
}

function usedPercent(value) {
  const fraction = usageFraction(value)
  if (fraction === undefined) return undefined
  return clampPercent(fraction * 100)
}

function resetIso(value) {
  const numeric = finiteNumber(value)
  if (numeric === undefined || numeric <= 0) return undefined
  const millis = numeric < 1_000_000_000_000 ? numeric * 1000 : numeric
  const date = new Date(millis)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function asObject(value) {
  if (typeof value === 'string') {
    try {
      return asObject(JSON.parse(value))
    } catch {
      return undefined
    }
  }
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : undefined
}

async function readJson(response) {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    throw new PlanError('UPSTREAM_FAILED', `non-JSON HTTP ${response.status}`)
  }
}

// ---------------------------------------------------------------------------
// Qwen Token Plan (browser cookie session)
// ---------------------------------------------------------------------------

export function normalizeCookie(raw) {
  let value = String(raw ?? '').replace(/^\uFEFF/, '').trim()
  value = value.replace(/^cookie\s*:\s*/i, '').trim()
  value = value.replace(/^['"]|['"]$/g, '').trim()
  value = value.replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim()
  if (value.length === 0) throw new PlanError('COOKIE_INVALID', 'empty cookie')
  if (value.length > COOKIE_LIMIT) throw new PlanError('COOKIE_INVALID', 'cookie too large')
  if (/^sk-/i.test(value)) throw new PlanError('COOKIE_INVALID', 'this is an API key, not a browser cookie')
  if (!value.includes('=')) throw new PlanError('COOKIE_INVALID', 'cookie has no name=value pair')
  return value
}

export function unwrapZelda(payload) {
  const root = asObject(payload)
  const outer = asObject(root?.data) ?? root
  const dataV2 = asObject(outer?.DataV2) ?? asObject(outer?.dataV2)
  const inner = asObject(dataV2?.data) ?? asObject(outer?.data)
  if (inner?.data !== undefined) {
    const nested = asObject(inner.data)
    if (nested) return nested
  }
  return inner
}

function quotaFor(quota, specCode) {
  if (!quota) return {}
  const keys = [specCode, specCode?.toLowerCase(), specCode?.toUpperCase()].filter(Boolean)
  for (const key of keys) {
    const row = asObject(quota[key])
    if (row) return row
  }
  const fallback = Object.values(quota).find((value) => {
    const row = asObject(value)
    return row?.five_hour !== undefined || row?.weekly !== undefined || row?.monthly !== undefined
  })
  return asObject(fallback) ?? {}
}

export function assembleQwenUsage(parts) {
  const subscription = unwrapZelda(parts.subscription) ?? {}
  const usage = unwrapZelda(parts.usage) ?? {}
  const quotaRoot = unwrapZelda(parts.quota) ?? {}
  const specCode = typeof subscription.specCode === 'string' ? subscription.specCode : undefined
  const quota = quotaFor(quotaRoot, specCode)
  const fiveTotal = finiteNumber(quota.five_hour ?? quota.fiveHour)
  const weekTotal = finiteNumber(quota.weekly ?? quota.week)
  const monthTotal = finiteNumber(quota.monthly ?? quota.month)
  const fiveFraction = usageFraction(usage.per5HourPercentage)
  const weekFraction = usageFraction(usage.per1WeekPercentage)
  const monthFraction = usageFraction(usage.per1MonthPercentage ?? usage.perMonthPercentage)
  const remainingDays = finiteNumber(subscription.remainingDays)
  const plan = specCode ? `Token Plan ${specCode}` : 'Token Plan'
  const usedOf = (fraction, total) => (fraction !== undefined && total !== undefined ? Math.round(total * fraction) : undefined)
  return {
    plan,
    status: typeof subscription.status === 'string' ? subscription.status : undefined,
    remainingDays: remainingDays !== undefined ? Math.max(0, Math.round(remainingDays)) : undefined,
    fiveHourPercent: usedPercent(usage.per5HourPercentage),
    fiveHourResetAt: resetIso(usage.per5HourResetTime),
    fiveHourTotal: fiveTotal,
    fiveHourUsed: usedOf(fiveFraction, fiveTotal),
    weekPercent: usedPercent(usage.per1WeekPercentage),
    weekResetAt: resetIso(usage.per1WeekResetTime),
    weekTotal,
    weekUsed: usedOf(weekFraction, weekTotal),
    monthPercent: usedPercent(usage.per1MonthPercentage ?? usage.perMonthPercentage),
    monthResetAt: resetIso(usage.per1MonthResetTime ?? usage.perMonthResetTime),
    monthTotal,
    monthUsed: usedOf(monthFraction, monthTotal),
  }
}

async function qwenConsoleGet(url, cookie) {
  const response = await fetch(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(20_000),
    headers: { cookie, accept: 'application/json' },
  })
  if (response.status >= 300 && response.status < 400) {
    throw new PlanError('SIGN_IN_REQUIRED', `Qwen HTTP ${response.status}`)
  }
  const body = await readJson(response)
  if (!response.ok || body.code === 'ConsoleNeedLogin') {
    throw new PlanError(
      response.status === 401 || response.status === 403 || body.code === 'ConsoleNeedLogin'
        ? 'SIGN_IN_REQUIRED'
        : 'UPSTREAM_FAILED',
      `Qwen HTTP ${response.status}`,
    )
  }
  return body
}

async function qwenSecToken(cookie) {
  const body = await qwenConsoleGet(QWEN_USER_INFO_URL, cookie)
  const token = body?.data?.secToken
  if (typeof token !== 'string' || token.length === 0) {
    throw new PlanError('SIGN_IN_REQUIRED', 'Qwen session has no sec_token')
  }
  return token
}

async function qwenCallBailian(cookie, token, api) {
  const params = {
    Api: api,
    V: '1.0',
    Data: {
      commodityCode: QWEN_COMMODITY_CODE,
      cornerstoneParam: {
        domain: 'home.qwencloud.com',
        consoleSite: 'QWENCLOUD',
        console: 'ONE_CONSOLE',
        xsp_lang: 'en',
        protocol: 'V2',
        productCode: 'p_efm',
      },
    },
  }
  const body = new URLSearchParams({
    product: 'sfm_bailian',
    action: 'IntlBroadScopeAspnGateway',
    sec_token: token,
    region: 'ap-southeast-1',
    params: JSON.stringify(params),
  })
  const url = `${QWEN_BAILIAN_URL}?product=sfm_bailian&action=IntlBroadScopeAspnGateway&api=${encodeURIComponent(api)}`
  const response = await fetch(url, {
    method: 'POST',
    redirect: 'manual',
    signal: AbortSignal.timeout(20_000),
    headers: {
      cookie,
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
      origin: 'https://home.qwencloud.com',
      referer: QWEN_BILLING_URL,
    },
    body,
  })
  if (response.status >= 300 && response.status < 400) {
    throw new PlanError('SIGN_IN_REQUIRED', `Qwen HTTP ${response.status}`)
  }
  const payload = await readJson(response)
  if (!response.ok || payload.code === 'ConsoleNeedLogin') {
    throw new PlanError(
      response.status === 401 || response.status === 403 || payload.code === 'ConsoleNeedLogin'
        ? 'SIGN_IN_REQUIRED'
        : 'UPSTREAM_FAILED',
      `Qwen HTTP ${response.status}`,
    )
  }
  return payload
}

export function loginProfileDir() {
  return path.join(os.homedir(), '.dsh', 'coding-plan-usage', 'edge-profile')
}

function browserCandidates() {
  const local = process.env.LOCALAPPDATA
  const programFiles = process.env.ProgramFiles
  const programFilesX86 = process.env['ProgramFiles(x86)']
  if (process.platform === 'win32') {
    return [
      programFilesX86 && path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      programFiles && path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      local && path.join(local, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      programFiles && path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      local && path.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ].filter(Boolean)
  }
  if (process.platform === 'darwin') {
    return [
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ]
  }
  return [
    '/usr/bin/microsoft-edge',
    '/usr/bin/microsoft-edge-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
  ]
}

export function findBrowser() {
  return browserCandidates().find((candidate) => existsSync(candidate))
}

export function cookieHeaderFromList(cookies) {
  const pairs = []
  const seen = new Set()
  for (const cookie of cookies ?? []) {
    const domain = String(cookie?.domain ?? '')
    if (!domain.includes('qwencloud.com') && !domain.includes('qianwenai.com')) continue
    const name = String(cookie?.name ?? '')
    const value = cookie?.value
    if (name.length === 0 || /[\s;,]/.test(name) || typeof value !== 'string' || value.includes(';')) continue
    if (seen.has(name)) continue
    seen.add(name)
    pairs.push(`${name}=${value}`)
  }
  return pairs.join('; ')
}

/** True once the Qwen login ticket cookie is present — a cheap login check. */
export function hasQwenTicket(cookies) {
  for (const cookie of cookies ?? []) {
    const domain = String(cookie?.domain ?? '')
    if (!domain.includes('qwencloud.com')) continue
    if (cookie?.name === 'login_qwencloud_ticket' && typeof cookie.value === 'string' && cookie.value.length > 0) return true
  }
  return false
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close(() => resolve(port))
    })
  })
}

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new PlanError('CANCELLED', 'cancelled'))
    }, { once: true })
  })
}

/** Kill the launched browser by PID tree first; fall back to a profile scan. */
function stopBrowser(child, profileDir) {
  const killTree = () => new Promise((resolve) => {
    if (!child || child.pid === undefined || child.exitCode !== null) return resolve(false)
    const killer = process.platform === 'win32'
      ? spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
      : spawn('kill', ['-TERM', String(child.pid)], { windowsHide: true, stdio: 'ignore' })
    let settled = false
    const done = () => { if (!settled) { settled = true; clearTimeout(t); resolve(true) } }
    const t = setTimeout(() => { try { killer.kill() } catch {} done() }, 8000)
    killer.once('exit', done)
    killer.once('error', done)
  })
  const scanProfile = () => new Promise((resolve) => {
    const command = process.platform === 'win32'
      ? ['powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
          `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${profileDir.replace(/'/g, "''")}*' -and $_.Name -match '^(msedge|chrome)\\.exe$' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`]]
      : ['pkill', ['-f', profileDir]]
    const child2 = spawn(command[0], command[1], { windowsHide: true, stdio: 'ignore' })
    let settled = false
    const done = () => { if (!settled) { settled = true; clearTimeout(t); resolve() } }
    const t = setTimeout(() => { try { child2.kill() } catch {} done() }, 15000)
    child2.once('exit', done)
    child2.once('error', done)
  })
  return killTree().then((killed) => (killed ? undefined : scanProfile()))
}

async function waitForDebugger(port, signal) {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    if (signal.aborted) throw new PlanError('CANCELLED', 'cancelled')
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1000) })
      if (response.ok) {
        const body = await response.json()
        if (typeof body.webSocketDebuggerUrl === 'string') return body.webSocketDebuggerUrl
      }
    } catch {
      /* browser still starting */
    }
    await delay(300, signal)
  }
  throw new PlanError('BROWSER_FAILED', 'browser debugger did not start')
}

function readDebuggerCookies(wsUrl, signal) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    const timer = setTimeout(() => { ws.close(); reject(new PlanError('BROWSER_FAILED', 'cookie read timed out')) }, 8000)
    const finish = (error, cookies) => {
      clearTimeout(timer)
      ws.close()
      if (error) reject(error)
      else resolve(cookies)
    }
    signal.addEventListener('abort', () => finish(new PlanError('CANCELLED', 'cancelled')), { once: true })
    ws.addEventListener('open', () => ws.send(JSON.stringify({ id: 1, method: 'Storage.getCookies' })))
    ws.addEventListener('message', (event) => {
      let message
      try {
        message = JSON.parse(String(event.data))
      } catch {
        finish(new PlanError('BROWSER_FAILED', 'debugger returned invalid JSON'))
        return
      }
      if (message.id !== 1) return
      if (message.error) {
        finish(new PlanError('BROWSER_FAILED', 'debugger refused cookie read'))
        return
      }
      finish(undefined, Array.isArray(message.result?.cookies) ? message.result.cookies : [])
    })
    ws.addEventListener('error', () => finish(new PlanError('BROWSER_FAILED', 'debugger connection failed')))
  })
}

// ---------------------------------------------------------------------------
// Z.ai GLM Coding Plan (API key)
// ---------------------------------------------------------------------------

async function zaiGet(url, key) {
  const response = await fetch(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(20_000),
    headers: { authorization: `Bearer ${key}`, accept: 'application/json' },
  })
  if (response.status === 401 || response.status === 403) {
    throw new PlanError('SIGN_IN_REQUIRED', `Z.ai HTTP ${response.status}`)
  }
  const body = await readJson(response)
  if (!response.ok || (body.code !== undefined && body.code !== 200)) {
    throw new PlanError('UPSTREAM_FAILED', `Z.ai HTTP ${response.status} code ${body.code}`)
  }
  return body
}

export function parseZai(subscriptionJson, quotaJson) {
  const subs = Array.isArray(subscriptionJson?.data) ? subscriptionJson.data : []
  const active = subs.find((s) => s?.status === 'VALID') ?? subs[0] ?? {}
  const limits = Array.isArray(quotaJson?.data?.limits) ? quotaJson.data.limits : []
  let session
  let weekly
  let searches
  for (const limit of limits) {
    if (limit?.type === 'TOKENS_LIMIT' && limit.unit === 3) session = limit
    else if (limit?.type === 'TOKENS_LIMIT' && limit.unit === 6) weekly = limit
    else if (limit?.type === 'TIME_LIMIT') searches = limit
  }
  return {
    plan: active.productName ?? active.productBigTitle ?? 'GLM Coding Plan',
    status: typeof active.status === 'string' ? active.status : undefined,
    level: typeof quotaJson?.data?.level === 'string' ? quotaJson.data.level : undefined,
    nextRenewAt: typeof active.nextRenewTime === 'string' ? active.nextRenewTime : undefined,
    sessionPercent: clampPercent(session?.percentage),
    sessionResetAt: resetIso(session?.nextResetTime),
    weekPercent: clampPercent(weekly?.percentage),
    weekResetAt: resetIso(weekly?.nextResetTime),
    searchesUsed: finiteNumber(searches?.currentValue),
    searchesTotal: finiteNumber(searches?.usage),
    searchesRemaining: finiteNumber(searches?.remaining),
    searchesResetAt: resetIso(searches?.nextResetTime),
  }
}

async function fetchZai(key) {
  const [subscription, quota] = await Promise.all([zaiGet(ZAI_SUBSCRIPTION_URL, key), zaiGet(ZAI_QUOTA_URL, key)])
  const parsed = parseZai(subscription, quota)
  if (parsed.sessionPercent === undefined && parsed.weekPercent === undefined && parsed.searchesTotal === undefined) {
    throw new PlanError('NO_USAGE', 'Z.ai returned no quota')
  }
  return parsed
}

// ---------------------------------------------------------------------------
// MiniMax Coding Plan (API key)
// ---------------------------------------------------------------------------

export function parseMinimax(json) {
  const baseResp = asObject(json?.base_resp)
  if (baseResp && baseResp.status_code !== undefined && baseResp.status_code !== 0) {
    const code = Number(baseResp.status_code)
    throw new PlanError(code === 1004 || code === 1008 ? 'SIGN_IN_REQUIRED' : 'UPSTREAM_FAILED', `MiniMax ${baseResp.status_msg || 'error'}`)
  }
  const remains = Array.isArray(json?.model_remains) ? json.model_remains : []
  const general = remains.find((r) => r?.model_name === 'general') ?? remains[0] ?? {}
  const intervalRemaining = finiteNumber(general.current_interval_remaining_percent)
  const weeklyRemaining = finiteNumber(general.current_weekly_remaining_percent)
  const plan = json?.current_subscribe_title ?? json?.plan_name ?? json?.plan ?? 'Coding Plan'
  return {
    plan: String(plan),
    sessionPercent: intervalRemaining !== undefined ? clampPercent(100 - intervalRemaining) : undefined,
    sessionResetAt: resetIso(general.end_time),
    sessionTotal: finiteNumber(general.current_interval_total_count),
    sessionUsed: finiteNumber(general.current_interval_usage_count),
    weekPercent: weeklyRemaining !== undefined ? clampPercent(100 - weeklyRemaining) : undefined,
    weekResetAt: resetIso(general.weekly_end_time),
    weekTotal: finiteNumber(general.current_weekly_total_count),
    weekUsed: finiteNumber(general.current_weekly_usage_count),
  }
}

async function minimaxGet(url, key) {
  const response = await fetch(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(20_000),
    headers: { authorization: `Bearer ${key}`, accept: 'application/json', 'content-type': 'application/json' },
  })
  if (response.status === 401 || response.status === 403) {
    throw new PlanError('SIGN_IN_REQUIRED', `MiniMax HTTP ${response.status}`)
  }
  const body = await readJson(response)
  if (!response.ok) throw new PlanError('UPSTREAM_FAILED', `MiniMax HTTP ${response.status}`)
  return body
}

async function fetchMinimax(key) {
  let lastError
  for (const url of MINIMAX_URLS) {
    try {
      const body = await minimaxGet(url, key)
      const parsed = parseMinimax(body)
      if (parsed.sessionPercent === undefined && parsed.weekPercent === undefined) {
        throw new PlanError('NO_USAGE', 'MiniMax returned no usage')
      }
      return parsed
    } catch (error) {
      lastError = error
      // A Cloudflare HTML fallback or 404 means try the next URL; an auth error is final.
      if (error instanceof PlanError && error.code === 'SIGN_IN_REQUIRED') throw error
    }
  }
  throw lastError ?? new PlanError('UPSTREAM_FAILED', 'MiniMax unreachable')
}

// ---------------------------------------------------------------------------
// plugin
// ---------------------------------------------------------------------------

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > COOKIE_LIMIT + 1024) {
        reject(new PlanError('COOKIE_INVALID', 'payload too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/** @param {any} ctx */
export function apply(ctx) {
  /** @type {Record<string, {at: number, data: any}>} */
  const cache = {}
  /** @type {{status: string, error: string | null, controller: AbortController | null}} */
  let qwenLogin = { status: 'idle', error: null, controller: null }

  // ---- credential helpers ----
  const readGrantPayload = async (key, type) => {
    const record = await ctx.credentials.readRecord(key)
    const payload = record?.kind === 'grant' ? record.payload : undefined
    if (!payload || typeof payload !== 'object' || payload.type !== type) return undefined
    return payload
  }

  const saveGrant = async (key, payload) => {
    await ctx.credentials.modifyRecord(key, async () => ({ kind: 'grant', payload }))
  }

  const recordConfigured = async (key) => {
    try {
      const info = await ctx.credentials.describeRecord(key)
      return info?.configured === true
    } catch {
      return false
    }
  }

  // ---- Qwen ----
  const qwenReadCookie = async () => {
    const payload = await readGrantPayload(QWEN_SESSION_KEY, 'cookie')
    return typeof payload?.cookie === 'string' && payload.cookie.length > 0 ? payload.cookie : undefined
  }

  const qwenLoadUsage = async (cookie) => {
    const token = await qwenSecToken(cookie)
    const [usage, subscription, quota] = await Promise.all([
      qwenCallBailian(cookie, token, QWEN_USAGE_API),
      qwenCallBailian(cookie, token, QWEN_SUBSCRIPTION_API),
      qwenCallBailian(cookie, token, QWEN_QUOTA_API),
    ])
    const assembled = assembleQwenUsage({ usage, subscription, quota })
    if (assembled.fiveHourPercent === undefined && assembled.weekPercent === undefined && assembled.monthPercent === undefined) {
      throw new PlanError('NO_USAGE', 'Qwen returned no usage percentages')
    }
    return assembled
  }

  const qwenUsageView = async (force) => {
    const signedIn = await recordConfigured(QWEN_SESSION_KEY)
    if (!signedIn) {
      return { provider: 'qwen', configured: false, status: qwenLogin.status === 'pending' ? 'pending' : 'idle', error: qwenLogin.error ?? 'SIGN_IN_REQUIRED', usage: null, fetchedAt: Date.now() }
    }
    if (!force && cache.qwen && Date.now() - cache.qwen.at < CACHE_TTL_MS) return cache.qwen.data
    const cookie = await qwenReadCookie()
    if (!cookie) return { provider: 'qwen', configured: false, status: 'idle', error: 'SIGN_IN_REQUIRED', usage: null, fetchedAt: Date.now() }
    try {
      const data = { provider: 'qwen', configured: true, status: 'authorized', error: null, usage: { signedIn: true, ...await qwenLoadUsage(cookie) }, fetchedAt: Date.now() }
      cache.qwen = { at: Date.now(), data }
      return data
    } catch (error) {
      return { provider: 'qwen', configured: true, status: 'authorized', error: errorCode(error), usage: null, fetchedAt: Date.now() }
    }
  }

  const openQwenLogin = async (signal) => {
    const browser = findBrowser()
    const profileDir = loginProfileDir()
    if (!browser) throw new PlanError('BROWSER_MISSING', 'Edge or Chrome was not found')
    await mkdir(profileDir, { recursive: true })
    const port = await freePort()
    const child = spawn(browser, [
      `--user-data-dir=${profileDir}`,
      `--remote-debugging-port=${port}`,
      '--remote-debugging-address=127.0.0.1',
      `--remote-allow-origins=${DEBUGGER_ALLOWED_ORIGIN}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-sync',
      '--new-window',
      QWEN_BILLING_URL,
    ], { detached: false, windowsHide: false, stdio: 'ignore' })
    child.unref()
    try {
      const wsUrl = await waitForDebugger(port, signal)
      const deadline = Date.now() + LOGIN_TIMEOUT_MS
      let ticketSeen = false
      while (Date.now() < deadline) {
        if (signal.aborted) throw new PlanError('CANCELLED', 'cancelled')
        let cookies = []
        try {
          cookies = await readDebuggerCookies(wsUrl, signal)
        } catch (error) {
          if (error instanceof PlanError && error.code === 'CANCELLED') throw error
          ctx.logger.warn('coding-plan-usage: qwen cookie read failed; keeping the login window open')
          ctx.logger.warn(safeMessage(error))
        }
        // Cheap gate: only run the four Qwen calls once the login ticket exists.
        if (hasQwenTicket(cookies)) {
          ticketSeen = true
          const header = cookieHeaderFromList(cookies)
          try {
            const usage = await qwenLoadUsage(header)
            await saveGrant(QWEN_SESSION_KEY, { type: 'cookie', cookie: header })
            cache.qwen = { at: Date.now(), data: { provider: 'qwen', configured: true, status: 'authorized', error: null, usage: { signedIn: true, ...usage }, fetchedAt: Date.now() } }
            return
          } catch (error) {
            if (error instanceof PlanError && error.code === 'CANCELLED') throw error
            ctx.logger.warn('coding-plan-usage: qwen usage check failed; keeping the login window open')
            ctx.logger.warn(safeMessage(error))
          }
        }
        await delay(ticketSeen ? 3000 : 1500, signal)
      }
      throw new PlanError('LOGIN_TIMEOUT', 'login timed out')
    } finally {
      await stopBrowser(child, profileDir)
    }
  }

  const startQwenLogin = () => {
    if (qwenLogin.status === 'pending') return
    const controller = new AbortController()
    qwenLogin = { status: 'pending', error: null, controller }
    openQwenLogin(controller.signal).then(() => {
      if (qwenLogin.controller !== controller) return
      qwenLogin = { status: 'authorized', error: null, controller: null }
    }).catch((error) => {
      if (qwenLogin.controller !== controller) return
      qwenLogin = { status: controller.signal.aborted ? 'cancelled' : 'failed', error: errorCode(error), controller: null }
    })
  }

  const cancelQwenLogin = async () => {
    qwenLogin.controller?.abort()
    qwenLogin = { status: 'cancelled', error: null, controller: null }
  }

  // ---- Z.ai / MiniMax (API key) ----
  const keyRecordFor = (provider) => (provider === 'zai' ? ZAI_KEY_RECORD : MINIMAX_KEY_RECORD)
  const refFor = (provider) => (provider === 'zai' ? ZAI_REF : MINIMAX_REF)

  const resolveApiKey = async (provider) => {
    const payload = await readGrantPayload(keyRecordFor(provider), 'api-key')
    if (typeof payload?.key === 'string' && payload.key.length > 0) return { key: payload.key, source: 'plugin' }
    try {
      const hit = await ctx.credentials.resolve(refFor(provider))
      if (typeof hit?.value === 'string' && hit.value.length > 0) return { key: hit.value, source: 'provider' }
    } catch (error) {
      ctx.logger.warn('coding-plan-usage: could not resolve %s', refFor(provider))
      ctx.logger.warn(safeMessage(error))
    }
    return undefined
  }

  const keyUsageView = async (provider, force) => {
    if (!force && cache[provider] && Date.now() - cache[provider].at < CACHE_TTL_MS) return cache[provider].data
    const resolved = await resolveApiKey(provider)
    if (!resolved) {
      return { provider, configured: false, status: 'missing-key', error: 'NO_KEY', usage: null, fetchedAt: Date.now() }
    }
    try {
      const usage = provider === 'zai' ? await fetchZai(resolved.key) : await fetchMinimax(resolved.key)
      const data = { provider, configured: true, status: 'ready', error: null, keySource: resolved.source, usage, fetchedAt: Date.now() }
      cache[provider] = { at: Date.now(), data }
      return data
    } catch (error) {
      return { provider, configured: true, status: 'error', error: errorCode(error), keySource: resolved.source, usage: null, fetchedAt: Date.now() }
    }
  }

  // ---- routing ----
  const originAllowed = (req) => {
    const origin = req.headers.origin
    if (typeof origin !== 'string' || origin.length === 0) return true
    const host = req.headers.host
    if (typeof host !== 'string' || host.length === 0) return false
    try {
      return new URL(origin).host === host
    } catch {
      return false
    }
  }

  const sendJson = (res, status, body) => {
    const payload = JSON.stringify(body)
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'content-length': Buffer.byteLength(payload),
      'cache-control': 'no-store',
    })
    res.end(payload)
  }

  const route = (routePath, handler) => {
    const wrapped = async (req, res) => {
      try {
        if (!originAllowed(req)) {
          sendJson(res, 403, { ok: false, error: 'forbidden origin' })
          return
        }
        if ((req.method ?? 'GET').toUpperCase() !== handler.method) {
          sendJson(res, 405, { ok: false, error: 'method not allowed' })
          return
        }
        sendJson(res, 200, { ok: true, ...(await handler.run(req)) })
      } catch (error) {
        ctx.logger.warn('coding-plan-usage: request handler failed')
        ctx.logger.warn(safeMessage(error))
        const code = error instanceof PlanError ? error.code : 'UPSTREAM_FAILED'
        const status = error instanceof PlanError && (error.code === 'COOKIE_INVALID' || error.code === 'BAD_REQUEST') ? 400 : 500
        sendJson(res, status, { ok: false, error: code })
      }
    }
    return ctx.webServer.register({ kind: 'exact', path: routePath, handler: wrapped })
  }

  const parseJsonBody = async (req) => {
    const raw = await readBody(req)
    try {
      return JSON.parse(raw || '{}')
    } catch {
      throw new PlanError('BAD_REQUEST', 'body is not JSON')
    }
  }

  ctx.effect(() => {
    // Migrate a session left by the earlier single-provider plugin.
    void (async () => {
      try {
        if (await recordConfigured(QWEN_SESSION_KEY)) return
        const legacy = await ctx.credentials.readRecord(LEGACY_QWEN_KEY)
        if (legacy) {
          await ctx.credentials.modifyRecord(QWEN_SESSION_KEY, async () => legacy)
          await ctx.credentials.deleteRecord(LEGACY_QWEN_KEY)
        }
      } catch (error) {
        ctx.logger.warn('coding-plan-usage: qwen session migration failed')
        ctx.logger.warn(safeMessage(error))
      }
    })()

    const disposers = [
      route('/coding-plan/usage', {
        method: 'GET',
        run: async (req) => {
          const url = new URL(req.url ?? '/', 'http://x')
          const provider = url.searchParams.get('provider') ?? 'qwen'
          const force = url.searchParams.get('refresh') === '1'
          if (provider === 'qwen') return { ...(await qwenUsageView(force)), loginStatus: qwenLogin.status, loginError: qwenLogin.error }
          if (provider === 'zai' || provider === 'minimax') return keyUsageView(provider, force)
          throw new PlanError('BAD_REQUEST', 'unknown provider')
        },
      }),
      route('/coding-plan/login', {
        method: 'POST',
        run: async () => {
          startQwenLogin()
          return { status: qwenLogin.status, error: qwenLogin.error }
        },
      }),
      route('/coding-plan/cancel', {
        method: 'POST',
        run: async () => {
          await cancelQwenLogin()
          return { status: qwenLogin.status, error: qwenLogin.error }
        },
      }),
      route('/coding-plan/sign-in', {
        method: 'POST',
        run: async (req) => {
          const body = await parseJsonBody(req)
          const provider = body?.provider ?? 'qwen'
          if (provider === 'qwen') {
            const cookie = normalizeCookie(body?.cookie)
            const usage = await qwenLoadUsage(cookie)
            await saveGrant(QWEN_SESSION_KEY, { type: 'cookie', cookie })
            cache.qwen = undefined
            return { provider, configured: true, usage: { signedIn: true, ...usage } }
          }
          if (provider === 'zai' || provider === 'minimax') {
            const key = String(body?.key ?? '').trim()
            if (key.length === 0 || key.length > 512) throw new PlanError('BAD_REQUEST', 'invalid key')
            const usage = provider === 'zai' ? await fetchZai(key) : await fetchMinimax(key)
            await saveGrant(keyRecordFor(provider), { type: 'api-key', key })
            cache[provider] = undefined
            return { provider, configured: true, usage }
          }
          throw new PlanError('BAD_REQUEST', 'unknown provider')
        },
      }),
      route('/coding-plan/sign-out', {
        method: 'POST',
        run: async (req) => {
          const body = await parseJsonBody(req)
          const provider = body?.provider ?? 'qwen'
          const key = provider === 'qwen' ? QWEN_SESSION_KEY : provider === 'zai' ? ZAI_KEY_RECORD : MINIMAX_KEY_RECORD
          cache[provider] = undefined
          try {
            await ctx.credentials.deleteRecord(key)
          } catch (error) {
            ctx.logger.warn('coding-plan-usage: failed to delete the %s record', provider)
            ctx.logger.warn(safeMessage(error))
          }
          return { provider, configured: false }
        },
      }),
    ]
    return () => {
      qwenLogin.controller?.abort()
      for (const dispose of disposers) dispose()
    }
  }, 'coding-plan-usage: host routes')
}

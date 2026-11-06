import assert from 'node:assert/strict'
import { apply } from '../index.js'

// ---- mock ctx ----
const routes = new Map()
const records = new Map()
const refs = { ZAI_API_KEY: 'zai-test-key', MINIMAX_API_KEY: 'mm-test-key' }
const logs = []
const ctx = {
  logger: { warn: (...a) => logs.push(a.map(String).join(' ')) },
  webServer: { register: ({ path, handler }) => { routes.set(path, handler); return () => routes.delete(path) } },
  credentials: {
    readRecord: async (k) => records.get(k),
    describeRecord: async (k) => (records.has(k) ? { configured: true } : { configured: false }),
    modifyRecord: async (k, fn) => { const next = await fn(records.get(k)); if (next !== undefined) records.set(k, next); return next },
    deleteRecord: async (k) => { records.delete(k) },
    resolve: async (ref) => (refs[ref] ? { value: refs[ref], source: 'file' } : undefined),
  },
  effect: (fn) => { const dispose = fn(); return dispose },
}

apply(ctx)

// routes registered
for (const p of ['/coding-plan/usage', '/coding-plan/login', '/coding-plan/cancel', '/coding-plan/sign-in', '/coding-plan/sign-out']) {
  assert.ok(routes.has(p), 'missing route ' + p)
}

// ---- mock fetch per host ----
const realFetch = globalThis.fetch
function mockFetch(handler) { globalThis.fetch = handler }

function req(method, url, body) {
  return { method, url, headers: { host: '127.0.0.1:1' }, on: (ev, cb) => { if (ev === 'end') setImmediate(() => cb()) }, }
}
function reqWithBody(method, url, bodyStr) {
  const r = { method, url, headers: { host: '127.0.0.1:1' }, on: () => {} }
  // simulate body streaming
  setImmediate(() => {
    r.onData?.(Buffer.from(bodyStr))
    r.onEnd?.()
  })
  r.on = (ev, cb) => { if (ev === 'data') r.onData = cb; if (ev === 'end') r.onEnd = cb; if (ev === 'error') r.onError = cb }
  return r
}
function res() {
  const out = {}
  return {
    out,
    writeHead: (status, headers) => { out.status = status; out.headers = headers },
    end: (body) => { out.body = body },
  }
}

// ---- Z.ai usage via provider key ----
mockFetch(async (url) => {
  if (url.includes('subscription/list')) return { ok: true, status: 200, headers: { get: () => 'application/json' }, text: async () => JSON.stringify({ code: 200, data: [{ productName: 'GLM Coding Pro', status: 'VALID' }], success: true }) }
  if (url.includes('quota/limit')) return { ok: true, status: 200, headers: { get: () => 'application/json' }, text: async () => JSON.stringify({ code: 200, data: { limits: [{ type: 'TOKENS_LIMIT', unit: 3, number: 5, percentage: 7, nextResetTime: 1793951648159 }, { type: 'TOKENS_LIMIT', unit: 6, number: 1, percentage: 1, nextResetTime: 1794450268998 }, { type: 'TIME_LIMIT', unit: 5, number: 1, usage: 1000, currentValue: 0, remaining: 1000, nextResetTime: 1795854643998 }], level: 'pro' }, success: true }) }
  throw new Error('unexpected ' + url)
})
{
  const r = res()
  await routes.get('/coding-plan/usage')({ method: 'GET', url: '/coding-plan/usage?provider=zai&refresh=1', headers: { host: '127.0.0.1:1' } }, r)
  const body = JSON.parse(r.out.body)
  assert.equal(body.ok, true)
  assert.equal(body.provider, 'zai')
  assert.equal(body.configured, true)
  assert.equal(body.keySource, 'provider')
  assert.equal(body.usage.plan, 'GLM Coding Pro')
  assert.equal(body.usage.sessionPercent, 7)
  assert.equal(body.usage.searchesTotal, 1000)
}

// ---- MiniMax usage via provider key ----
mockFetch(async (url) => {
  if (url.includes('coding_plan/remains')) return { ok: true, status: 200, headers: { get: () => 'application/json' }, text: async () => JSON.stringify({ model_remains: [{ model_name: 'general', current_interval_remaining_percent: 80, end_time: 1793959200000, current_weekly_remaining_percent: 60, weekly_end_time: 1794182400000 }], base_resp: { status_code: 0 } }) }
  throw new Error('unexpected ' + url)
})
{
  const r = res()
  await routes.get('/coding-plan/usage')({ method: 'GET', url: '/coding-plan/usage?provider=minimax&refresh=1', headers: { host: '127.0.0.1:1' } }, r)
  const body = JSON.parse(r.out.body)
  assert.equal(body.usage.sessionPercent, 20)
  assert.equal(body.usage.weekPercent, 40)
}

// ---- Z.ai missing key path ----
{
  const savedZai = refs.ZAI_API_KEY
  delete refs.ZAI_API_KEY
  const r = res()
  await routes.get('/coding-plan/usage')({ method: 'GET', url: '/coding-plan/usage?provider=zai&refresh=1', headers: { host: '127.0.0.1:1' } }, r)
  const body = JSON.parse(r.out.body)
  assert.equal(body.configured, false)
  assert.equal(body.status, 'missing-key')
  refs.ZAI_API_KEY = savedZai
}

// ---- sign-in saves a pasted key, then sign-out deletes it ----
mockFetch(async (url) => {
  if (url.includes('subscription/list')) return { ok: true, status: 200, headers: { get: () => 'application/json' }, text: async () => JSON.stringify({ code: 200, data: [{ productName: 'GLM Coding Lite', status: 'VALID' }] }) }
  if (url.includes('quota/limit')) return { ok: true, status: 200, headers: { get: () => 'application/json' }, text: async () => JSON.stringify({ code: 200, data: { limits: [{ type: 'TOKENS_LIMIT', unit: 3, number: 5, percentage: 50, nextResetTime: 1793951648159 }] } }) }
  throw new Error('unexpected ' + url)
})
{
  delete refs.ZAI_API_KEY // force plugin-record path
  const r = res()
  const rq = reqWithBody('POST', '/coding-plan/sign-in', JSON.stringify({ provider: 'zai', key: 'pasted-key' }))
  await routes.get('/coding-plan/sign-in')(rq, r)
  const body = JSON.parse(r.out.body)
  assert.equal(body.configured, true)
  assert.equal(body.usage.plan, 'GLM Coding Lite')
  assert.ok(records.has('coding-plan-usage/zai-key'), 'pasted key not stored')
  // sign-out
  const r2 = res()
  const rq2 = reqWithBody('POST', '/coding-plan/sign-out', JSON.stringify({ provider: 'zai' }))
  await routes.get('/coding-plan/sign-out')(rq2, r2)
  assert.equal(records.has('coding-plan-usage/zai-key'), false, 'sign-out did not delete')
}

// ---- origin rejection ----
{
  const r = res()
  await routes.get('/coding-plan/usage')({ method: 'GET', url: '/coding-plan/usage?provider=zai', headers: { host: '127.0.0.1:1', origin: 'https://evil.example' } }, r)
  assert.equal(r.out.status, 403)
}

globalThis.fetch = realFetch
console.log('PASS host smoke: routes, zai, minimax, missing-key, paste+signout, origin guard')

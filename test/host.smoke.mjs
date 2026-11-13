import assert from 'node:assert/strict'
import { apply } from '../index.js'

// ---- mock ctx ----
const routes = new Map()
const records = new Map()
const refs = { ZAI_API_KEY: 'zai-test-key', MINIMAX_API_KEY: 'mm-test-key' }
const logs = []
const ctx = {
  logger: { warn: (...a) => logs.push(a.map(String).join(' ')) },
  get() { return undefined },
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

function req(method, url) {
  return { method, url, headers: { host: '127.0.0.1:1', origin: 'http://127.0.0.1:1' }, on: (ev, cb) => { if (ev === 'end') setImmediate(() => cb()) } }
}
function reqWithBody(method, url, bodyStr) {
  const r = { method, url, headers: { host: '127.0.0.1:1', origin: 'http://127.0.0.1:1' }, on: () => {} }
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
  await routes.get('/coding-plan/usage')({ method: 'GET', url: '/coding-plan/usage?provider=zai&refresh=1', headers: { host: '127.0.0.1:1', origin: 'http://127.0.0.1:1' } }, r)
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
  await routes.get('/coding-plan/usage')({ method: 'GET', url: '/coding-plan/usage?provider=minimax&refresh=1', headers: { host: '127.0.0.1:1', origin: 'http://127.0.0.1:1' } }, r)
  const body = JSON.parse(r.out.body)
  assert.equal(body.usage.sessionPercent, 20)
  assert.equal(body.usage.weekPercent, 40)
}

// ---- Z.ai missing key path ----
{
  const savedZai = refs.ZAI_API_KEY
  delete refs.ZAI_API_KEY
  const r = res()
  await routes.get('/coding-plan/usage')({ method: 'GET', url: '/coding-plan/usage?provider=zai&refresh=1', headers: { host: '127.0.0.1:1', origin: 'http://127.0.0.1:1' } }, r)
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

// ---- origin rejection on a composition without connection ----
{
  const r = res()
  await routes.get('/coding-plan/usage')({ method: 'GET', url: '/coding-plan/usage?provider=zai', headers: { host: '127.0.0.1:1', origin: 'https://evil.example' } }, r)
  assert.equal(r.out.status, 403)
}

// A request with no Origin is not treated as local. curl and another local
// process must not start a login browser or delete a stored credential.
{
  const r = res()
  await routes.get('/coding-plan/login')({ method: 'POST', url: '/coding-plan/login', headers: { host: '127.0.0.1:1' } }, r)
  assert.equal(r.out.status, 403)
  assert.equal(JSON.parse(r.out.body).ok, false)
}

// ---- current DSH: webServer admits before dispatch and passes the Peer ----
{
  const admitted = new Map()
  const peer = { principal: { kind: 'owner' }, signal: { aborted: false } }
  apply({
    ...ctx,
    webServer: {
      register: ({ path, auth, handler }) => {
        assert.equal(auth, 'required', path + ' must require admission')
        admitted.set(path, (req, res) => handler(req, res, peer))
        return () => admitted.delete(path)
      },
    },
  })
  const r = res()
  await admitted.get('/coding-plan/usage')({ method: 'GET', url: '/coding-plan/usage?provider=zai', headers: { host: 'attacker.example', origin: 'https://attacker.example' } }, r)
  assert.equal(r.out.status, 200, 'an admitted Peer is the host decision')
}

// ---- installed 0.2.2 nightly: connection.requestRejection is the fence ----
{
  const guarded = new Map()
  let admissions = 0
  apply({
    ...ctx,
    get(name) {
      if (name !== 'connection') return undefined
      return {
        requestRejection(request) {
          return request.headers.origin === 'https://evil.example' ? 403 : undefined
        },
        admit() {
          admissions += 1
          return { peer: { principal: { kind: 'owner' } } }
        },
      }
    },
    webServer: {
      register: ({ path, handler }) => {
        guarded.set(path, handler)
        return () => guarded.delete(path)
      },
    },
  })
  const rejected = res()
  let bodyRead = false
  await guarded.get('/coding-plan/sign-out')({
    method: 'POST',
    url: '/coding-plan/sign-out',
    headers: { host: '127.0.0.1:1', origin: 'https://evil.example' },
    on(event, callback) {
      if (event === 'data') bodyRead = true
      if (event === 'end') callback()
    },
  }, rejected)
  assert.equal(rejected.out.status, 403)
  assert.equal(bodyRead, false, 'a rejected request must not be read')

  const allowed = res()
  await guarded.get('/coding-plan/usage')({ method: 'GET', url: '/coding-plan/usage?provider=zai', headers: { host: '127.0.0.1:1' } }, allowed)
  assert.equal(allowed.out.status, 200)
  assert.equal(admissions, 1, 'an accepted requestRejection still resolves the Peer')
}

globalThis.fetch = realFetch
console.log('PASS host smoke: routes, zai, minimax, missing-key, paste+signout, admission fence')

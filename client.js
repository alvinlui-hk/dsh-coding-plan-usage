window.__ModuleLoader__.load({
  id: '@local/dsh-coding-plan-usage',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const NS = 'codingPlanUsage'
    const QWEN_BILLING_URL = 'https://home.qwencloud.com/billing/subscription/token-plan-individual'

    const zh = {
      zoneTitle: 'Coding Plan 用量',
      checking: '檢查緊…',
      refresh: '刷新',
      loading: '讀取緊用量…',
      updated: '更新於 {time}',
      reset: '重設於 {time}',
      usedOf: '{used} / {total}',
      remainingDays: '剩餘 {days} 日',
      hostUnreachable: '連唔到插件後台，請刷新頁面。',
      upstreamFailed: '暫時讀唔到用量，請稍後再試。',
      noUsage: '供應商冇返回用量資料。',
      // qwen
      qwenTitle: 'Qwen Token Plan',
      qwenSignedIn: '已連接',
      qwenNotSignedIn: '未連接',
      qwenPending: '等待登入',
      qwenSignIn: '登入 Qwen Cloud',
      qwenCancel: '取消登入',
      qwenSignOut: '退出並刪除 Cookie',
      qwenWaiting: '登入視窗已打開。請在嗰個視窗登入 Qwen Cloud，成功後呢度會自動更新。',
      qwenPrivacy: '登入用獨立瀏覽器設定檔，唔會打開你日常瀏覽器。插件只讀 qwencloud.com 嘅 Cookie，存入本機憑證庫，然後關閉視窗。',
      qwenPasteToggle: '改為手動貼上 Cookie',
      qwenCookieLabel: 'Cookie',
      qwenCookiePlaceholder: '貼上 home.qwencloud.com 請求入面成條 Cookie 值',
      qwenSaveCookie: '保存 Cookie',
      qwenCookieInvalid: '呢段唔似瀏覽器 Cookie。請複製成條 Cookie，唔好貼 API Key。',
      qwenBrowserMissing: '搵唔到 Edge 或 Chrome，開唔到登入視窗。',
      qwenBrowserFailed: '登入視窗啟動失敗。請關閉殘留視窗後再試。',
      qwenLoginTimeout: '5 分鐘內未完成登入，視窗已關閉。',
      qwenCancelled: '已取消登入。',
      qwenSignInRequired: '未有可用嘅登入 Cookie。',
      qwenFiveHour: '5 小時用量',
      qwenWeekly: '每週用量',
      qwenMonthly: '每月用量',
      // zai
      zaiTitle: 'Z.ai GLM Coding Plan',
      zaiReady: '已連接',
      zaiNoKey: '未設定 API Key',
      zaiSession: 'Session（5 小時）',
      zaiWeekly: '每週',
      zaiSearches: 'Web 搜尋',
      zaiSearchesCount: '{used} / {total} 次（剩 {remaining}）',
      zaiPasteHint: '貼上 Z.ai API Key（會存入本機憑證庫）。如果你已經喺 DSH 設定咗 zai 供應商，呢度會自動讀到，唔使貼。',
      zaiKeyLabel: 'ZAI_API_KEY',
      zaiSaveKey: '保存 Key',
      zaiSignOut: '刪除已貼 Key',
      // minimax
      mmTitle: 'MiniMax Coding Plan',
      mmReady: '已連接',
      mmNoKey: '未設定 API Key',
      mmSession: 'Session（5 小時）',
      mmWeekly: '每週',
      mmPasteHint: '貼上 MiniMax API Key（會存入本機憑證庫）。如果你已經喺 DSH 設定咗 minimax 供應商，呢度會自動讀到，唔使貼。',
      mmKeyLabel: 'MINIMAX_API_KEY',
      mmSaveKey: '保存 Key',
      mmSignOut: '刪除已貼 Key',
    }

    const en = {
      zoneTitle: 'Coding Plan usage',
      checking: 'Checking…',
      refresh: 'Refresh',
      loading: 'Reading usage…',
      updated: 'Updated {time}',
      reset: 'Resets {time}',
      usedOf: '{used} / {total}',
      remainingDays: '{days} days left',
      hostUnreachable: 'The plugin host is unreachable. Refresh the page.',
      upstreamFailed: 'Usage is temporarily unavailable. Try again later.',
      noUsage: 'The provider returned no usage data.',
      qwenTitle: 'Qwen Token Plan',
      qwenSignedIn: 'Connected',
      qwenNotSignedIn: 'Not connected',
      qwenPending: 'Waiting for sign-in',
      qwenSignIn: 'Sign in to Qwen Cloud',
      qwenCancel: 'Cancel sign-in',
      qwenSignOut: 'Sign out and delete cookie',
      qwenWaiting: 'The sign-in window is open. Sign in to Qwen Cloud there; this card updates automatically.',
      qwenPrivacy: 'Sign-in uses a dedicated browser profile, not your everyday browser. The plugin reads only qwencloud.com cookies, stores them locally, then closes the window.',
      qwenPasteToggle: 'Paste a cookie instead',
      qwenCookieLabel: 'Cookie',
      qwenCookiePlaceholder: 'Paste the Cookie value from a home.qwencloud.com request',
      qwenSaveCookie: 'Save cookie',
      qwenCookieInvalid: 'That does not look like a browser cookie. Copy the whole Cookie header, not the API key.',
      qwenBrowserMissing: 'Edge or Chrome was not found, so the sign-in window cannot open.',
      qwenBrowserFailed: 'The sign-in window failed to start. Close any leftover window and try again.',
      qwenLoginTimeout: 'Sign-in was not completed within 5 minutes, so the window was closed.',
      qwenCancelled: 'Sign-in cancelled.',
      qwenSignInRequired: 'No usable login cookie.',
      qwenFiveHour: '5-hour usage',
      qwenWeekly: 'Weekly usage',
      qwenMonthly: 'Monthly usage',
      zaiTitle: 'Z.ai GLM Coding Plan',
      zaiReady: 'Connected',
      zaiNoKey: 'No API key set',
      zaiSession: 'Session (5h)',
      zaiWeekly: 'Weekly',
      zaiSearches: 'Web searches',
      zaiSearchesCount: '{used} / {total} ({remaining} left)',
      zaiPasteHint: 'Paste a Z.ai API key (stored in the local credential store). If you already configured the zai provider in DSH, it is read automatically — no paste needed.',
      zaiKeyLabel: 'ZAI_API_KEY',
      zaiSaveKey: 'Save key',
      zaiSignOut: 'Delete pasted key',
      mmTitle: 'MiniMax Coding Plan',
      mmReady: 'Connected',
      mmNoKey: 'No API key set',
      mmSession: 'Session (5h)',
      mmWeekly: 'Weekly',
      mmPasteHint: 'Paste a MiniMax API key (stored in the local credential store). If you already configured the minimax provider in DSH, it is read automatically — no paste needed.',
      mmKeyLabel: 'MINIMAX_API_KEY',
      mmSaveKey: 'Save key',
      mmSignOut: 'Delete pasted key',
    }

    const api = async (path, options) => {
      const response = await fetch(path, {
        method: options?.method ?? 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: options?.body ? { 'content-type': 'application/json' } : undefined,
        body: options?.body,
      })
      let body
      try {
        body = await response.json()
      } catch {
        body = undefined
      }
      if (!response.ok || body === undefined || body.ok === false) {
        throw new Error(body && typeof body.error === 'string' ? body.error : 'HTTP ' + response.status)
      }
      return body
    }

    const fill = (text, values) =>
      Object.entries(values).reduce((result, [key, value]) => result.split('{' + key + '}').join(String(value)), text)

    const formatTime = (iso) => {
      if (typeof iso !== 'string' || iso.length === 0) return ''
      const date = new Date(iso)
      if (Number.isNaN(date.getTime())) return ''
      try {
        return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
      } catch {
        return date.toLocaleString()
      }
    }

    const formatCount = (value) => {
      const numeric = Number(value)
      if (!Number.isFinite(numeric)) return ''
      if (numeric >= 1_000_000) return (numeric / 1_000_000).toFixed(numeric % 1_000_000 === 0 ? 0 : 1) + 'M'
      if (numeric >= 1_000) return Math.round(numeric / 1_000) + 'K'
      return String(Math.round(numeric))
    }

    function Meter(props) {
      const t = props.t
      const percent = Number.isFinite(Number(props.percent)) ? Math.max(0, Math.min(100, Number(props.percent))) : undefined
      const tone = percent === undefined ? 'idle' : percent >= 90 ? 'error' : percent >= 70 ? 'warn' : 'ok'
      const count = props.used !== undefined && props.total !== undefined && Number(props.total) > 0
        ? fill(t('usedOf'), { used: formatCount(props.used), total: formatCount(props.total) })
        : ''
      const reset = props.resetAt ? fill(t('reset'), { time: formatTime(props.resetAt) }) : ''
      const meta = [count, reset].filter((part) => part.length > 0).join(' · ')
      return h(
        'div',
        { className: 'cpu_meter' },
        h('div', { className: 'cpu_usageTop' },
          h('span', { className: 'cpu_usageLabel' }, props.label),
          h('span', { className: 'cpu_usageValue' }, percent === undefined ? '—' : percent + '%'),
        ),
        h('div', { className: 'cpu_bar', role: 'progressbar', 'aria-valuenow': percent ?? 0, 'aria-valuemin': 0, 'aria-valuemax': 100 },
          h('span', { className: 'cpu_barFill cpu_barFill_' + tone, style: { width: (percent ?? 0) + '%' } }),
        ),
        meta ? h('p', { className: 'cpu_meta' }, meta) : null,
      )
    }

    function CountRow(props) {
      const t = props.t
      const used = Number(props.used)
      const total = Number(props.total)
      const remaining = props.remaining !== undefined ? Number(props.remaining) : (Number.isFinite(total) && Number.isFinite(used) ? total - used : undefined)
      const text = Number.isFinite(used) && Number.isFinite(total)
        ? fill(t('zaiSearchesCount'), { used: formatCount(used), total: formatCount(total), remaining: formatCount(remaining) })
        : ''
      const reset = props.resetAt ? fill(t('reset'), { time: formatTime(props.resetAt) }) : ''
      const meta = [text, reset].filter((p) => p.length > 0).join(' · ')
      return h('div', { className: 'cpu_meter' },
        h('div', { className: 'cpu_usageTop' }, h('span', { className: 'cpu_usageLabel' }, props.label)),
        meta ? h('p', { className: 'cpu_meta' }, meta) : null,
      )
    }

    // ---- Qwen card (browser login) ----
    function QwenCard(props) {
      const t = props.t
      const [state, setState] = React.useState(null)
      const [cookie, setCookie] = React.useState('')
      const [showPaste, setShowPaste] = React.useState(false)
      const [busy, setBusy] = React.useState(false)
      const [localError, setLocalError] = React.useState(null)
      const mounted = React.useRef(true)

      const errText = (code) => {
        if (code === 'SIGN_IN_REQUIRED') return t('qwenSignInRequired')
        if (code === 'COOKIE_INVALID') return t('qwenCookieInvalid')
        if (code === 'BROWSER_MISSING') return t('qwenBrowserMissing')
        if (code === 'BROWSER_FAILED') return t('qwenBrowserFailed')
        if (code === 'LOGIN_TIMEOUT') return t('qwenLoginTimeout')
        if (code === 'CANCELLED') return t('qwenCancelled')
        if (code === 'NO_USAGE') return t('noUsage')
        if (/failed to fetch|networkerror|load failed/i.test(String(code))) return t('hostUnreachable')
        return t('upstreamFailed')
      }

      const load = React.useCallback(async (force) => {
        try {
          const next = await api('/coding-plan/usage?provider=qwen' + (force ? '&refresh=1' : ''))
          if (mounted.current) { setState(next); setLocalError(null) }
        } catch (error) {
          if (mounted.current) setLocalError(errText(error instanceof Error ? error.message : error))
        }
      }, [])

      React.useEffect(() => { mounted.current = true; load(false); return () => { mounted.current = false } }, [load])
      const pending = state?.status === 'pending' || state?.loginStatus === 'pending'
      React.useEffect(() => {
        if (!pending) return undefined
        const timer = setInterval(() => load(false), 1500)
        return () => clearInterval(timer)
      }, [pending, load])
      React.useEffect(() => {
        if (state?.configured !== true) return undefined
        const timer = setInterval(() => load(false), 60_000)
        return () => clearInterval(timer)
      }, [state?.configured, load])

      const post = async (path, body, after) => {
        if (busy) return
        setBusy(true); setLocalError(null)
        try {
          const next = await api(path, { method: 'POST', body: JSON.stringify(body ?? {}) })
          if (!mounted.current) return
          after?.(next)
        } catch (error) {
          if (mounted.current) setLocalError(errText(error instanceof Error ? error.message : error))
        } finally {
          if (mounted.current) setBusy(false)
        }
      }

      const configured = state?.configured === true
      const usage = state?.usage
      const badge = state === null ? t('checking') : pending ? t('qwenPending') : configured ? t('qwenSignedIn') : t('qwenNotSignedIn')
      const tone = pending ? 'warn' : configured ? 'ok' : 'idle'
      const usageError = usage === null && state?.error && state.error !== 'SIGN_IN_REQUIRED' ? errText(state.error) : null
      const planBits = [usage?.plan, usage?.status, usage?.remainingDays !== undefined ? fill(t('remainingDays'), { days: usage.remainingDays }) : ''].filter((p) => p && String(p).length > 0)

      return h('section', { className: 'cpu_card', 'data-plugin': 'coding-plan-usage:qwen' },
        h('div', { className: 'cpu_header' },
          h('span', { className: 'cpu_icon cpu_icon_qwen', 'aria-hidden': true }, 'Q'),
          h('div', { className: 'cpu_heading' },
            h('div', { className: 'cpu_titleRow' },
              h('h3', { className: 'cpu_title' }, t('qwenTitle')),
              h('span', { className: 'cpu_badge cpu_badge_' + tone }, badge),
            ),
          ),
        ),
        configured
          ? h('div', { className: 'cpu_panel' },
              h('p', { className: 'cpu_plan' }, planBits.length > 0 ? planBits.join(' · ') : t('loading')),
              [['qwenFiveHour', 'fiveHour'], ['qwenWeekly', 'week'], ['qwenMonthly', 'month']]
                .filter(([, key]) => usage?.[key + 'Percent'] !== undefined)
                .map(([label, key]) => h(Meter, { key, t, label: t(label), percent: usage[key + 'Percent'], resetAt: usage[key + 'ResetAt'], used: usage[key + 'Used'], total: usage[key + 'Total'] })),
              usageError ? h('p', { className: 'cpu_error' }, usageError) : null,
              state?.fetchedAt ? h('p', { className: 'cpu_meta' }, fill(t('updated'), { time: formatTime(new Date(state.fetchedAt).toISOString()) })) : null,
            )
          : h('div', { className: 'cpu_panel' },
              h('p', { className: 'cpu_meta' }, pending ? t('qwenWaiting') : t('qwenPrivacy')),
              state?.error && state.error !== 'SIGN_IN_REQUIRED' && !pending ? h('p', { className: 'cpu_error' }, errText(state.error)) : null,
              showPaste
                ? h(React.Fragment, null,
                    h('label', { className: 'cpu_label', htmlFor: 'cpu-qwen-cookie' }, t('qwenCookieLabel')),
                    h('textarea', { id: 'cpu-qwen-cookie', className: 'cpu_input', value: cookie, placeholder: t('qwenCookiePlaceholder'), autoComplete: 'off', spellCheck: false, rows: 3, onChange: (e) => setCookie(e.target.value) }),
                  )
                : h('button', { type: 'button', className: 'cpu_linkButton', onClick: () => setShowPaste(true) }, t('qwenPasteToggle')),
            ),
        localError ? h('p', { className: 'cpu_error' }, localError) : null,
        h('div', { className: 'cpu_actions' },
          pending
            ? h('button', { type: 'button', className: 'cpu_button cpu_secondary', onClick: () => post('/coding-plan/cancel', {}, (next) => setState((s) => ({ ...(s ?? {}), status: next.status, loginStatus: next.status, error: next.error }))) }, t('qwenCancel'))
            : configured
              ? h('button', { type: 'button', className: 'cpu_button cpu_secondary', disabled: busy, onClick: () => load(true) }, t('refresh'))
              : h('button', { type: 'button', className: 'cpu_button cpu_primary', disabled: busy || (showPaste && cookie.trim().length === 0), onClick: () => (showPaste ? post('/coding-plan/sign-in', { provider: 'qwen', cookie }, () => { setCookie(''); setShowPaste(false); load(true) }) : post('/coding-plan/login', {}, (next) => setState((s) => ({ ...(s ?? {}), status: next.status, loginStatus: next.status })))) }, showPaste ? t('qwenSaveCookie') : t('qwenSignIn')),
          configured
            ? h('button', { type: 'button', className: 'cpu_button cpu_secondary', disabled: busy, onClick: () => post('/coding-plan/sign-out', { provider: 'qwen' }, () => { setState({ configured: false, status: 'idle', usage: null }); }) }, t('qwenSignOut'))
            : null,
        ),
      )
    }

    // ---- Z.ai / MiniMax card (API key) ----
    function KeyCard(props) {
      const t = props.t
      const provider = props.provider
      const L = props.labels
      const [state, setState] = React.useState(null)
      const [key, setKey] = React.useState('')
      const [showPaste, setShowPaste] = React.useState(false)
      const [busy, setBusy] = React.useState(false)
      const [localError, setLocalError] = React.useState(null)
      const mounted = React.useRef(true)

      const errText = (code) => {
        if (code === 'NO_KEY') return ''
        if (code === 'SIGN_IN_REQUIRED') return L.keyInvalid
        if (code === 'NO_USAGE') return t('noUsage')
        if (/failed to fetch|networkerror|load failed/i.test(String(code))) return t('hostUnreachable')
        return t('upstreamFailed')
      }

      const load = React.useCallback(async (force) => {
        try {
          const next = await api(`/coding-plan/usage?provider=${provider}` + (force ? '&refresh=1' : ''))
          if (mounted.current) { setState(next); setLocalError(null) }
        } catch (error) {
          if (mounted.current) setLocalError(errText(error instanceof Error ? error.message : error))
        }
      }, [provider])

      React.useEffect(() => { mounted.current = true; load(false); return () => { mounted.current = false } }, [load])
      React.useEffect(() => {
        if (state?.configured !== true) return undefined
        const timer = setInterval(() => load(false), 60_000)
        return () => clearInterval(timer)
      }, [state?.configured, load])

      const saveKey = async () => {
        if (busy || key.trim().length === 0) return
        setBusy(true); setLocalError(null)
        try {
          await api('/coding-plan/sign-in', { method: 'POST', body: JSON.stringify({ provider, key: key.trim() }) })
          if (!mounted.current) return
          setKey(''); setShowPaste(false); await load(true)
        } catch (error) {
          if (mounted.current) setLocalError(errText(error instanceof Error ? error.message : error))
        } finally {
          if (mounted.current) setBusy(false)
        }
      }

      const signOut = async () => {
        if (busy) return
        setBusy(true); setLocalError(null)
        try {
          await api('/coding-plan/sign-out', { method: 'POST', body: JSON.stringify({ provider }) })
          if (!mounted.current) return
          setState({ provider, configured: false, status: 'missing-key', usage: null })
        } catch (error) {
          if (mounted.current) setLocalError(errText(error instanceof Error ? error.message : error))
        } finally {
          if (mounted.current) setBusy(false)
        }
      }

      const configured = state?.configured === true
      const usage = state?.usage
      const missingKey = state?.status === 'missing-key'
      const badge = state === null ? t('checking') : configured ? L.ready : L.noKey
      const tone = configured ? 'ok' : 'idle'
      const usageError = configured && state?.error ? errText(state.error) : null
      const keyNote = configured && state?.keySource === 'plugin' ? null : null

      return h('section', { className: 'cpu_card', 'data-plugin': 'coding-plan-usage:' + provider },
        h('div', { className: 'cpu_header' },
          h('span', { className: 'cpu_icon ' + L.iconClass, 'aria-hidden': true }, L.iconText),
          h('div', { className: 'cpu_heading' },
            h('div', { className: 'cpu_titleRow' },
              h('h3', { className: 'cpu_title' }, L.title),
              h('span', { className: 'cpu_badge cpu_badge_' + tone }, badge),
            ),
          ),
        ),
        configured
          ? h('div', { className: 'cpu_panel' },
              usage?.plan ? h('p', { className: 'cpu_plan' }, [usage.plan, usage.status, usage.level].filter(Boolean).join(' · ')) : null,
              L.meters(usage, t),
              usageError ? h('p', { className: 'cpu_error' }, usageError) : null,
              state?.fetchedAt ? h('p', { className: 'cpu_meta' }, fill(t('updated'), { time: formatTime(new Date(state.fetchedAt).toISOString()) })) : null,
            )
          : h('div', { className: 'cpu_panel' },
              h('p', { className: 'cpu_meta' }, L.pasteHint),
              showPaste
                ? h(React.Fragment, null,
                    h('label', { className: 'cpu_label', htmlFor: 'cpu-' + provider + '-key' }, L.keyLabel),
                    h('input', { id: 'cpu-' + provider + '-key', className: 'cpu_input', type: 'password', value: key, placeholder: L.keyLabel, autoComplete: 'off', spellCheck: false, onChange: (e) => setKey(e.target.value) }),
                  )
                : h('button', { type: 'button', className: 'cpu_linkButton', onClick: () => setShowPaste(true) }, L.pasteToggle),
            ),
        localError ? h('p', { className: 'cpu_error' }, localError) : null,
        keyNote,
        h('div', { className: 'cpu_actions' },
          configured
            ? h('button', { type: 'button', className: 'cpu_button cpu_secondary', disabled: busy, onClick: () => load(true) }, t('refresh'))
            : showPaste
              ? h('button', { type: 'button', className: 'cpu_button cpu_primary', disabled: busy || key.trim().length === 0, onClick: saveKey }, L.saveKey)
              : null,
          configured && state?.keySource === 'plugin'
            ? h('button', { type: 'button', className: 'cpu_button cpu_secondary', disabled: busy, onClick: signOut }, L.signOut)
            : null,
        ),
      )
    }

    const zaiLabels = {
      title: null, ready: null, noKey: null, iconClass: 'cpu_icon_zai', iconText: 'Z',
      pasteHint: null, pasteToggle: null, keyLabel: null, saveKey: null, signOut: null, keyInvalid: null,
      meters: (usage, t) => [
        usage?.sessionPercent !== undefined ? h(Meter, { key: 's', t, label: t('zaiSession'), percent: usage.sessionPercent, resetAt: usage.sessionResetAt }) : null,
        usage?.weekPercent !== undefined ? h(Meter, { key: 'w', t, label: t('zaiWeekly'), percent: usage.weekPercent, resetAt: usage.weekResetAt }) : null,
        usage?.searchesTotal !== undefined ? h(CountRow, { key: 'x', t, label: t('zaiSearches'), used: usage.searchesUsed, total: usage.searchesTotal, remaining: usage.searchesRemaining, resetAt: usage.searchesResetAt }) : null,
      ],
    }
    const mmLabels = {
      title: null, ready: null, noKey: null, iconClass: 'cpu_icon_mm', iconText: 'M',
      pasteHint: null, pasteToggle: null, keyLabel: null, saveKey: null, signOut: null, keyInvalid: null,
      meters: (usage, t) => [
        usage?.sessionPercent !== undefined ? h(Meter, { key: 's', t, label: t('mmSession'), percent: usage.sessionPercent, resetAt: usage.sessionResetAt, used: usage.sessionUsed, total: usage.sessionTotal }) : null,
        usage?.weekPercent !== undefined ? h(Meter, { key: 'w', t, label: t('mmWeekly'), percent: usage.weekPercent, resetAt: usage.weekResetAt, used: usage.weekUsed, total: usage.weekTotal }) : null,
      ],
    }

    function Zone(props) {
      const t = props.t
      const zai = { ...zaiLabels, title: t('zaiTitle'), ready: t('zaiReady'), noKey: t('zaiNoKey'), pasteHint: t('zaiPasteHint'), pasteToggle: t('zaiPasteToggle'), keyLabel: t('zaiKeyLabel'), saveKey: t('zaiSaveKey'), signOut: t('zaiSignOut'), keyInvalid: t('upstreamFailed') }
      const mm = { ...mmLabels, title: t('mmTitle'), ready: t('mmReady'), noKey: t('mmNoKey'), pasteHint: t('mmPasteHint'), pasteToggle: t('mmPasteToggle'), keyLabel: t('mmKeyLabel'), saveKey: t('mmSaveKey'), signOut: t('mmSignOut'), keyInvalid: t('upstreamFailed') }
      return h('div', { className: 'cpu_zone' },
        h('h2', { className: 'cpu_zoneTitle' }, t('zoneTitle')),
        h(QwenCard, { t }),
        h(KeyCard, { t, provider: 'zai', labels: zai }),
        h(KeyCard, { t, provider: 'minimax', labels: mm }),
      )
    }

    const css = `
      .cpu_zone{display:flex;flex-direction:column;gap:12px;margin-top:16px}
      .cpu_zoneTitle{margin:0;font-size:13px;line-height:20px;font-weight:600;color:var(--dsw-alias-label-secondary,#666);text-transform:uppercase;letter-spacing:.04em}
      .cpu_card{display:flex;flex-direction:column;gap:12px;padding:16px;border:1px solid var(--dsw-alias-border-l1,#e3e3e8);border-radius:12px;background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#18181b);font-size:13px;line-height:20px}
      .cpu_header{display:flex;align-items:flex-start;gap:12px}
      .cpu_icon{display:flex;flex:none;width:32px;height:32px;border-radius:9px;color:#fff;align-items:center;justify-content:center;font-weight:700}
      .cpu_icon_qwen{background:#4b2e83}
      .cpu_icon_zai{background:#1f6f5c}
      .cpu_icon_mm{background:#b3541e}
      .cpu_heading{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
      .cpu_titleRow{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      .cpu_title{margin:0;font-size:14px;line-height:20px;font-weight:600}
      .cpu_badge{font-size:11px;line-height:18px;padding:0 8px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1,#e3e3e8);color:var(--dsw-alias-label-secondary,#666)}
      .cpu_badge_ok{color:var(--dsw-alias-state-success-primary,#2e7d32);border-color:currentColor}
      .cpu_badge_warn{color:var(--dsw-alias-state-warn-primary,#9a6700);border-color:currentColor}
      .cpu_panel{display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid var(--dsw-alias-border-l1,#e3e3e8);border-radius:10px;background:var(--dsw-alias-bg-layer-2,#f5f5f7)}
      .cpu_plan{margin:0;font-size:12px;font-weight:600}
      .cpu_meter{display:flex;flex-direction:column;gap:4px}
      .cpu_usageTop{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
      .cpu_usageLabel{font-size:12px;color:var(--dsw-alias-label-secondary,#666)}
      .cpu_usageValue{font-size:18px;line-height:22px;font-weight:600;font-variant-numeric:tabular-nums}
      .cpu_bar{height:6px;border-radius:999px;background:var(--dsw-alias-border-l1,#e3e3e8);overflow:hidden}
      .cpu_barFill{display:block;height:100%;border-radius:inherit;background:#4b2e83}
      .cpu_barFill_ok{background:var(--dsw-alias-state-success-primary,#2e7d32)}
      .cpu_barFill_warn{background:var(--dsw-alias-state-warn-primary,#9a6700)}
      .cpu_barFill_error{background:var(--dsw-alias-state-error-primary,#c62828)}
      .cpu_meta{margin:0;color:var(--dsw-alias-label-secondary,#666);font-size:11px;line-height:16px;overflow-wrap:anywhere}
      .cpu_label{font-size:12px;font-weight:600}
      .cpu_input{width:100%;box-sizing:border-box;resize:vertical;border:1px solid var(--dsw-alias-border-l2,#cfcfd6);border-radius:8px;padding:8px;font:inherit;font-size:12px;background:var(--dsw-alias-bg-base,#fff);color:inherit}
      .cpu_actions{display:flex;gap:8px;flex-wrap:wrap}
      .cpu_button{appearance:none;border:1px solid transparent;border-radius:8px;padding:6px 12px;font:inherit;font-size:12px;line-height:18px;cursor:pointer}
      .cpu_button:disabled{opacity:.55;cursor:default}
      .cpu_primary{background:#1f6f5c;color:#fff}
      .cpu_secondary{border-color:var(--dsw-alias-border-l2,#cfcfd6);background:transparent;color:inherit}
      .cpu_linkButton{color:#1f6f5c;font-size:12px;width:fit-content;background:transparent;border:0;padding:0;cursor:pointer;text-align:left}
      .cpu_error{margin:0;color:var(--dsw-alias-state-error-primary,#c62828);font-size:12px;line-height:18px;overflow-wrap:anywhere}
    `

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'coding-plan-usage: dictionaries')
        ctx.effect(() => {
          const tag = document.createElement('style')
          tag.dataset.plugin = 'coding-plan-usage'
          tag.textContent = css
          document.head.appendChild(tag)
          return () => tag.remove()
        }, 'coding-plan-usage: styles')
        ctx.slots.inject('settings.models.footer', () =>
          ctx.slots.register(
            { name: 'settings.models.footer', id: 'coding-plan-usage', order: 25, locale: NS },
            (props) => h(Zone, { t: props.t }),
          ),
        )
      },
    }
  },
})

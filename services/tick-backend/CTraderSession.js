const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');
const { CTraderTransportAdapter } = require('./supervision/CTraderTransportAdapter');
const { HealthMonitor } = require('./HealthMonitor');
const { ReconnectionManager } = require('./utils/ReconnectionManager');
const { CTraderSymbolLoader } = require('./CTraderSymbolLoader');
const { CTraderDataProcessor } = require('./CTraderDataProcessor');
const { CTraderEventHandler } = require('./CTraderEventHandler');
const { VALID_PERIODS } = require('./utils/constants');
const config = require('./config');
const { createLogger, describeError } = require('./utils/Logger');
const { ctraderErrorCategory, classifyError } = require('./utils/ctraderErrorCode');
const log = createLogger('CTraderSession');

// ── Restore runner tuning (Phase 4.1 / Loop-E) ──────────────────────────────
// Full restore for 28 symbols × 2 (spots + M1) = ~56 commands. With a
// bounded-concurrency runner these complete well under dataStaleMs (60s) while
// keeping cTrader from throttling us (345 command timeouts in the incident).
// Centralized in config.js so this module reads from config (not process.env).
const RESTORE_CONCURRENCY = config.restoreConcurrency;
const RESTORE_SPACING_MS = config.restoreSpacingMs;
const RESTORE_COMMAND_TIMEOUT_MS = config.restoreCommandTimeoutMs;
const RESTORE_MAX_RETRIES = config.restoreMaxRetries;

/**
 * CTrader Session - Main orchestration for cTrader connection.
 * Delegates symbol loading, data processing, and event handling to focused modules.
 */
class CTraderSession extends EventEmitter {
    constructor() {
        super();
        this.connection = null;
        this.heartbeatInterval = null;
        this.ctidTraderAccountId = Number(config.ctraderAccountId);
        this.accessToken = config.ctraderAccessToken;
        this.refreshToken = config.ctraderRefreshToken;
        this.clientId = config.ctraderClientId;
        this.clientSecret = config.ctraderClientSecret;

        this.symbolLoader = null;
        this.dataProcessor = null;
        this.eventHandler = null;

        // 60s staleness threshold - FX pairs can go tens of seconds without ticks
        // during low-activity periods; only ticks reset the timer, so this must be generous
        this.healthMonitor = new HealthMonitor('ctrader', 60000, 10000);
        this.reconnection = new ReconnectionManager(15000, 500, config.maxReconnectAttempts);

        // Store listener references to prevent duplicates
        this.spotEventHandler = null;
        this.closeEventHandler = null;
        this.errorEventHandler = null;
        this.staleEventHandler = null;

        // Connection state guards
        this.isConnecting = false;
        this.isDisconnecting = false;
        this.eventListenersAttached = false;
        this.connectedAt = null;

        // Supervised mode: when a FeedSupervisor owns this session's lifecycle,
        // the session does NOT self-reconnect or self-track staleness — it becomes
        // a dumb I/O worker that emits connected/disconnected/tick, and the
        // supervisor (monitoring the transport + its own HealthSensor) recovers.
        this.supervised = false;

        // Track active subscriptions for restoration after reconnection
        this.activeSubscriptions = new Set();

        // Track active bar subscriptions (multi-timeframe): 'symbolName:period' -> true
        this.activeBarSubscriptions = new Map();

        // Track last bar timestamp per symbol:period for bar-close detection
        this.lastBarTimestamps = new Map();

        // In-flight post-connect restore promise (Phase 2.2). Null when no
        // restore is running; set before the runner starts and cleared when it
        // settles. Tests/supervisor can await/observe this so restore — now
        // OUTSIDE the connect handshake — is still observable.
        this.restorePromise = null;
        // Generation token (FIX B1): bumped on every connect so a stale detached
        // restore coroutine (from a superseded connect) can detect it has been
        // overtaken and stop sending subscribes against the NEW transport. The
        // runner/tasks/thread `gen` through and short-circuit when it no longer
        // matches this counter.
        this._restoreGen = 0;
    }

    async connect(transport) {
        if (this.isConnecting) {
            return;
        }

        this.isConnecting = true;

        if (this.connection) this.connection.close();

        // Accept an injected transport (CTraderTransportAdapter in production, a
        // FakeTransport in tests) so connection lifecycle is supervisor-driven
        // and recovery is unit-testable offline. Default to the adapter, which
        // resolves DNS→IP itself (bypassing the library's WSL2 TLS-hang fallback)
        // and bounds every sendCommand with a per-RPC TTL (defect #4).
        this.connection = transport || new CTraderTransportAdapter({
            host: config.ctraderHost,
            port: Number(config.ctraderPort),
        });

        // Phase 2.1 / Loop-G: persist symbolLoader across reconnects. Create it
        // lazily ONCE (first connect) and REUSE it thereafter, only re-binding its
        // connection. This preserves symbolInfoCache (avoids ~60 re-fetched
        // SymbolByIdReq) and keeps the old symbolMap valid so restore can resolve
        // symbolIds immediately on a reconnect — the map is never cold.
        if (!this.symbolLoader) {
            this.symbolLoader = new CTraderSymbolLoader(this.connection, this.ctidTraderAccountId);
        } else {
            this.symbolLoader.setConnection(this.connection);
        }
        this.dataProcessor = new CTraderDataProcessor(this.connection, this.ctidTraderAccountId, this.symbolLoader);
        this.eventHandler = new CTraderEventHandler(this.dataProcessor, this.healthMonitor);

        this.removeEventListeners();
        this.setupEventListeners();

        // Connect-cycle timing markers (Phase 1.3). Combined with timestamped log
        // lines (Phase 1.1) these reconstruct the full handshake timeline from
        // backend.log alone — proving whether the connect-phase deadline (Loop-B)
        // fires and how long each phase + restore actually takes.
        const connectStart = Date.now();
        log.info(`connect-start: restoring ${this.activeSubscriptions.size} tick + ${this.activeBarSubscriptions.size} bar subscriptions`);

        // B4: the layer's open() now self-rejects on socket timeout/error
        // (Plan Phase 1 / L1, live-validated), so the former 10s Promise.race
        // wrapper around open() is redundant. The supervisor's connect-phase
        // deadline still bounds the whole handshake as a backstop.
        let stepStart = Date.now();
        try {
            await this.connection.open();
            this.isConnecting = false;
            log.info(`connect-step open: ${Date.now() - stepStart}ms`);
        } catch (error) {
            this.isConnecting = false;
            log.error('Connection failed:', error.message);
            this.handleDisconnect(error, true);
            throw error;
        }

        stepStart = Date.now();
        await this.authenticate();
        log.info(`connect-step authenticate: ${Date.now() - stepStart}ms`);

        // Populate/refresh the symbol map as part of the FAST handshake (must
        // stay bounded by the connect-phase deadline). On a reconnect the
        // persisted map is already serving; loadAllSymbols() repopulates it
        // (merges, never clears) so restore can resolve every symbol.
        stepStart = Date.now();
        await this.symbolLoader.loadAllSymbols();
        log.info(`connect-step loadAllSymbols: ${Date.now() - stepStart}ms`);

        // Start heartbeat BEFORE emitting 'connected'. Heartbeats are fire-and-
        // forget raw frames (defect-#4 rework); starting them here keeps the
        // transport's liveness clock warm during the post-connect restore window
        // so HealthSensor sees fresh heartbeats (DEGRADED, not STALE) until data
        // ticks resume.
        this.startHeartbeat();

        // Initialize health monitor with grace period - start first (resets lastTick),
        // then record tick immediately to prevent immediate staleness.
        // B5: in supervised mode the supervisor's HealthSensor owns liveness, so
        // the session's own HealthMonitor is inert (mirrors the 'stale' gating at
        // the listener wiring) — don't start it or feed it recordTick().
        this.connectedAt = Date.now();
        if (!this.supervised) {
            this.healthMonitor.start();
            this.healthMonitor.recordTick();
        }

        // B6: in supervised mode the supervisor owns recovery (its own RetryPolicy
        // + backoff), so the session's ReconnectionManager is inert — mirror the
        // HealthMonitor gating. scheduleReconnect() is already gated out above.
        if (!this.supervised) this.reconnection.reset();

        // Phase 2.2 / Loop-B: emit 'connected' as soon as the FAST handshake
        // (open + auth + symbol-map + heartbeat) is done. The supervisor's
        // connect-phase deadline now only covers this sub-second handshake.
        // Restore runs AFTER 'connected', asynchronously, and is NOT awaited by
        // connect() — so a slow/failed restore can never trip the deadline or
        // abort the connect (the structural root of the runtime reconnect loop).
        log.info(`connect-end: ${Date.now() - connectStart}ms total (restore deferred)`);
        this.emit('connected', this.symbolLoader.getAllSymbolNames());

        // Kick off restore as a detached background task. restorePromise +
        // 'restoreStart'/'restoreComplete' events let the supervisor and tests
        // observe/await restore without blocking the handshake.
        this._beginRestore();
    }

    /**
     * Begin a post-connect restore as a detached, observable background task
     * (Phase 2.2). Emits 'restoreStart' when restore begins and 'restoreComplete'
     * (with the result) when it settles; stores the in-flight promise on
     * this.restorePromise so callers/tests can await it.
     * @private
     */
    _beginRestore() {
        // FIX B1: bump the generation token so a stale restore from a prior
        // connect can detect it has been superseded. Assign restorePromise
        // BEFORE emitting 'restoreStart' so a listener that inspects it (e.g.
        // the supervisor) always sees the in-flight promise.
        const gen = ++this._restoreGen;
        this.restorePromise = this._runRestore(gen).finally(() => {
            this.restorePromise = null;
        });
        this.emit('restoreStart');
        return this.restorePromise;
    }

    /**
     * Underlying restore coroutine. Wraps restoreSubscriptions() and emits
     * 'restoreComplete' on settle (resolve/reject). Rejection is swallowed here
     * (the promise is detached) but surfaced via the event + logs.
     * @private
     */
    async _runRestore(gen) {
        const stepStart = Date.now();
        log.info('restore-start');
        try {
            const result = await this.restoreSubscriptions(gen);
            log.info(`restore-end: ${Date.now() - stepStart}ms`);
            this.emit('restoreComplete', { ok: true, result });
            return result;
        } catch (err) {
            log.error('restore failed:', describeError(err));
            this.emit('restoreComplete', { ok: false, error: err });
            throw err;
        }
    }

    /**
     * Lazily refresh the symbol map in the background (Phase 2.1 / Phase 3).
     * Fire-and-forget: never blocks connect/restore, never rejects (the loader's
     * refreshAllSymbols is best-effort and leaves the old map intact on error).
     * On success it resolves any Phase-3 deferred symbols via the restore promise.
     * @private
     */
    _refreshSymbolMapLazily() {
        if (!this.symbolLoader) return;
        // FIX m2: share a single in-flight refresh across concurrent callers.
        // restoreSubscriptions may trigger this from multiple paths; without
        // dedup, overlapping refreshes would race on the atomic map swap.
        if (this._symbolMapRefresh) return this._symbolMapRefresh;
        const refreshStart = Date.now();
        this._symbolMapRefresh = this.symbolLoader.refreshAllSymbols().then((freshMap) => {
            const elapsed = Date.now() - refreshStart;
            if (freshMap) {
                log.info(`symbol-map refresh: ${freshMap.size} symbols in ${elapsed}ms`);
            } else {
                log.warn(`symbol-map refresh failed in ${elapsed}ms — keeping existing map`);
            }
            this._onSymbolMapRefreshed();
            return freshMap;
        }).catch(() => null); // best-effort; never surface to caller
        return this._symbolMapRefresh;
    }

    /**
     * Hook invoked after the lazy symbol-map refresh settles (Phase 3). Retries
     * any subscriptions that were deferred during restore because their symbol
     * was unresolved against the old map. Symbols still unresolved after refresh
     * are logged once (with errorCode/reason) and skipped — never retried forever.
     * @private
     */
    _onSymbolMapRefreshed() {
        if (!this._deferredSubscriptions || this._deferredSubscriptions.length === 0) return;
        const deferred = this._deferredSubscriptions;
        this._deferredSubscriptions = [];
        for (const sub of deferred) {
            const symbolId = this.symbolLoader && this.symbolLoader.getSymbolId(sub.symbolName);
            if (symbolId) {
                // Resolved now — re-run via the normal subscribe path (best-effort).
                this._runRestoreTask(sub).catch((err) => {
                    log.error(`deferred subscribe for ${sub.symbolName} failed after refresh:`, describeError(err));
                });
            } else {
                // Genuinely absent — log ONCE and skip permanently.
                log.warn(`symbol unresolved after refresh — skipping ${sub.kind} subscription for ${sub.symbolName}`);
            }
        }
    }

    setupEventListeners() {
        if (this.eventListenersAttached) {
            return;
        }

        this.spotEventHandler = async (event) => {
            try {
                const symbolId = Number(event.symbolId);
                if (!symbolId) return;

                const symbolName = this.symbolLoader.getSymbolName(symbolId);
                if (!symbolName) return;

                const symbolInfo = await this.symbolLoader.getFullSymbolInfo(symbolId);
                if (!symbolInfo) return;

                let tickData = null;
                let m1Bar = null;

                if (event.trendbar && event.trendbar.length > 0) {
                    const subscribedPeriods = this.getSubscribedBarPeriods(symbolName);
                    const hasM1 = subscribedPeriods.has('M1');

                    // Try period-field routing first.
                    // Each trendbar entry MAY carry a period field (ProtoOATrendbarPeriod numeric enum).
                    // When populated, we can route each entry to the correct handler.
                    for (const tb of event.trendbar) {
                        const periodStr = tb.period != null ? (PERIOD_ENUM_TO_STRING[tb.period] || null) : null;

                        if (periodStr === 'M1') {
                            if (hasM1 || subscribedPeriods.size === 0) {
                                const result = this.eventHandler.processTrendbarEntry(tb, symbolName, symbolInfo);
                                m1Bar = result.m1Bar;
                                tickData = result.tick;
                            }
                        } else if (periodStr && periodStr !== 'M1' && subscribedPeriods.has(periodStr)) {
                            const barData = this.eventHandler.processMultiTimeframeTrendbarEntry(tb, symbolName, symbolInfo, periodStr);
                            if (barData) {
                                const tsKey = `${symbolName}:${periodStr}`;
                                const prevTimestamp = this.lastBarTimestamps.get(tsKey);
                                barData.isBarClose = prevTimestamp !== undefined && prevTimestamp !== barData.bar.timestamp;
                                this.lastBarTimestamps.set(tsKey, barData.bar.timestamp);
                                this.emit('barUpdate', barData);
                            }
                        }
                        // periodStr === null → period field absent; per-tick path handles live close for non-M1 TFs
                    }

                    // Non-M1 routing: cTrader spot events only carry M1 trendbar entries
                    // (RC6 in plans/chart-data-fix.md). The period-field loop above handles
                    // genuine non-M1 entries if they ever arrive. No fallback needed — the
                    // per-tick spot price path in ChartDisplay handles live close updates
                    // for non-M1 timeframes.

                    // Ensure M1 processing happened even if period field was absent
                    if (!m1Bar && !tickData && (hasM1 || subscribedPeriods.size === 0)) {
                        const lastTb = event.trendbar[event.trendbar.length - 1];
                        const result = this.eventHandler.processTrendbarEntry(lastTb, symbolName, symbolInfo);
                        m1Bar = result.m1Bar;
                        tickData = result.tick;
                    }
                }

                // Always derive live tick price from bid/ask when available.
                // Trendbar close prices are from the last *closed* bar (stale),
                // whereas bid/ask are live market quotes. Both can arrive in the
                // same spot event, so process them independently.
                if (event.bid != null && event.ask != null) {
                    // Defect #3 fix: processSpotEvent can return null during quiet /
                    // rollover windows (non-finite or inverted bid/ask). Only adopt the
                    // spot-derived tick when it is valid, so a null does NOT clobber a
                    // valid trendbar-derived tick, drop the emit, or skip recordTick().
                    const spotTick = this.eventHandler.processSpotEvent(event, symbolName, symbolInfo);
                    if (spotTick) tickData = spotTick;
                }

                if (tickData) {
                    // B5: HealthMonitor is inert in supervised mode (HealthSensor
                    // owns liveness); only feed it on the unsupervised path.
                    if (!this.supervised) this.healthMonitor.recordTick();
                    this.emit('tick', tickData);
                }

                if (m1Bar) {
                    this.emit('m1Bar', m1Bar);
                }
            } catch (error) {
                log.error('[ERROR] Unhandled error in PROTO_OA_SPOT_EVENT handler:', describeError(error));
            }
        };

        this.closeEventHandler = () => {
            this.handleDisconnect(null, true);
        };

        this.errorEventHandler = (err) => {
            log.error('[ERROR] CTraderConnection error:', describeError(err));
            this.handleDisconnect(err, true);
        };

        // Handle staleness detection from HealthMonitor
        this.staleEventHandler = () => {
            this.handleDisconnect(new Error('Connection stale - no data received'), true);
        };

        this.connection.on('PROTO_OA_SPOT_EVENT', this.spotEventHandler);
        this.connection.on('close', this.closeEventHandler);
        this.connection.on('error', this.errorEventHandler);

        // In supervised mode the supervisor's HealthSensor owns staleness; skip
        // the session's own stale→disconnect trigger to avoid dual detection.
        if (!this.supervised) {
            this.healthMonitor.on('stale', this.staleEventHandler);
        }

        this.eventListenersAttached = true;
    }

    removeEventListeners() {
        if (!this.connection) return;

        if (this.spotEventHandler) {
            // Must use numeric payload type '2131' because removeListener is not overridden
            this.connection.removeAllListeners('2131');
            this.spotEventHandler = null;
        }

        if (this.closeEventHandler) {
            this.connection.removeListener('close', this.closeEventHandler);
            this.closeEventHandler = null;
        }

        if (this.errorEventHandler) {
            this.connection.removeListener('error', this.errorEventHandler);
            this.errorEventHandler = null;
        }

        // Remove health monitor listener
        if (this.staleEventHandler) {
            this.healthMonitor.removeListener('stale', this.staleEventHandler);
            this.staleEventHandler = null;
        }

        this.eventListenersAttached = false;
    }

    async authenticate() {
        await this.connection.sendCommand('ProtoOAApplicationAuthReq', {
            clientId: this.clientId,
            clientSecret: this.clientSecret
        });

        try {
            await this.connection.sendCommand('ProtoOAAccountAuthReq', {
                ctidTraderAccountId: this.ctidTraderAccountId,
                accessToken: this.accessToken
            });
        } catch (authError) {
            if (authError.errorCode === 'CH_ACCESS_TOKEN_INVALID' && this.refreshToken) {
                const refreshRes = await this.connection.sendCommand('ProtoOARefreshTokenReq', {
                    refreshToken: this.refreshToken
                });
                this.accessToken = refreshRes.accessToken;
                this.refreshToken = refreshRes.refreshToken;
                this.persistTokens(this.accessToken, this.refreshToken);

                await this.connection.sendCommand('ProtoOAAccountAuthReq', {
                    ctidTraderAccountId: this.ctidTraderAccountId,
                    accessToken: this.accessToken
                });
            } else {
                throw authError;
            }
        }
    }

    persistTokens(accessToken, refreshToken) {
        const envPath = path.resolve(__dirname, '../../.env');
        const tmpPath = envPath + '.tmp';
        try {
            let envContent = fs.readFileSync(envPath, 'utf8');
            envContent = envContent.replace(
                /^CTRADER_ACCESS_TOKEN=.*$/m,
                `CTRADER_ACCESS_TOKEN=${accessToken}`
            );
            envContent = envContent.replace(
                /^CTRADER_REFRESH_TOKEN=.*$/m,
                `CTRADER_REFRESH_TOKEN=${refreshToken}`
            );
            // Atomic write: write to temp file, then rename (atomic on POSIX)
            fs.writeFileSync(tmpPath, envContent);
            fs.renameSync(tmpPath, envPath);
        } catch (err) {
            log.warn('Failed to persist tokens to .env:', err.message);
            // Clean up temp file if it exists
            try { fs.unlinkSync(tmpPath); } catch (e) { /* ignore */ }
        }
    }

    handleDisconnect(error = null, shouldScheduleReconnect = true) {
        // Prevent concurrent disconnect handling
        if (this.isDisconnecting) {
            return;
        }

        this.isDisconnecting = true;
        if (error) log.error('connection failed:', describeError(error));
        // B6: ReconnectionManager is inert in supervised mode (supervisor owns
        // recovery). cancelReconnect() only matters on the self-reconnect path.
        if (!this.supervised) this.reconnection.cancelReconnect();
        this.isConnecting = false;
        // B5: HealthMonitor is inert in supervised mode (never started).
        if (!this.supervised) this.healthMonitor.stop();
        this.stopHeartbeat();
        this.emit('disconnected');

        if (this.connection) {
            this.connection.close();
        }

        // Reset flag after cleanup
        this.isDisconnecting = false;

        // In supervised mode the supervisor owns recovery (it observes the
        // transport close / its HealthSensor and re-arms). Do not self-reconnect.
        if (shouldScheduleReconnect && !this.supervised) {
            this.scheduleReconnect();
        }
    }

    scheduleReconnect() {
        this.reconnection.scheduleReconnect(() => this.connect());
    }

    startHeartbeat() {
        this.stopHeartbeat();

        // The server echoes ProtoHeartbeatEvent back as a push event (payloadType 51),
        // NOT as a command response with clientMsgId. sendCommand().then() never fires.
        // CTraderConnection.on() normalizes 'ProtoHeartbeatEvent' to numeric '51',
        // but removeListener is NOT overridden - so we must use '51' for cleanup.
        //
        // B3: the handler translates the library's echo (payloadType 51) into the
        // session 'heartbeat' event. The library does NOT emit a domain
        // 'heartbeat' event, so this translation must stay — its single consumer is
        // FeedSupervisor's HealthSensor.recordHeartbeat (FeedSupervisor.js). The
        // former recordTick() double-feed is now dead in supervised mode (B5: the
        // supervisor's HealthSensor owns liveness, and the session's HealthMonitor
        // is inert), so the handler is a clean emit('heartbeat') pass-through there.
        this.heartbeatEventHandler = () => {
            if (!this.supervised) this.healthMonitor.recordTick();
            this.emit('heartbeat');
        };
        this.connection.on('ProtoHeartbeatEvent', this.heartbeatEventHandler);

        this.heartbeatInterval = setInterval(() => {
            try {
                // sendHeartbeat writes a leak-free raw ProtoHeartbeatEvent frame
                // (no clientMsgId, no command-map entry) — owned by the layer
                // after Plan Phase 1 / L2 (live-validated).
                if (this.connection) this.connection.sendHeartbeat();
            } catch (e) { /* connection closing */ }
        }, 10000);
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        if (this.connection && this.heartbeatEventHandler) {
            // Must use numeric payload type '51' because removeListener is not overridden
            this.connection.removeAllListeners('51');
            this.heartbeatEventHandler = null;
        }
    }

    /**
     * Restore all active subscriptions after reconnection.
     *
     * Phase 2.2: runs AFTER 'connected' (not inside connect()), so it can never
     * trip the connect-phase deadline (Loop-B). Phase 4.1: bounded-concurrency +
     * inter-request spacing + per-command budget (Loop-E). Phase 3: symbols
     * unresolved against the current map are DEFERRED (queued for retry once the
     * lazy refresh lands) rather than dropped (Loop-C). Phase 4.2: cTrader
     * errorCodes are classified (Loop-D) — already-subscribed counts as success,
     * rate-limit triggers backoff+retry, permanent is logged-once-and-skipped.
     *
     * Restores symbol-for-symbol equal to the pre-disconnect set (the B0
     * characterization guarantee): ticks first (cTrader requires ticks before
     * bars), then M1 bars, then any other bar subscriptions.
     *
     * Restored set equality note: subscriptions whose symbol is genuinely absent
     * after the lazy refresh are logged and skipped (never retried forever), so a
     * degenerate pre-disconnect set with an unknown symbol will restore
     * symbol-for-symbol minus those logged-skips — which is the desired behavior
     * (a permanently-unknown symbol cannot be subscribed to).
     *
     * @param {number} [gen] - Generation token (FIX B1); a stale restore whose
     *   gen no longer matches `this._restoreGen` stops launching/sending.
     */
    async restoreSubscriptions(gen) {
        if (!this.connection) {
            return;
        }
        if (this.activeSubscriptions.size === 0 && this.activeBarSubscriptions.size === 0) {
            return;
        }

        // Snapshot what to restore, then CLEAR the in-memory tracking. This may
        // be a brand-new connection, so every subscription must be re-sent — but
        // subscribeToTicks/M1Bars/Bars carry idempotency guards that short-
        // circuit when the set already holds the key. Because the sets persist
        // across reconnects (to remember what to restore), NOT clearing would
        // leave the restored feed silent (the B0 baseline defect). Clearing first
        // makes the guards pass and the sets repopulate exactly as on a fresh
        // connect, so the restored set is symbol-for-symbol equal to the
        // pre-disconnect set.
        const tickNames = [...this.activeSubscriptions];
        const barKeys = [...this.activeBarSubscriptions.keys()];
        this.activeSubscriptions.clear();
        this.activeBarSubscriptions.clear();

        // Reset the per-restore defer-queue (Phase 3) and live-throttle state.
        this._deferredSubscriptions = [];
        this._rateLimited = false;

        // Build the ordered task list (ticks → M1 bars → other bars). Order is
        // preserved within the bounded runner by enqueueing in this sequence.
        const tasks = [];
        for (const symbolName of tickNames) {
            tasks.push(this._makeRestoreTask('tick', symbolName));
        }
        for (const symbolName of tickNames) {
            tasks.push(this._makeRestoreTask('m1', symbolName));
        }
        for (const key of barKeys) {
            const [symbolName, period] = key.split(':');
            tasks.push(this._makeRestoreTask('bar', symbolName, period));
        }

        await this._runBounded(tasks, RESTORE_CONCURRENCY, RESTORE_SPACING_MS, gen);

        if (this._deferredSubscriptions.length > 0) {
            log.info(`restore: deferred ${this._deferredSubscriptions.length} unresolved subscription(s) pending symbol-map refresh`);
            // Kick the lazy refresh ONLY when there are deferred symbols (Phase 3
            // / Loop-C). The handshake already loaded the map, so a redundant
            // refresh is skipped in the common (all-resolved) case; the refresh
            // exists to give deferred symbols a second chance at resolution.
            this._refreshSymbolMapLazily();
        }
    }

    /**
     * Construct a restore task descriptor for one subscription.
     * The task carries the resolved symbolId if available (checked up-front) so
     * the runner can defer unresolved symbols without ever sending a command.
     * @private
     */
    _makeRestoreTask(kind, symbolName, period) {
        return { kind, symbolName, period, _sent: false };
    }

    /**
     * Execute one restore task: send the subscribe command with a per-command
     * budget and classified error handling. Returns true on success/defer/false
     * on permanent failure (logged once).
     *
     * Phase 3: a symbol whose id is not resolvable against the current map is
     * DEFERRED (queued) rather than dropped — it is retried once the lazy
     * symbol-map refresh (Phase 2.1) resolves, then logged-once-and-skipped if
     * still absent.
     *
     * @private
     * @param {Object} task
     * @param {number} [gen] - Generation token (FIX B1); if non-null and stale,
     *   the task does nothing (a newer connect superseded this restore).
     * @returns {Promise<boolean>} true if subscribed or deferred, false if
     *   permanently failed.
     */
    async _runRestoreTask(task, gen) {
        // FIX B1: a stale restore (superseded by a newer connect that bumped the
        // gen) must send NOTHING against the new transport. Return true so the
        // runner counts it as handled without side effects.
        if (gen != null && gen !== this._restoreGen) return true;

        const symbolId = this.symbolLoader && this.symbolLoader.getSymbolId(task.symbolName);
        if (!symbolId) {
            // Phase 3 / Loop-C: defer, do not drop. The lazy refresh (Phase 2.1)
            // retries these; a symbol still unresolved after refresh is logged
            // once and skipped in _onSymbolMapRefreshed.
            this._deferredSubscriptions.push(task);
            return true; // deferred counts as "handled", not a failure
        }

        const send = () => this._dispatchRestoreCommand(task);
        try {
            await this._sendWithRetry(send, task);
            task._sent = true;
            return true;
        } catch (err) {
            const category = classifyError(err);
            if (category === ctraderErrorCategory.ALREADY_SUBSCRIBED) {
                // Idempotent success: the subscription IS established server-side.
                // Mark the tracking set so the idempotency guards stay consistent.
                this._markRestored(task); task._sent = true; return true;
            }
            if (category === ctraderErrorCategory.RATE_LIMIT) {
                // Retried inside _sendWithRetry; still failing after the retry
                // budget — give up for this pass.
                log.warn(`restore rate-limited and exhausted for ${task.symbolName} (${task.kind}):`, describeError(err));
                return false;
            }
            if (category === ctraderErrorCategory.PERMANENT) {
                // Classified permanent (has an errorCode): log once, do not retry.
                log.error(`restore permanently failed for ${task.symbolName} (${task.kind}):`, describeError(err));
                return false;
            }
            // FIX M3: UNKNOWN (no errorCode — e.g. RESTORE_COMMAND_TIMEOUT budget
            // expiry, or a transport-closed rejection) is TRANSIENT. Re-defer for
            // another attempt rather than permanently dropping the subscription.
            // This cannot infinite-loop: the lazy refresh runs once per restore
            // pass; a task that fails again after the refresh-retry simply parks
            // in _deferredSubscriptions and is not re-triggered until the next
            // reconnect.
            this._deferredSubscriptions.push(task);
            log.warn(`restore transient failure, re-deferring ${task.symbolName} (${task.kind}):`, describeError(err));
            return true;
        }
    }

    /**
     * Send the actual subscribe command for a task (after the symbol resolved).
     * @private
     */
    async _dispatchRestoreCommand(task) {
        if (task.kind === 'tick') {
            await this.subscribeToTicks(task.symbolName);
        } else if (task.kind === 'm1') {
            await this.subscribeToM1Bars(task.symbolName);
        } else {
            await this.subscribeToBars(task.symbolName, task.period);
        }
    }

    /**
     * Mark a task's tracking entry as restored (idempotency-guard consistency),
     * used when a command returns already-subscribed.
     * @private
     */
    _markRestored(task) {
        if (task.kind === 'tick') {
            this.activeSubscriptions.add(task.symbolName);
        } else {
            const key = task.kind === 'm1' ? `${task.symbolName}:M1` : `${task.symbolName}:${task.period}`;
            this.activeBarSubscriptions.set(key, true);
        }
    }

    /**
     * Send a single subscription command with a per-command budget and a small
     * retry-on-rate-limit (Phase 4.1 / Phase 4.2). A single stalling command is
     * ISOLATED to this task: the budget rejects it so the bounded runner can
     * move on without aborting the whole restore.
     * @private
     */
    async _sendWithRetry(send, task) {
        let attempt = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            try {
                // FIX M2: a successful command clears the sticky rate-limit flag
                // so concurrency is restored for the remaining commands (without
                // this, one rate-limit halves concurrency for the whole pass).
                const res = await this._sendWithBudget(send);
                this._rateLimited = false;
                return res;
            } catch (err) {
                if (classifyError(err) === ctraderErrorCategory.RATE_LIMIT && attempt < RESTORE_MAX_RETRIES) {
                    attempt += 1;
                    // Signal the runner to back off globally too.
                    this._rateLimited = true;
                    await new Promise((r) => setTimeout(r, RESTORE_SPACING_MS * (attempt + 1)));
                    continue;
                }
                throw err;
            }
        }
    }

    /**
     * Send a command bounded by a per-command budget (Phase 4.1 / Loop-E). A
     * command that never responds is rejected after RESTORE_COMMAND_TIMEOUT_MS
     * so one stalled SubscribeLiveTrendbarReq cannot block the restore or the
     * connect handshake (restore is post-connect, but the isolation still
     * matters: it keeps the runner's concurrency slots free).
     *
     * FIX M1: RESTORE_COMMAND_TIMEOUT_MS is intentionally STRICTLY LESS than the
     * CTraderTransportAdapter's own per-RPC TTL (15s) so the restore budget
     * rejects a stalled command BEFORE the adapter's TTL force-closes the whole
     * transport. In PRODUCTION a genuinely stalled command therefore still
     * triggers the adapter's 15s transport-wide force-close (defect-#4 hang
     * breaker) → a reconnect the supervisor handles via backoff; the light
     * post-connect handshake keeps each cycle fast. The offline stall-isolation
     * test models LOGIC-level isolation with FakeTransport and does NOT replicate
     * the adapter's transport-wide force-close.
     * @private
     */
    _sendWithBudget(send) {
        let handle;
        const budget = new Promise((_, reject) => {
            handle = setTimeout(
                () => reject(this._budgetError('restore command timed out')),
                RESTORE_COMMAND_TIMEOUT_MS
            );
        });
        return Promise.race([send(), budget]).finally(() => clearTimeout(handle));
    }

    /** Build a budget-expiry error carrying a stable code. @private */
    _budgetError(message) {
        const e = new Error(message);
        e.code = 'RESTORE_COMMAND_TIMEOUT';
        return e;
    }

    /**
     * Bounded-concurrency runner with inter-request spacing (Phase 4.1 / Loop-E).
     *
     * Runs up to `concurrency` tasks in flight at once, spacing out the START of
     * each task by at least `spacingMs` (cTrader's concurrent-request / rate
     * limits were being exceeded by the old serial-burst). Tasks that stall are
     * isolated to their own slot: a single never-responding command only ties up
     * one slot until its per-command budget rejects it, never the whole batch.
     *
     * Order within the runner: tasks are started in enqueue order, but because
     * slots free up independently the completion order is non-deterministic. The
     * restore's correctness does NOT depend on completion order (each task is an
     * independent subscribe on an already-open transport); only the START order
     * (ticks before bars) is preserved, which holds because enqueue is in order
     * and spacing serializes starts up to the concurrency cap.
     *
     * @private
     * @param {Array<Object>} tasks
     * @param {number} concurrency
     * @param {number} spacingMs
     * @param {number} [gen] - Generation token (FIX B1); a superseded restore
     *   stops launching new tasks (startNext returns early).
     */
    async _runBounded(tasks, concurrency, spacingMs, gen) {
        const maxInFlight = Math.max(1, concurrency);
        let nextIndex = 0;
        let lastStart = 0;
        const inFlight = new Set();

        const startNext = async () => {
            // FIX B1: a newer connect bumped the gen — this restore is stale;
            // stop launching further tasks. In-flight tasks self-check the gen
            // and no-op; the drain/allSettled logic below still settles them.
            if (gen !== this._restoreGen) return;
            // Inter-request spacing: never start two tasks closer than spacingMs.
            // Reduced effective concurrency when the server rate-limited us.
            const liveCap = this._rateLimited ? Math.max(1, Math.floor(maxInFlight / 2)) : maxInFlight;
            while (inFlight.size < liveCap && nextIndex < tasks.length) {
                const now = Date.now();
                if (now - lastStart < spacingMs) {
                    await new Promise((r) => setTimeout(r, spacingMs - (now - lastStart)));
                }
                const task = tasks[nextIndex++];
                lastStart = Date.now();
                const p = this._runRestoreTask(task, gen).catch(() => false);
                inFlight.add(p);
                p.finally(() => inFlight.delete(p));
            }
        };

        // Drain the queue, topping up in-flight slots as they free.
        while (nextIndex < tasks.length || inFlight.size > 0) {
            await startNext();
            if (inFlight.size === 0) break; // nothing in flight and nothing left
            await Promise.race(inFlight);
        }
        // Ensure all in-flight settle.
        await Promise.allSettled([...inFlight]);
    }

    async subscribeToTicks(symbolName) {
        if (this.activeSubscriptions.has(symbolName)) {
            return;
        }

        const symbolId = this.symbolLoader.getSymbolId(symbolName);
        if (symbolId) {
            await this.connection.sendCommand('ProtoOASubscribeSpotsReq', {
                ctidTraderAccountId: this.ctidTraderAccountId,
                symbolId: [symbolId]
            });
            // Track subscription for restoration after reconnect
            this.activeSubscriptions.add(symbolName);
        } else {
            const error = new Error(`Symbol ID not found for ${symbolName}`);
            error.code = 'SYMBOL_NOT_FOUND';
            error.symbol = symbolName;
            throw error;
        }
    }

    async unsubscribeFromTicks(symbolName) {
        const symbolId = this.symbolLoader.getSymbolId(symbolName);
        if (symbolId) {
            await this.connection.sendCommand('ProtoOAUnsubscribeSpotsReq', {
                ctidTraderAccountId: this.ctidTraderAccountId,
                symbolId: [symbolId]
            });
            // Stop tracking this subscription
            this.activeSubscriptions.delete(symbolName);
        }
    }

    async subscribeToM1Bars(symbolName) {
        const key = `${symbolName}:M1`;
        if (this.activeBarSubscriptions.has(key)) {
            return;
        }

        const symbolId = this.symbolLoader.getSymbolId(symbolName);
        if (symbolId) {
            await this.connection.sendCommand('ProtoOASubscribeLiveTrendbarReq', {
                ctidTraderAccountId: this.ctidTraderAccountId,
                symbolId: symbolId,
                period: 'M1'
            });
            this.activeBarSubscriptions.set(key, true);
        } else {
            const error = new Error(`Symbol ID not found for ${symbolName}`);
            error.code = 'SYMBOL_NOT_FOUND';
            error.symbol = symbolName;
            throw error;
        }
    }

    /**
     * Subscribe to live trendbars for any cTrader-supported period.
     * Up to 3 non-M1 bar subscriptions per symbol are supported.
     * When the limit is reached, the oldest non-M1 subscription is evicted.
     *
     * Each trendbar entry in the spot event carries a numeric period field
     * (ProtoOATrendbarPeriod enum) that is mapped to the string identifier
     * used internally, enabling unambiguous routing per entry.
     *
     * @param {string} symbolName - Symbol name (e.g., 'EURUSD')
     * @param {string} period - cTrader period string (M1, M5, M10, M15, M30, H1, H4, H12, D1, W1, MN1)
     */
    async subscribeToBars(symbolName, period) {
        if (!VALID_PERIODS.includes(period)) {
            throw new Error(`Invalid period: ${period}. Must be one of: ${VALID_PERIODS.join(', ')}`);
        }

        const symbolId = this.symbolLoader.getSymbolId(symbolName);
        if (!symbolId) {
            const error = new Error(`Symbol ID not found for ${symbolName}`);
            error.code = 'SYMBOL_NOT_FOUND';
            error.symbol = symbolName;
            throw error;
        }

        const key = `${symbolName}:${period}`;
        if (this.activeBarSubscriptions.has(key)) {
            return;
        }

        if (period !== 'M1') {
            // Allow up to 3 non-M1 subscriptions per symbol.
            // Evict the oldest if limit reached.
            const MAX_NON_M1_PER_SYMBOL = 3;
            const nonM1Keys = [];
            for (const [existingKey] of this.activeBarSubscriptions) {
                const [existingSymbol, existingPeriod] = existingKey.split(':');
                if (existingSymbol === symbolName && existingPeriod !== 'M1') {
                    nonM1Keys.push(existingKey);
                }
            }
            if (nonM1Keys.length >= MAX_NON_M1_PER_SYMBOL) {
                const evictKey = nonM1Keys[0];
                const [, evictPeriod] = evictKey.split(':');
                await this.unsubscribeFromBars(symbolName, evictPeriod);
            }
        }

        await this.connection.sendCommand('ProtoOASubscribeLiveTrendbarReq', {
            ctidTraderAccountId: this.ctidTraderAccountId,
            symbolId: symbolId,
            period: period
        });

        this.activeBarSubscriptions.set(key, true);
    }

    /**
     * Unsubscribe from live trendbars for a specific period.
     * @param {string} symbolName - Symbol name
     * @param {string} period - cTrader period string
     */
    async unsubscribeFromBars(symbolName, period) {
        const symbolId = this.symbolLoader.getSymbolId(symbolName);
        if (!symbolId) return;

        const key = `${symbolName}:${period}`;
        if (!this.activeBarSubscriptions.has(key)) {
            return;
        }

        await this.connection.sendCommand('ProtoOAUnsubscribeLiveTrendbarReq', {
            ctidTraderAccountId: this.ctidTraderAccountId,
            symbolId: symbolId,
            period: period
        });

        this.activeBarSubscriptions.delete(key);
    }

    /**
     * Get set of subscribed bar periods for a symbol.
     * @param {string} symbolName
     * @returns {Set<string>} Set of period strings
     */
    getSubscribedBarPeriods(symbolName) {
        const periods = new Set();
        for (const [key] of this.activeBarSubscriptions) {
            const [symbol, period] = key.split(':');
            if (symbol === symbolName) {
                periods.add(period);
            }
        }
        return periods;
    }

    /**
     * Fetch historical candles for any period with automatic request chaining.
     * Delegates to CTraderDataProcessor.
     * @param {string} symbolName - Symbol name
     * @param {string} period - cTrader period string
     * @param {number} fromTimestamp - Start timestamp in ms
     * @param {number} toTimestamp - End timestamp in ms
     * @returns {Array} Array of OHLC bar objects sorted by timestamp
     */
    async fetchHistoricalCandles(symbolName, period, fromTimestamp, toTimestamp) {
        return this.dataProcessor.fetchHistoricalCandles(symbolName, period, fromTimestamp, toTimestamp);
    }

    async getSymbolDataPackage(symbolName, adrLookbackDays = 14) {
        return this.dataProcessor.getSymbolDataPackage(symbolName, adrLookbackDays);
    }

    disconnect(clearSubscriptions = true) {
        if (clearSubscriptions) {
            // Clear subscription tracking on explicit disconnect
            this.activeSubscriptions.clear();
            this.activeBarSubscriptions.clear();
        }
        // Use handleDisconnect with shouldScheduleReconnect=false to prevent auto-reconnect
        this.handleDisconnect(null, false);
    }

    async reconnect(transport) {
        // B5: HealthMonitor is inert in supervised mode (never started).
        if (!this.supervised) this.healthMonitor.stop();
        // B6: ReconnectionManager is inert in supervised mode. reconnect() is
        // only reachable unsupervised (WebSocketServer.handleReinit's no-
        // supervisor else branch), so this guard is defensive self-consistency.
        if (!this.supervised) this.reconnection.reset();
        this.isConnecting = false;
        // FIX m3: a reconnect must not start a second restore while the first is
        // still settling. Await the in-flight restore (if any) first; it will be
        // superseded by the connect() that follows (which bumps _restoreGen).
        if (this.restorePromise) await this.restorePromise.catch(() => {});
        // Preserve subscriptions across reconnect — connect() → restoreSubscriptions()
        // repopulates the backend from the saved maps.
        await this.disconnect(false);
        await this.connect(transport);
    }
}

// ProtoOATrendbarPeriod numeric enum → string identifier
// protobufjs deserializes the period field as a number, not a string
const PERIOD_ENUM_TO_STRING = {
    1: 'M1', 2: 'M2', 3: 'M3', 4: 'M4', 5: 'M5',
    6: 'M10', 7: 'M15', 8: 'M30', 9: 'H1', 10: 'H4',
    11: 'H12', 12: 'D1', 13: 'W1', 14: 'MN1'
};

module.exports = { CTraderSession };

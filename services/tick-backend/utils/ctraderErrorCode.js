'use strict';

/**
 * Classification of cTrader subscribe/symbol rejections (Loop-D, Phase 4.2).
 *
 * The cTrader-Layer library rejects `sendCommand` with the RAW protobuf payload
 * (a plain object carrying `.errorCode` / `.description`) when the server
 * returns a `ProtoOAErrorRes`. This helper classifies those codes into the
 * categories the restore runner needs to decide what to do with a failed
 * subscription command:
 *
 *   ALREADY_SUBSCRIBED → treat as SUCCESS (idempotent). The subscription IS
 *                        established server-side; re-subscribing after a
 *                        reconnect legitimately returns this. Do not fail.
 *   RATE_LIMIT         → the server is throttling us (too many concurrent /
 *                        too-frequent requests). Back off: reduce concurrency,
 *                        raise inter-request spacing, then retry.
 *   PERMANENT          → auth / permission / otherwise non-transient. Log once,
 *                        surface, and do NOT churn-retry (would loop forever).
 *
 * Consistent with `RequestCoordinator.handleFetchError`, which already treats
 * `REQUEST_FREQUENCY_EXCEEDED` / `BLOCKED_PAYLOAD_TYPE` as retryable.
 *
 * Categories are intentionally exhaustive: anything unrecognized falls back to
 * PERMANENT (the safe default — never blind-retry an unknown server rejection).
 */

const CATEGORY = {
    ALREADY_SUBSCRIBED: 'ALREADY_SUBSCRIBED',
    RATE_LIMIT: 'RATE_LIMIT',
    PERMANENT: 'PERMANENT',
    UNKNOWN: 'UNKNOWN',
};

// "Already subscribed" variants. cTrader returns one of these when a symbol is
// re-subscribed while still (or again) subscribed server-side — a normal
// reconnect condition, NOT a restore failure. cTrader errorCodes are observed
// BOTH bare (e.g. `ALREADY_SUBSCRIBED`) and `CH_`-prefixed; classifyErrorCode
// strips a leading `CH_` so both forms match.
const ALREADY_SUBSCRIBED_CODES = new Set([
    'SYMBOL_ALREADY_SUBSCRIBED',
    'ALREADY_SUBSCRIBED',
]);

// Rate-limit / too-many variants. The server is throttling our request rate;
// the correct response is to slow down, not to churn-retry at full speed.
const RATE_LIMIT_CODES = new Set([
    'SPEED_OVERLIMIT',
    'REQUEST_FREQUENCY_EXCEEDED',
    'BLOCKED_PAYLOAD_TYPE',
    'TOO_MANY_REQUESTS',
]);

/**
 * Classify a cTrader errorCode (string) into a category.
 * @param {string} [errorCode] - The `errorCode` field from a rejected payload.
 * @returns {string} One of CATEGORY.* (defaults to PERMANENT for unknown codes
 *   so we never blind-retry an unrecognized server rejection).
 */
function classifyErrorCode(errorCode) {
    if (errorCode == null) return CATEGORY.UNKNOWN;
    // Normalize: cTrader codes arrive both bare (`ALREADY_SUBSCRIBED`) and
    // `CH_`-prefixed (`CH_ALREADY_SUBSCRIBED`). Strip the prefix so a single
    // set matches both (confirmed live: reconnect re-subscribes return the bare
    // form, which previously fell through to PERMANENT and broke restore).
    let code = String(errorCode).toUpperCase();
    if (code.startsWith('CH_')) code = code.slice(3);
    if (ALREADY_SUBSCRIBED_CODES.has(code)) return CATEGORY.ALREADY_SUBSCRIBED;
    if (RATE_LIMIT_CODES.has(code)) return CATEGORY.RATE_LIMIT;
    // Auth / permission / not-found / any other server error is non-transient.
    // Auth-ish prefixes hint permanence; everything else defaults the same way.
    return CATEGORY.PERMANENT;
}

/**
 * Convenience: extract an errorCode from a rejected value (raw payload or
 * Error) and classify it. Returns UNKNOWN when no code is present.
 * @param {*} err - Rejected value from sendCommand.
 * @returns {string} One of CATEGORY.*
 */
function classifyError(err) {
    return classifyErrorCode(err && err.errorCode);
}

module.exports = {
    ctraderErrorCategory: CATEGORY,
    classifyErrorCode,
    classifyError,
};

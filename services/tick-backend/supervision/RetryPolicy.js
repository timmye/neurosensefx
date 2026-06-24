/**
 * RetryPolicy — pure exponential-backoff delay calculator.
 *
 * Replaces the give-up logic that used to live in ReconnectionManager. A
 * RetryPolicy is **stateless w.r.t. counting**: the caller (FeedSupervisor)
 * tracks the attempt count and asks `delayFor(attempts)` for the next delay.
 * It NEVER returns a terminal — every attempt gets a finite, capped, jittered
 * delay — so a transiently-failed feed always gets another retry.
 *
 * Determinism: the jitter RNG is injectable (`random`, default `Math.random`)
 * so supervisor/recovery tests can pin it. The policy performs no I/O and reads
 * no clock internally.
 */
class RetryPolicy {
    constructor({
        initialDelay = 500,
        maxDelay = 15000,
        factor = 2,
        jitter = 0.3,
        random = Math.random,
    } = {}) {
        this.initialDelay = initialDelay;
        this.maxDelay = maxDelay;
        this.factor = factor;
        this.jitter = jitter;
        this.random = random;
    }

    /**
     * Un-jittered base delay for a given attempt index (0-based), exponential
     * with a hard cap at `maxDelay`.
     * @param {number} attempts
     * @returns {number} ms
     */
    baseDelay(attempts) {
        const exp = this.initialDelay * Math.pow(this.factor, attempts);
        return Math.min(exp, this.maxDelay);
    }

    /**
     * True once the (un-jittered) base delay has flattened against `maxDelay`.
     * The supervisor uses this to emit its periodic escalation log
     * ("still retrying — attempt N over M min") so a genuinely-broken feed is
     * detectable instead of silently churning.
     * @param {number} attempts
     * @returns {boolean}
     */
    isPlateau(attempts) {
        return this.baseDelay(attempts) >= this.maxDelay;
    }

    /**
     * Delay to wait before the (attempts+1)-th retry. Always finite and positive:
     * `baseDelay(attempts)` (capped) plus jitter in `[0, jitter * base)`.
     * @param {number} attempts
     * @returns {number} ms
     */
    delayFor(attempts) {
        const base = this.baseDelay(attempts);
        const jitterAmount = this.random() * this.jitter * base;
        return base + jitterAmount;
    }
}

module.exports = { RetryPolicy };

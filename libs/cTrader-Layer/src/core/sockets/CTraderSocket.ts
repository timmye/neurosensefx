import * as tls from "tls";
import * as dns from "dns";
import { promisify } from "util";
import { CTraderSocketParameters } from "#sockets/CTraderSocketParameters";

const lookupAsync = promisify(dns.lookup);

export class CTraderSocket {
    readonly #host: string;
    readonly #port: number;
    #socket?: tls.TLSSocket;

    public constructor ({ host, port, }: CTraderSocketParameters) {
        this.#host = host;
        this.#port = port;
        this.#socket = undefined;
    }

    public get host (): string {
        return this.#host;
    }

    public get port (): number {
        return this.#port;
    }

    public connect (): void {
        // Resolve hostname to IP before connecting. Some environments have issues
        // with tls.connect() doing internal DNS resolution (e.g. Codespaces/WSL2),
        // where the hostname resolves but TLS handshake never completes.
        const resolveAndConnect = async () => {
            try {
                const resolved = await lookupAsync(this.#host, { family: 4 });
                const socket = tls.connect({
                    host: resolved.address,
                    port: this.#port,
                    servername: this.#host,
                    timeout: 10000
                });

                // A hung TLS handshake (e.g. WSL2) never fires 'secureConnect'; the
                // socket's 'timeout' is the only signal. Destroy on timeout so the
                // handshake aborts -> 'error'/'end' fires -> open() rejects instead
                // of hanging forever.
                socket.on("timeout", () => socket.destroy());

                // Use secureConnect event instead of callback to ensure proper binding
                socket.on("secureConnect", () => {
                    // L1 fix: `timeout: 10000` above is a socket-INACTIVITY timer
                    // meant only to catch a hung TLS HANDSHAKE (open() must not
                    // hang forever). Once the handshake succeeds, disable it —
                    // otherwise an idle no-subscription socket is destroyed after
                    // 10s of inactivity (the heartbeat keepalive owns post-connect
                    // liveness, not this timeout). Caught by the Phase-4 live run.
                    socket.setTimeout(0);
                    if (this.onOpen && typeof this.onOpen === 'function') {
                        this.onOpen();
                    }
                });

                socket.on("data", this.onData);
                socket.on("end", this.onClose);
                socket.on("close", this.onClose);
                socket.on("error", this.onError);

                this.#socket = socket;
                return;
            } catch (e: unknown) {
                // Fallback: try direct connect if DNS resolution fails
                const msg = e instanceof Error ? e.message : String(e);
                console.warn(`[CTraderSocket] DNS resolution failed (${this.#host}), falling back to direct connect: ${msg}`);
            }

            // Fallback path
            const socket = tls.connect({
                host: this.#host,
                port: this.#port,
                servername: this.#host,
                timeout: 10000
            });

            socket.on("timeout", () => socket.destroy());

            socket.on("secureConnect", () => {
                if (this.onOpen && typeof this.onOpen === 'function') {
                    this.onOpen();
                }
            });

            socket.on("data", this.onData);
            socket.on("end", this.onClose);
            socket.on("close", this.onClose);
            socket.on("error", this.onError);

            this.#socket = socket;
        };
        resolveAndConnect();
    }

    public send (buffer: Buffer): void {
        this.#socket?.write(buffer);
    }

    public onOpen (): void {
        // Silence is golden.
    }

    public onData (...parameters: any[]): void {
        // Silence is golden.
    }

    public onClose (): void {
        // Silence is golden.
    }

    public onError (error: Error): void {
        // Error handled by CTraderConnection
    }

    public close (): void {
        if (this.#socket) {
            this.#socket.destroy();
            this.#socket = undefined;
        }
    }
}

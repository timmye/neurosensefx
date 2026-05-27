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

                // Use secureConnect event instead of callback to ensure proper binding
                socket.on("secureConnect", () => {
                    if (this.onOpen && typeof this.onOpen === 'function') {
                        this.onOpen();
                    }
                });

                socket.on("data", this.onData);
                socket.on("end", this.onClose);
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

            socket.on("secureConnect", () => {
                if (this.onOpen && typeof this.onOpen === 'function') {
                    this.onOpen();
                }
            });

            socket.on("data", this.onData);
            socket.on("end", this.onClose);
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

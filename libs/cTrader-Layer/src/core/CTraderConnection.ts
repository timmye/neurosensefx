import * as EventEmitter from "events";
import * as path from "path";
import { v1 } from "uuid";
import { CTraderCommandMap } from "#commands/CTraderCommandMap";
import { CTraderEncoderDecoder } from "#encoder-decoder/CTraderEncoderDecoder";
import { CTraderSocket } from "#sockets/CTraderSocket";
import { GenericObject } from "#utilities/GenericObject";
import { CTraderProtobufReader } from "#protobuf/CTraderProtobufReader";
import { CTraderConnectionParameters } from "#CTraderConnectionParameters";
import axios from "axios";

export class CTraderConnection extends EventEmitter {
    readonly #commandMap: CTraderCommandMap;
    readonly #encoderDecoder: CTraderEncoderDecoder;
    readonly #protobufReader;
    readonly #socket: CTraderSocket;
    #resolveConnectionPromise?: (...parameters: any[]) => void;
    #rejectConnectionPromise?: (...parameters: any[]) => void;
    #connectionSettled: boolean;
    #closed: boolean;

    public constructor ({ host, port, commandTtlMs, }: CTraderConnectionParameters) {
        super();

        this.#connectionSettled = false;
        this.#closed = false;
        this.#commandMap = new CTraderCommandMap({
            send: (data: any): void => this.#send(data),
            onCommandTimeout: (): void => { this.close(); },
            commandTtlMs,
        });
        this.#encoderDecoder = new CTraderEncoderDecoder();
        // eslint-disable-next-line max-len
        this.#protobufReader = new CTraderProtobufReader([ {
            file: path.resolve(__dirname, "../../../protobuf/OpenApiCommonMessages.proto"),
        }, {
            file: path.resolve(__dirname, "../../../protobuf/OpenApiMessages.proto"),
        }, ]);
        this.#socket = new CTraderSocket({ host, port, });
        this.#resolveConnectionPromise = undefined;
        this.#rejectConnectionPromise = undefined;

        this.#encoderDecoder.setDecodeHandler((data) => this.#onDecodedData(this.#protobufReader.decode(data)));
        this.#protobufReader.load();
        this.#protobufReader.build();

        this.#socket.onOpen = (): void => this.#onOpen();
        this.#socket.onData = (data: any): void => this.#onData(data);
        this.#socket.onClose = (): void => this.#onClose();
        this.#socket.onError = (error: Error): void => this.#onError(error);
    }

    public getPayloadTypeByName (name: string): number | undefined {
        return this.#protobufReader.getPayloadTypeByName(name);
    }

    async sendCommand (payloadType: string | number, data?: GenericObject): Promise<GenericObject> {
        const clientMsgId: string = v1();
        const normalizedPayloadType = this.#protobufReader.resolveIdentifierToPayloadType(payloadType);

        if (normalizedPayloadType === undefined) {
            throw new Error(`Unknown payload type or identifier: ${payloadType}`);
        }

        const message: any = this.#protobufReader.encode(normalizedPayloadType, data ?? {}, clientMsgId);

        return this.#commandMap.create({ clientMsgId, message, });
    }

    async trySendCommand (payloadType: string | number, data?: GenericObject): Promise<GenericObject | undefined> {
        try {
            return await this.sendCommand(payloadType, data);
        }
        catch {
            return undefined;
        }
    }

    public sendHeartbeat (): void {
        const payloadType = this.#protobufReader.resolveIdentifierToPayloadType("ProtoHeartbeatEvent");

        if (payloadType === undefined) {
            return;
        }

        const encodedPayload = this.#protobufReader.encode(payloadType, {}, undefined as any);

        this.#socket.send(this.#encoderDecoder.encode(encodedPayload));
    }

    public get pendingCommandCount (): number {
        return this.#commandMap.pendingCommandCount;
    }

    public open (): Promise<unknown> {
        this.#connectionSettled = false;
        this.#closed = false;
        const connectionPromise = new Promise((resolve, reject) => {
            this.#resolveConnectionPromise = resolve;
            this.#rejectConnectionPromise = reject;
        });

        this.#socket.connect();

        return connectionPromise;
    }

    public override on (type: string | symbol, listener: (...parameters: any) => any): this {
        let normalizedType: string | symbol = type;

        if (typeof type === "string") {
            const resolvedPayloadType = this.#protobufReader.resolveIdentifierToPayloadType(type);
            if (resolvedPayloadType !== undefined) {
                normalizedType = resolvedPayloadType.toString();
            }
            else if (!Number.isFinite(Number.parseInt(type, 10))) {
                console.warn(`Attempted to listen for unknown event type: ${type}. Listener might not be triggered.`);
            }
        }
        return super.on(normalizedType, listener);
    }

    #send (data: GenericObject): void {
        this.#socket.send(this.#encoderDecoder.encode(data));
    }

    #onOpen (): void {
        if (this.#resolveConnectionPromise && !this.#connectionSettled) {
            this.#connectionSettled = true;
            this.#resolveConnectionPromise();
        }

        this.#resolveConnectionPromise = undefined;
        this.#rejectConnectionPromise = undefined;
    }

    #onData (data: Buffer): void {
        this.#encoderDecoder.decode(data);
    }

    #onDecodedData (data: GenericObject): void {
        const payloadType = data.payloadType;
        const payload = data.payload;
        const clientMsgId = data.clientMsgId;
        const sentCommand = this.#commandMap.extractById(clientMsgId);

        if (sentCommand) {
            if (typeof payload.errorCode === "string" || typeof payload.errorCode === "number") {
                sentCommand.reject(payload);
            }
            else {
                sentCommand.resolve(payload);
            }
        }
        else {
            this.#onPushEvent(payloadType, data.payload);
        }
    }

    #onClose (): void {
        // Emit 'close' exactly once. The socket binds BOTH 'end' and 'close' to this
        // handler (a clean FIN fires 'end' then 'close'); without this guard a single
        // disconnect would emit 'close' twice and re-run rejectAll. Consumers are
        // idempotent today, but this removes the latent double-emit (also L5's guard).
        if (this.#closed) {
            return;
        }
        this.#closed = true;

        // If the connection was never settled (e.g. a hung TLS handshake where
        // socket.destroy() emits only 'close', no 'error'), reject open() here so
        // the awaiting caller doesn't hang forever. Idempotent via the settled guard.
        if (!this.#connectionSettled && this.#rejectConnectionPromise) {
            this.#connectionSettled = true;
            this.#rejectConnectionPromise(new Error("cTrader connection closed"));
        }

        this.#commandMap.rejectAll(new Error("cTrader connection closed"));
        this.emit('close');
    }

    #onError (error: Error): void {
        if (!this.#connectionSettled && this.#rejectConnectionPromise) {
            this.#connectionSettled = true;
            this.#rejectConnectionPromise(error);
        }

        this.emit('error', error);
    }

    #onPushEvent (payloadType: number, message: GenericObject): void {
        this.emit(payloadType.toString(), message);
    }

    public close (): void {
        this.#socket.close();
    }

    public static async getAccessTokenProfile (accessToken: string): Promise<GenericObject> {
        return JSON.parse(await axios.get(`https://api.spotware.com/connect/profile?access_token=${accessToken}`));
    }

    public static async getAccessTokenAccounts (accessToken: string): Promise<GenericObject[]> {
        const parsedResponse: any = JSON.parse(await axios.get(`https://api.spotware.com/connect/tradingaccounts?access_token=${accessToken}`));

        if (!Array.isArray(parsedResponse)) {
            return [];
        }

        return parsedResponse;
    }
}

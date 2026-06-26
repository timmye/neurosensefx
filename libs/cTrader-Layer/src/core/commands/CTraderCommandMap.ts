import { CTraderCommand } from "#commands/CTraderCommand";
import { CTraderCommandMapParameters } from "#commands/CTraderCommandMapParameters";
import { GenericObject } from "#utilities/GenericObject";

const DEFAULT_COMMAND_TTL_MS = 15000;

export class CTraderCommandMap {
    readonly #openCommands: Map<string, CTraderCommand>;
    readonly #timers: Map<string, ReturnType<typeof setTimeout>>;
    readonly #send: (...parameters: any[]) => void;
    readonly #onCommandTimeout?: () => void;
    readonly #commandTtlMs: number;

    public constructor ({ send, onCommandTimeout, commandTtlMs, }: CTraderCommandMapParameters) {
        this.#openCommands = new Map();
        this.#timers = new Map();
        this.#send = send;
        this.#onCommandTimeout = onCommandTimeout;
        this.#commandTtlMs = commandTtlMs ?? DEFAULT_COMMAND_TTL_MS;
    }

    public get openCommands (): CTraderCommand[] {
        return [ ...this.#openCommands.values(), ];
    }

    public get pendingCommandCount (): number {
        return this.#openCommands.size;
    }

    public create ({ clientMsgId, message, }: {
        clientMsgId: string;
        message: GenericObject;
    }): Promise<GenericObject> {
        const command: CTraderCommand = new CTraderCommand({ clientMsgId, });

        this.#openCommands.set(clientMsgId, command);
        this.#send(message);

        this.#armTimer(clientMsgId);

        return command.responsePromise;
    }

    public extractById (clientMsgId: string): CTraderCommand | undefined {
        const command: CTraderCommand | undefined = this.#openCommands.get(clientMsgId);

        if (!command) {
            return undefined;
        }

        this.#clearTimer(clientMsgId);
        this.#openCommands.delete(clientMsgId);

        return command;
    }

    public rejectAll (error: Error): void {
        for (const command of this.#openCommands.values()) {
            command.reject(error);
        }

        for (const timer of this.#timers.values()) {
            clearTimeout(timer);
        }
        this.#timers.clear();
        this.#openCommands.clear();
    }

    #armTimer (clientMsgId: string): void {
        if (this.#commandTtlMs <= 0) {
            return;
        }

        const timer = setTimeout(() => {
            const command: CTraderCommand | undefined = this.#openCommands.get(clientMsgId);

            if (command) {
                this.#clearTimer(clientMsgId);
                this.#openCommands.delete(clientMsgId);
                command.reject(new Error(`Command ${clientMsgId} timed out after ${this.#commandTtlMs}ms`));

                if (this.#onCommandTimeout) {
                    this.#onCommandTimeout();
                }
            }
        }, this.#commandTtlMs);

        if (typeof timer === "object" && timer && typeof (timer as any).unref === "function") {
            (timer as any).unref();
        }

        this.#timers.set(clientMsgId, timer);
    }

    #clearTimer (clientMsgId: string): void {
        const timer = this.#timers.get(clientMsgId);

        if (timer) {
            clearTimeout(timer);
            this.#timers.delete(clientMsgId);
        }
    }
}

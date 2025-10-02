import { GenericObject } from "#utilities/GenericObject";

const protobuf = require("protobufjs");

export class CTraderProtobufReader {
    #params: any;
    #builder: any;
    readonly #payloadTypes: { [key: string]: any };
    readonly #names: { [key: string]: any };
    readonly #messages: { [key: string]: any };
    readonly #enums: { [key: string]: any };

    public constructor (options: GenericObject) {
        this.#params = options;
        this.#builder = undefined;
        this.#payloadTypes = {};
        this.#names = {};
        this.#messages = {};
        this.#enums = {};
    }

    public encode (payloadType: number, params: GenericObject, clientMsgId: string): any {
        const Message = this.getMessageByPayloadType(payloadType);
        if (!Message) {
            throw new Error(`No message definition found for payloadType: ${payloadType}`);
        }
        const message = new Message(params);

        return this.#wrap(payloadType, message, clientMsgId).encode();
    }

    public decode (buffer: GenericObject): any {
        const protoMessage = this.getMessageByName("ProtoMessage").decode(buffer);
        const payloadType = protoMessage.payloadType;
        const messageDecoder = this.getMessageByPayloadType(payloadType);

        if (!messageDecoder) {
            return {
                payload: null,
                payloadType: payloadType,
                clientMsgId: protoMessage.clientMsgId,
            };
        }

        return {
            payload: messageDecoder.decode(protoMessage.payload),
            payloadType: payloadType,
            clientMsgId: protoMessage.clientMsgId,
        };
    }

    #wrap (payloadType: number, message: GenericObject, clientMsgId: string): any {
        const ProtoMessage = this.getMessageByName("ProtoMessage");
        return new ProtoMessage({
            payloadType: payloadType,
            payload: message.toBuffer(),
            clientMsgId: clientMsgId,
        });
    }

    public load (): void {
        this.#params.forEach((param: any) => {
            this.#builder = protobuf.loadProtoFile(param.file, this.#builder);
        });
    }

    public build (): any {
        const builder: any = this.#builder;
        builder.build();

        // First, cache all enums.
        builder.ns.children.forEach((reflect: any) => {
            if (reflect.className === "Enum") {
                this.#enums[reflect.name] = builder.build(reflect.name);
            }
        });

        // Then, cache all messages and their payload types.
        builder.ns.children.forEach((reflect: any) => {
            if (reflect.className === "Message") {
                const messageName = reflect.name;
                const messageBuilded = builder.build(messageName);
                this.#messages[messageName] = messageBuilded;

                const payloadType = this.findPayloadType(reflect);

                if (payloadType !== undefined) {
                    this.#names[messageName] = {
                        messageBuilded: messageBuilded,
                        payloadType: payloadType,
                    };
                    this.#payloadTypes[payloadType] = {
                        messageBuilded: messageBuilded,
                        name: messageName,
                    };
                }
            }
        });

        this.#buildWrapper();
    }

    #buildWrapper (): void {
        const name = "ProtoMessage";
        const messageBuilded = this.#builder.build(name);

        this.#messages[name] = messageBuilded;
        this.#names[name] = {
            messageBuilded: messageBuilded,
            payloadType: undefined,
        };
    }

    public findPayloadType (message: GenericObject): number | undefined {
        const field = message.children.find((field: any) => field.name === "payloadType");
        if (!field) {
            return undefined;
        }

        const defaultValue = field.defaultValue;
        if (typeof defaultValue === "number") {
            return defaultValue;
        }

        if (typeof defaultValue === "string") {
            return this.getPayloadTypeByEnumName(defaultValue);
        }

        return undefined;
    }

    public getMessageByPayloadType (payloadType: number): any {
        const payloadInfo = this.#payloadTypes[payloadType];
        return payloadInfo ? payloadInfo.messageBuilded : undefined;
    }

    public getMessageByName (name: string): any {
        const nameInfo = this.#names[name];
        return nameInfo ? nameInfo.messageBuilded : undefined;
    }

    public getPayloadTypeByName (name: string): number | undefined {
        const nameInfo = this.#names[name];
        return nameInfo ? nameInfo.payloadType : undefined;
    }

    public getPayloadTypeByEnumName (enumName: string): number | undefined {
        const protoOAPayloadType = this.#enums["ProtoOAPayloadType"];
        if (protoOAPayloadType && typeof protoOAPayloadType[enumName] === "number") {
            return protoOAPayloadType[enumName];
        }
        const protoPayloadType = this.#enums["ProtoPayloadType"];
        if (protoPayloadType && typeof protoPayloadType[enumName] === "number") {
            return protoPayloadType[enumName];
        }
        return undefined;
    }

    public resolveIdentifierToPayloadType (identifier: string | number): number | undefined {
        if (typeof identifier === "number") {
            return identifier;
        }

        // Try as SCREAMING_SNAKE_CASE enum name
        const enumValue = this.getPayloadTypeByEnumName(identifier);
        if (enumValue !== undefined) {
            return enumValue;
        }

        // Try as PascalCase message name (from this.#names)
        const nameInfo = this.#names[identifier];
        if (nameInfo && typeof nameInfo.payloadType === "number") {
            return nameInfo.payloadType;
        }

        return undefined;
    }
}

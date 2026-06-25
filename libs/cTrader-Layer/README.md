# cTrader Layer (NeuroSense FX — internal vendored fork)

> **Internal vendored copy — free to modify.** This library lives directly inside the
> NeuroSense FX repo at `libs/cTrader-Layer/` and is consumed via a local `file:`
> dependency (`@neurosensefx/ctrader-layer`). It is **not** installed from npm and is
> **never published**; treat it as part of this project and edit it freely. It is derived
> from the MIT-licensed [cTrader-Layer](https://github.com/Reiryoku-Technologies/cTrader-Layer)
> by Reiryoku Technologies — attribution and license are preserved in `LICENSE`.

A Node.js communication layer for the cTrader [Open API](https://connect.spotware.com).
Originally created and maintained by Reiryoku Technologies and its contributors; locally
forked and patched for NeuroSense FX.

## Installation
```console
# Internal dependency — already present at libs/cTrader-Layer/ and wired via a file: link
# in package.json (as @neurosensefx/ctrader-layer). A normal `npm install` resolves it.
# Do NOT run: npm install @reiryoku/ctrader-layer
```

## Usage
For the cTrader Open API usage refer to the [Open API Documentation](https://spotware.github.io/open-api-docs/).

### How to establish a connection
```javascript
const { CTraderConnection } = require("@neurosensefx/ctrader-layer");

const connection = new CTraderConnection({
    host: "demo.ctraderapi.com",
    port: 5035,
});

await connection.open();
```

### How to send commands
You can use the `sendCommand` method to send a command with payload to the server.
The method returns a `Promise` resolved only when a response from the server is received.
If the response to the command contains an error code then the returned `Promise` is rejected.

```javascript
await connection.sendCommand("PayloadName", {
    foo: "bar",
});
```

### How to authenticate an application
```javascript
await connection.sendCommand("ProtoOAApplicationAuthReq", {
    clientId: "foo",
    clientSecret: "bar",
});
```

### How to keep connection alive
You can send a heartbeat message every 25 seconds to keep the connection alive.
```javascript
setInterval(() => connection.sendHeartbeat(), 25000);
```

### How to listen events from server
```javascript
connection.on("EventName", (event) => {
    console.log(event);
});
```

### How to get the access token profile information
Through HTTP request.
```javascript
console.log(await CTraderConnection.getAccessTokenProfile("access-token"));
```

### How to get the access token accounts
Through HTTP request.
```javascript
console.log(await CTraderConnection.getAccessTokenAccounts("access-token"));
```

## Contribution
You can create a PR or open an issue for bug reports or ideas.

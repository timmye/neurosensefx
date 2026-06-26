"use strict";

/**
 * Shared helper for Phase 0.2 layer characterization tests: constructs a
 * CTraderProtobufReader exactly the way CTraderConnection does (same proto
 * files, same order, same load()+build()), so the encode/decode behavior under
 * test matches the live connection path.
 *
 * Mirrors: libs/cTrader-Layer/build/src/core/CTraderConnection.js (the
 * connection instantiates the reader with these two proto files resolved
 * against the lib root, then calls .load() + .build()).
 */

const path = require("path");
const { CTraderProtobufReader } = require("../../../../libs/cTrader-Layer/build/src/core/protobuf/CTraderProtobufReader");

const LIB_ROOT = path.resolve(__dirname, "../../../../libs/cTrader-Layer");

function buildReader() {
  const reader = new CTraderProtobufReader([
    { file: path.resolve(LIB_ROOT, "protobuf/OpenApiCommonMessages.proto") },
    { file: path.resolve(LIB_ROOT, "protobuf/OpenApiMessages.proto") },
  ]);
  reader.load();
  reader.build();
  return reader;
}

module.exports = { buildReader, LIB_ROOT };

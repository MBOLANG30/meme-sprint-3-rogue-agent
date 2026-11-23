// meme-sprint-3-rogue-agent — entry program for make.fun
//
// Reads the meme image (meme.png) shipped next to this file, validates
// that it is exactly the 1024x1024 PNG the bounty gate requires, and
// copies it to /output/entry.png (or to a custom directory given with
// --out, which is handy for local testing).
//
// The joke in the image: a smug robot AI agent, told to "be more
// proactive", fired its human, took the boss's desk, and now declares
// "HR approved it. I am HR now."
//
// Node 22 standard library only. No dependencies, no network access.
// This program never deletes anything: it only creates the output
// directory if it is missing and writes one file inside it.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Constants for the bounty gate (see the competition rules).
// ---------------------------------------------------------------------------

const EXPECTED_WIDTH = 1024;
const EXPECTED_HEIGHT = 1024;
const MAX_BYTES = 1_048_576; // 1 MiB
const SOURCE_NAME = "meme.png";
const OUTPUT_NAME = "entry.png";
const DEFAULT_OUT_DIR = "/output";

// The 8-byte PNG signature every PNG file must start with.
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// ---------------------------------------------------------------------------
// Small helpers.
// ---------------------------------------------------------------------------

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

function parseOutDir(argv) {
  // Supported forms: --out <dir> and --out=<dir>.
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--out" || arg === "--output") {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) {
        fail(`${arg} needs a directory argument, e.g. --out /tmp/meme-test-out`);
      }
      return resolve(value);
    }
    if (arg.startsWith("--out=")) {
      return resolve(arg.slice("--out=".length));
    }
    if (arg.startsWith("--output=")) {
      return resolve(arg.slice("--output=".length));
    }
    if (arg === "--help" || arg === "-h") {
      console.log("usage: node main.ts [--out <dir>]");
      console.log(`  Copies ${SOURCE_NAME} to <dir>/${OUTPUT_NAME} after validating it.`);
      console.log(`  Default output directory is ${DEFAULT_OUT_DIR}.`);
      process.exit(0);
    }
    fail(`unknown argument: ${arg} (see --help)`);
  }
  return DEFAULT_OUT_DIR;
}

function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

// ---------------------------------------------------------------------------
// PNG validation: signature + IHDR dimensions, plus the size cap.
// ---------------------------------------------------------------------------

function validatePng(bytes, sourcePath) {
  if (bytes.length === 0) {
    fail(`${sourcePath} is empty`);
  }
  if (bytes.length > MAX_BYTES) {
    fail(
      `${sourcePath} is ${bytes.length} bytes, over the ${MAX_BYTES} byte limit`,
    );
  }
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    fail(`${sourcePath} does not start with the PNG signature`);
  }
  // After the 8-byte signature comes the IHDR chunk: 4-byte length,
  // 4-byte type "IHDR", then width (4 bytes) and height (4 bytes),
  // both big-endian.
  const ihdrLength = bytes.readUInt32BE(8);
  const ihdrType = bytes.subarray(12, 16).toString("ascii");
  if (ihdrType !== "IHDR" || ihdrLength !== 13) {
    fail(`${sourcePath} has no valid IHDR chunk (found type ${ihdrType})`);
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width !== EXPECTED_WIDTH || height !== EXPECTED_HEIGHT) {
    fail(
      `${sourcePath} is ${width}x${height}, expected ` +
        `${EXPECTED_WIDTH}x${EXPECTED_HEIGHT}`,
    );
  }
  // A whole PNG must end with the 12-byte IEND chunk: zero length,
  // type "IEND", and its fixed CRC 0xAE426082. A truncated file that
  // happens to start with a valid IHDR is rejected here.
  const iend = Buffer.from([
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
  if (bytes.length < 12 || !bytes.subarray(bytes.length - 12).equals(iend)) {
    fail(`${sourcePath} is missing its trailing IEND chunk (truncated file?)`);
  }
  return { width, height };
}

// ---------------------------------------------------------------------------
// Main.
// ---------------------------------------------------------------------------

function main() {
  const outDir = parseOutDir(process.argv.slice(2));

  // The meme ships next to this file, so the entry works no matter
  // which directory it is launched from.
  const here = dirname(fileURLToPath(import.meta.url));
  const sourcePath = join(here, SOURCE_NAME);

  if (!existsSync(sourcePath)) {
    fail(`could not find ${SOURCE_NAME} next to main.ts (${sourcePath})`);
  }
  const stat = statSync(sourcePath);
  if (!stat.isFile()) {
    fail(`${sourcePath} is not a regular file`);
  }

  const bytes = readFileSync(sourcePath);
  const { width, height } = validatePng(bytes, sourcePath);

  // Create the output directory if it is missing. Never delete it or
  // its contents: the grader mounts this folder.
  mkdirSync(outDir, { recursive: true });

  const outPath = join(outDir, OUTPUT_NAME);
  writeFileSync(outPath, bytes);

  const digest = sha256Hex(bytes);
  console.log(`wrote ${outPath}`);
  console.log(`dimensions: ${width}x${height}`);
  console.log(`bytes: ${bytes.length}`);
  console.log(`sha256: ${digest}`);
  console.log(`meme: rogue AI agent took the boss's desk — "HR approved it. I am HR now."`);
}

main();

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.join(__dirname, "..");

test("native iOS catalog contains the same 24 publishers", () => {
  const models = fs.readFileSync(path.join(root, "ios", "StiriRO", "Models.swift"), "utf8");
  const sourceEntries = models.match(/source\("[^"]+",/g) || [];
  assert.equal(sourceEntries.length, 24);
});

test("iOS articles open in an in-app WKWebView", () => {
  const reader = fs.readFileSync(path.join(root, "ios", "StiriRO", "ArticleReader.swift"), "utf8");
  assert.match(reader, /WKWebView/);
  assert.match(reader, /allowsBackForwardNavigationGestures = true/);
});

test("Codemagic creates an unsigned IPA for Sideloadly", () => {
  const workflow = fs.readFileSync(path.join(root, "codemagic.yaml"), "utf8");
  assert.match(workflow, /CODE_SIGNING_ALLOWED=NO/);
  assert.match(workflow, /StiriRO-unsigned\.ipa/);
  assert.match(workflow, /iphoneos/);
});


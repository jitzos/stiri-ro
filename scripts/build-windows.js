const { Arch, build, Platform } = require("electron-builder");

const owner = process.env.STIRIRO_GITHUB_OWNER?.trim() || "jitzos";
const repo = process.env.STIRIRO_GITHUB_REPO?.trim() || "stiri-ro";

build({
  targets: Platform.WINDOWS.createTarget(["nsis"], Arch.x64),
  config: {
    publish: [{ provider: "github", owner, repo }]
  }
}).catch((error) => {
  console.error(error);
  process.exit(1);
});

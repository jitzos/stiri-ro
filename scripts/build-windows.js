const { Arch, build, Platform } = require("electron-builder");

build({
  targets: Platform.WINDOWS.createTarget(["nsis"], Arch.x64)
}).catch((error) => {
  console.error(error);
  process.exit(1);
});

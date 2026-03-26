const { execSync } = require("child_process")
const fs = require("fs")
const path = require("path")

const cacheDir = path.join(
  process.env.LOCALAPPDATA,
  "electron-builder",
  "Cache",
  "winCodeSign"
)
const sevenZip = path.join(
  process.cwd(),
  "node_modules",
  "7zip-bin",
  "win",
  "x64",
  "7za.exe"
)

const url =
  "https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-2.6.0/winCodeSign-2.6.0.7z"
const archivePath = path.join(cacheDir, "winCodeSign-2.6.0.7z")
const outDir = path.join(cacheDir, "winCodeSign-2.6.0")

fs.mkdirSync(cacheDir, { recursive: true })

console.log("Downloading winCodeSign...")
execSync(`curl -L -o "${archivePath}" "${url}"`, { stdio: "inherit" })

console.log("Extracting (ignoring symlink errors)...")
fs.mkdirSync(outDir, { recursive: true })
try {
  execSync(`"${sevenZip}" x -bd -y "${archivePath}" -o"${outDir}"`, {
    stdio: "inherit",
  })
} catch {
  console.log("Extraction had non-fatal errors (expected on Windows)")
}

console.log("Contents:", fs.readdirSync(outDir))
console.log("Done - cache is ready")

import { app, BrowserWindow, Menu, screen, utilityProcess } from "electron"
Menu.setApplicationMenu(null)
import type { UtilityProcess } from "electron"
import path from "path"
import net from "net"

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
  process.exit(0)
}

const isDev = process.env.NODE_ENV === "development"
const DEV_PORT = 3000

let mainWindow: BrowserWindow | null = null
let serverChild: UtilityProcess | null = null

const getFreePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = net.createServer()
    server.listen(0, () => {
      const address = server.address()
      if (address && typeof address !== "string") {
        const port = address.port
        server.close(() => resolve(port))
      } else {
        reject(new Error("Failed to get free port"))
      }
    })
    server.on("error", reject)
  })

const waitForServer = (port: number, retries = 50, delay = 300): Promise<void> =>
  new Promise((resolve, reject) => {
    const attempt = (remaining: number) => {
      const socket = net.createConnection({ port, host: "127.0.0.1" }, () => {
        socket.destroy()
        resolve()
      })
      socket.on("error", () => {
        if (remaining <= 0) {
          reject(new Error(`Server did not start on port ${port}`))
          return
        }
        setTimeout(() => attempt(remaining - 1), delay)
      })
    }
    attempt(retries)
  })

const startProductionServer = async (): Promise<number> => {
  const port = await getFreePort()
  const standaloneDir = path.join(process.resourcesPath, "standalone")
  const serverPath = path.join(standaloneDir, "server.js")

  serverChild = utilityProcess.fork(serverPath, [], {
    cwd: standaloneDir,
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
    },
    stdio: "pipe",
    serviceName: "next-server",
  })

  serverChild.stdout?.on("data", (data: Buffer) => {
    console.log(`[server] ${data.toString()}`)
  })

  serverChild.stderr?.on("data", (data: Buffer) => {
    console.error(`[server] ${data.toString()}`)
  })

  serverChild.on("exit", (code: number) => {
    console.log(`[server] exited with code ${code}`)
    serverChild = null
  })

  await waitForServer(port, 100, 300)
  return port
}

const killServer = () => {
  if (serverChild) {
    serverChild.kill()
    serverChild = null
  }
}

const createWindow = async () => {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  const iconPath = isDev
    ? path.join(__dirname, "..", "public", "icon.ico")
    : path.join(process.resourcesPath, "standalone", "public", "icon.ico")

  mainWindow = new BrowserWindow({
    width: Math.min(1400, width),
    height: Math.min(900, height),
    minWidth: 800,
    minHeight: 600,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
    title: "SDO Attendance System",
  })

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show()
  })

  mainWindow.on("closed", () => {
    mainWindow = null
  })

  try {
    let url: string

    if (isDev) {
      url = `http://localhost:${DEV_PORT}`
    } else {
      const port = await startProductionServer()
      url = `http://127.0.0.1:${port}`
    }

    await mainWindow.loadURL(url)
  } catch (err) {
    const standaloneDir = path.join(process.resourcesPath, "standalone")
    const hasServerJs = require("fs").existsSync(path.join(standaloneDir, "server.js"))
    const hasNodeModules = require("fs").existsSync(path.join(standaloneDir, "node_modules"))
    const hasEnv = require("fs").existsSync(path.join(standaloneDir, ".env.local"))

    mainWindow.show()
    mainWindow.webContents.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(`<h2>Failed to start</h2>
<pre>${String(err)}</pre>
<h3>Debug info</h3>
<pre>resourcesPath: ${process.resourcesPath}
server.js exists: ${hasServerJs}
node_modules exists: ${hasNodeModules}
.env.local exists: ${hasEnv}</pre>`)}`
    )
  }
}

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

app.whenReady().then(createWindow)

app.on("window-all-closed", () => {
  killServer()
  app.quit()
})

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on("before-quit", () => {
  killServer()
})

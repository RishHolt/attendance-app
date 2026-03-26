import { app, BrowserWindow, screen } from "electron"
import { spawn, ChildProcess } from "child_process"
import path from "path"
import net from "net"

const isDev = process.env.NODE_ENV === "development"
const DEV_PORT = 3000

let mainWindow: BrowserWindow | null = null
let serverProcess: ChildProcess | null = null

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
  const serverPath = path.join(process.resourcesPath, "standalone", "server.js")

  serverProcess = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
    },
    stdio: "pipe",
  })

  serverProcess.stdout?.on("data", (data: Buffer) => {
    console.log(`[server] ${data.toString()}`)
  })

  serverProcess.stderr?.on("data", (data: Buffer) => {
    console.error(`[server] ${data.toString()}`)
  })

  serverProcess.on("close", (code: number | null) => {
    console.log(`[server] exited with code ${code}`)
    serverProcess = null
  })

  await waitForServer(port)
  return port
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

  let url: string

  if (isDev) {
    url = `http://localhost:${DEV_PORT}`
  } else {
    const port = await startProductionServer()
    url = `http://127.0.0.1:${port}`
  }

  await mainWindow.loadURL(url)
}

app.whenReady().then(createWindow)

app.on("window-all-closed", () => {
  if (serverProcess) {
    serverProcess.kill()
    serverProcess = null
  }
  app.quit()
})

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on("before-quit", () => {
  if (serverProcess) {
    serverProcess.kill()
    serverProcess = null
  }
})

import Swal from "sweetalert2"

export const swal = {
  error: (message: string, title = "Error") =>
    Swal.fire({ icon: "error", title, text: message }),

  success: (message: string, title = "Success") =>
    Swal.fire({ icon: "success", title, text: message }),

  info: (message: string, title = "Info") =>
    Swal.fire({ icon: "info", title, text: message }),

  warning: (message: string, title = "Warning") =>
    Swal.fire({ icon: "warning", title, text: message }),
}

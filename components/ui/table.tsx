import type { ComponentPropsWithoutRef } from "react"

const tableCellBase = "py-4 px-4"
const tableHeadBase =
  "text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400"

const alignClasses = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
}

type TableProps = ComponentPropsWithoutRef<"table">

export const Table = ({ className = "", ...props }: TableProps) => (
  <table className={`w-full ${className}`.trim()} {...props} />
)

type TableHeaderProps = ComponentPropsWithoutRef<"thead">

export const TableHeader = ({ className = "", ...props }: TableHeaderProps) => (
  <thead className={className} {...props} />
)

type TableBodyProps = ComponentPropsWithoutRef<"tbody">

export const TableBody = ({ className = "", ...props }: TableBodyProps) => (
  <tbody
    className={`divide-y divide-zinc-200 dark:divide-zinc-800 ${className}`.trim()}
    {...props}
  />
)

type TableRowProps = ComponentPropsWithoutRef<"tr"> & {
  variant?: "header" | "body"
}

export const TableRow = ({
  variant = "body",
  className = "",
  ...props
}: TableRowProps) => {
  const variantClasses =
    variant === "header"
      ? "border-b border-zinc-200 dark:border-zinc-800"
      : "transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
  return (
    <tr
      className={`${variantClasses} ${className}`.trim()}
      {...props}
    />
  )
}

type TableHeadProps = ComponentPropsWithoutRef<"th"> & {
  align?: "left" | "center" | "right"
}

export const TableHead = ({
  align = "left",
  className = "",
  ...props
}: TableHeadProps) => (
  <th
    className={`${tableCellBase} ${tableHeadBase} ${alignClasses[align]} ${className}`.trim()}
    {...props}
  />
)

type TableCellProps = ComponentPropsWithoutRef<"td"> & {
  align?: "left" | "center" | "right"
}

export const TableCell = ({
  align = "left",
  className = "",
  ...props
}: TableCellProps) => (
  <td
    className={`${tableCellBase} ${alignClasses[align]} ${className}`.trim()}
    {...props}
  />
)

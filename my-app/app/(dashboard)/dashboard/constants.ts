import type { ColumnId } from "./types"

export const columns: { id: ColumnId; title: string; color: string }[] = [
  { id: "todo", title: "To-do", color: "bg-[var(--brand-primary-fixed)]" },
  { id: "inprogress", title: "In Progress", color: "bg-yellow-500" },
  { id: "revision", title: "Revision", color: "bg-orange-500" },
  { id: "completed", title: "Completed", color: "bg-green-500" },
]

export const people = [
  { name: "A", src: "" },
  { name: "B", src: "" },
  { name: "C", src: "" },
  { name: "D", src: "" },
]

export const cardStatusStyles: Record<
  ColumnId,
  { label: string; className: string }
> = {
  todo: {
    label: "Not Started",
    className: "bg-violet-100 text-violet-700",
  },
  inprogress: {
    label: "In Progress",
    className: "bg-amber-100 text-amber-700",
  },
  revision: {
    label: "Revision",
    className: "bg-orange-100 text-orange-700",
  },
  completed: {
    label: "Completed",
    className: "bg-emerald-100 text-emerald-700",
  },
}

"use client"

export type TodoStatus = "todo" | "inprogress" | "revision" | "completed"
export type TodoPriority = "low" | "medium" | "high"
export type TodoTaskType = "development" | "research" | "documentation" | "testing"

export type TodoItem = {
  id: string
  title: string
  assignee: string
  deadline: string
  priority: TodoPriority
  taskType: TodoTaskType
  description: string
  status: TodoStatus
  createdAt: string
}

const TODOS_STORAGE_KEY = "dashboard-todos"
const TODOS_CHANGED_EVENT = "dashboard-todos-changed"

function isTodoStatus(value: string): value is TodoStatus {
  return value === "todo" || value === "inprogress" || value === "revision" || value === "completed"
}

function isTodoPriority(value: string): value is TodoPriority {
  return value === "low" || value === "medium" || value === "high"
}

function isTodoTaskType(value: string): value is TodoTaskType {
  return value === "development" || value === "research" || value === "documentation" || value === "testing"
}

function normalizeTodo(raw: Partial<TodoItem>): TodoItem | null {
  if (!raw.id || !raw.title) {
    return null
  }

  return {
    id: raw.id,
    title: raw.title,
    assignee: raw.assignee ?? "",
    deadline: raw.deadline ?? "",
    priority: isTodoPriority(raw.priority ?? "") ? raw.priority : "medium",
    taskType: isTodoTaskType(raw.taskType ?? "") ? raw.taskType : "development",
    description: raw.description ?? "",
    status: isTodoStatus(raw.status ?? "") ? raw.status : "todo",
    createdAt: raw.createdAt ?? new Date().toISOString(),
  }
}

export function getTodos(): TodoItem[] {
  if (typeof window === "undefined") {
    return []
  }

  try {
    const raw = window.localStorage.getItem(TODOS_STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as Partial<TodoItem>[]
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .map((item) => normalizeTodo(item))
      .filter((item): item is TodoItem => item !== null)
  } catch {
    return []
  }
}

function setTodos(todos: TodoItem[]) {
  window.localStorage.setItem(TODOS_STORAGE_KEY, JSON.stringify(todos))
  window.dispatchEvent(new Event(TODOS_CHANGED_EVENT))
}

export function createTodo(
  input: Omit<TodoItem, "id" | "status" | "createdAt">
): TodoItem {
  const todos = getTodos()

  const nextTodo: TodoItem = {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    assignee: input.assignee.trim(),
    deadline: input.deadline,
    priority: input.priority,
    taskType: input.taskType,
    description: input.description.trim(),
    status: "todo",
    createdAt: new Date().toISOString(),
  }

  setTodos([nextTodo, ...todos])
  return nextTodo
}

export function subscribeTodos(onChange: () => void) {
  if (typeof window === "undefined") {
    return () => {}
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === TODOS_STORAGE_KEY) {
      onChange()
    }
  }

  window.addEventListener(TODOS_CHANGED_EVENT, onChange)
  window.addEventListener("storage", handleStorage)

  return () => {
    window.removeEventListener(TODOS_CHANGED_EVENT, onChange)
    window.removeEventListener("storage", handleStorage)
  }
}


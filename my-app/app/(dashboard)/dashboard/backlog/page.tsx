"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import type { BacklogApiItem } from "../types"
import { BacklogBoard } from "./components/backlog-board"
import { BacklogToolbar } from "./components/backlog-toolbar"
import { CreateWorkItemDialog } from "./components/create-work-item-dialog"
import { EditWorkItemDialog } from "./components/edit-work-item-dialog"
import { statusOptions, type WorkItem } from "./types"
import {
  findDashboardProject,
  getSelectedDashboardProjectId,
  PROJECT_CHANGE_EVENT,
} from "@/lib/projects"

function mapApiItem(item: BacklogApiItem): WorkItem {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    startDate: item.startDate ? new Date(item.startDate) : undefined,
    dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
    status: item.status,
    checked: item.checked,
    assigneeId: item.assigneeId ?? null,
  }
}

export default function BacklogPage() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [title, setTitle] = React.useState("")
  const [startDate, setStartDate] = React.useState<Date | undefined>()
  const [dueDate, setDueDate] = React.useState<Date | undefined>()
  const [description, setDescription] = React.useState("")

  const [items, setItems] = React.useState<WorkItem[]>([])

  const [editOpen, setEditOpen] = React.useState(false)
  const [editingItemId, setEditingItemId] = React.useState<string | null>(null)
  const [editTitle, setEditTitle] = React.useState("")
  const [editDescription, setEditDescription] = React.useState("")
  const [editStartDate, setEditStartDate] = React.useState<Date | undefined>()
  const [editDueDate, setEditDueDate] = React.useState<Date | undefined>()

  React.useEffect(() => {
    let cancelled = false

    async function loadItems() {
      const selectedProjectId = getSelectedDashboardProjectId()

      if (!selectedProjectId || !findDashboardProject(selectedProjectId)) {
        router.replace("/dashboard")
        return
      }

      try {
        const response = await fetch(`/api/backlog-items?projectId=${selectedProjectId}`, {
          cache: "no-store",
        })

        if (!response.ok) {
          throw new Error("Failed to load backlog items")
        }

        const data = (await response.json()) as { items: BacklogApiItem[] }

        if (!cancelled) {
          setItems(data.items.map(mapApiItem))
        }
      } catch (error) {
        console.error(error)
      }
    }

    void loadItems()
    window.addEventListener(PROJECT_CHANGE_EVENT, loadItems)

    return () => {
      cancelled = true
      window.removeEventListener(PROJECT_CHANGE_EVENT, loadItems)
    }
  }, [router])

  const resetForm = () => {
    setTitle("")
    setStartDate(undefined)
    setDueDate(undefined)
    setDescription("")
  }

  const handleAddItem = async () => {
    if (!title.trim()) return

    const selectedProjectId = getSelectedDashboardProjectId()

    if (!selectedProjectId) {
      router.replace("/dashboard")
      return
    }

    try {
      const response = await fetch("/api/backlog-items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: selectedProjectId,
          title: title.trim(),
          description: description.trim(),
          startDate: startDate ? startDate.toISOString().slice(0, 10) : null,
          dueDate: dueDate ? dueDate.toISOString().slice(0, 10) : null,
          assigneeId: null,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create backlog item")
      }

      const data = (await response.json()) as { item: BacklogApiItem }

      setItems((prev) => [mapApiItem(data.item), ...prev])
      resetForm()
      setOpen(false)
    } catch (error) {
      console.error(error)
    }
  }

  const updateItemStatus = async (id: string, nextStatus: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: nextStatus } : item))
    )

    try {
      const response = await fetch(`/api/backlog-items/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: nextStatus }),
      })

      if (!response.ok) {
        throw new Error("Failed to update backlog item status")
      }
    } catch (error) {
      console.error(error)
    }
  }

  const toggleCheckbox = async (id: string, checked: boolean) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked } : item))
    )

    try {
      const response = await fetch(`/api/backlog-items/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ checked }),
      })

      if (!response.ok) {
        throw new Error("Failed to update backlog item checkbox")
      }
    } catch (error) {
      console.error(error)
    }
  }

  const updateItemAssignee = async (id: string, assigneeId: string | null) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, assigneeId } : item))
    )

    try {
      const response = await fetch(`/api/backlog-items/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ assigneeId }),
      })

      if (!response.ok) {
        throw new Error("Failed to update backlog item assignee")
      }
    } catch (error) {
      console.error(error)
    }
  }

  const handleOpenEdit = (item: WorkItem) => {
    setEditingItemId(item.id)
    setEditTitle(item.title)
    setEditDescription(item.description)
    setEditStartDate(item.startDate)
    setEditDueDate(item.dueDate)
    setEditOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!editingItemId || !editTitle.trim()) return

    setItems((prev) =>
      prev.map((item) =>
        item.id === editingItemId
          ? {
              ...item,
              title: editTitle.trim(),
              description: editDescription.trim(),
              startDate: editStartDate,
              dueDate: editDueDate,
            }
          : item
      )
    )

    try {
      const response = await fetch(`/api/backlog-items/${editingItemId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim(),
          startDate: editStartDate ? editStartDate.toISOString().slice(0, 10) : null,
          dueDate: editDueDate ? editDueDate.toISOString().slice(0, 10) : null,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to update backlog item")
      }

      setEditOpen(false)
      setEditingItemId(null)
      setEditTitle("")
      setEditDescription("")
      setEditStartDate(undefined)
      setEditDueDate(undefined)
    } catch (error) {
      console.error(error)
    }
  }

  const handleDeleteItem = async (id: string) => {
    const previousItems = items
    setItems((prev) => prev.filter((item) => item.id !== id))

    try {
      const response = await fetch(`/api/backlog-items/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete backlog item")
      }
    } catch (error) {
      console.error(error)
      setItems(previousItems)
    }
  }

  const statusCounts = statusOptions.map((status) => ({
    ...status,
    count: items.filter((item) => item.status === status.value).length,
  }))

  return (
    <div className="min-h-screen space-y-6 bg-white p-4">
      <BacklogToolbar />

      <BacklogBoard
        items={items}
        statusCounts={statusCounts}
        onToggleCheckbox={toggleCheckbox}
        onUpdateStatus={updateItemStatus}
        onUpdateAssignee={updateItemAssignee}
        onEditItem={handleOpenEdit}
        onDeleteItem={handleDeleteItem}
        onOpenCreate={() => setOpen(true)}
      />

      <CreateWorkItemDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        startDate={startDate}
        dueDate={dueDate}
        description={description}
        onTitleChange={setTitle}
        onStartDateChange={setStartDate}
        onDueDateChange={setDueDate}
        onDescriptionChange={setDescription}
        onAddItem={handleAddItem}
      />

      <EditWorkItemDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title={editTitle}
        description={editDescription}
        startDate={editStartDate}
        dueDate={editDueDate}
        onTitleChange={setEditTitle}
        onDescriptionChange={setEditDescription}
        onStartDateChange={setEditStartDate}
        onDueDateChange={setEditDueDate}
        onSave={handleSaveEdit}
      />
    </div>
  )
}

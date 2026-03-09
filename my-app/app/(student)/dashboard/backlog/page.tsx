"use client"

import * as React from "react"
import { buildApiUrl } from "@/lib/api"
import { BacklogBoard } from "./components/backlog-board"
import { BacklogToolbar } from "./components/backlog-toolbar"
import { CreateWorkItemDialog } from "./components/create-work-item-dialog"
import { EditWorkItemDialog } from "./components/edit-work-item-dialog"
import { statusOptions, type UploadItem, type WorkItem } from "./types"

type BacklogApiItem = {
  id: string
  title: string
  description: string
  dueDate: string | null
  status: string
  checked: boolean
  file: UploadItem | null
  assigneeId?: string | null
}

function mapApiItem(item: BacklogApiItem): WorkItem {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
    status: item.status,
    checked: item.checked,
    file: item.file,
    assigneeId: item.assigneeId ?? null,
  }
}

export default function BacklogPage() {
  const [open, setOpen] = React.useState(false)
  const [title, setTitle] = React.useState("")
  const [dueDate, setDueDate] = React.useState<Date | undefined>()
  const [description, setDescription] = React.useState("")
  const [uploadedFile, setUploadedFile] = React.useState<UploadItem | null>(null)

  const [items, setItems] = React.useState<WorkItem[]>([])

  const [editOpen, setEditOpen] = React.useState(false)
  const [editingItemId, setEditingItemId] = React.useState<string | null>(null)
  const [editTitle, setEditTitle] = React.useState("")
  const [editDescription, setEditDescription] = React.useState("")

  React.useEffect(() => {
    let cancelled = false

    async function loadItems() {
      try {
        const response = await fetch(buildApiUrl("/api/backlog-items"), {
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

    return () => {
      cancelled = true
    }
  }, [])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const sizeInKb = file.size / 1024
    const formattedSize =
      sizeInKb < 1024
        ? `${sizeInKb.toFixed(1)} KB`
        : `${(sizeInKb / 1024).toFixed(1)} MB`

    setUploadedFile({
      name: file.name,
      size: formattedSize,
      type: file.type || "File",
    })
  }

  const removeFile = () => {
    setUploadedFile(null)
  }

  const resetForm = () => {
    setTitle("")
    setDueDate(undefined)
    setDescription("")
    setUploadedFile(null)
  }

  const handleAddItem = async () => {
    if (!title.trim()) return

    try {
      const response = await fetch(buildApiUrl("/api/backlog-items"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          dueDate: dueDate ? dueDate.toISOString().slice(0, 10) : null,
          file: uploadedFile,
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
      const response = await fetch(buildApiUrl(`/api/backlog-items/${id}`), {
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
      const response = await fetch(buildApiUrl(`/api/backlog-items/${id}`), {
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
      const response = await fetch(buildApiUrl(`/api/backlog-items/${id}`), {
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
            }
          : item
      )
    )

    try {
      const response = await fetch(
        buildApiUrl(`/api/backlog-items/${editingItemId}`),
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: editTitle.trim(),
            description: editDescription.trim(),
          }),
        }
      )

      if (!response.ok) {
        throw new Error("Failed to update backlog item")
      }

      setEditOpen(false)
      setEditingItemId(null)
      setEditTitle("")
      setEditDescription("")
    } catch (error) {
      console.error(error)
    }
  }

  const handleDeleteItem = async (id: string) => {
    const previousItems = items
    setItems((prev) => prev.filter((item) => item.id !== id))

    try {
      const response = await fetch(buildApiUrl(`/api/backlog-items/${id}`), {
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
        dueDate={dueDate}
        description={description}
        uploadedFile={uploadedFile}
        onTitleChange={setTitle}
        onDueDateChange={setDueDate}
        onDescriptionChange={setDescription}
        onFileChange={handleFileChange}
        onRemoveFile={removeFile}
        onAddItem={handleAddItem}
      />

      <EditWorkItemDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title={editTitle}
        description={editDescription}
        onTitleChange={setEditTitle}
        onDescriptionChange={setEditDescription}
        onSave={handleSaveEdit}
      />
    </div>
  )
}

"use client"

import { ArrowUpRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  PROJECT_DESCRIPTION_MAX_LENGTH,
  PROJECT_TITLE_MAX_LENGTH,
} from "@/lib/projects"

type CreateProjectDialogProps = {
  memberSearch: string
  onCreateProject: () => Promise<unknown>
  onMemberSearchChange: (value: string) => void
  onOpenChange: (open: boolean) => void
  onProjectDescriptionChange: (value: string) => void
  onProjectTitleChange: (value: string) => void
  open: boolean
  projectDescription: string
  projectTitle: string
}

export function CreateProjectDialog({
  memberSearch,
  onCreateProject,
  onMemberSearchChange,
  onOpenChange,
  onProjectDescriptionChange,
  onProjectTitleChange,
  open,
  projectDescription,
  projectTitle,
}: CreateProjectDialogProps) {
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await onCreateProject()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden border-border/70 p-0 sm:max-w-xl">
        <div className="border-b border-border/70 bg-gradient-to-br from-slate-50 via-white to-slate-100 px-5 py-4">
          <DialogHeader className="gap-3 text-left">
            <DialogTitle className="text-xl font-semibold tracking-tight">
              Create new project
            </DialogTitle>
            <DialogDescription className="max-w-xl text-sm leading-6">
              Set up a new thesis project with a clear title, a focused summary, and
              the people who will own delivery.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form className="space-y-5 px-5 py-5" onSubmit={handleSubmit}>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <label htmlFor="project-title" className="text-sm font-medium text-slate-900">
                Project title
              </label>
              <Input
                id="project-title"
                value={projectTitle}
                onChange={(event) => onProjectTitleChange(event.target.value)}
                maxLength={PROJECT_TITLE_MAX_LENGTH}
                placeholder="Capstone Progress Tracker"
                className="h-9 border-border/70 bg-white text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {projectTitle.length}/{PROJECT_TITLE_MAX_LENGTH}
              </p>
            </div>

            <div className="grid gap-2">
              <label htmlFor="project-description" className="text-sm font-medium text-slate-900">
                Short description
              </label>
              <Textarea
                id="project-description"
                value={projectDescription}
                onChange={(event) => onProjectDescriptionChange(event.target.value)}
                maxLength={PROJECT_DESCRIPTION_MAX_LENGTH}
                placeholder="Summarize the scope, milestones, and the main outcome for this project."
                className="min-h-20 resize-none border-border/70 bg-white px-3 py-2 text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {projectDescription.length}/{PROJECT_DESCRIPTION_MAX_LENGTH}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-slate-50/80 p-3.5">
            <h3 className="text-sm font-medium text-slate-900">Choose member</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Search the member name you want to assign to this project.
            </p>

            <div className="mt-4">
              <Input
                value={memberSearch}
                onChange={(event) => onMemberSearchChange(event.target.value)}
                placeholder="Search member by name"
                className="h-9 border-border/70 bg-white text-sm"
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/70 pt-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="gap-2 bg-[#2972b6] text-white hover:bg-[#215f98]"
              disabled={
                !projectTitle.trim() ||
                !projectDescription.trim() ||
                !memberSearch.trim()
              }
            >
              Create project
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

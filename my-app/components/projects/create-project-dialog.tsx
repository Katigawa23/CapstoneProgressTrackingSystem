"use client"

import * as React from "react"
import { ArrowUpRight, ChevronDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  OTHER_PROJECT_OPTION,
  PROJECT_DESCRIPTION_MAX_LENGTH,
  PROJECT_PROGRAM_OPTIONS,
  PROJECT_SY_TERM_OPTIONS,
  PROJECT_TYPE_OPTIONS,
  PROJECT_TITLE_MAX_LENGTH,
  PROJECT_YEAR_LEVEL_OPTIONS,
} from "@/lib/projects"

type CreateProjectDialogProps = {
  memberSearch: string
  onCreateProject: () => Promise<unknown>
  onMemberSearchChange: (value: string) => void
  onOpenChange: (open: boolean) => void
  onProjectDescriptionChange: (value: string) => void
  onProjectProgramChange: (value: string) => void
  onProjectProgramOtherChange: (value: string) => void
  onProjectSyTermChange: (value: string) => void
  onProjectTitleChange: (value: string) => void
  onProjectTypeChange: (value: string) => void
  onProjectTypeOtherChange: (value: string) => void
  onProjectYearLevelChange: (value: string) => void
  onProjectYearLevelOtherChange: (value: string) => void
  open: boolean
  projectDescription: string
  projectProgram: string
  projectProgramOther: string
  projectSyTerm: string
  projectTitle: string
  projectType: string
  projectTypeOther: string
  projectYearLevel: string
  projectYearLevelOther: string
}

type ProjectSelectFieldProps = {
  allowCustomValue?: boolean
  customPlaceholder: string
  customValue: string
  id: string
  label: string
  onCustomValueChange: (value: string) => void
  onValueChange: (value: string) => void
  options: readonly string[]
  placeholder: string
  reserveFooterSpace?: boolean
  value: string
}

function ProjectSelectField({
  allowCustomValue = true,
  customPlaceholder,
  customValue,
  id,
  label,
  onCustomValueChange,
  onValueChange,
  options,
  placeholder,
  reserveFooterSpace = false,
  value,
}: ProjectSelectFieldProps) {
  const displayValue = value === OTHER_PROJECT_OPTION ? customValue : value
  const [open, setOpen] = React.useState(false)
  const closeTimeoutRef = React.useRef<number | null>(null)
  const inputRef = React.useRef<HTMLInputElement | null>(null)

  const filteredOptions = React.useMemo(() => {
    const query = displayValue.trim().toLowerCase()

    if (!query) {
      return options
    }

    return options.filter((option) => option.toLowerCase().includes(query))
  }, [displayValue, options])

  React.useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current)
      }
    }
  }, [])

  function handleCustomFieldChange(nextValue: string) {
    const matchedOption = options.find((option) => option === nextValue)

    if (matchedOption === "Other") {
      onValueChange(OTHER_PROJECT_OPTION)
      onCustomValueChange("")
      return
    }

    if (matchedOption) {
      onValueChange(matchedOption)
      onCustomValueChange("")
      return
    }

    onValueChange(OTHER_PROJECT_OPTION)
    onCustomValueChange(nextValue)
    setOpen(true)
  }

  function handleOptionSelect(option: string) {
    if (option === "Other") {
      onValueChange(OTHER_PROJECT_OPTION)
      onCustomValueChange("")
      setOpen(true)
      window.requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
      return
    }

    onValueChange(option)
    onCustomValueChange("")
    setOpen(false)
  }

  function handleInputFocus() {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }

    setOpen(true)
  }

  function handleInputBlur() {
    closeTimeoutRef.current = window.setTimeout(() => {
      setOpen(false)
      closeTimeoutRef.current = null
    }, 120)
  }

  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-medium text-slate-900">
        {label}
      </label>
      {allowCustomValue ? (
        <div className="relative">
          <Input
            id={id}
            ref={inputRef}
            value={displayValue}
            onChange={(event) => handleCustomFieldChange(event.target.value)}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            placeholder={value === OTHER_PROJECT_OPTION ? customPlaceholder : placeholder}
            className="h-9 border-border/70 bg-white pr-9 text-sm"
          />
          <button
            type="button"
            onMouseDown={(event) => {
              event.preventDefault()
              setOpen((currentOpen) => !currentOpen)
              inputRef.current?.focus()
            }}
            className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center text-muted-foreground/70"
            aria-label={`Toggle ${label} options`}
          >
            <ChevronDown className="h-4 w-4" />
          </button>

          {open ? (
            <div className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-50 overflow-hidden rounded-md border border-border bg-white shadow-md">
              <div className="max-h-52 overflow-y-auto p-1">
                {filteredOptions.length > 0 ? (
                  filteredOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault()
                        handleOptionSelect(option)
                      }}
                      className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100"
                    >
                      {option}
                    </button>
                  ))
                ) : (
                  <div className="px-2 py-2 text-sm text-muted-foreground">
                    No matching option.
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <Select value={value} onValueChange={onValueChange}>
          <SelectTrigger
            id={id}
            className="w-full border-border/70 bg-white text-sm"
            aria-label={label}
          >
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem
                key={option}
                value={option === "Other" ? OTHER_PROJECT_OPTION : option}
              >
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {reserveFooterSpace ? (
        <p aria-hidden="true" className="text-xs text-transparent select-none">
          0/00
        </p>
      ) : null}
    </div>
  )
}

export function CreateProjectDialog({
  memberSearch,
  onCreateProject,
  onMemberSearchChange,
  onOpenChange,
  onProjectDescriptionChange,
  onProjectProgramChange,
  onProjectProgramOtherChange,
  onProjectSyTermChange,
  onProjectTitleChange,
  onProjectTypeChange,
  onProjectTypeOtherChange,
  onProjectYearLevelChange,
  onProjectYearLevelOtherChange,
  open,
  projectDescription,
  projectProgram,
  projectProgramOther,
  projectSyTerm,
  projectTitle,
  projectType,
  projectTypeOther,
  projectYearLevel,
  projectYearLevelOther,
}: CreateProjectDialogProps) {
  const isProgramComplete =
    projectProgram.trim().length > 0 &&
    (projectProgram !== OTHER_PROJECT_OPTION || projectProgramOther.trim().length > 0)
  const isYearLevelComplete = projectYearLevel.trim().length > 0
  const isSyTermComplete = projectSyTerm.trim().length > 0
  const isProjectTypeComplete =
    projectType.trim().length > 0 &&
    (projectType !== OTHER_PROJECT_OPTION || projectTypeOther.trim().length > 0)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await onCreateProject()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden border-border/70 p-0 sm:max-w-xl">
        <div className="border-b border-border/70 bg-gradient-to-br from-slate-50 via-white to-slate-100 px-5 py-3.5">
          <DialogHeader className="gap-2 text-left">
            <DialogTitle className="text-xl font-semibold tracking-tight">
              Create new project
            </DialogTitle>
          </DialogHeader>
        </div>

        <form className="space-y-4 px-5 py-4" onSubmit={handleSubmit}>
          <div className="grid gap-3 sm:grid-cols-2">
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

            <ProjectSelectField
              id="project-program"
              label="Program"
              value={projectProgram}
              onValueChange={onProjectProgramChange}
              options={PROJECT_PROGRAM_OPTIONS}
              placeholder="Select a program"
              customValue={projectProgramOther}
              onCustomValueChange={onProjectProgramOtherChange}
              customPlaceholder="Enter program"
              reserveFooterSpace
            />

            <div className="grid gap-2 sm:col-span-2">
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

            <ProjectSelectField
              id="project-year-level"
              label="Year level"
              value={projectYearLevel}
              onValueChange={onProjectYearLevelChange}
              options={PROJECT_YEAR_LEVEL_OPTIONS}
              placeholder="Select a year level"
              allowCustomValue={false}
              customValue={projectYearLevelOther}
              onCustomValueChange={onProjectYearLevelOtherChange}
              customPlaceholder="Enter year level"
            />

            <ProjectSelectField
              id="project-sy-term"
              label="SY term"
              value={projectSyTerm}
              onValueChange={onProjectSyTermChange}
              options={PROJECT_SY_TERM_OPTIONS}
              placeholder="Select a term"
              allowCustomValue={false}
              customValue=""
              onCustomValueChange={() => undefined}
              customPlaceholder=""
            />

            <ProjectSelectField
              id="project-type"
              label="Project type"
              value={projectType}
              onValueChange={onProjectTypeChange}
              options={PROJECT_TYPE_OPTIONS}
              placeholder="Select a project type"
              customValue={projectTypeOther}
              onCustomValueChange={onProjectTypeOtherChange}
              customPlaceholder="Enter project type"
            />

            <div className="grid gap-2">
              <label htmlFor="project-member" className="text-sm font-medium text-slate-900">
                Member
              </label>
              <Input
                id="project-member"
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
                !isProgramComplete ||
                !isYearLevelComplete ||
                !isSyTermComplete ||
                !isProjectTypeComplete ||
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

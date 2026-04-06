"use client"

import * as React from "react"
import { ArrowUpRight } from "lucide-react"

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
import {
  OTHER_PROJECT_OPTION,
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
  onProjectProgramChange: (value: string) => void
  onProjectProgramOtherChange: (value: string) => void
  onProjectSyTermChange: (value: string) => void
  onProjectSyTermOtherChange: (value: string) => void
  onProjectTitleChange: (value: string) => void
  onProjectTypeChange: (value: string) => void
  onProjectTypeOtherChange: (value: string) => void
  onProjectYearLevelChange: (value: string) => void
  onProjectYearLevelOtherChange: (value: string) => void
  open: boolean
  projectProgram: string
  projectProgramOther: string
  projectSyTerm: string
  projectSyTermOther: string
  projectTitle: string
  projectType: string
  projectTypeOther: string
  projectYearLevel: string
  projectYearLevelOther: string
}

type SelectWithCustomInputProps = {
  customInputPlaceholder: string
  customValue: string
  id: string
  label: string
  onCustomValueChange: (value: string) => void
  onValueChange: (value: string) => void
  options: readonly string[]
  placeholder: string
  value: string
}

function SelectWithCustomInput({
  customInputPlaceholder,
  customValue,
  id,
  label,
  onCustomValueChange,
  onValueChange,
  options,
  placeholder,
  value,
}: SelectWithCustomInputProps) {
  const isOtherSelected = value === OTHER_PROJECT_OPTION
  const inputId = `${id}-custom`

  React.useEffect(() => {
    if (!isOtherSelected) {
      onCustomValueChange("")
    }
  }, [isOtherSelected, onCustomValueChange])

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-slate-900">
        {label}
      </label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger
          id={id}
          className="w-full border-border/70 bg-white text-sm h-9"
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

      <Input
        id={inputId}
        value={customValue}
        onChange={(event) => onCustomValueChange(event.target.value)}
        placeholder={customInputPlaceholder}
        className={`h-9 border-border/70 bg-white text-sm transition-all duration-200 ${
          isOtherSelected ? "opacity-100" : "h-0 overflow-hidden opacity-0"
        }`}
        autoFocus={isOtherSelected}
        aria-hidden={!isOtherSelected}
      />
    </div>
  )
}

export function CreateProjectDialog({
  memberSearch,
  onCreateProject,
  onMemberSearchChange,
  onOpenChange,
  onProjectProgramChange,
  onProjectProgramOtherChange,
  onProjectSyTermChange,
  onProjectSyTermOtherChange,
  onProjectTitleChange,
  onProjectTypeChange,
  onProjectTypeOtherChange,
  onProjectYearLevelChange,
  onProjectYearLevelOtherChange,
  open,
  projectProgram,
  projectProgramOther,
  projectSyTerm,
  projectSyTermOther,
  projectTitle,
  projectType,
  projectTypeOther,
  projectYearLevel,
  projectYearLevelOther,
}: CreateProjectDialogProps) {
  const isProgramComplete =
    projectProgram.trim().length > 0 &&
    (projectProgram !== OTHER_PROJECT_OPTION || projectProgramOther.trim().length > 0)
  const isYearLevelComplete =
    projectYearLevel.trim().length > 0 &&
    (projectYearLevel !== OTHER_PROJECT_OPTION || projectYearLevelOther.trim().length > 0)
  const isSyTermComplete =
    projectSyTerm.trim().length > 0 &&
    (projectSyTerm !== OTHER_PROJECT_OPTION || projectSyTermOther.trim().length > 0)
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
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
              <p className="text-xs text-muted-foreground mt-0.5">
                {projectTitle.length}/{PROJECT_TITLE_MAX_LENGTH}
              </p>
            </div>

            <SelectWithCustomInput
              id="project-program"
              label="Program"
              value={projectProgram}
              onValueChange={onProjectProgramChange}
              options={PROJECT_PROGRAM_OPTIONS}
              placeholder="Select a program"
              customValue={projectProgramOther}
              onCustomValueChange={onProjectProgramOtherChange}
              customInputPlaceholder="Enter program"
            />

            <SelectWithCustomInput
              id="project-type"
              label="Project type"
              value={projectType}
              onValueChange={onProjectTypeChange}
              options={PROJECT_TYPE_OPTIONS}
              placeholder="Select a project type"
              customValue={projectTypeOther}
              onCustomValueChange={onProjectTypeOtherChange}
              customInputPlaceholder="Enter project type"
            />

            <SelectWithCustomInput
              id="project-year-level"
              label="Year level"
              value={projectYearLevel}
              onValueChange={onProjectYearLevelChange}
              options={PROJECT_YEAR_LEVEL_OPTIONS}
              placeholder="Select a year level"
              customValue={projectYearLevelOther}
              onCustomValueChange={onProjectYearLevelOtherChange}
              customInputPlaceholder="Enter year level"
            />

            <SelectWithCustomInput
              id="project-sy-term"
              label="SY term"
              value={projectSyTerm}
              onValueChange={onProjectSyTermChange}
              options={PROJECT_SY_TERM_OPTIONS}
              placeholder="Select a term"
              customValue={projectSyTermOther}
              onCustomValueChange={onProjectSyTermOtherChange}
              customInputPlaceholder="Enter academic term"
            />

            <div className="flex flex-col gap-2">
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

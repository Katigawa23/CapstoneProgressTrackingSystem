"use client"

import * as React from "react"
import { ArrowUpRight, Check, CircleUserRound, Loader2, Search, UserRound, X } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover"
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
import type { ProjectMemberOption } from "@/hooks/use-dashboard-projects"

type CreateProjectDialogProps = {
  memberSearch: string
  memberOptions: ProjectMemberOption[]
  memberOptionsLoading: boolean
  onCreateProject: () => Promise<unknown>
  onMemberRemove: (memberId: string) => void
  onMemberSearchChange: (value: string) => void
  onMemberSelect: (member: ProjectMemberOption) => void
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
  titleError?: string | null
  isSubmitting?: boolean
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
  selectedMembers: ProjectMemberOption[]
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

function getMemberRoleLabel(role: string) {
  return role === "student" ? "Student" : "Adviser"
}

function getMemberDisplayName(name: string) {
  return name
    .trim()
    .replace(/\s*\((student|faculty|adviser)\)\s*$/i, "")
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
      <label htmlFor={id} className="text-sm font-medium text-slate-900 dark:text-slate-100">
        {label} <span className="text-red-500">*</span>
      </label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger
          id={id}
          className="h-8 w-full rounded-[2px] border-border/70 bg-white text-sm dark:border-[#343434] dark:bg-[#1f1f1f] dark:text-slate-100"
          aria-label={label}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="dark:border-[#343434] dark:bg-[#1f1f1f] dark:text-slate-100">
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
        className={`h-8 rounded-[2px] border-border/70 bg-white text-sm transition-all duration-200 dark:border-[#343434] dark:bg-[#1f1f1f] dark:text-slate-100 dark:placeholder:text-slate-500 ${
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
  memberOptions,
  memberOptionsLoading,
  onCreateProject,
  onMemberRemove,
  onMemberSearchChange,
  onMemberSelect,
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
  titleError = null,
  isSubmitting = false,
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
  selectedMembers,
}: CreateProjectDialogProps) {
  const [memberPickerOpen, setMemberPickerOpen] = React.useState(false)
  const [memberPickerWidth, setMemberPickerWidth] = React.useState(0)
  const memberPickerRef = React.useRef<HTMLDivElement | null>(null)
  const isProgramComplete =
    projectProgram.trim().length > 0 &&
    (projectProgram !== OTHER_PROJECT_OPTION || projectProgramOther.trim().length > 0)
  const isYearLevelComplete =
    projectYearLevel.trim().length > 0 &&
    (projectYearLevel !== OTHER_PROJECT_OPTION || projectYearLevelOther.trim().length > 0)
  const isSyTermComplete =
    projectSyTerm.trim().length > 0
  const isProjectTypeComplete =
    projectType.trim().length > 0 &&
    (projectType !== OTHER_PROJECT_OPTION || projectTypeOther.trim().length > 0)

  React.useEffect(() => {
    if (!open) {
      setMemberPickerOpen(false)
    }
  }, [open])

  React.useLayoutEffect(() => {
    if (!memberPickerOpen) {
      return
    }

    const updateMemberPickerWidth = () => {
      if (memberPickerRef.current) {
        setMemberPickerWidth(memberPickerRef.current.getBoundingClientRect().width)
      }
    }

    updateMemberPickerWidth()
    window.addEventListener("resize", updateMemberPickerWidth)

    return () => {
      window.removeEventListener("resize", updateMemberPickerWidth)
    }
  }, [memberPickerOpen])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) {
      return
    }
    await onCreateProject()
  }

  function getInitials(name: string) {
    return getMemberDisplayName(name)
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-[2px] border-border/70 bg-white px-5 py-4 dark:border-[#343434] dark:bg-[#171717] sm:max-w-xl">
        <div className="border-b border-border/70 pb-2 dark:border-[#343434]">
          <DialogHeader className="gap-2 text-left">
            <DialogTitle className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Create new project
            </DialogTitle>
          </DialogHeader>
        </div>

        <form className="flex min-h-0 flex-1 flex-col gap-3 py-1" onSubmit={handleSubmit}>
          <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto pr-1 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="project-title" className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Project title <span className="text-red-500">*</span>
              </label>
              <Input
                id="project-title"
                value={projectTitle}
                onChange={(event) => onProjectTitleChange(event.target.value)}
                maxLength={PROJECT_TITLE_MAX_LENGTH}
                placeholder="Capstone Progress Tracker"
                className="h-8 rounded-[2px] border-border/70 bg-white text-sm dark:border-[#343434] dark:bg-[#1f1f1f] dark:text-slate-100 dark:placeholder:text-slate-500"
              />
              {titleError ? (
                <p className="text-xs text-red-500">{titleError}</p>
              ) : null}
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
              <label htmlFor="project-member" className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Members <span className="text-red-500">*</span>
              </label>
              <Popover open={memberPickerOpen} onOpenChange={setMemberPickerOpen}>
                <PopoverAnchor asChild>
                  <div ref={memberPickerRef} className="relative">
                    <Search className="pointer-events-none absolute left-3 top-[18px] h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="project-member"
                      value={memberSearch}
                      onPointerDown={() => setMemberPickerOpen(true)}
                      onClick={() => setMemberPickerOpen(true)}
                      onFocus={() => setMemberPickerOpen(true)}
                      onChange={(event) => {
                        onMemberSearchChange(event.target.value)
                        setMemberPickerOpen(true)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          setMemberPickerOpen(false)
                        }
                      }}
                      placeholder="Search members"
                      autoComplete="off"
                      className="h-8 rounded-[2px] border-border/70 bg-white pr-9 pl-9 text-sm dark:border-[#343434] dark:bg-[#1f1f1f] dark:text-slate-100 dark:placeholder:text-slate-500"
                    />
                    {memberSearch ? (
                      <button
                        type="button"
                        onClick={() => {
                          onMemberSearchChange("")
                          setMemberPickerOpen(true)
                        }}
                        className="absolute right-2 top-[18px] inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-[#2a2a2a] dark:hover:text-slate-200"
                        aria-label="Clear member search"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                </PopoverAnchor>

                <PopoverContent
                  align="start"
                  sideOffset={6}
                  onOpenAutoFocus={(event) => event.preventDefault()}
                  className="z-[80] overflow-hidden rounded-[2px] border border-slate-200 bg-white p-1 shadow-[0_18px_38px_rgba(15,23,42,0.12)] dark:border-[#343434] dark:bg-[#1b1b1b]"
                  style={{ width: memberPickerWidth || undefined }}
                >
                    {memberOptionsLoading ? (
                      <div className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-slate-500 dark:text-slate-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading users...
                      </div>
                    ) : memberOptions.length > 0 ? (
                      <Command className="rounded-lg bg-transparent">
                        <CommandList className="max-h-[260px]">
                          <CommandGroup className="p-0">
                            {memberOptions.map((member) => {
                              const isSelected = selectedMembers.some(
                                (selectedMember) => selectedMember.id === member.id
                              )

                              return (
                                <CommandItem
                                  key={member.id}
                                  value={`${member.name} ${member.email}`}
                                  onMouseDown={(event) => event.preventDefault()}
                                  onSelect={() => {
                                    onMemberSelect(member)
                                    setMemberPickerOpen(false)
                                  }}
                                  className="flex items-start gap-3 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100"
                                >
                                  <Avatar className="mt-0.5 h-8 w-8">
                                    <AvatarFallback className="text-[10px]">
                                      {getInitials(member.name) || <UserRound className="h-3.5 w-3.5" />}
                                    </AvatarFallback>
                                  </Avatar>

                                  <div className="min-w-0 flex-1 leading-tight">
                                    <div className="truncate text-[13px] font-medium">
                                      {getMemberDisplayName(member.name)} ({getMemberRoleLabel(member.role)})
                                    </div>
                                    <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                                      {member.email}
                                    </div>
                                  </div>

                                  <Check
                                    className={`mt-1 h-4 w-4 ${
                                      isSelected ? "opacity-100 text-sky-600 dark:text-sky-400" : "opacity-0"
                                    }`}
                                  />
                                </CommandItem>
                              )
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    ) : (
                      <Command className="rounded-lg bg-transparent">
                        <CommandEmpty className="flex py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                          No registered users found.
                        </CommandEmpty>
                      </Command>
                    )}
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                {selectedMembers.length > 0
                  ? `${selectedMembers.length} participant${selectedMembers.length === 1 ? "" : "s"} selected`
                  : ""}
              </p>
            </div>

            {selectedMembers.length > 0 ? (
              <div className="sm:col-span-2">
                <div className="overflow-hidden rounded-[2px] border border-slate-200 bg-white dark:border-[#343434] dark:bg-[#1b1b1b]">
                  <div className="grid grid-cols-[minmax(0,1fr)_36px] border-b border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 dark:border-[#343434] dark:text-slate-400">
                    <span>Member</span>
                    <span className="sr-only">Remove</span>
                  </div>

                  <div className="divide-y divide-slate-200 dark:divide-[#343434]">
                    {selectedMembers.map((member) => (
                      <div
                        key={member.id}
                        className="grid grid-cols-[minmax(0,1fr)_36px] items-center gap-3 px-3 py-2"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <CircleUserRound className="h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-slate-400" />
                          <div className="truncate text-sm text-slate-900 dark:text-slate-100">
                            {getMemberDisplayName(member.name)} ({getMemberRoleLabel(member.role)})
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => onMemberRemove(member.id)}
                          className="inline-flex h-7 w-7 items-center justify-center justify-self-end rounded-[2px] text-slate-400 transition hover:bg-slate-100 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-slate-500 dark:hover:bg-[#2a2a2a] dark:hover:text-red-400"
                          aria-label={`Remove ${getMemberDisplayName(member.name)}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter className="justify-end gap-2 border-t border-border/70 pt-2.5 dark:border-[#343434]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 min-w-24 rounded-[2px]"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              style={{
                backgroundColor: "var(--brand-primary-fixed)",
                color: "var(--brand-primary-fixed-foreground)",
              }}
              className="h-8 min-w-24 rounded-[2px] gap-2 hover:opacity-90"
              disabled={
                isSubmitting ||
                !projectTitle.trim() ||
                !isProgramComplete ||
                !isYearLevelComplete ||
                !isSyTermComplete ||
                !isProjectTypeComplete ||
                selectedMembers.length === 0
              }
            >
              {isSubmitting ? "Creating..." : "Create project"}
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

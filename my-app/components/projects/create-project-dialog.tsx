"use client"

import * as React from "react"
import { ArrowUpRight, Check, CircleUserRound, Loader2, Search, UserRound, X } from "lucide-react"
import { hasInvalidTaskTitleCharacters, TASK_TITLE_CHARACTERS_ERROR } from "@/lib/text-validation"
import { isProjectWorkflowPreset, projectWorkflowPresets, type ProjectWorkflowPreset } from "@/lib/project-workflow-presets"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Command,
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
  isResearchApproach,
  isThesisGroupType,
  OTHER_PROJECT_OPTION,
  PROJECT_PROGRAM_OPTIONS,
  PROJECT_SY_TERM_OPTIONS,
  PROJECT_TYPE_OPTIONS,
  PROJECT_TITLE_MAX_LENGTH,
  PROJECT_YEAR_LEVEL_OPTIONS,
  researchApproaches,
  type ResearchApproach,
} from "@/lib/projects"
import type { ProjectMemberOption } from "@/hooks/use-dashboard-projects"

type CreateProjectDialogProps = {
  adviserOptions: ProjectMemberOption[]
  adviserOptionsError: boolean
  adviserOptionsLoading: boolean
  adviserSearch: string
  memberSearch: string
  memberOptions: ProjectMemberOption[]
  memberOptionsError: boolean
  memberOptionsLoading: boolean
  onCreateProject: (workflowPreset: ProjectWorkflowPreset, researchApproach?: ResearchApproach) => Promise<unknown>
  onAdviserRemove: (adviserId: string) => void
  onAdviserSearchChange: (value: string) => void
  onAdviserSelect: (adviser: ProjectMemberOption) => void
  onMemberRemove: (memberId: string) => void
  onMemberSearchChange: (value: string) => void
  onMemberSelect: (member: ProjectMemberOption) => void
  onOpenChange: (open: boolean) => void
  onProjectProgramChange: (value: string) => void
  onProjectSyTermChange: (value: string) => void
  onProjectSyTermOtherChange: (value: string) => void
  onProjectTitleChange: (value: string) => void
  onProjectTypeChange: (value: string) => void
  onProjectTypeOtherChange: (value: string) => void
  onProjectYearLevelChange: (value: string) => void
  titleError?: string | null
  isSubmitting?: boolean
  open: boolean
  projectProgram: string
  projectSyTerm: string
  projectSyTermOther: string
  projectTitle: string
  projectType: string
  projectTypeOther: string
  projectYearLevel: string
  selectedMembers: ProjectMemberOption[]
  selectedAdvisers: ProjectMemberOption[]
  showAdviserField?: boolean
  useGroupTerminology?: boolean
  pendingStudentTransfer?: { member: ProjectMemberOption; groupName: string } | null
  onConfirmStudentTransfer?: () => void
  onCancelStudentTransfer?: () => void
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

type ConfigurationResponse = {
  options?: Array<{
    category: "program" | "year_level" | "group_type" | "sy_term"
    label: string
  }>
}

type ConfigurationOptions = {
  programs: string[]
  yearLevels: string[]
  groupTypes: string[]
  terms: string[]
}

const defaultConfigurationOptions = (): ConfigurationOptions => ({
  programs: [...PROJECT_PROGRAM_OPTIONS],
  yearLevels: [...PROJECT_YEAR_LEVEL_OPTIONS],
  groupTypes: [...PROJECT_TYPE_OPTIONS],
  terms: [...PROJECT_SY_TERM_OPTIONS],
})

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
          className="h-8 w-full rounded-[2px] border-border/70 bg-white text-sm dark:border-[var(--border)] dark:bg-[var(--card)] dark:text-slate-100"
          aria-label={label}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="dark:border-[var(--border)] dark:bg-[var(--card)] dark:text-slate-100">
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
        className={`h-8 rounded-[2px] border-border/70 bg-white text-sm transition-all duration-200 dark:border-[var(--border)] dark:bg-[var(--card)] dark:text-slate-100 dark:placeholder:text-slate-500 ${
          isOtherSelected ? "opacity-100" : "h-0 overflow-hidden opacity-0"
        }`}
        autoFocus={isOtherSelected}
        aria-hidden={!isOtherSelected}
      />
    </div>
  )
}

export function CreateProjectDialog({
  adviserOptions,
  adviserOptionsError,
  adviserOptionsLoading,
  adviserSearch,
  memberSearch,
  memberOptions,
  memberOptionsError,
  memberOptionsLoading,
  onCreateProject,
  onAdviserRemove,
  onAdviserSearchChange,
  onAdviserSelect,
  onMemberRemove,
  onMemberSearchChange,
  onMemberSelect,
  onOpenChange,
  onProjectProgramChange,
  onProjectSyTermChange,
  onProjectSyTermOtherChange,
  onProjectTitleChange,
  onProjectTypeChange,
  onProjectTypeOtherChange,
  onProjectYearLevelChange,
  titleError = null,
  isSubmitting = false,
  open,
  projectProgram,
  projectSyTerm,
  projectSyTermOther,
  projectTitle,
  projectType,
  projectTypeOther,
  projectYearLevel,
  selectedMembers,
  selectedAdvisers,
  showAdviserField = false,
  useGroupTerminology = false,
  pendingStudentTransfer = null,
  onConfirmStudentTransfer,
  onCancelStudentTransfer,
}: CreateProjectDialogProps) {
  const [memberPickerOpen, setMemberPickerOpen] = React.useState(false)
  const [workflowPreset, setWorkflowPreset] = React.useState<ProjectWorkflowPreset>("existing")
  const [researchApproach, setResearchApproach] = React.useState<ResearchApproach>()
  const [adviserPickerOpen, setAdviserPickerOpen] = React.useState(false)
  const [discardWarningOpen, setDiscardWarningOpen] = React.useState(false)
  const [memberPickerWidth, setMemberPickerWidth] = React.useState(0)
  const memberPickerRef = React.useRef<HTMLDivElement | null>(null)
  const [configurationOptions, setConfigurationOptions] = React.useState<ConfigurationOptions>(defaultConfigurationOptions)
  const [configurationStatus, setConfigurationStatus] = React.useState<"loading" | "ready" | "error">("loading")
  const [configurationAttempt, setConfigurationAttempt] = React.useState(0)
  const hasInvalidTitle = hasInvalidTaskTitleCharacters(projectTitle)
  const displayedTitleError = hasInvalidTitle ? TASK_TITLE_CHARACTERS_ERROR : null
  const isProgramComplete = projectProgram.trim().length > 0
  const isYearLevelComplete = projectYearLevel.trim().length > 0
  const isSyTermComplete =
    projectSyTerm.trim().length > 0 &&
    (projectSyTerm !== OTHER_PROJECT_OPTION || projectSyTermOther.trim().length > 0)
  const isProjectTypeComplete =
    projectType.trim().length > 0 &&
    (projectType !== OTHER_PROJECT_OPTION || projectTypeOther.trim().length > 0)
  const isThesis = isThesisGroupType(projectType === OTHER_PROJECT_OPTION ? projectTypeOther : projectType)
  const missingFields = [
    ...(!projectTitle.trim() ? [{ id: "project-title", label: "title" }] : []),
    ...(!isProgramComplete ? [{ id: "project-program", label: "program" }] : []),
    ...(!isYearLevelComplete ? [{ id: "project-year-level", label: "year level" }] : []),
    ...(!isSyTermComplete ? [{ id: "project-sy-term", label: "school year and term" }] : []),
    ...(!isProjectTypeComplete ? [{ id: "project-type", label: "project type" }] : []),
    ...(isThesis && !researchApproach ? [{ id: "project-research-approach", label: "research approach" }] : []),
    ...(showAdviserField && !selectedAdvisers.length ? [{ id: "project-adviser", label: "an adviser" }] : []),
    ...(!selectedMembers.some((member) => member.role === "student" && member.name.trim())
      ? [{ id: "project-member", label: "at least one student" }] : []),
  ]
  const [submitAttempted, setSubmitAttempted] = React.useState(false)
  const hasUnsavedChanges = Boolean(
    workflowPreset !== "existing" ||
    projectTitle.trim() ||
    projectProgram.trim() ||
    projectType.trim() ||
    projectTypeOther.trim() ||
    projectYearLevel.trim() ||
    projectSyTerm.trim() ||
    projectSyTermOther.trim() ||
    selectedMembers.length ||
    selectedAdvisers.length
  )

  React.useEffect(() => {
    if (!open) {
      setSubmitAttempted(false)
      setWorkflowPreset("existing")
      setResearchApproach(undefined)
      setMemberPickerOpen(false)
      setAdviserPickerOpen(false)
    }
  }, [open])

  React.useEffect(() => {
    if (!open) return
    setConfigurationStatus("loading")
    const controller = new AbortController()
    void fetch("/api/project-configuration", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to load project configuration")
        return response.json() as Promise<ConfigurationResponse>
      })
      .then((payload) => {
        if (controller.signal.aborted) return
        const next: ConfigurationOptions = { programs: [], yearLevels: [], groupTypes: [], terms: [] }
        for (const option of payload.options ?? []) {
          if (option.category === "program") next.programs.push(option.label)
          if (option.category === "year_level") next.yearLevels.push(option.label)
          if (option.category === "group_type") next.groupTypes.push(option.label)
          if (option.category === "sy_term") next.terms.push(option.label)
        }
        setConfigurationOptions(next)
        setConfigurationStatus("ready")
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          if (controller.signal.aborted) return
          setConfigurationStatus("error")
          setConfigurationOptions({ ...defaultConfigurationOptions(), programs: [] })
        }
      })
    return () => controller.abort()
  }, [open, configurationAttempt])

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
    if (isSubmitting) return
    setSubmitAttempted(true)
    if (configurationStatus !== "ready") return
    const fieldId = hasInvalidTitle ? "project-title" : missingFields[0]?.id
    if (fieldId) {
      document.getElementById(fieldId)?.focus()
      return
    }
    await onCreateProject(workflowPreset, isThesis ? researchApproach : undefined)
  }

  function requestClose() {
    if (isSubmitting) return
    if (hasUnsavedChanges) {
      setDiscardWarningOpen(true)
      return
    }
    onOpenChange(false)
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
    <>
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (nextOpen) onOpenChange(true)
      else requestClose()
    }}>
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] flex-col overflow-hidden rounded-[2px] border-border/70 bg-white px-4 py-4 sm:px-5 dark:border-[var(--border)] dark:bg-[var(--background)] sm:max-w-xl">
        <div className="border-b border-border/70 pb-2 dark:border-[var(--border)]">
          <DialogHeader className="gap-2 text-left">
            <DialogTitle className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Create new {useGroupTerminology ? "group" : "project"}
            </DialogTitle>
          </DialogHeader>
        </div>

        <form className="flex min-h-0 flex-1 flex-col gap-3 py-1" onSubmit={handleSubmit}>
          <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto pr-1 sm:grid-cols-2">
            <div className="flex flex-col gap-2 sm:col-span-2">
              <label htmlFor="project-workflow-preset" className="text-sm font-medium">Workflow preset</label>
              <select
                id="project-workflow-preset"
                className="h-8 rounded border bg-background px-2 text-sm"
                value={workflowPreset}
                disabled={isSubmitting}
                onChange={(event) => {
                  if (isProjectWorkflowPreset(event.target.value)) setWorkflowPreset(event.target.value)
                }}
              >
                {Object.entries(projectWorkflowPresets).map(([id, preset]) =>
                  <option key={id} value={id}>{preset.label}</option>
                )}
              </select>
              <p className="text-xs text-muted-foreground">{projectWorkflowPresets[workflowPreset].description}</p>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="project-title" className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {useGroupTerminology ? "Group" : "Project"} title <span className="text-red-500">*</span>
              </label>
              <Input
                id="project-title"
                aria-invalid={Boolean(displayedTitleError)}
                aria-describedby={displayedTitleError ? "project-title-error" : undefined}
                value={projectTitle}
                onChange={(event) => onProjectTitleChange(event.target.value)}
                maxLength={PROJECT_TITLE_MAX_LENGTH}
                placeholder="Capstone Progress Tracker"
                className="h-8 rounded-[2px] border-border/70 bg-white text-sm dark:border-[var(--border)] dark:bg-[var(--card)] dark:text-slate-100 dark:placeholder:text-slate-500"
              />
              {displayedTitleError ? (
                <p id="project-title-error" className="text-xs text-red-500">{displayedTitleError}</p>
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
              options={configurationStatus === "ready" ? configurationOptions.programs : []}
              placeholder="Select a program"
              customValue=""
              onCustomValueChange={() => undefined}
              customInputPlaceholder="Enter program"
            />

            <SelectWithCustomInput
              id="project-type"
              label={useGroupTerminology ? "Group type" : "Project type"}
              value={projectType}
              onValueChange={onProjectTypeChange}
              options={configurationOptions.groupTypes}
              placeholder="Select a project type"
              customValue={projectTypeOther}
              onCustomValueChange={onProjectTypeOtherChange}
              customInputPlaceholder="Enter project type"
            />

            {isThesis ? (
              <div className="flex flex-col gap-2">
                <label htmlFor="project-research-approach" className="text-sm font-medium">
                  Research approach <span className="text-red-500">*</span>
                </label>
                <Select value={researchApproach ?? ""} onValueChange={(value) => {
                  if (isResearchApproach(value)) setResearchApproach(value)
                }}>
                  <SelectTrigger id="project-research-approach" className="h-8 w-full">
                    <SelectValue placeholder="Select a research approach" />
                  </SelectTrigger>
                  <SelectContent>
                    {researchApproaches.map((approach) => <SelectItem key={approach} value={approach}>{approach}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <SelectWithCustomInput
              id="project-year-level"
              label="Year level"
              value={projectYearLevel}
              onValueChange={onProjectYearLevelChange}
              options={configurationOptions.yearLevels}
              placeholder="Select a year level"
              customValue=""
              onCustomValueChange={() => undefined}
              customInputPlaceholder="Enter year level"
            />

            <SelectWithCustomInput
              id="project-sy-term"
              label="SY term"
              value={projectSyTerm}
              onValueChange={onProjectSyTermChange}
              options={configurationOptions.terms}
              placeholder="Select a term"
              customValue={projectSyTermOther}
              onCustomValueChange={onProjectSyTermOtherChange}
              customInputPlaceholder="Enter academic term"
            />

            {showAdviserField ? (
              <div className="flex flex-col gap-2">
                <label htmlFor="project-adviser" className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Adviser <span className="text-red-500">*</span>
                </label>
                <Popover open={adviserPickerOpen} onOpenChange={setAdviserPickerOpen}>
                  <PopoverAnchor asChild>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-[18px] h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        id="project-adviser"
                        value={adviserSearch}
                        onFocus={() => setAdviserPickerOpen(true)}
                        onClick={() => setAdviserPickerOpen(true)}
                        onChange={(event) => {
                          onAdviserSearchChange(event.target.value)
                          setAdviserPickerOpen(true)
                        }}
                        placeholder="Search advisers"
                        autoComplete="off"
                        className="h-8 rounded-[2px] border-border/70 bg-white pl-9 text-sm dark:border-[var(--border)] dark:bg-[var(--card)] dark:text-slate-100 dark:placeholder:text-slate-500"
                      />
                    </div>
                  </PopoverAnchor>
                  <PopoverContent align="start" sideOffset={6} onOpenAutoFocus={(event) => event.preventDefault()} className="z-[80] w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-[2px] border border-slate-200 bg-white p-1 dark:border-[var(--border)] dark:bg-[var(--background)]">
                    {adviserOptionsLoading ? (
                      <div className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" /> Loading advisers...
                      </div>
                    ) : adviserOptions.length ? (
                      <Command className="bg-transparent">
                        <CommandList className="max-h-[220px]">
                          <CommandGroup className="p-0">
                            {adviserOptions.map((adviser) => {
                              const selected = selectedAdvisers.some((item) => item.id === adviser.id)
                              return (
                                <CommandItem
                                  key={adviser.id}
                                  value={`${adviser.name} ${adviser.email}`}
                                  onSelect={() => {
                                    onAdviserSelect(adviser)
                                    setAdviserPickerOpen(false)
                                  }}
                                  className="flex items-center gap-3 px-3 py-2"
                                >
                                  <Avatar name={adviser.name} className="size-8"><AvatarFallback className="text-[10px]">{getInitials(adviser.name)}</AvatarFallback></Avatar>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-[13px] font-medium">{getMemberDisplayName(adviser.name)}</p>
                                    <p className="truncate text-[11px] text-muted-foreground">{adviser.email}</p>
                                  </div>
                                  <Check className={`size-4 ${selected ? "opacity-100" : "opacity-0"}`} />
                                </CommandItem>
                              )
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    ) : (
                      <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                        {adviserOptionsError ? "Could not load advisers. Change your search to try again." : "No verified advisers match your search."}
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
                {selectedAdvisers.map((adviser) => (
                  <div key={adviser.id} className="flex items-center justify-between rounded-[2px] border px-3 py-2 text-sm dark:border-[var(--border)]">
                    <span className="truncate">{getMemberDisplayName(adviser.name)} (Adviser)</span>
                    <button type="button" onClick={() => onAdviserRemove(adviser.id)} aria-label={`Remove ${adviser.name}`} className="text-slate-400 hover:text-red-500">
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <label htmlFor="project-member" className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {showAdviserField ? "Students" : "Members"} <span className="text-red-500">*</span>
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
                      placeholder={showAdviserField ? "Search students" : "Search members"}
                      autoComplete="off"
                      className="h-8 rounded-[2px] border-border/70 bg-white pr-9 pl-9 text-sm dark:border-[var(--border)] dark:bg-[var(--card)] dark:text-slate-100 dark:placeholder:text-slate-500"
                    />
                    {memberSearch ? (
                      <button
                        type="button"
                        onClick={() => {
                          onMemberSearchChange("")
                          setMemberPickerOpen(true)
                        }}
                        className="absolute right-2 top-[18px] inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-[var(--surface-hover)] dark:hover:text-slate-200"
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
                  className="z-[80] overflow-hidden rounded-[2px] border border-slate-200 bg-white p-1 shadow-[0_18px_38px_rgba(15,23,42,0.12)] dark:border-[var(--border)] dark:bg-[var(--background)]"
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
                            {memberOptions
                              .filter((member) => !showAdviserField || member.role === "student")
                              .map((member) => {
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
                                  <Avatar name={member.name} className="mt-0.5 h-8 w-8">
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
                                      isSelected ? "opacity-100 text-[var(--brand-primary-fixed)] dark:text-[var(--brand-link)]" : "opacity-0"
                                    }`}
                                  />
                                </CommandItem>
                              )
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    ) : (
                      <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                        {!projectProgram ? "Choose a program first."
                          : memberOptionsError ? "Could not load students. Change your search to try again."
                            : "No eligible students match this program and search."}
                      </p>
                    )}
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                {selectedMembers.length > 0
                  ? `${selectedMembers.length} ${showAdviserField ? `student${selectedMembers.length === 1 ? "" : "s"}` : `participant${selectedMembers.length === 1 ? "" : "s"}`} selected`
                  : ""}
              </p>
            </div>

            {selectedMembers.length > 0 ? (
              <div className="sm:col-span-2">
                <div className="overflow-hidden rounded-[2px] border border-slate-200 bg-white dark:border-[var(--border)] dark:bg-[var(--background)]">
                  <div className="grid grid-cols-[minmax(0,1fr)_36px] border-b border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 dark:border-[var(--border)] dark:text-slate-400">
                    <span>{showAdviserField ? "Student" : "Member"}</span>
                    <span className="sr-only">Remove</span>
                  </div>

                  <div className="divide-y divide-slate-200 dark:divide-[var(--border)]">
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
                          className="inline-flex h-7 w-7 items-center justify-center justify-self-end rounded-[2px] text-slate-400 transition hover:bg-slate-100 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary-fixed)] dark:text-slate-500 dark:hover:bg-[var(--surface-hover)] dark:hover:text-red-400"
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

          {configurationStatus === "loading" ? (
            <p role="status" className="text-sm text-muted-foreground">Loading group setup…</p>
          ) : configurationStatus === "error" ? (
            <div className="flex items-center gap-2">
              <p role="alert" className="text-sm text-destructive">Could not load group setup options.</p>
              <Button type="button" variant="outline" size="sm" onClick={() => setConfigurationAttempt((attempt) => attempt + 1)}>Retry</Button>
            </div>
          ) : configurationStatus === "ready" && !configurationOptions.programs.length ? (
            <p role="alert" className="text-sm text-destructive">No program is assigned to this coordinator. Ask the administrator to assign a program first.</p>
          ) : null}
          {submitAttempted && configurationStatus === "ready" && configurationOptions.programs.length > 0 &&
            (missingFields.length > 0 || displayedTitleError || titleError) ? (
            <p role="alert" className="text-sm text-destructive">
              {missingFields.length > 0
                ? `Complete these fields: ${missingFields.map(({ label }) => label).join(", ")}.`
                : displayedTitleError || titleError}
            </p>
          ) : null}
          <DialogFooter className="justify-end gap-2 border-t border-border/70 pt-2.5 dark:border-[var(--border)]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 min-w-24 rounded-[2px]"
              disabled={isSubmitting}
              onClick={requestClose}
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
              disabled={isSubmitting || configurationStatus === "loading"}
            >
              {isSubmitting
                ? "Creating..."
                : `Create ${useGroupTerminology ? "group" : "project"}`}
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
      <AlertDialog open={discardWarningOpen} onOpenChange={setDiscardWarningOpen}>
        <AlertDialogContent className="max-w-md rounded-[2px] border-slate-200 bg-white text-slate-950 shadow-2xl dark:border-[var(--border)] dark:bg-[var(--card)] dark:text-slate-100">
          <AlertDialogHeader className="text-left">
            <AlertDialogTitle>Discard your changes?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 dark:text-slate-300">
              You have entered information in this form. Closing it will remove your unsaved changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDiscardWarningOpen(false)
                onOpenChange(false)
              }}
              className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-600"
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={Boolean(pendingStudentTransfer)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) onCancelStudentTransfer?.()
        }}
      >
        <AlertDialogContent className="max-w-md rounded-[2px] border-slate-200 bg-white text-slate-950 shadow-2xl dark:border-[var(--border)] dark:bg-[var(--card)] dark:text-slate-100">
          <AlertDialogHeader className="text-left">
            <AlertDialogTitle>Transfer student?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-slate-600 dark:text-slate-300">
              <span className="block">
                This student is already assigned to another group. Do you want to transfer them to this group?
              </span>
              {pendingStudentTransfer ? (
                <span className="block font-medium text-slate-900 dark:text-slate-100">
                  {getMemberDisplayName(pendingStudentTransfer.member.name)} is currently in {pendingStudentTransfer.groupName}.
                </span>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onCancelStudentTransfer}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmStudentTransfer}
              style={{
                backgroundColor: "var(--brand-primary-fixed)",
                color: "var(--brand-primary-fixed-foreground)",
              }}
            >
              Transfer Student
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

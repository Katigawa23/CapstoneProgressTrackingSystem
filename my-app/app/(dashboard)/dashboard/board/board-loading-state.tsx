"use client"

import * as React from "react"

import {
  readDashboardBoardState,
  type DashboardBoardState,
} from "@/lib/dashboard-board-state"
import { BoardLoadingSkeleton } from "./board-loading-skeleton"

const emptyBoardState: DashboardBoardState = {
  todoCount: 0,
  inprogressCount: 0,
  revisionCount: 0,
  completedCount: 0,
}

export function BoardLoadingState() {
  const [boardState, setBoardState] = React.useState<DashboardBoardState>(
    emptyBoardState
  )

  React.useEffect(() => {
    setBoardState(readDashboardBoardState())
  }, [])

  return <BoardLoadingSkeleton useLiveHeader cardCounts={boardState} />
}

"use client"

import * as React from "react"

import {
  readDashboardBoardState,
  type DashboardBoardState,
} from "@/lib/dashboard-board-state"
import { BoardLoadingSkeleton } from "./board-loading-skeleton"

export function BoardLoadingState({
  cardCounts,
}: {
  cardCounts?: DashboardBoardState
}) {
  const [boardState, setBoardState] = React.useState<DashboardBoardState>(
    () => cardCounts ?? readDashboardBoardState()
  )

  React.useLayoutEffect(() => {
    setBoardState(cardCounts ?? readDashboardBoardState())
  }, [cardCounts])

  return <BoardLoadingSkeleton cardCounts={boardState} />
}

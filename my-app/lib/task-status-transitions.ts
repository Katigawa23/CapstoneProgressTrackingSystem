export function canTransitionTaskStatus(
  current: string,
  next: string,
  role: "student" | "faculty" | "admin"
) {
  if (current === next || current === "completed" || role === "admin") return false
  if (role === "student") return current === "todo" && next === "inprogress"

  if (current === "revision") return next === "completed"
  if (current === "inprogress" || current === "inreview") {
    return next === "revision" || next === "completed"
  }

  return current === "todo" && ["inprogress", "revision", "completed"].includes(next)
}

const express = require("express");

const {
  listBacklogItems,
  createBacklogItem,
  updateBacklogItem,
  deleteBacklogItem,
} = require("../repositories/backlog-repository");

const router = express.Router();

router.get("/", async (_request, response) => {
  try {
    const items = await listBacklogItems();
    response.json({ items });
  } catch (error) {
    console.error("Failed to load backlog items", error);
    response.status(500).json({ error: "Failed to load backlog items" });
  }
});

router.post("/", async (request, response) => {
  try {
    const body = request.body || {};
    const title = typeof body.title === "string" ? body.title.trim() : "";

    if (!title) {
      response.status(400).json({ error: "Title is required" });
      return;
    }

    const item = await createBacklogItem({
      title,
      description: typeof body.description === "string" ? body.description.trim() : "",
      dueDate: body.dueDate ?? null,
      status: "todo",
      checked: false,
      assigneeId: body.assigneeId ?? null,
      file:
        body.file &&
        typeof body.file.name === "string" &&
        typeof body.file.size === "string" &&
        typeof body.file.type === "string"
          ? {
              name: body.file.name,
              size: body.file.size,
              type: body.file.type,
            }
          : null,
    });

    response.status(201).json({ item });
  } catch (error) {
    console.error("Failed to create backlog item", error);
    response.status(500).json({ error: "Failed to create backlog item" });
  }
});

router.patch("/:id", async (request, response) => {
  try {
    const item = await updateBacklogItem(request.params.id, {
      title: typeof request.body.title === "string" ? request.body.title.trim() : undefined,
      description:
        typeof request.body.description === "string"
          ? request.body.description.trim()
          : undefined,
      status: request.body.status,
      checked: request.body.checked,
      assigneeId: Object.prototype.hasOwnProperty.call(request.body, "assigneeId")
        ? request.body.assigneeId
        : undefined,
    });

    if (!item) {
      response.status(404).json({ error: "Backlog item not found or unchanged" });
      return;
    }

    response.json({ item });
  } catch (error) {
    console.error("Failed to update backlog item", error);
    response.status(500).json({ error: "Failed to update backlog item" });
  }
});

router.delete("/:id", async (request, response) => {
  try {
    const deleted = await deleteBacklogItem(request.params.id);

    if (!deleted) {
      response.status(404).json({ error: "Backlog item not found" });
      return;
    }

    response.json({ success: true });
  } catch (error) {
    console.error("Failed to delete backlog item", error);
    response.status(500).json({ error: "Failed to delete backlog item" });
  }
});

module.exports = {
  backlogRouter: router,
};

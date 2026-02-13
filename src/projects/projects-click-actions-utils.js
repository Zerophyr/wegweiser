// projects-click-actions-utils.js - Resolves event-target intent for Projects list interactions

function resolveProjectCardClickAction(target, card) {
  const toggleBtn = target?.closest?.('[data-action="toggle-menu"]');
  if (toggleBtn) return { type: "toggle-menu", button: toggleBtn };

  const editBtn = target?.closest?.('[data-action="edit"]');
  if (editBtn) return { type: "edit", projectId: editBtn.dataset.projectId };

  const deleteBtn = target?.closest?.('[data-action="delete"]');
  if (deleteBtn) return { type: "delete", projectId: deleteBtn.dataset.projectId };

  if (target?.closest?.(".menu-dropdown")) return { type: "ignore" };

  return { type: "open", projectId: card?.dataset?.projectId || null };
}

function resolveThreadItemClickAction(target, item) {
  const toggleBtn = target?.closest?.('[data-action="toggle-menu"]');
  if (toggleBtn) return { type: "toggle-menu", button: toggleBtn };

  const renameBtn = target?.closest?.('[data-action="rename"]');
  if (renameBtn) return { type: "rename", threadId: renameBtn.dataset.threadId };

  const exportBtn = target?.closest?.('[data-action="export"]');
  if (exportBtn) {
    return { type: "export", threadId: exportBtn.dataset.threadId, format: exportBtn.dataset.format };
  }

  if (target?.closest?.('[data-action="export-parent"]')) return { type: "ignore" };

  const deleteBtn = target?.closest?.('[data-action="delete-thread"]');
  if (deleteBtn) return { type: "delete-thread", threadId: deleteBtn.dataset.threadId };

  if (target?.closest?.(".menu-dropdown")) return { type: "ignore" };

  return { type: "open", threadId: item?.dataset?.threadId || null };
}

const projectsClickActionsUtils = {
  resolveProjectCardClickAction,
  resolveThreadItemClickAction
};

if (typeof window !== "undefined") {
  window.projectsClickActionsUtils = projectsClickActionsUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsClickActionsUtils;
}

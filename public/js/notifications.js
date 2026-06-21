let notificationProjects = [];

document.addEventListener("DOMContentLoaded", () => {
  const currentUser = getCurrentUser();
  if (!currentUser) return;

  const refreshBtn = document.getElementById("refresh-notifications-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", loadNotifications);
  }

  loadNotifications();
});

async function loadNotifications() {
  try {
    const res = await fetch("/api/projects");
    if (!res.ok) throw new Error("Failed to load notifications");
    notificationProjects = await res.json();
    renderNotifications(buildNotificationGroups(notificationProjects));
  } catch (err) {
    console.error("Notifications load error:", err);
  }
}

function buildNotificationGroups(projects) {
  const groups = {
    taskDue: [],
    subtaskDue: [],
    newTasks: [],
    taskUpdates: [],
    ticketDue: [],
    newTickets: [],
    ticketUpdates: []
  };

  projects.forEach(project => {
    (project.tasks || []).forEach(task => {
      if (!isVisibleToCurrentUser(task.assignee)) return;

      const isSubtask = Boolean(task.dependencies);
      const baseTask = {
        title: task.name,
        project: project.name,
        assignee: task.assignee || "Unassigned",
        date: task.end,
        meta: isSubtask ? "Subtask" : "Task",
        description: task.description || ""
      };

      if (task.end) {
        groups[isSubtask ? "subtaskDue" : "taskDue"].push({
          ...baseTask,
          message: `${isSubtask ? "Subtask" : "Task"} due ${formatDate(task.end)}`,
          sortDate: normalizeDate(task.end)
        });
      }

      if (task.createdAt) {
        groups.newTasks.push({
          ...baseTask,
          message: `${isSubtask ? "Subtask" : "Task"} added ${formatDateTime(task.createdAt)}`,
          sortDate: normalizeDate(task.createdAt)
        });
      }

      if (task.updatedAt && task.updatedAt !== task.createdAt) {
        groups.taskUpdates.push({
          ...baseTask,
          message: `${isSubtask ? "Subtask" : "Task"} updated ${formatDateTime(task.updatedAt)}`,
          sortDate: normalizeDate(task.updatedAt)
        });
      }
    });

    (project.columns || []).forEach(column => {
      (column.cards || []).forEach(card => {
        if (!isVisibleToCurrentUser(card.assignee)) return;

        const baseTicket = {
          title: card.title,
          project: project.name,
          assignee: card.assignee || "Unassigned",
          meta: `Ticket - ${column.title}`,
          description: card.description || ""
        };

        if (card.dueDate) {
          groups.ticketDue.push({
            ...baseTicket,
            date: card.dueDate,
            message: `Ticket due ${formatDateTime(card.dueDate)}`,
            sortDate: normalizeDate(card.dueDate)
          });
        }

        if (card.createdAt) {
          groups.newTickets.push({
            ...baseTicket,
            message: `Ticket added ${formatDateTime(card.createdAt)}`,
            sortDate: normalizeDate(card.createdAt)
          });
        }

        if (card.updatedAt && card.updatedAt !== card.createdAt) {
          groups.ticketUpdates.push({
            ...baseTicket,
            message: `Ticket updated ${formatDateTime(card.updatedAt)}`,
            sortDate: normalizeDate(card.updatedAt)
          });
        }
      });
    });
  });

  groups.taskDue.sort(sortByDueDate);
  groups.subtaskDue.sort(sortByDueDate);
  groups.ticketDue.sort(sortByDueDate);
  groups.newTasks.sort(sortNewestFirst);
  groups.taskUpdates.sort(sortNewestFirst);
  groups.newTickets.sort(sortNewestFirst);
  groups.ticketUpdates.sort(sortNewestFirst);

  return groups;
}

function renderNotifications(groups) {
  renderNotificationList("task-due", groups.taskDue);
  renderNotificationList("subtask-due", groups.subtaskDue);
  renderNotificationList("new-task", groups.newTasks);
  renderNotificationList("task-update", groups.taskUpdates);
  renderNotificationList("ticket-due", groups.ticketDue);
  renderNotificationList("new-ticket", groups.newTickets);
  renderNotificationList("ticket-update", groups.ticketUpdates);

  const total = Object.values(groups).reduce((sum, items) => sum + items.length, 0);
  const summary = document.getElementById("notifications-summary");
  if (summary) {
    summary.innerHTML = `
      <div class="notification-summary-item">
        <span class="notification-summary-number">${total}</span>
        <span class="notification-summary-label">Total notifications</span>
      </div>
      <div class="notification-summary-item">
        <span class="notification-summary-number">${groups.taskDue.length + groups.subtaskDue.length + groups.ticketDue.length}</span>
        <span class="notification-summary-label">Due date items</span>
      </div>
      <div class="notification-summary-item">
        <span class="notification-summary-number">${groups.taskUpdates.length + groups.ticketUpdates.length}</span>
        <span class="notification-summary-label">Recent updates</span>
      </div>
    `;
  }
}

function renderNotificationList(prefix, items) {
  const list = document.getElementById(`${prefix}-list`);
  const count = document.getElementById(`${prefix}-count`);
  if (count) count.textContent = items.length;
  if (!list) return;

  if (!items.length) {
    list.innerHTML = `<div class="notification-empty">No notifications in this section.</div>`;
    return;
  }

  list.innerHTML = items.map(item => `
    <article class="notification-item">
      <div class="notification-item-main">
        <h6>${escapeHTML(item.title)}</h6>
        <p>${escapeHTML(item.message)}</p>
      </div>
      <div class="notification-item-meta">
        <span>${escapeHTML(item.project)}</span>
        <span>${escapeHTML(item.meta)}</span>
        <span>${escapeHTML(item.assignee)}</span>
      </div>
      ${item.description ? `<div class="notification-item-desc">${escapeHTML(item.description)}</div>` : ""}
    </article>
  `).join("");
}

function isVisibleToCurrentUser(assignee) {
  const currentUser = getCurrentUser();
  if (!currentUser) return false;
  if (currentUser.role === "admin") return true;
  return !assignee || assignee.toLowerCase() === currentUser.username.toLowerCase();
}

function normalizeDate(value) {
  if (!value) return 0;
  const date = value.includes("T") ? new Date(value) : new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function sortByDueDate(a, b) {
  return a.sortDate - b.sortDate;
}

function sortNewestFirst(a, b) {
  return b.sortDate - a.sortDate;
}

function formatDate(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit"
  });
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function escapeHTML(str) {
  return String(str || "").replace(/[&<>'"]/g,
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

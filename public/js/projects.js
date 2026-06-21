// Projects & Gantt Chart Logic

let projects = [];
let activeProjectId = '';
let activeProject = null;
let ganttChartInstance = null;
let currentViewMode = 'Day';
let usersList = [];

document.addEventListener("DOMContentLoaded", () => {
  const currentUser = getCurrentUser();
  if (!currentUser) return;

  // Handle roles visibility
  const isAdminUser = currentUser.role === 'admin';
  if (!isAdminUser) {
    const addProjBtn = document.getElementById("add-project-btn");
    const addTaskBtn = document.getElementById("add-task-btn");
    if (addProjBtn) addProjBtn.classList.add("d-none");
    if (addTaskBtn) addTaskBtn.classList.add("d-none");
  }

  // Load project list
  loadProjects();
  // Fetch users for assignees dropdown
  fetchUsers();

  // Project selector change listener
  const projectSelector = document.getElementById("project-selector");
  if (projectSelector) {
    projectSelector.addEventListener("change", (e) => {
      selectProject(e.target.value);
    });
  }

  // Gantt view modes listeners
  const modeBtns = document.querySelectorAll(".gantt-view-btn");
  modeBtns.forEach(btn => {
    btn.addEventListener("click", (e) => {
      modeBtns.forEach(b => b.classList.remove("active"));
      e.target.classList.add("active");
      const mode = e.target.getAttribute("data-mode");
      changeGanttViewMode(mode);
    });
  });

  // Form submit: Create Project
  const createProjForm = document.getElementById("add-project-form");
  if (createProjForm) {
    createProjForm.addEventListener("submit", handleCreateProject);
  }

  // Form submit: Add Task
  const addTaskForm = document.getElementById("add-task-form");
  if (addTaskForm) {
    addTaskForm.addEventListener("submit", handleAddTask);
  }

  // Form submit: Edit Task
  const editTaskForm = document.getElementById("edit-task-form");
  if (editTaskForm) {
    editTaskForm.addEventListener("submit", handleEditTask);
  }

  // Post comment in task thread
  const postTaskCommentBtn = document.getElementById("post-task-comment-btn");
  if (postTaskCommentBtn) {
    postTaskCommentBtn.addEventListener("click", handlePostTaskComment);
  }

  // Delete project click
  const deleteProjBtn = document.getElementById("delete-project-btn");
  if (deleteProjBtn) {
    deleteProjBtn.addEventListener("click", handleDeleteProject);
  }

  // Delete task click
  const deleteRecTaskBtn = document.getElementById("delete-task-btn");
  if (deleteRecTaskBtn) {
    deleteRecTaskBtn.addEventListener("click", handleDeleteTask);
  }

  // Add subtask click
  const addSubtaskBtn = document.getElementById("add-subtask-btn");
  if (addSubtaskBtn) {
    addSubtaskBtn.addEventListener("click", () => {
      const parentId = document.getElementById("edit-task-id").value;
      const parentTask = activeProject.tasks.find(t => t.id === parentId);

      // Close Edit Modal
      const editModalEl = document.getElementById("editTaskModal");
      const editModal = bootstrap.Modal.getInstance(editModalEl);
      if (editModal) editModal.hide();

      // Clear add form inputs
      document.getElementById("task-name").value = "";
      document.getElementById("task-desc").value = "";
      document.getElementById("task-images").value = "";
      document.getElementById("task-progress").value = 0;
      document.getElementById("task-assignee").value = "";

      // Select parent task as dependency
      const depSelect = document.getElementById("task-dependency");
      if (depSelect) {
        depSelect.value = parentId;
      }

      // Schedule subtask to start after parent task ends
      if (parentTask) {
        document.getElementById("task-start").value = parentTask.end;
        // Default end date is 3 days later
        const parentEnd = new Date(parentTask.end);
        parentEnd.setDate(parentEnd.getDate() + 3);
        const yyyy = parentEnd.getFullYear();
        const mm = String(parentEnd.getMonth() + 1).padStart(2, '0');
        const dd = String(parentEnd.getDate()).padStart(2, '0');
        document.getElementById("task-end").value = `${yyyy}-${mm}-${dd}`;
      }

      // Open Add Modal
      const addModal = new bootstrap.Modal(document.getElementById("addTaskModal"));
      addModal.show();
    });
  }
});

// Fetch users list
async function fetchUsers() {
  try {
    const res = await fetch("/api/users");
    if (res.ok) {
      usersList = await res.json();
      populateAssigneeDropdowns();
    }
  } catch (err) {
    console.error("Error fetching users:", err);
  }
}

function populateAssigneeDropdowns() {
  const addAssigneeSelect = document.getElementById("task-assignee");
  const editAssigneeSelect = document.getElementById("edit-task-assignee");
  
  if (addAssigneeSelect && editAssigneeSelect) {
    const optionsHtml = `
      <option value="">Unassigned</option>
      ${usersList.map(u => `<option value="${u.username}">${u.username}</option>`).join('')}
    `;
    addAssigneeSelect.innerHTML = optionsHtml;
    editAssigneeSelect.innerHTML = optionsHtml;
  }
}

// Fetch projects
async function loadProjects(selectId = '') {
  try {
    const res = await fetch("/api/projects");
    if (!res.ok) throw new Error("Failed to load projects");
    projects = await res.json();
    
    // Populate Dropdown
    const selector = document.getElementById("project-selector");
    if (selector) {
      selector.innerHTML = '<option value="">-- Select Project --</option>';
      projects.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.name;
        selector.appendChild(opt);
      });

      if (selectId) {
        selector.value = selectId;
        selectProject(selectId);
      } else if (activeProjectId) {
        selector.value = activeProjectId;
        selectProject(activeProjectId);
      }
    }
  } catch (err) {
    console.error("Error loading projects:", err);
  }
}

// Select project action
function selectProject(id) {
  activeProjectId = id;
  const selectState = document.getElementById("gantt-select-project-state");
  const workspaceState = document.getElementById("gantt-workspace");
  const deleteBtn = document.getElementById("delete-project-btn");
  const currentUser = getCurrentUser();

  if (!id) {
    activeProject = null;
    if (selectState) selectState.classList.remove("d-none");
    if (workspaceState) workspaceState.classList.add("d-none");
    if (deleteBtn) deleteBtn.classList.add("d-none");
    return;
  }

  activeProject = projects.find(p => p.id === id);
  if (!activeProject) return;

  if (selectState) selectState.classList.add("d-none");
  if (workspaceState) workspaceState.classList.remove("d-none");

  // Show delete project button to admin
  if (deleteBtn) {
    if (currentUser && currentUser.role === 'admin') {
      deleteBtn.classList.remove("d-none");
    } else {
      deleteBtn.classList.add("d-none");
    }
  }

  // Display project info
  const nameEl = document.getElementById("active-project-name");
  const descEl = document.getElementById("active-project-desc");
  if (nameEl) nameEl.textContent = activeProject.name;
  if (descEl) descEl.textContent = activeProject.description || "No description provided.";

  // Populate dependency selectors
  populateDependencyDropdowns();

  // Render Gantt
  renderGanttChart();
}

function populateDependencyDropdowns() {
  const addDepSelect = document.getElementById("task-dependency");
  const editDepSelect = document.getElementById("edit-task-dependency");

  if (activeProject && addDepSelect && editDepSelect) {
    const tasks = activeProject.tasks || [];
    
    // Add form dependency dropdown
    addDepSelect.innerHTML = '<option value="">None</option>' + 
      tasks.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

    // Edit form dependency dropdown will be updated when task is clicked
  }
}

// Render Gantt wrapper
function renderGanttChart() {
  const containerSvg = document.getElementById("gantt-chart-svg");
  const emptyState = document.getElementById("gantt-empty-state");

  if (!containerSvg) return;
  
  // Clear previous chart
  containerSvg.innerHTML = "";

  const tasks = activeProject ? activeProject.tasks || [] : [];

  if (tasks.length === 0) {
    emptyState.classList.remove("d-none");
    containerSvg.style.display = "none";
    return;
  }

  emptyState.classList.add("d-none");
  containerSvg.style.display = "block";

  const currentUser = getCurrentUser();
  const isReadOnly = !currentUser || currentUser.role !== 'admin';

  // Format tasks for Frappe Gantt
  // Frappe Gantt expects: id, name, start, end, progress, dependencies
  const formattedTasks = tasks.map(t => {
    // Make sure dates are in YYYY-MM-DD format
    return {
      id: t.id,
      name: t.name + (t.assignee ? ` (${t.assignee})` : ''),
      start: t.start,
      end: t.end,
      progress: parseInt(t.progress) || 0,
      dependencies: t.dependencies || ""
    };
  });

  try {
    ganttChartInstance = new Gantt("#gantt-chart-svg", formattedTasks, {
      header_height: 50,
      column_width: 30,
      step: 24,
      view_mode: currentViewMode,
      bar_height: 22,
      bar_corner_radius: 4,
      arrow_curve: 5,
      padding: 18,
      date_format: 'YYYY-MM-DD',
      readonly: isReadOnly,
      on_click: function (task) {
        // Open details modal
        openEditTaskModal(task.id);
      },
      on_date_change: function(task, start, end) {
        // Handle drag and resize updates
        if (isReadOnly) return;
        updateTaskTimeline(task.id, start, end);
      },
      on_progress_change: function(task, progress) {
        // Handle progress handles dragging updates
        if (isReadOnly) return;
        updateTaskProgress(task.id, progress);
      }
    });
  } catch (err) {
    console.error("Error creating Gantt instance:", err);
  }
}

// Change view scale
function changeGanttViewMode(mode) {
  currentViewMode = mode;
  if (ganttChartInstance) {
    ganttChartInstance.change_view_mode(mode);
  }
}

function getBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

async function readImageFiles(input) {
  if (!input || !input.files || input.files.length === 0) return [];

  const files = Array.from(input.files);
  const images = [];
  for (const file of files) {
    try {
      images.push(await getBase64(file));
    } catch (err) {
      console.error("Error reading task image:", err);
    }
  }
  return images;
}

// API updates

// Create Project
async function handleCreateProject(e) {
  e.preventDefault();
  const nameInput = document.getElementById("project-name");
  const descInput = document.getElementById("project-desc");
  const alertEl = document.getElementById("project-error-alert");

  if (!nameInput.value.trim()) return;

  alertEl.classList.add("d-none");

  try {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: nameInput.value.trim(),
        description: descInput.value.trim()
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to create project");
    }

    // Reset Form
    nameInput.value = "";
    descInput.value = "";

    // Close Modal
    const modalEl = document.getElementById("addProjectModal");
    const modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (modalInstance) modalInstance.hide();

    // Reload projects and select newly created project
    loadProjects(data.id);

  } catch (err) {
    console.error("Create project error:", err);
    alertEl.textContent = err.message;
    alertEl.classList.remove("d-none");
  }
}

// Delete Project
async function handleDeleteProject() {
  if (!activeProjectId) return;
  if (!confirm(`Are you sure you want to delete project "${activeProject.name}"? This removes all tasks and Trello tickets.`)) {
    return;
  }

  try {
    const res = await fetch(`/api/projects/${activeProjectId}`, {
      method: "DELETE"
    });

    if (res.ok) {
      loadProjects(""); // Reset dropdown and state
    } else {
      alert("Failed to delete project");
    }
  } catch (err) {
    console.error("Delete project error:", err);
  }
}

// Add Task
async function handleAddTask(e) {
  e.preventDefault();
  if (!activeProject) return;

  const nameInput = document.getElementById("task-name");
  const descInput = document.getElementById("task-desc");
  const imageInput = document.getElementById("task-images");
  const startInput = document.getElementById("task-start");
  const endInput = document.getElementById("task-end");
  const assigneeInput = document.getElementById("task-assignee");
  const progressInput = document.getElementById("task-progress");
  const dependencyInput = document.getElementById("task-dependency");
  const alertEl = document.getElementById("task-error-alert");

  if (new Date(endInput.value) < new Date(startInput.value)) {
    alertEl.textContent = "End Date must be after Start Date.";
    alertEl.classList.remove("d-none");
    return;
  }

  alertEl.classList.add("d-none");
  const images = await readImageFiles(imageInput);

  const newTask = {
    id: 'task_' + Date.now(),
    name: nameInput.value.trim(),
    description: descInput.value.trim(),
    start: startInput.value,
    end: endInput.value,
    assignee: assigneeInput.value,
    progress: parseInt(progressInput.value) || 0,
    dependencies: dependencyInput.value,
    images,
    comments: []
  };

  const updatedTasks = [...(activeProject.tasks || []), newTask];

  try {
    const res = await fetch(`/api/projects/${activeProjectId}/tasks`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ tasks: updatedTasks })
    });

    if (!res.ok) throw new Error("Failed to save task");

    // Clear Inputs
    nameInput.value = "";
    descInput.value = "";
    imageInput.value = "";
    startInput.value = "";
    endInput.value = "";
    assigneeInput.value = "";
    progressInput.value = 0;
    dependencyInput.value = "";

    // Close Modal
    const modalEl = document.getElementById("addTaskModal");
    const modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (modalInstance) modalInstance.hide();

    // Reload
    loadProjects();

  } catch (err) {
    console.error("Add task error:", err);
    alertEl.textContent = err.message;
    alertEl.classList.remove("d-none");
  }
}

// Drag & Resize date change trigger
async function updateTaskTimeline(taskId, start, end) {
  if (!activeProject) return;

  // Format Dates back to YYYY-MM-DD
  const formatTime = (d) => {
    const date = new Date(d);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  };

  const startFormatted = formatTime(start);
  const endFormatted = formatTime(end);

  const updatedTasks = (activeProject.tasks || []).map(t => {
    if (t.id === taskId) {
      return { ...t, start: startFormatted, end: endFormatted };
    }
    return t;
  });

  try {
    const res = await fetch(`/api/projects/${activeProjectId}/tasks`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ tasks: updatedTasks })
    });
    if (res.ok) {
      activeProject.tasks = updatedTasks;
      // Re-populate dropdowns
      populateDependencyDropdowns();
    }
  } catch (err) {
    console.error("Gantt update task dates error:", err);
  }
}

// Progress handle drag update trigger
async function updateTaskProgress(taskId, progress) {
  if (!activeProject) return;

  const updatedTasks = (activeProject.tasks || []).map(t => {
    if (t.id === taskId) {
      return { ...t, progress: parseInt(progress) };
    }
    return t;
  });

  try {
    const res = await fetch(`/api/projects/${activeProjectId}/tasks`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ tasks: updatedTasks })
    });
    if (res.ok) {
      activeProject.tasks = updatedTasks;
    }
  } catch (err) {
    console.error("Gantt update task progress error:", err);
  }
}

// Edit details Modal view trigger
function openEditTaskModal(taskId) {
  if (!activeProject) return;
  const task = activeProject.tasks.find(t => t.id === taskId);
  if (!task) return;

  document.getElementById("edit-task-id").value = task.id;
  document.getElementById("edit-task-name").value = task.name;
  document.getElementById("edit-task-desc").value = task.description || "";
  document.getElementById("edit-task-images").value = "";
  document.getElementById("edit-task-start").value = task.start;
  document.getElementById("edit-task-end").value = task.end;
  document.getElementById("edit-task-assignee").value = task.assignee || "";
  document.getElementById("edit-task-progress").value = task.progress || 0;
  document.getElementById("new-task-comment-text").value = "";
  document.getElementById("edit-task-error-alert").classList.add("d-none");
  renderTaskImageGallery(task.id, task.images || []);
  renderTaskCommentsList(task.comments || []);

  // Dependency dropdown setup: excludes the current task to avoid circularity
  const editDepSelect = document.getElementById("edit-task-dependency");
  if (editDepSelect) {
    const otherTasks = activeProject.tasks.filter(t => t.id !== task.id);
    editDepSelect.innerHTML = '<option value="">None</option>' + 
      otherTasks.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    
    editDepSelect.value = task.dependencies || "";
  }

  // Adjust permissions on edit modal
  const currentUser = getCurrentUser();
  const isAdminUser = currentUser && currentUser.role === 'admin';
  
  document.getElementById("edit-task-name").disabled = !isAdminUser;
  document.getElementById("edit-task-desc").disabled = !isAdminUser;
  document.getElementById("edit-task-images").disabled = false;
  document.getElementById("edit-task-start").disabled = !isAdminUser;
  document.getElementById("edit-task-end").disabled = !isAdminUser;
  document.getElementById("edit-task-assignee").disabled = !isAdminUser;
  document.getElementById("edit-task-progress").disabled = !isAdminUser;
  document.getElementById("edit-task-dependency").disabled = !isAdminUser;

  const saveBtn = document.getElementById("save-task-btn");
  const deleteBtn = document.getElementById("delete-task-btn");
  const subtaskBtn = document.getElementById("add-subtask-btn");
  
  if (saveBtn) saveBtn.style.display = "inline-block";
  if (deleteBtn) deleteBtn.style.display = isAdminUser ? "inline-block" : "none";
  if (subtaskBtn) subtaskBtn.style.display = isAdminUser ? "inline-block" : "none";

  const editModal = new bootstrap.Modal(document.getElementById("editTaskModal"));
  editModal.show();
}

async function handleEditTask(e) {
  e.preventDefault();
  if (!activeProject) return;

  const id = document.getElementById("edit-task-id").value;
  const name = document.getElementById("edit-task-name").value.trim();
  const description = document.getElementById("edit-task-desc").value.trim();
  const imageInput = document.getElementById("edit-task-images");
  const start = document.getElementById("edit-task-start").value;
  const end = document.getElementById("edit-task-end").value;
  const assignee = document.getElementById("edit-task-assignee").value;
  const progress = parseInt(document.getElementById("edit-task-progress").value) || 0;
  const dependencies = document.getElementById("edit-task-dependency").value;
  const alertEl = document.getElementById("edit-task-error-alert");

  if (new Date(end) < new Date(start)) {
    alertEl.textContent = "End Date must be after Start Date.";
    alertEl.classList.remove("d-none");
    return;
  }

  alertEl.classList.add("d-none");
  const newImages = await readImageFiles(imageInput);

  const updatedTasks = (activeProject.tasks || []).map(t => {
    if (t.id === id) {
      return {
        ...t,
        id,
        name,
        description,
        start,
        end,
        assignee,
        progress,
        dependencies,
        images: [...(t.images || []), ...newImages]
      };
    }
    return t;
  });

  try {
    const res = await fetch(`/api/projects/${activeProjectId}/tasks`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ tasks: updatedTasks })
    });

    if (!res.ok) throw new Error("Failed to edit task");

    // Close Modal
    const modalEl = document.getElementById("editTaskModal");
    const modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (modalInstance) modalInstance.hide();

    // Reload
    loadProjects();

  } catch (err) {
    console.error("Edit task error:", err);
    alertEl.textContent = err.message;
    alertEl.classList.remove("d-none");
  }
}

function renderTaskCommentsList(comments) {
  const container = document.getElementById("edit-task-comments-list");
  if (!container) return;

  if (!comments.length) {
    container.innerHTML = `<div class="text-center py-3 text-muted small">No comments yet. Start the thread below.</div>`;
    return;
  }

  container.innerHTML = "";
  comments.forEach(c => {
    const div = document.createElement("div");
    div.className = "comment-item";
    const timeStr = formatCommentTime(c.timestamp);
    div.innerHTML = `
      <div class="comment-header">
        <span class="comment-author">${escapeHTML(c.username || "Unknown")}</span>
        <span class="comment-time">${timeStr}</span>
      </div>
      <p class="comment-text">${escapeHTML(c.text || "")}</p>
    `;
    container.appendChild(div);
  });
}

function renderTaskImageGallery(taskId, images) {
  const gallery = document.getElementById("edit-task-image-gallery");
  if (!gallery) return;

  gallery.innerHTML = "";

  if (!images.length) {
    gallery.innerHTML = `<span class="text-muted small italic">No images attached.</span>`;
    return;
  }

  const currentUser = getCurrentUser();
  const isAdminUser = currentUser && currentUser.role === 'admin';

  images.forEach((imgBase64, idx) => {
    const div = document.createElement("div");
    div.className = "ticket-image-wrapper";

    const img = document.createElement("img");
    img.src = imgBase64;
    img.alt = "Task attachment";
    img.onclick = () => {
      const win = window.open();
      if (win) {
        win.document.write(`<img src="${imgBase64}" style="max-width:100%; max-height:100%; display:block; margin:auto;">`);
      }
    };

    div.appendChild(img);

    if (isAdminUser) {
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "ticket-image-remove";
      removeBtn.innerHTML = "&times;";
      removeBtn.onclick = (e) => {
        e.stopPropagation();
        removeTaskImage(taskId, idx);
      };
      div.appendChild(removeBtn);
    }

    gallery.appendChild(div);
  });
}

async function removeTaskImage(taskId, index) {
  if (!activeProject || !activeProjectId) return;
  if (!confirm("Are you sure you want to remove this attached image?")) return;

  const updatedTasks = (activeProject.tasks || []).map(t => {
    if (t.id === taskId) {
      const images = [...(t.images || [])];
      images.splice(index, 1);
      return { ...t, images };
    }
    return t;
  });

  try {
    const res = await fetch(`/api/projects/${activeProjectId}/tasks`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ tasks: updatedTasks })
    });

    if (!res.ok) throw new Error("Failed to remove image");

    activeProject.tasks = updatedTasks;
    const task = activeProject.tasks.find(t => t.id === taskId);
    renderTaskImageGallery(taskId, task ? task.images || [] : []);
  } catch (err) {
    console.error("Remove task image error:", err);
    const alertEl = document.getElementById("edit-task-error-alert");
    alertEl.textContent = err.message;
    alertEl.classList.remove("d-none");
  }
}

async function handlePostTaskComment() {
  if (!activeProject || !activeProjectId) return;

  const currentUser = getCurrentUser();
  const taskId = document.getElementById("edit-task-id").value;
  const textInput = document.getElementById("new-task-comment-text");
  const text = textInput.value.trim();
  if (!currentUser || !taskId || !text) return;

  const comment = {
    username: currentUser.username,
    role: currentUser.role,
    text,
    timestamp: new Date().toISOString()
  };

  const updatedTasks = (activeProject.tasks || []).map(t => {
    if (t.id === taskId) {
      return {
        ...t,
        comments: [...(t.comments || []), comment]
      };
    }
    return t;
  });

  try {
    const res = await fetch(`/api/projects/${activeProjectId}/tasks`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ tasks: updatedTasks })
    });

    if (!res.ok) throw new Error("Failed to post comment");

    activeProject.tasks = updatedTasks;
    const updatedTask = activeProject.tasks.find(t => t.id === taskId);
    textInput.value = "";
    renderTaskCommentsList(updatedTask ? updatedTask.comments || [] : []);
  } catch (err) {
    console.error("Post task comment error:", err);
    const alertEl = document.getElementById("edit-task-error-alert");
    alertEl.textContent = err.message;
    alertEl.classList.remove("d-none");
  }
}

function formatCommentTime(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function handleDeleteTask() {
  if (!activeProject || !activeProjectId) return;
  const id = document.getElementById("edit-task-id").value;

  if (!confirm("Are you sure you want to delete this task?")) {
    return;
  }

  // Filter out task
  const updatedTasks = (activeProject.tasks || []).filter(t => t.id !== id);

  // Clear dependencies pointing to this deleted task
  const cleanedTasks = updatedTasks.map(t => {
    if (t.dependencies === id) {
      return { ...t, dependencies: "" };
    }
    return t;
  });

  try {
    const res = await fetch(`/api/projects/${activeProjectId}/tasks`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ tasks: cleanedTasks })
    });

    if (!res.ok) throw new Error("Failed to delete task");

    // Close Modal
    const modalEl = document.getElementById("editTaskModal");
    const modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (modalInstance) modalInstance.hide();

    // Reload
    loadProjects();

  } catch (err) {
    console.error("Delete task error:", err);
    alert("Failed to delete task");
  }
}

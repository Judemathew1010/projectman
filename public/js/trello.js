// Trello Task Board Logic

let projects = [];
let activeProjectId = '';
let activeProject = null;
let usersList = [];

document.addEventListener("DOMContentLoaded", () => {
  const currentUser = getCurrentUser();
  if (!currentUser) return;

  // Load project dropdown
  loadProjects();
  // Fetch users for assignees
  fetchUsers();

  // Selector listener
  const selector = document.getElementById("trello-project-selector");
  if (selector) {
    selector.addEventListener("change", (e) => {
      selectProject(e.target.value);
    });
  }

  // Column Inline form togglers
  const addColForm = document.getElementById("add-column-form");
  if (addColForm) {
    addColForm.addEventListener("submit", handleAddColumn);
  }

  // Ticket create form
  const addTicketForm = document.getElementById("add-ticket-form");
  if (addTicketForm) {
    addTicketForm.addEventListener("submit", handleAddTicket);
  }

  // Ticket edit form
  const editTicketForm = document.getElementById("edit-ticket-form");
  if (editTicketForm) {
    editTicketForm.addEventListener("submit", handleEditTicket);
  }

  // Delete ticket click
  const deleteTicketBtn = document.getElementById("delete-ticket-btn");
  if (deleteTicketBtn) {
    deleteTicketBtn.addEventListener("click", handleDeleteTicket);
  }
});

// Fetch user listing
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
  const addAssigneeSelect = document.getElementById("ticket-assignee");
  const editAssigneeSelect = document.getElementById("edit-ticket-assignee");
  
  if (addAssigneeSelect && editAssigneeSelect) {
    const optionsHtml = `
      <option value="">Unassigned</option>
      ${usersList.map(u => `<option value="${u.username}">${u.username}</option>`).join('')}
    `;
    addAssigneeSelect.innerHTML = optionsHtml;
    editAssigneeSelect.innerHTML = optionsHtml;
  }
}

// Fetch project listings
async function loadProjects(selectId = '') {
  try {
    const res = await fetch("/api/projects");
    if (!res.ok) throw new Error("Failed to load projects");
    projects = await res.json();

    const selector = document.getElementById("trello-project-selector");
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
  const selectState = document.getElementById("trello-select-project-state");
  const workspaceState = document.getElementById("trello-workspace");

  if (!id) {
    activeProject = null;
    if (selectState) selectState.classList.remove("d-none");
    if (workspaceState) workspaceState.classList.add("d-none");
    return;
  }

  activeProject = projects.find(p => p.id === id);
  if (!activeProject) return;

  if (selectState) selectState.classList.add("d-none");
  if (workspaceState) workspaceState.classList.remove("d-none");

  // Display project info
  const nameEl = document.getElementById("trello-project-name");
  if (nameEl) nameEl.textContent = activeProject.name;

  // Render Kanban Board
  renderKanbanBoard();
}

// Render columns & cards dynamically
function renderKanbanBoard() {
  const board = document.getElementById("kanban-board");
  if (!board) return;

  // Keep static Add Column button, remove other columns
  const cols = board.querySelectorAll(".kanban-column:not(#add-column-trigger)");
  cols.forEach(c => c.remove());

  const columns = activeProject ? activeProject.columns || [] : [];
  const trigger = document.getElementById("add-column-trigger");

  columns.forEach(col => {
    const colDiv = document.createElement("div");
    colDiv.className = "kanban-column";
    colDiv.id = `col-${col.id}`;
    colDiv.setAttribute("data-column-id", col.id);

    colDiv.innerHTML = `
      <div class="kanban-column-header">
        <h5 class="kanban-column-title">${escapeHTML(col.title)}</h5>
        <button class="btn btn-sm btn-link text-muted p-0" onclick="deleteColumn('${col.id}')">
          <i class="bi bi-x-lg text-danger-emphasis"></i>
        </button>
      </div>
      <div class="kanban-cards-container" id="cards-container-${col.id}" data-column-id="${col.id}">
        <!-- Cards populated below -->
      </div>
      <button class="btn btn-secondary-custom btn-sm w-100 mt-2 d-flex align-items-center justify-content-center gap-1 py-2" onclick="openAddTicketModal('${col.id}')">
        <i class="bi bi-plus-lg"></i> Add Ticket
      </button>
    `;

    // Populate Cards
    const cardsContainer = colDiv.querySelector(".kanban-cards-container");
    const cards = col.cards || [];
    
    cards.forEach(card => {
      const cardDiv = document.createElement("div");
      cardDiv.className = "kanban-card";
      cardDiv.setAttribute("data-card-id", card.id);
      cardDiv.onclick = () => openEditTicketModal(col.id, card.id);

      const priorityBadge = card.priority 
        ? `<span class="badge-priority-${card.priority} small">${card.priority.toUpperCase()}</span>`
        : '';

      const dueBadge = card.dueDate 
        ? `<span class="kanban-card-due" title="Due Date"><i class="bi bi-calendar-event"></i> ${formatDueDateTime(card.dueDate)}</span>`
        : '';
      
      const assigneeBadge = card.assignee 
        ? `<span class="kanban-card-assignee"><i class="bi bi-person"></i> ${escapeHTML(card.assignee)}</span>` 
        : '<span class="text-muted small italic">Unassigned</span>';

      const imagesPreview = (card.images && card.images.length > 0)
        ? `<div class="kanban-card-images-preview">${card.images.map(img => `<img src="${img}" class="kanban-card-thumb">`).join('')}</div>`
        : '';

      cardDiv.innerHTML = `
        <div class="kanban-card-title">${escapeHTML(card.title)}</div>
        <div class="kanban-card-desc">${escapeHTML(card.description || 'No description.')}</div>
        ${imagesPreview}
        <div class="kanban-card-footer mt-2">
          ${priorityBadge}
          ${dueBadge}
          ${assigneeBadge}
        </div>
      `;
      cardsContainer.appendChild(cardDiv);
    });

    // Insert column before the "Add Column" trigger
    board.insertBefore(colDiv, trigger);

    // Initialize SortableJS for cards container with click tolerance fix
    new Sortable(cardsContainer, {
      group: "kanban-cards",
      animation: 150,
      ghostClass: "bg-opacity-20",
      fallbackTolerance: 5, // Fixes unresponsive click by preventing drag start on tiny mouse movement
      onEnd: function() {
        syncKanbanState();
      }
    });
  });
}

// Format ISO date string into readable IST view format
function formatDueDateTime(isoString) {
  if (!isoString) return '';
  try {
    const dt = luxon.DateTime.fromISO(isoString).setZone('Asia/Kolkata');
    return dt.toFormat('MMM dd, hh:mm a');
  } catch (e) {
    return isoString;
  }
}

// Scrape board state from DOM and update server
async function syncKanbanState() {
  if (!activeProject) return;

  const updatedColumns = [];
  const colElements = document.querySelectorAll(".kanban-column:not(#add-column-trigger)");

  colElements.forEach(colEl => {
    const colId = colEl.getAttribute("data-column-id");
    const originalCol = activeProject.columns.find(c => c.id === colId);
    if (!originalCol) return;

    const cardsContainer = colEl.querySelector(".kanban-cards-container");
    const cardElements = cardsContainer.querySelectorAll(".kanban-card");
    const updatedCards = [];

    cardElements.forEach(cardEl => {
      const cardId = cardEl.getAttribute("data-card-id");
      // Find the card inside the active project columns data
      let cardData = null;
      for (const c of activeProject.columns) {
        const found = c.cards.find(card => card.id === cardId);
        if (found) {
          cardData = found;
          break;
        }
      }
      if (cardData) {
        updatedCards.push(cardData);
      }
    });

    updatedColumns.push({
      id: originalCol.id,
      title: originalCol.title,
      cards: updatedCards
    });
  });

  try {
    const res = await fetch(`/api/projects/${activeProjectId}/trello`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ columns: updatedColumns })
    });

    if (res.ok) {
      activeProject.columns = updatedColumns;
    } else {
      console.error("Failed to sync board state");
    }
  } catch (err) {
    console.error("Sync state error:", err);
  }
}

// Column operations
function showAddColumnInput() {
  document.getElementById("add-column-btn-content").classList.add("d-none");
  document.getElementById("add-column-form-content").classList.remove("d-none");
  document.getElementById("new-column-title").focus();
}

function hideAddColumnInput(e) {
  if (e) e.stopPropagation();
  document.getElementById("add-column-btn-content").classList.remove("d-none");
  document.getElementById("add-column-form-content").classList.add("d-none");
  document.getElementById("new-column-title").value = "";
}

async function handleAddColumn(e) {
  e.preventDefault();
  if (!activeProject) return;

  const titleInput = document.getElementById("new-column-title");
  const title = titleInput.value.trim();
  if (!title) return;

  const newCol = {
    id: 'col_' + Date.now(),
    title,
    cards: []
  };

  const updatedColumns = [...(activeProject.columns || []), newCol];

  try {
    const res = await fetch(`/api/projects/${activeProjectId}/trello`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ columns: updatedColumns })
    });

    if (res.ok) {
      activeProject.columns = updatedColumns;
      hideAddColumnInput();
      renderKanbanBoard();
    }
  } catch (err) {
    console.error("Add column error:", err);
  }
}

async function deleteColumn(colId) {
  if (!activeProject) return;
  const col = activeProject.columns.find(c => c.id === colId);
  if (!col) return;

  if (!confirm(`Are you sure you want to delete column "${col.title}"? All tickets inside will be lost.`)) {
    return;
  }

  const updatedColumns = activeProject.columns.filter(c => c.id !== colId);

  try {
    const res = await fetch(`/api/projects/${activeProjectId}/trello`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ columns: updatedColumns })
    });

    if (res.ok) {
      activeProject.columns = updatedColumns;
      renderKanbanBoard();
    }
  } catch (err) {
    console.error("Delete column error:", err);
  }
}

// Convert image file upload to Base64 promise
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
      console.error("Error reading ticket image:", err);
    }
  }
  return images;
}

// Ticket operations
function openAddTicketModal(colId) {
  document.getElementById("add-ticket-column-id").value = colId;
  
  // Reset fields
  document.getElementById("ticket-title").value = "";
  document.getElementById("ticket-desc").value = "";
  document.getElementById("ticket-due").value = "";
  document.getElementById("ticket-image").value = "";
  document.getElementById("ticket-assignee").value = "";
  document.getElementById("ticket-priority").value = "low";
  document.getElementById("ticket-error-alert").classList.add("d-none");

  const addModal = new bootstrap.Modal(document.getElementById("addTicketModal"));
  addModal.show();
}

async function handleAddTicket(e) {
  e.preventDefault();
  if (!activeProject) return;

  const colId = document.getElementById("add-ticket-column-id").value;
  const titleInput = document.getElementById("ticket-title");
  const descInput = document.getElementById("ticket-desc");
  const assigneeInput = document.getElementById("ticket-assignee");
  const priorityInput = document.getElementById("ticket-priority");
  const dueInput = document.getElementById("ticket-due");
  const imageInput = document.getElementById("ticket-image");
  const alertEl = document.getElementById("ticket-error-alert");

  alertEl.classList.add("d-none");

  const images = await readImageFiles(imageInput);

  const newCard = {
    id: 'card_' + Date.now(),
    title: titleInput.value.trim(),
    description: descInput.value.trim(),
    assignee: assigneeInput.value,
    priority: priorityInput.value,
    dueDate: dueInput.value || "",
    images: images,
    comments: []
  };

  const updatedColumns = activeProject.columns.map(col => {
    if (col.id === colId) {
      return {
        ...col,
        cards: [...(col.cards || []), newCard]
      };
    }
    return col;
  });

  try {
    const res = await fetch(`/api/projects/${activeProjectId}/trello`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ columns: updatedColumns })
    });

    if (!res.ok) throw new Error("Failed to add ticket");

    // Close Modal
    const modalEl = document.getElementById("addTicketModal");
    const modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (modalInstance) modalInstance.hide();

    // Reload
    activeProject.columns = updatedColumns;
    renderKanbanBoard();

  } catch (err) {
    console.error("Add ticket error:", err);
    alertEl.textContent = err.message;
    alertEl.classList.remove("d-none");
  }
}

// Edit ticket modal trigger
function openEditTicketModal(colId, cardId) {
  if (!activeProject) return;
  const location = findCardLocation(cardId, colId);
  if (!location) return;
  const { col, card } = location;
  colId = col.id;

  document.getElementById("edit-ticket-column-id").value = colId;
  document.getElementById("edit-ticket-id").value = cardId;
  document.getElementById("edit-ticket-title").value = card.title;
  document.getElementById("edit-ticket-desc").value = card.description || "";
  document.getElementById("edit-ticket-assignee").value = card.assignee || "";
  document.getElementById("edit-ticket-priority").value = card.priority || "low";
  document.getElementById("edit-ticket-due").value = card.dueDate || "";
  document.getElementById("edit-ticket-image").value = "";
  document.getElementById("new-comment-text").value = "";
  document.getElementById("edit-ticket-error-alert").classList.add("d-none");

  // Load Thumbnail Image Gallery
  renderImageGallery(colId, cardId, card.images || []);

  // Load Comments thread
  renderCommentsList(card.comments || []);

  // Clone and rebind Post Comment button
  const postBtn = document.getElementById("post-comment-btn");
  const newPostBtn = postBtn.cloneNode(true);
  postBtn.parentNode.replaceChild(newPostBtn, postBtn);
  newPostBtn.addEventListener("click", () => postComment(colId, cardId));

  const editModal = new bootstrap.Modal(document.getElementById("editTicketModal"));
  editModal.show();
}

function findCardLocation(cardId, preferredColId = '') {
  if (!activeProject || !Array.isArray(activeProject.columns)) return null;

  if (preferredColId) {
    const preferredCol = activeProject.columns.find(c => c.id === preferredColId);
    const preferredCard = preferredCol && (preferredCol.cards || []).find(c => c.id === cardId);
    if (preferredCol && preferredCard) {
      return { col: preferredCol, card: preferredCard };
    }
  }

  for (const col of activeProject.columns) {
    const card = (col.cards || []).find(c => c.id === cardId);
    if (card) {
      return { col, card };
    }
  }

  return null;
}

// Render image attachments
function renderImageGallery(colId, cardId, images) {
  const gallery = document.getElementById("edit-ticket-image-gallery");
  if (!gallery) return;

  gallery.innerHTML = "";
  
  if (images.length === 0) {
    gallery.innerHTML = `<span class="text-muted small italic">No images attached.</span>`;
    return;
  }

  images.forEach((imgBase64, idx) => {
    const div = document.createElement("div");
    div.className = "ticket-image-wrapper";

    const img = document.createElement("img");
    img.src = imgBase64;
    img.alt = "Attachment";
    img.onclick = () => {
      const win = window.open();
      if (win) {
        win.document.write(`<img src="${imgBase64}" style="max-width:100%; max-height:100%; display:block; margin:auto;">`);
      }
    };

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "ticket-image-remove";
    removeBtn.innerHTML = "&times;";
    removeBtn.onclick = (e) => {
      e.stopPropagation();
      removeTicketImage(colId, cardId, idx);
    };

    div.appendChild(img);
    div.appendChild(removeBtn);
    gallery.appendChild(div);
  });
}

// Remove image attachment
async function removeTicketImage(colId, cardId, index) {
  if (!confirm("Are you sure you want to remove this attached image?")) return;

  const col = activeProject.columns.find(c => c.id === colId);
  if (!col) return;
  const card = col.cards.find(c => c.id === cardId);
  if (!card) return;

  card.images.splice(index, 1);

  try {
    const res = await fetch(`/api/projects/${activeProjectId}/trello`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ columns: activeProject.columns })
    });

    if (res.ok) {
      renderImageGallery(colId, cardId, card.images);
      renderKanbanBoard();
    }
  } catch (err) {
    console.error("Remove image error:", err);
  }
}

// Render comments thread
function renderCommentsList(comments) {
  const container = document.getElementById("edit-ticket-comments-list");
  if (!container) return;

  container.innerHTML = "";

  if (comments.length === 0) {
    container.innerHTML = `<div class="text-center py-3 text-muted small">No comments logged. Post one below.</div>`;
    return;
  }

  comments.forEach(c => {
    const div = document.createElement("div");
    div.className = "comment-item";

    const dt = luxon.DateTime.fromISO(c.timestamp).setZone('Asia/Kolkata');
    const timeStr = dt.toFormat('MMM dd, yyyy hh:mm a');

    div.innerHTML = `
      <div class="comment-header">
        <span class="comment-author">${escapeHTML(c.username)}</span>
        <span class="comment-time">${timeStr}</span>
      </div>
      <p class="comment-text">${escapeHTML(c.text)}</p>
    `;
    container.appendChild(div);
  });

  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

// Post comment action
async function postComment(colId, cardId) {
  const textInput = document.getElementById("new-comment-text");
  const text = textInput.value.trim();
  if (!text) return;

  const currentUser = getCurrentUser();
  if (!currentUser) return;

  const col = activeProject.columns.find(c => c.id === colId);
  if (!col) return;
  const card = col.cards.find(c => c.id === cardId);
  if (!card) return;

  const commentObj = {
    username: currentUser.username,
    text: text,
    timestamp: new Date().toISOString()
  };

  if (!card.comments) card.comments = [];
  card.comments.push(commentObj);

  try {
    const res = await fetch(`/api/projects/${activeProjectId}/trello`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ columns: activeProject.columns })
    });

    if (res.ok) {
      textInput.value = "";
      renderCommentsList(card.comments);
    }
  } catch (err) {
    console.error("Post comment error:", err);
  }
}

async function handleEditTicket(e) {
  e.preventDefault();
  if (!activeProject) return;

  const colId = document.getElementById("edit-ticket-column-id").value;
  const cardId = document.getElementById("edit-ticket-id").value;
  const title = document.getElementById("edit-ticket-title").value.trim();
  const description = document.getElementById("edit-ticket-desc").value.trim();
  const assignee = document.getElementById("edit-ticket-assignee").value;
  const priority = document.getElementById("edit-ticket-priority").value;
  const due = document.getElementById("edit-ticket-due").value;
  const imageInput = document.getElementById("edit-ticket-image");
  const alertEl = document.getElementById("edit-ticket-error-alert");

  alertEl.classList.add("d-none");

  // Get active card reference
  const col = activeProject.columns.find(c => c.id === colId);
  if (!col) return;
  const card = col.cards.find(c => c.id === cardId);
  if (!card) return;

  let images = [...(card.images || [])];
  images = [...images, ...await readImageFiles(imageInput)];

  const updatedColumns = activeProject.columns.map(col => {
    if (col.id === colId) {
      const updatedCards = col.cards.map(c => {
        if (c.id === cardId) {
          return {
            id: cardId,
            title,
            description,
            assignee,
            priority,
            dueDate: due,
            images: images,
            comments: card.comments || []
          };
        }
        return c;
      });
      return { ...col, cards: updatedCards };
    }
    return col;
  });

  try {
    const res = await fetch(`/api/projects/${activeProjectId}/trello`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ columns: updatedColumns })
    });

    if (!res.ok) throw new Error("Failed to edit ticket");

    // Close Modal
    const modalEl = document.getElementById("editTicketModal");
    const modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (modalInstance) modalInstance.hide();

    activeProject.columns = updatedColumns;
    renderKanbanBoard();

  } catch (err) {
    console.error("Edit ticket error:", err);
    alertEl.textContent = err.message;
    alertEl.classList.remove("d-none");
  }
}

async function handleDeleteTicket() {
  if (!activeProject) return;

  const colId = document.getElementById("edit-ticket-column-id").value;
  const cardId = document.getElementById("edit-ticket-id").value;

  if (!confirm("Are you sure you want to remove this ticket?")) {
    return;
  }

  const updatedColumns = activeProject.columns.map(col => {
    if (col.id === colId) {
      const updatedCards = col.cards.filter(c => c.id !== cardId);
      return { ...col, cards: updatedCards };
    }
    return col;
  });

  try {
    const res = await fetch(`/api/projects/${activeProjectId}/trello`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ columns: updatedColumns })
    });

    if (!res.ok) throw new Error("Failed to delete ticket");

    // Close Modal
    const modalEl = document.getElementById("editTicketModal");
    const modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (modalInstance) modalInstance.hide();

    activeProject.columns = updatedColumns;
    renderKanbanBoard();

  } catch (err) {
    console.error("Delete ticket error:", err);
    alert("Could not remove ticket.");
  }
}

// Utility html escaping
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

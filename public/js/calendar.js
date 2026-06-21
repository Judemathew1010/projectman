// Timeline Scheduler Logic (IST Aligned)

let currentRangeStart = null; // Luxon DateTime (active range start in IST)
let currentViewMode = 'today';
let usersList = [];
let availabilitySlots = [];
let editingSlot = null;

document.addEventListener("DOMContentLoaded", () => {
  const currentUser = getCurrentUser();
  if (!currentUser) return;

  // Setup current range start, aligned to India Time
  const nowIST = luxon.DateTime.now().setZone('Asia/Kolkata');
  currentRangeStart = nowIST.startOf('day');

  // Load Nav buttons
  document.getElementById("prev-week-btn").addEventListener("click", () => navigateRange(-1));
  document.getElementById("next-week-btn").addEventListener("click", () => navigateRange(1));
  document.getElementById("today-btn").addEventListener("click", goToToday);

  document.querySelectorAll(".availability-view-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".availability-view-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      setViewMode(btn.getAttribute("data-view"));
    });
  });

  // Load initial dataset
  loadSchedulerData();

  // Modal setup
  const form = document.getElementById("add-availability-form");
  if (form) {
    form.addEventListener("submit", handleFormSubmit);
  }

  const deleteBtn = document.getElementById("modal-delete-slot-btn");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", handleDeleteSlot);
  }
});

// Navigate active range helper
function navigateRange(offset) {
  if (currentViewMode === 'month') {
    currentRangeStart = currentRangeStart.plus({ months: offset }).startOf('month');
  } else if (currentViewMode === 'week') {
    currentRangeStart = currentRangeStart.plus({ weeks: offset }).startOf('week');
  } else {
    currentRangeStart = currentRangeStart.plus({ days: offset }).startOf('day');
  }
  renderScheduler();
}

function goToToday() {
  const nowIST = luxon.DateTime.now().setZone('Asia/Kolkata');
  currentRangeStart = getRangeStartForMode(nowIST, currentViewMode);
  renderScheduler();
}

function setViewMode(mode) {
  currentViewMode = mode || 'today';
  const nowIST = luxon.DateTime.now().setZone('Asia/Kolkata');
  currentRangeStart = getRangeStartForMode(nowIST, currentViewMode);
  renderScheduler();
}

function getRangeStartForMode(date, mode) {
  if (mode === 'month') return date.startOf('month');
  if (mode === 'week') return date.startOf('week');
  return date.startOf('day');
}

// Fetch all scheduler dependencies
async function loadSchedulerData() {
  try {
    // 1. Fetch users
    const usersRes = await fetch("/api/users");
    if (usersRes.ok) {
      usersList = await usersRes.json();
      populateUserDropdown();
    }

    // 2. Fetch slots
    await fetchSlots();

    // 3. Render
    renderScheduler();
  } catch (err) {
    console.error("Error loading timeline data:", err);
  }
}

async function fetchSlots() {
  try {
    const res = await fetch("/api/availability");
    if (res.ok) {
      availabilitySlots = await res.json();
    }
  } catch (err) {
    console.error("Error loading availability slots:", err);
  }
}

function populateUserDropdown() {
  const userSelect = document.getElementById("slot-username");
  if (!userSelect) return;

  const currentUser = getCurrentUser();
  userSelect.innerHTML = "";

  if (currentUser.role === 'admin') {
    usersList.forEach(u => {
      const opt = document.createElement("option");
      opt.value = u.username;
      opt.textContent = u.username;
      if (u.username === currentUser.username) opt.selected = true;
      userSelect.appendChild(opt);
    });
    userSelect.disabled = false;
  } else {
    const opt = document.createElement("option");
    opt.value = currentUser.username;
    opt.textContent = currentUser.username;
    opt.selected = true;
    userSelect.appendChild(opt);
    userSelect.disabled = true;
  }
}

// Calculate short name (initials)
function getShortName(username) {
  if (!username) return '??';
  if (username.toLowerCase() === 'admin12') return 'AD';
  if (username.length <= 2) return username.toUpperCase();
  return username.substring(0, 2).toUpperCase();
}

// Map slots and render timeline grid
function renderScheduler() {
  const container = document.getElementById("timeline-scheduler");
  const weekLabel = document.getElementById("week-display-label");
  if (!container) return;

  const visibleDays = getVisibleDays();
  const rangeEnd = visibleDays[visibleDays.length - 1];
  weekLabel.textContent = formatRangeLabel(visibleDays[0], rangeEnd);

  // Clear previous grid
  container.innerHTML = "";

  // Table setup
  const table = document.createElement("table");
  table.className = "scheduler-table text-white";

  // Header row
  let headerHtml = `
    <thead>
      <tr>
        <th scope="col" class="py-3">MEMBER</th>
  `;
  visibleDays.forEach(day => {
    headerHtml += `
      <th scope="col" class="py-3 text-center">
        <span class="d-block fw-bold">${day.toFormat('cccc')}</span>
        <span class="text-muted small">${day.toFormat('MMM dd')}</span>
      </th>
    `;
  });
  headerHtml += `
      </tr>
    </thead>
  `;
  table.innerHTML = headerHtml;

  // Table body
  const tbody = document.createElement("tbody");
  
  if (usersList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${visibleDays.length + 1}" class="text-center py-5 text-muted">No system members registered.</td>
      </tr>
    `;
    table.appendChild(tbody);
    container.appendChild(table);
    return;
  }

  usersList.forEach(user => {
    const tr = document.createElement("tr");
    tr.className = "scheduler-row";

    // Column 1: Member Name
    const userCell = document.createElement("td");
    userCell.className = "scheduler-user-cell py-3";
    userCell.innerHTML = `
      <div class="d-flex align-items-center gap-2">
        <div class="avatar-sm" style="background-color: ${user.role === 'admin' ? 'var(--accent-purple)' : 'var(--accent-blue)'}">
          ${getShortName(user.username)}
        </div>
        <div>
          <div class="fw-bold">${user.username}</div>
          <div class="text-muted small" style="font-size: 0.7rem;">${user.role}</div>
        </div>
      </div>
    `;
    tr.appendChild(userCell);

    // Availability slots per visible day
    visibleDays.forEach(day => {
      const cell = document.createElement("td");
      cell.className = "py-2 px-2";

      const cellDateStr = day.toFormat('yyyy-MM-dd');
      
      // Filter slots for this user overlapping this specific date in IST
      const daySlots = availabilitySlots.filter(slot => {
        if (slot.username.toLowerCase() !== user.username.toLowerCase()) return false;

        const startIST = luxon.DateTime.fromISO(slot.start).setZone('Asia/Kolkata');
        const endIST = luxon.DateTime.fromISO(slot.end).setZone('Asia/Kolkata');
        
        const startDayStr = startIST.toFormat('yyyy-MM-dd');
        const endDayStr = endIST.toFormat('yyyy-MM-dd');

        // Check if cellDateStr is inside the slot range inclusive
        return (cellDateStr >= startDayStr && cellDateStr <= endDayStr);
      });

      // Sort slots chronologically
      daySlots.sort((a, b) => new Date(a.start) - new Date(b.start));

      daySlots.forEach(slot => {
        const startIST = luxon.DateTime.fromISO(slot.start).setZone('Asia/Kolkata');
        const endIST = luxon.DateTime.fromISO(slot.end).setZone('Asia/Kolkata');
        
        const timeStr = `${startIST.toFormat('HH:mm')} - ${endIST.toFormat('HH:mm')}`;
        const initials = getShortName(slot.username);

        const slotBlock = document.createElement("div");
        slotBlock.className = "scheduler-slot-block";
        slotBlock.title = `${slot.username}\nIST: ${timeStr}\nOrig Zone: ${slot.timezone}\nNotes: ${slot.notes || 'None'}`;
        slotBlock.innerHTML = `
          <div class="fw-bold">${initials} <span class="fw-normal text-white-50">(${timeStr})</span></div>
          ${slot.notes ? `<div class="text-truncate text-muted small" style="font-size: 0.65rem;">${escapeHTML(slot.notes)}</div>` : ''}
        `;

        slotBlock.addEventListener("click", (e) => {
          e.stopPropagation();
          openEditModal(slot);
        });

        cell.appendChild(slotBlock);
      });

      // Double-click or click empty cell to add slot
      const currentUser = getCurrentUser();
      const canLog = currentUser && (currentUser.role === 'admin' || currentUser.username.toLowerCase() === user.username.toLowerCase());
      
      if (canLog) {
        cell.style.cursor = "pointer";
        cell.addEventListener("click", (e) => {
          if (e.target === cell) {
            openAddModalForDay(user.username, cellDateStr);
          }
        });
      }

      tr.appendChild(cell);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.appendChild(table);
}

function getVisibleDays() {
  if (currentViewMode === 'month') {
    const days = [];
    const monthEnd = currentRangeStart.endOf('month');
    let cursor = currentRangeStart.startOf('day');
    while (cursor <= monthEnd) {
      days.push(cursor);
      cursor = cursor.plus({ days: 1 });
    }
    return days;
  }

  const dayCount = currentViewMode === 'week' ? 7 : 1;
  const days = [];
  for (let i = 0; i < dayCount; i++) {
    days.push(currentRangeStart.plus({ days: i }));
  }
  return days;
}

function formatRangeLabel(start, end) {
  if (currentViewMode === 'today') {
    return start.toFormat('MMM dd, yyyy');
  }

  if (currentViewMode === 'month') {
    return start.toFormat('MMMM yyyy');
  }

  return `${start.toFormat('MMM dd')} - ${end.toFormat('MMM dd, yyyy')}`;
}

// Modal open handlers
function openAddModal() {
  editingSlot = null;
  resetModalForm();
  
  document.getElementById("addAvailabilityModalLabel").innerHTML = `<i class="bi bi-calendar-plus"></i> Add Time Availability`;
  document.getElementById("modal-delete-slot-btn").classList.add("d-none");
  document.getElementById("modal-save-btn").textContent = "Save Slot";

  const modal = new bootstrap.Modal(document.getElementById("addAvailabilityModal"));
  modal.show();
}

function openAddModalForDay(username, dateStr) {
  editingSlot = null;
  resetModalForm();

  document.getElementById("addAvailabilityModalLabel").innerHTML = `<i class="bi bi-calendar-plus"></i> Add Time Availability`;
  document.getElementById("modal-delete-slot-btn").classList.add("d-none");
  document.getElementById("modal-save-btn").textContent = "Save Slot";

  // Pre-fill user dropdown
  const userSelect = document.getElementById("slot-username");
  if (userSelect) {
    userSelect.value = username;
  }

  // Pre-fill start/end inputs in IST (or browser local, but defaulting to selected day at 09:00 - 17:00 IST)
  // Let's set datetime-local inputs. Since datetime-local inputs represent local timezone values,
  // we set them using dateStr + 'T09:00' and 'T17:00'.
  document.getElementById("slot-start").value = `${dateStr}T09:00`;
  document.getElementById("slot-end").value = `${dateStr}T17:00`;
  
  // Set default entry timezone as Indian Time since we prefilled in IST
  document.getElementById("slot-timezone").value = "Asia/Kolkata";

  const modal = new bootstrap.Modal(document.getElementById("addAvailabilityModal"));
  modal.show();
}

function openEditModal(slot) {
  editingSlot = slot;
  resetModalForm();

  const currentUser = getCurrentUser();
  const isAdminOrOwner = currentUser && (currentUser.role === 'admin' || currentUser.username.toLowerCase() === slot.username.toLowerCase());

  document.getElementById("addAvailabilityModalLabel").innerHTML = `<i class="bi bi-pencil-square"></i> Edit Time Availability`;
  document.getElementById("slot-id").value = slot.id;
  document.getElementById("slot-username").value = slot.username;
  document.getElementById("slot-timezone").value = slot.timezone;
  document.getElementById("slot-notes").value = slot.notes || "";

  // Convert UTC ISO dates to inputs matching the slot's original entry timezone!
  const startDt = luxon.DateTime.fromISO(slot.start).setZone(slot.timezone);
  const endDt = luxon.DateTime.fromISO(slot.end).setZone(slot.timezone);

  document.getElementById("slot-start").value = startDt.toFormat("yyyy-MM-dd'T'HH:mm");
  document.getElementById("slot-end").value = endDt.toFormat("yyyy-MM-dd'T'HH:mm");

  // Show delete button
  const deleteBtn = document.getElementById("modal-delete-slot-btn");
  if (deleteBtn) {
    if (isAdminOrOwner) {
      deleteBtn.classList.remove("d-none");
    } else {
      deleteBtn.classList.add("d-none");
    }
  }

  // Check read-only state
  const formFields = ['slot-username', 'slot-timezone', 'slot-start', 'slot-end', 'slot-notes', 'slot-repeat-scope'];
  formFields.forEach(fieldId => {
    const el = document.getElementById(fieldId);
    if (el) {
      // Disabled if not owner/admin. Username is always disabled on edit.
      el.disabled = !isAdminOrOwner || fieldId === 'slot-username';
    }
  });

  const saveBtn = document.getElementById("modal-save-btn");
  if (saveBtn) {
    saveBtn.textContent = "Save Changes";
    saveBtn.style.display = isAdminOrOwner ? "inline-block" : "none";
  }

  const modal = new bootstrap.Modal(document.getElementById("addAvailabilityModal"));
  modal.show();
}

function resetModalForm() {
  document.getElementById("slot-id").value = "";
  document.getElementById("slot-notes").value = "";
  document.getElementById("slot-start").value = "";
  document.getElementById("slot-end").value = "";
  document.getElementById("slot-repeat-scope").value = "single";
  document.getElementById("modal-error-alert").classList.add("d-none");

  // Reset disabled states
  const formFields = ['slot-username', 'slot-timezone', 'slot-start', 'slot-end', 'slot-notes', 'slot-repeat-scope'];
  formFields.forEach(fieldId => {
    const el = document.getElementById(fieldId);
    if (el) el.disabled = false;
  });
  
  populateUserDropdown(); // Refresh selections
}

// Add / Update handler
async function handleFormSubmit(e) {
  e.preventDefault();

  const slotId = document.getElementById("slot-id").value;
  const username = document.getElementById("slot-username").value;
  const timezone = document.getElementById("slot-timezone").value;
  const startVal = document.getElementById("slot-start").value;
  const endVal = document.getElementById("slot-end").value;
  const notes = document.getElementById("slot-notes").value.trim();
  const repeatScope = document.getElementById("slot-repeat-scope").value;
  const alertEl = document.getElementById("modal-error-alert");

  if (!startVal || !endVal) {
    alertEl.textContent = "Start and End times are required.";
    alertEl.classList.remove("d-none");
    return;
  }

  // Convert inputs to UTC using the selected entry timezone
  const entryTz = timezone === 'local' ? luxon.Settings.defaultZone.name : timezone;
  const startDt = luxon.DateTime.fromISO(startVal, { zone: entryTz });
  const endDt = luxon.DateTime.fromISO(endVal, { zone: entryTz });

  if (endDt <= startDt) {
    alertEl.textContent = "End time must be after start time.";
    alertEl.classList.remove("d-none");
    return;
  }

  const payload = {
    username,
    start: startDt.toUTC().toISO(),
    end: endDt.toUTC().toISO(),
    timezone: entryTz,
    notes
  };

  alertEl.classList.add("d-none");

  try {
    if (repeatScope === "single") {
      await saveAvailabilitySlot(slotId, payload);
    } else {
      await saveAvailabilityBulk({
        slotId,
        username,
        timezone: entryTz,
        startDt,
        endDt,
        notes,
        repeatScope
      });
    }

    // Close modal
    const modalEl = document.getElementById("addAvailabilityModal");
    const modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (modalInstance) modalInstance.hide();

    // Reload and render
    await fetchSlots();
    renderScheduler();

  } catch (err) {
    console.error("Save slot error:", err);
    alertEl.textContent = err.message;
    alertEl.classList.remove("d-none");
  }
}

async function saveAvailabilitySlot(slotId, payload) {
  const url = slotId ? `/api/availability/${slotId}` : '/api/availability';
  const method = slotId ? 'PUT' : 'POST';

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to save slot details");
  }

  return data;
}

async function saveAvailabilityBulk({ slotId, username, timezone, startDt, endDt, notes, repeatScope }) {
  const payloads = buildRepeatedSlotPayloads({ username, timezone, startDt, endDt, notes, repeatScope });
  const existingMatches = slotId ? findMatchingRepeatedSlots({ slotId, username, timezone, repeatScope }) : [];
  const matchesByDate = new Map(existingMatches.map(slot => {
    const slotDate = luxon.DateTime.fromISO(slot.start).setZone(timezone).toFormat("yyyy-MM-dd");
    return [slotDate, slot];
  }));

  for (const payload of payloads) {
    const payloadDate = luxon.DateTime.fromISO(payload.start).setZone(timezone).toFormat("yyyy-MM-dd");
    const matchingSlot = matchesByDate.get(payloadDate);
    await saveAvailabilitySlot(matchingSlot ? matchingSlot.id : "", payload);
  }
}

function buildRepeatedSlotPayloads({ username, timezone, startDt, endDt, notes, repeatScope }) {
  const rangeStart = repeatScope === "month" ? startDt.startOf("month") : startDt.startOf("week");
  const rangeEnd = repeatScope === "month" ? startDt.endOf("month") : startDt.endOf("week");
  const duration = endDt.diff(startDt);
  const payloads = [];

  let cursor = rangeStart.startOf("day");
  while (cursor <= rangeEnd) {
    const repeatedStart = cursor.set({
      hour: startDt.hour,
      minute: startDt.minute,
      second: 0,
      millisecond: 0
    });
    const repeatedEnd = repeatedStart.plus(duration);

    payloads.push({
      username,
      start: repeatedStart.toUTC().toISO(),
      end: repeatedEnd.toUTC().toISO(),
      timezone,
      notes
    });

    cursor = cursor.plus({ days: 1 });
  }

  return payloads;
}

function findMatchingRepeatedSlots({ slotId, username, timezone, repeatScope }) {
  const originalSlot = availabilitySlots.find(slot => slot.id === slotId);
  if (!originalSlot) return [];

  const originalStart = luxon.DateTime.fromISO(originalSlot.start).setZone(originalSlot.timezone || timezone);
  const originalEnd = luxon.DateTime.fromISO(originalSlot.end).setZone(originalSlot.timezone || timezone);
  const originalDurationMinutes = Math.round(originalEnd.diff(originalStart, "minutes").minutes);
  const rangeStart = repeatScope === "month" ? originalStart.startOf("month") : originalStart.startOf("week");
  const rangeEnd = repeatScope === "month" ? originalStart.endOf("month") : originalStart.endOf("week");

  return availabilitySlots.filter(slot => {
    if (slot.username.toLowerCase() !== username.toLowerCase()) return false;

    const slotZone = slot.timezone || timezone;
    const slotStart = luxon.DateTime.fromISO(slot.start).setZone(slotZone);
    const slotEnd = luxon.DateTime.fromISO(slot.end).setZone(slotZone);
    const slotDurationMinutes = Math.round(slotEnd.diff(slotStart, "minutes").minutes);

    return slotStart >= rangeStart &&
      slotStart <= rangeEnd &&
      slotStart.hour === originalStart.hour &&
      slotStart.minute === originalStart.minute &&
      slotDurationMinutes === originalDurationMinutes;
  });
}

// Delete slot handler
async function handleDeleteSlot() {
  const slotId = document.getElementById("slot-id").value;
  const username = document.getElementById("slot-username").value;
  const timezone = document.getElementById("slot-timezone").value;
  const repeatScope = document.getElementById("slot-repeat-scope").value;
  if (!slotId) return;

  const slotsToDelete = repeatScope === "single"
    ? availabilitySlots.filter(slot => slot.id === slotId)
    : findMatchingRepeatedSlots({ slotId, username, timezone, repeatScope });

  if (!slotsToDelete.length) return;

  const deleteLabel = repeatScope === "single"
    ? "this availability slot"
    : `${slotsToDelete.length} matching availability slots`;

  if (!confirm(`Are you sure you want to remove ${deleteLabel}?`)) {
    return;
  }

  try {
    for (const slot of slotsToDelete) {
      const res = await fetch(`/api/availability/${slot.id}`, {
        method: "DELETE"
      });

      if (!res.ok) throw new Error("Failed to delete slot");
    }

    // Close modal
    const modalEl = document.getElementById("addAvailabilityModal");
    const modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (modalInstance) modalInstance.hide();

    // Reload and render
    await fetchSlots();
    renderScheduler();

  } catch (err) {
    console.error("Delete slot error:", err);
    alert("Could not remove availability slot.");
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

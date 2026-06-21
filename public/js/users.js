// User Management Logic

document.addEventListener("DOMContentLoaded", () => {
  loadUsers();

  const form = document.getElementById("add-user-form");
  if (form) {
    form.addEventListener("submit", handleAddUser);
  }
});

async function loadUsers() {
  const tableBody = document.getElementById("users-table-body");
  if (!tableBody) return;

  try {
    const response = await fetch("/api/users");
    if (!response.ok) {
      throw new Error("Failed to fetch users");
    }
    const users = await response.json();

    tableBody.innerHTML = "";

    if (users.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="3" class="text-center py-4 text-muted">No users found</td>
        </tr>
      `;
      return;
    }

    users.forEach(user => {
      const tr = document.createElement("tr");
      tr.style.borderBottom = "1px solid var(--border-color)";

      const isPrimaryAdmin = user.username.toLowerCase() === 'admin12';
      const roleBadgeClass = user.role === 'admin' ? 'bg-danger' : 'bg-primary';

      tr.innerHTML = `
        <td class="py-3">
          <div class="d-flex align-items-center gap-2">
            <div class="avatar-sm" style="background-color: ${user.role === 'admin' ? 'var(--accent-purple)' : 'var(--accent-blue)'}">
              ${user.username.charAt(0).toUpperCase()}
            </div>
            <span class="fw-bold">${user.username}</span>
          </div>
        </td>
        <td class="py-3">
          <span class="badge ${roleBadgeClass} bg-opacity-25 text-white border border-${user.role === 'admin' ? 'danger' : 'primary'} border-opacity-25 small px-2.5 py-1.5">
            ${user.role.toUpperCase()}
          </span>
        </td>
        <td class="py-3 text-end">
          ${isPrimaryAdmin 
            ? `<span class="text-muted small italic me-2">System Reserved</span>`
            : `<button class="btn btn-danger btn-sm bg-danger bg-opacity-10 border-danger border-opacity-20 text-danger" onclick="deleteUser('${user.username}')">
                 <i class="bi bi-trash"></i> Delete
               </button>`
          }
        </td>
      `;
      tableBody.appendChild(tr);
    });

  } catch (err) {
    console.error("Error loading users:", err);
    tableBody.innerHTML = `
      <tr>
        <td colspan="3" class="text-center py-4 text-danger">Error loading users. Please refresh the page.</td>
      </tr>
    `;
  }
}

async function handleAddUser(e) {
  e.preventDefault();

  const usernameInput = document.getElementById("new-username");
  const passwordInput = document.getElementById("new-password");
  const roleInput = document.getElementById("new-role");
  const alertEl = document.getElementById("user-form-alert");

  if (!usernameInput || !passwordInput || !roleInput) return;

  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  const role = roleInput.value;

  alertEl.classList.add("d-none");

  try {
    const response = await fetch("/api/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username, password, role })
    });

    const data = await response.json();

    if (!response.ok) {
      alertEl.textContent = data.error || "Failed to create user";
      alertEl.classList.remove("d-none");
      return;
    }

    // Reset Form
    usernameInput.value = "";
    passwordInput.value = "";
    roleInput.value = "user";

    // Reload Table
    loadUsers();

  } catch (err) {
    console.error("Error creating user:", err);
    alertEl.textContent = "Server connection error.";
    alertEl.classList.remove("d-none");
  }
}

async function deleteUser(username) {
  if (!confirm(`Are you sure you want to delete user "${username}"?`)) {
    return;
  }

  try {
    const response = await fetch(`/api/users/${username}`, {
      method: "DELETE"
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Failed to delete user");
      return;
    }

    // Reload Table
    loadUsers();

  } catch (err) {
    console.error("Error deleting user:", err);
    alert("Server error when deleting user.");
  }
}

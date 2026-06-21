document.addEventListener("DOMContentLoaded", () => {
  const sidebarContainer = document.getElementById('sidebar-container');
  if (!sidebarContainer) return;

  fetch('components/sidebar.html')
    .then(response => {
      if (!response.ok) throw new Error('Failed to load sidebar component');
      return response.text();
    })
    .then(html => {
      sidebarContainer.innerHTML = html;
      initSidebar();
    })
    .catch(err => {
      console.error('Error loading sidebar:', err);
    });
});

function initSidebar() {
  const currentUser = getCurrentUser();
  if (!currentUser) return;

  // Set user display details
  const nameEl = document.getElementById('user-display-name');
  const roleEl = document.getElementById('user-display-role');
  const avatarEl = document.getElementById('user-avatar');

  if (nameEl) nameEl.textContent = currentUser.username;
  if (roleEl) roleEl.textContent = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
  if (avatarEl) avatarEl.textContent = currentUser.username.charAt(0).toUpperCase();

  // Show User Management tab if admin
  if (currentUser.role === 'admin') {
    const adminSection = document.getElementById('nav-admin-section');
    if (adminSection) {
      adminSection.classList.remove('d-none');
    }
  }

  // Highlight active tab
  const path = window.location.pathname;
  let activeId = '';
  
  if (path.endsWith('calendar.html')) {
    activeId = 'nav-calendar';
  } else if (path.endsWith('projects.html')) {
    activeId = 'nav-projects';
  } else if (path.endsWith('trello.html')) {
    activeId = 'nav-trello';
  } else if (path.endsWith('notifications.html')) {
    activeId = 'nav-notifications';
  } else if (path.endsWith('users.html')) {
    activeId = 'nav-users';
  }

  if (activeId) {
    const activeLink = document.getElementById(activeId);
    if (activeLink) {
      activeLink.classList.add('active');
    }
  }
}

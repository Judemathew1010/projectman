// Authentication Helper Module

const API_BASE = '/api';

// Get current user from localStorage
function getCurrentUser() {
  const userStr = localStorage.getItem('currentUser');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch (e) {
    return null;
  }
}

// Save user session
function setCurrentUser(user) {
  localStorage.setItem('currentUser', JSON.stringify(user));
}

// Clear user session
function logout() {
  localStorage.removeItem('currentUser');
  window.location.href = 'index.html';
}

// Check page authentication status
function checkAuth() {
  const user = getCurrentUser();
  const path = window.location.pathname;
  const isLoginPage = path.endsWith('index.html') || path === '/' || path.endsWith('/');

  if (!user) {
    // If not logged in and not on login page, redirect to login
    if (!isLoginPage) {
      window.location.href = 'index.html';
    }
  } else {
    // If logged in and on login page, redirect to home page (calendar)
    if (isLoginPage) {
      window.location.href = 'calendar.html';
    }

    // Role-based route guard
    if (path.endsWith('users.html') && user.role !== 'admin') {
      alert("Access Denied: Admin role required.");
      window.location.href = 'calendar.html';
    }
  }
}

// Global script execution
checkAuth();

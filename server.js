const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const CACHE_FILE = path.join(__dirname, 'cache.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper functions for reading and writing JSON cache
function readCache() {
  try {
    if (!fs.existsSync(CACHE_FILE)) {
      const initialData = {
        users: [{ username: 'admin12', password: 'admin42', role: 'admin' }],
        availability: [],
        projects: []
      };
      fs.writeFileSync(CACHE_FILE, JSON.stringify(initialData, null, 2));
      return initialData;
    }
    const data = fs.readFileSync(CACHE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading cache file:", err);
    return { users: [], availability: [], projects: [] };
  }
}

function writeCache(data) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    console.error("Error writing cache file:", err);
    return false;
  }
}

// ---------------- AUTHENTICATION ----------------
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const cache = readCache();
  const user = cache.users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);

  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  res.json({ username: user.username, role: user.role });
});

// ---------------- USER MANAGEMENT ----------------
app.get('/api/users', (req, res) => {
  const cache = readCache();
  // Don't send passwords back to client
  const safeUsers = cache.users.map(u => ({ username: u.username, role: u.role }));
  res.json(safeUsers);
});

app.post('/api/users', (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const cache = readCache();
  const exists = cache.users.some(u => u.username.toLowerCase() === username.toLowerCase());
  if (exists) {
    return res.status(400).json({ error: 'User already exists' });
  }

  const newUser = {
    username,
    password,
    role: role || 'user'
  };

  cache.users.push(newUser);
  writeCache(cache);
  res.status(201).json({ username: newUser.username, role: newUser.role });
});

app.delete('/api/users/:username', (req, res) => {
  const { username } = req.params;
  if (username.toLowerCase() === 'admin12') {
    return res.status(400).json({ error: 'Cannot delete primary admin user' });
  }

  const cache = readCache();
  const initialLen = cache.users.length;
  cache.users = cache.users.filter(u => u.username.toLowerCase() !== username.toLowerCase());

  if (cache.users.length === initialLen) {
    return res.status(404).json({ error: 'User not found' });
  }

  writeCache(cache);
  res.json({ message: 'User deleted successfully' });
});

// ---------------- TIME AVAILABILITY ----------------
app.get('/api/availability', (req, res) => {
  const cache = readCache();
  res.json(cache.availability || []);
});

app.post('/api/availability', (req, res) => {
  const { username, start, end, timezone, notes } = req.body;
  if (!username || !start || !end || !timezone) {
    return res.status(400).json({ error: 'username, start, end, and timezone are required' });
  }

  const cache = readCache();
  const newSlot = {
    id: 'slot_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    username,
    start, // ISO string (UTC)
    end,   // ISO string (UTC)
    timezone,
    notes: notes || ''
  };

  if (!cache.availability) cache.availability = [];
  cache.availability.push(newSlot);
  writeCache(cache);

  res.status(201).json(newSlot);
});

app.delete('/api/availability/:id', (req, res) => {
  const { id } = req.params;
  const cache = readCache();
  if (!cache.availability) cache.availability = [];
  const initialLen = cache.availability.length;
  cache.availability = cache.availability.filter(slot => slot.id !== id);

  if (cache.availability.length === initialLen) {
    return res.status(404).json({ error: 'Availability slot not found' });
  }

  writeCache(cache);
  res.json({ message: 'Slot removed successfully' });
});

app.put('/api/availability/:id', (req, res) => {
  const { id } = req.params;
  const { username, start, end, timezone, notes } = req.body;

  if (!username || !start || !end || !timezone) {
    return res.status(400).json({ error: 'username, start, end, and timezone are required' });
  }

  const cache = readCache();
  if (!cache.availability) cache.availability = [];
  
  const slotIndex = cache.availability.findIndex(slot => slot.id === id);
  if (slotIndex === -1) {
    return res.status(404).json({ error: 'Availability slot not found' });
  }

  cache.availability[slotIndex] = {
    id,
    username,
    start,
    end,
    timezone,
    notes: notes || ''
  };

  writeCache(cache);
  res.json(cache.availability[slotIndex]);
});

// ---------------- PROJECTS & GANTT ----------------
app.get('/api/projects', (req, res) => {
  const cache = readCache();
  res.json(cache.projects || []);
});

app.post('/api/projects', (req, res) => {
  const { name, description } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  const cache = readCache();
  const newProject = {
    id: 'proj_' + Date.now(),
    name,
    description: description || '',
    tasks: [], // Gantt Tasks
    columns: [ // Default Trello columns
      { id: 'todo', title: 'To Do', cards: [] },
      { id: 'in_progress', title: 'In Progress', cards: [] },
      { id: 'done', title: 'Done', cards: [] }
    ]
  };

  cache.projects.push(newProject);
  writeCache(cache);
  res.status(201).json(newProject);
});

app.delete('/api/projects/:id', (req, res) => {
  const { id } = req.params;
  const cache = readCache();
  const initialLen = cache.projects.length;
  cache.projects = cache.projects.filter(p => p.id !== id);

  if (cache.projects.length === initialLen) {
    return res.status(404).json({ error: 'Project not found' });
  }

  writeCache(cache);
  res.json({ message: 'Project deleted successfully' });
});

// Update all tasks for a project (Gantt interface sends updated task array)
app.put('/api/projects/:id/tasks', (req, res) => {
  const { id } = req.params;
  const { tasks } = req.body;

  if (!Array.isArray(tasks)) {
    return res.status(400).json({ error: 'Tasks must be an array' });
  }

  const cache = readCache();
  const project = cache.projects.find(p => p.id === id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  project.tasks = tasks;
  writeCache(cache);
  res.json(project);
});

// ---------------- TRELLO BOARD ----------------
// Update columns structure (including cards) for a project (Trello re-ordering)
app.put('/api/projects/:id/trello', (req, res) => {
  const { id } = req.params;
  const { columns } = req.body;

  if (!Array.isArray(columns)) {
    return res.status(400).json({ error: 'Columns must be an array' });
  }

  const cache = readCache();
  const project = cache.projects.find(p => p.id === id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  project.columns = columns;
  writeCache(cache);
  res.json(project);
});

// Default catch-all serves frontend files
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

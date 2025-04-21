import React, { useState, useEffect, createContext, useContext } from 'react';
import './App.css';
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import LoginPage from './LoginPage';
import { LogOut, User, Users, CheckCircle, Circle, Calendar, StickyNote, ListChecks } from 'lucide-react';

import { fetchTasksByAssignee, fetchUserTasks, markAssignmentComplete, TasksByAssigneeResponse, UserTasksResponse, TaskDetail, UserTaskDetail, getDashboardData } from './api';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleString();
}

// TaskTable for UserTasksResponse (user view)
function TaskTable({ tasks, onToggle, readonly }: { tasks: UserTaskDetail[], onToggle: (assignment_id: number) => void, readonly: boolean }) {
  return (
    <table className="task-table themed">
      <thead>
        <tr>
          <th><ListChecks size={18} style={{verticalAlign:'middle'}}/> Task</th>
          <th><Calendar size={18} style={{verticalAlign:'middle'}}/> Deadline</th>
          <th><StickyNote size={18} style={{verticalAlign:'middle'}}/> Notes</th>
          <th>Status</th>
          <th>Completed</th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((task) => (
          <tr key={task.assignment_id} className={task.status === 'completed' ? 'completed-row' : ''}>
            <td>{task.description}</td>
            <td>{formatDate(task.deadline)}</td>
            <td>{task.notes}</td>
            <td>
              {task.status === 'completed' ? (
                <CheckCircle color="#13e6b3" size={20} />
              ) : (
                <Circle color="#aaa" size={20} />
              )}
            </td>
            <td>
              <input
                type="checkbox"
                checked={task.status === 'completed'}
                disabled={readonly}
                onChange={() => onToggle(task.assignment_id)}
                style={{ accentColor: '#13e6b3' }}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// TaskTable for admin (grouped by assignee)
function AdminTaskTable({ assigneeName, tasks, onToggle }: { assigneeName: string, tasks: TaskDetail[], onToggle: (assignment_id: number) => void }) {
  return (
    <div className="user-section card themed">
      <h3><User size={16}/> {assigneeName}</h3>
      {tasks.length === 0 ? (
        <p className="no-tasks">No tasks assigned.</p>
      ) : (
        <table className="task-table themed">
          <thead>
            <tr>
              <th><ListChecks size={18} style={{verticalAlign:'middle'}}/> Task</th>
              <th><Calendar size={18} style={{verticalAlign:'middle'}}/> Deadline</th>
              <th><StickyNote size={18} style={{verticalAlign:'middle'}}/> Notes</th>
              <th>Status</th>
              <th>Completed</th>
              <th>Creator</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.assignment_id} className={task.status === 'completed' ? 'completed-row' : ''}>
                <td>{task.description}</td>
                <td>{formatDate(task.deadline)}</td>
                <td>{task.notes}</td>
                <td>
                  {task.status === 'completed' ? (
                    <CheckCircle color="#13e6b3" size={20} />
                  ) : (
                    <Circle color="#aaa" size={20} />
                  )}
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={task.status === 'completed'}
                    disabled={false}
                    onChange={() => onToggle(task.assignment_id)}
                    style={{ accentColor: '#13e6b3' }}
                  />
                </td>
                <td>{task.creator_name} ({task.creator_phone})</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}


// Auth Context for simple global auth state
const AuthContext = createContext<{username: string|null, login: (u: string) => void, logout: () => void}>({ username: null, login: () => {}, logout: () => {} });

function useAuth() {
  return useContext(AuthContext);
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { username } = useAuth();
  if (!username) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function Dashboard() {
  const { username, logout } = useAuth();
  const [view, setView] = useState<'admin' | 'user'>(username === 'admin' ? 'admin' : 'user');
  const [currentUser, setCurrentUser] = useState<string>(username !== 'admin' ? username : '');

  // Ensure currentUser is set to username after login if not admin
  useEffect(() => {
    if (username !== 'admin' && currentUser !== username) {
      setCurrentUser(username);
    }
  }, [username]);
  const [users, setUsers] = useState<{ phone: string; name: string }[]>([]);
  const [adminData, setAdminData] = useState<TasksByAssigneeResponse>({});
  const [userTasks, setUserTasks] = useState<UserTasksResponse>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);

  // Modular data loader
  useEffect(() => {
    setLoading(true);
    setError(null);
    if (view === 'admin') {
      getDashboardData('admin')
        .then((result) => {
          if ('admin' in result) {
            setAdminData(result.admin);
            setUsers(Object.entries(result.admin).map(([phone, group]) => ({ phone, name: group.assignee_name })));
          }
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message);
          setLoading(false);
        });
    } else if (view === 'user') {
      let phone = currentUser;
      if (!phone && users.length > 0) {
        phone = users[0].phone;
        setCurrentUser(phone);
        // Don't fetch until currentUser is set
        setLoading(false);
        return;
      }
      if (phone) {
        getDashboardData(phone)
          .then((result) => {
            if ('user' in result) {
              setUserTasks(result.user);
            }
            setLoading(false);
          })
          .catch((err) => {
            setError(err.message);
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    }
    // eslint-disable-next-line
  }, [view, currentUser]);

  // Update users list if admin data changes
  useEffect(() => {
    if (view === 'admin' && Object.keys(adminData).length > 0) {
      setUsers(Object.entries(adminData).map(([phone, group]) => ({ phone, name: group.assignee_name })));
    }
  }, [adminData, view]);

  // Handle assignment completion
  const handleToggle = async (assignment_id: number) => {
    setLoading(true);
    try {
      await markAssignmentComplete(assignment_id);
      // Refresh data
      if (view === 'admin') {
        const data = await fetchTasksByAssignee();
        setAdminData(data);
      } else if (currentUser) {
        const tasks = await fetchUserTasks(currentUser);
        setUserTasks(tasks);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container themed">
      <header className="dashboard-header">
        <h1><Users size={32} style={{verticalAlign:'middle',marginRight:8}}/>Task Management System</h1>
        <div className="dashboard-actions">
          <button className="logout-btn" onClick={logout}><LogOut size={18}/> Logout</button>
          <button className={view==='admin' ? 'active' : ''} onClick={() => setView('admin')}><User size={16}/> Admin View</button>
          <button className={view==='user' ? 'active' : ''} onClick={() => setView('user')}><User size={16}/> User View</button>
          {view === 'user' && users.length > 0 && (
            <select
              value={currentUser}
              onChange={(e) => setCurrentUser(e.target.value)}
              className="user-select"
            >
              {users.map((u) => (
                <option key={u.phone} value={u.phone}>
                  {u.name} ({u.phone})
                </option>
              ))}
            </select>
          )}
        </div>
      </header>
      <main>
        {error && <div className="error">{error}</div>}
        {loading ? (
          <div>Loading...</div>
        ) : view === 'admin' ? (
          <div>
            <h2><Users size={20}/> All Users & Their Tasks</h2>
            {Object.entries(adminData).map(([phone, group]) => (
              <AdminTaskTable
                key={phone}
                assigneeName={group.assignee_name + ' (' + phone + ')'}
                tasks={group.tasks}
                onToggle={handleToggle}
              />
            ))}
          </div>
        ) : (
          <div className="user-section card themed">
            <h2><User size={20}/> My Tasks</h2>
            <TaskTable
              tasks={userTasks}
              onToggle={handleToggle}
              readonly={false}
            />
          </div>
        )}
      </main>
    </div>
  );
}

function App() {
  // Auth state
  const [username, setUsername] = useState<string|null>(() => localStorage.getItem('username'));

  const login = (uname: string) => {
    setUsername(uname);
    localStorage.setItem('username', uname);
  };
  const logout = () => {
    setUsername(null);
    localStorage.removeItem('username');
  };

  return (
    <AuthContext.Provider value={{ username, login, logout }}>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage onLogin={login} />} />
          <Route path="/" element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          } />
        </Routes>
      </Router>
    </AuthContext.Provider>
  );
}

export default App;

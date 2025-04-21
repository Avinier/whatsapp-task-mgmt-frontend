// API utility for dashboard endpoints

export interface TaskDetail {
  assignment_id: number;
  task_id: number;
  description: string;
  deadline: string | null;
  notes: string | null;
  status: 'pending' | 'completed';
  created_at: string | null;
  creator_name: string;
  creator_phone: string;
}

export interface AssigneeTaskGroup {
  assignee_name: string;
  tasks: TaskDetail[];
}

export type TasksByAssigneeResponse = Record<string, AssigneeTaskGroup>;

export interface UserTaskDetail {
  assignment_id: number;
  task_id: number;
  description: string;
  deadline: string | null;
  notes: string | null;
  status: 'pending' | 'completed';
  created_at: string | null;
  completed_at: string | null;
  creator_name: string;
  creator_phone: string;
}

export type UserTasksResponse = UserTaskDetail[];

export interface MarkAsDoneSuccessResponse {
  assignment_id: number;
  task_id: number;
  status: 'completed';
  completed_at: string;
  task_status: 'open' | 'completed';
  message: string;
}

async function parseJSONorThrow(res: Response) {
  const text = await res.text();
  if (text.trim().startsWith('<!DOCTYPE html') || text.trim().startsWith('<html')) {
    throw new Error('Received HTML instead of JSON. Check if the backend API endpoint is correct and running.');
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Response is not valid JSON.');
  }
}

export async function fetchTasksByAssignee(assignee_phone?: string): Promise<TasksByAssigneeResponse> {
  let url = 'http://127.0.0.1:8000/api/dashboard/tasks/by-assignee';
  if (assignee_phone) {
    url += `?assignee_phone=${encodeURIComponent(assignee_phone)}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch tasks by assignee');
  return parseJSONorThrow(res);
}

export async function fetchUserTasks(user_phone: string): Promise<UserTasksResponse> {
  const res = await fetch(`http://127.0.0.1:8000/api/dashboard/tasks/user/${user_phone}`);
  if (!res.ok) throw new Error('Failed to fetch user tasks');
  return parseJSONorThrow(res);
}

export async function markAssignmentComplete(assignment_id: number): Promise<MarkAsDoneSuccessResponse> {
  const res = await fetch(`http://127.0.0.1:8000/api/dashboard/assignments/${assignment_id}/complete`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to mark assignment as complete');
  return parseJSONorThrow(res);
}

/**
 * Modular dashboard data fetcher
 * If username is 'admin', fetches all assignees and their tasks.
 * If username is a phone number, fetches only that user's tasks.
 */
export async function getDashboardData(username: string): Promise<{ admin: TasksByAssigneeResponse } | { user: UserTasksResponse }> {
  if (username === 'admin') {
    const data = await fetchTasksByAssignee();
    return { admin: data };
  } else {
    // Use the new assignee_phone query param
    const data = await fetchTasksByAssignee(username);
    return { user: data[username]?.tasks || [] };
  }
}


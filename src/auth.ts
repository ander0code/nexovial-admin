import type {Admin} from './api/client';

export function getAdmin(): Admin | null {
  const raw = localStorage.getItem('nexovial:admin');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Admin;
  } catch {
    return null;
  }
}

export function isLoggedIn(): boolean {
  return Boolean(localStorage.getItem('nexovial:token')) && getAdmin() !== null;
}

export function saveSession(token: string, admin: Admin) {
  localStorage.setItem('nexovial:token', token);
  localStorage.setItem('nexovial:admin', JSON.stringify(admin));
}

export function clearSession() {
  localStorage.removeItem('nexovial:token');
  localStorage.removeItem('nexovial:admin');
}

'use strict';

/**
 * Session store for in-flight USSD dialogues.
 *
 * USSD sessions are short-lived (typically <180s) and keyed by the gateway's
 * sessionId + phoneNumber. This in-memory Map is fine for a single-instance
 * demo/dev deployment. For production behind a load balancer, replace with
 * Redis (or another shared store) so any app instance can pick up mid-session
 * requests — the interface below is intentionally storage-agnostic so that
 * swap is a drop-in change.
 */

const SESSION_TTL_MS = 3 * 60 * 1000; // 3 minutes, matches typical MNO USSD timeout
const sessions = new Map();

function key(sessionId, phoneNumber) {
  return `${sessionId}:${phoneNumber}`;
}

function get(sessionId, phoneNumber) {
  const k = key(sessionId, phoneNumber);
  const entry = sessions.get(k);
  if (!entry) return null;
  if (Date.now() - entry.updatedAt > SESSION_TTL_MS) {
    sessions.delete(k);
    return null;
  }
  return entry.data;
}

function set(sessionId, phoneNumber, data) {
  sessions.set(key(sessionId, phoneNumber), { data, updatedAt: Date.now() });
}

function clear(sessionId, phoneNumber) {
  sessions.delete(key(sessionId, phoneNumber));
}

// Periodic sweep of expired sessions so memory doesn't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [k, entry] of sessions.entries()) {
    if (now - entry.updatedAt > SESSION_TTL_MS) sessions.delete(k);
  }
}, 60 * 1000).unref();

module.exports = { get, set, clear };

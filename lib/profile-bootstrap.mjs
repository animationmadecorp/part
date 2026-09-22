export const PROFILE_SYNC_MAX_RETRIES = 2;

export function startProfileSync({
  userId,
  ensureCurrentProfile,
  onSynced,
  onExhausted,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  let cancelled = false;
  let retries = 0;
  let timerId = null;

  async function sync() {
    if (cancelled) return;

    try {
      await ensureCurrentProfile({});
      if (!cancelled) onSynced(userId);
    } catch {
      if (cancelled) return;

      if (retries < PROFILE_SYNC_MAX_RETRIES) {
        retries += 1;
        timerId = setTimer(() => {
          timerId = null;
          if (!cancelled) void sync();
        }, retries * 500);
      } else if (!cancelled) {
        onExhausted(userId);
      }
    }
  }

  void sync();

  return () => {
    cancelled = true;
    if (timerId !== null) {
      clearTimer(timerId);
      timerId = null;
    }
  };
}

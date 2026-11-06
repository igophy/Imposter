export function safeStorage(getArea) {
  const memory = new Map();
  let area;
  let available = true;
  try {
    area = getArea();
  } catch {
    available = false;
  }
  return {
    get available() {
      return available;
    },
    read(key, fallback = null) {
      let raw = memory.get(key);
      if (raw === undefined && area) {
        try {
          raw = area.getItem(key);
        } catch {
          available = false;
        }
      }
      if (raw == null) return fallback;
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    },
    write(key, value) {
      const raw = JSON.stringify(value);
      memory.set(key, raw);
      try {
        if (area) area.setItem(key, raw);
        else available = false;
      } catch {
        available = false;
      }
    },
    remove(key) {
      // A tombstone prevents a failed removal from exposing an older persisted value.
      memory.set(key, null);
      try {
        if (area) area.removeItem(key);
      } catch {
        available = false;
      }
    }
  };
}

export function readJSON(key, fallback) {
  try {
    const x = JSON.parse(localStorage.getItem(key));
    return x === null ? fallback : x;
  } catch {
    return fallback;
  }
}
export function save(key, value) {
  try {
    localStorage.setItem(
      key,
      typeof value === "string" ? value : JSON.stringify(value),
    );
    return true;
  } catch {
    alert(
      "Device storage is full or unavailable. Export a backup before clearing any data.",
    );
    return false;
  }
}
export function validURL(value) {
  try {
    const u = new URL(value);
    return ["http:", "https:"].includes(u.protocol) ? u.href : "";
  } catch {
    return "";
  }
}
export const allowedKey = (k) =>
  /^shakerrr_(favs|bar|unit|photo_mode|family|region|preferences|notes|recent|my_[a-z0-9-]+|social_[a-z0-9-]+)$/.test(
    k,
  );
export function validateBackup(p) {
  if (p?.format !== "shakerrr-backup" || ![1, 2, 3].includes(p.version))
    throw Error("Unsupported backup format/version");
  const data = p.storage || p.local;
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw Error("Missing backup data");
  for (const [k, v] of Object.entries(data)) {
    if (!allowedKey(k)) continue;
    if (typeof v !== "string") throw Error("Invalid value: " + k);
    if (k === "shakerrr_unit") {
      if (!["oz", "ml"].includes(v)) throw Error("Invalid unit");
      continue;
    }
    if (k.startsWith("shakerrr_my_")) continue;
    let x;
    try {
      x = JSON.parse(v);
    } catch {
      throw Error("Invalid JSON: " + k);
    }
    if (
      /_(favs|bar)$/.test(k) &&
      (!Array.isArray(x) || x.some((i) => typeof i !== "string"))
    )
      throw Error("Invalid inventory/favorites");
    if (
      k.includes("_social_") &&
      (!Array.isArray(x) || x.some((i) => !i || typeof i !== "object"))
    )
      throw Error("Invalid social recipes");
    if (
      k.endsWith("_photo_mode") &&
      (Array.isArray(x) ||
        !x ||
        Object.values(x).some(
          (i) => !["system", "custom", "remote"].includes(i),
        ))
    )
      throw Error("Invalid photo preferences");
  }
  for (const [id, data] of Object.entries(p.photos || {}))
    if (
      !/^[a-z0-9-]+$/.test(id) ||
      typeof data !== "string" ||
      !/^data:image\/(png|jpeg|webp);base64,/.test(data)
    )
      throw Error("Invalid photo backup");
  return { ...p, storage: data };
}

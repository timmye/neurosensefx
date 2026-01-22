export function calculatePointOfControl(profile) {
  if (!profile || profile.length === 0) {
    return null;
  }

  return profile.reduce((maxLevel, level) =>
    level.tpo > maxLevel.tpo ? level : maxLevel
  );
}

// js/filters-patches.js
// Подключать после basefucs.js и auth.js

// === 1) Собираем teachers/levels/types/locations ===
function extractAllData() {
  const teachers = new Set(),
    levels = new Set(),
    types = new Set(),
    locations = new Set();

  for (const time of timeSlots || []) {
    for (let d = 0; d < (dayNames || []).length; d++) {
      const list = (scheduleData[time] && scheduleData[time][d]) || [];
      list.forEach((c) => {
        if (c.teacher) teachers.add(c.teacher);
        if (c.level) levels.add(c.level);
        if (c.type) types.add(c.type);
        if (c.location) locations.add(c.location);
      });
    }
  }

  return {
    teachers: Array.from(teachers).sort(),
    levels: Array.from(levels).sort(),
    types: Array.from(types).sort(),
    locations: Array.from(locations).sort(),
  };
}
window.extractAllData = extractAllData;

// === 2) Проверка по всем активным фильтрам ===
function matchesFilters(item, time, day) {
  // "Мои группы"
  if (activeFilters.showMyGroupsOnly) {
    const key = item.id
      ? `db_${item.id}`
      : `${item.name}_${item.level}_${item.teacher}_${item.location}_${time}_${day}`;
    if (!myGroups.has(key)) return false;
  }
  // по преподавателям
  if (
    activeFilters.teachers.size &&
    !activeFilters.teachers.has(item.teacher)
  ) {
    return false;
  }
  // по уровням
  if (activeFilters.levels.size && !activeFilters.levels.has(item.level)) {
    return false;
  }
  // по типам занятий
  if (activeFilters.types.size && !activeFilters.types.has(item.type)) {
    return false;
  }
  // по локациям
  if (
    activeFilters.locations.size &&
    !activeFilters.locations.has(item.location)
  ) {
    return false;
  }
  return true;
}
window.matchesFilters = matchesFilters;

// === 3) Создание кнопок-фильтров ===
function createFilterButtons(container, items, filterKey) {
  if (!container) return;
  container.innerHTML = "";
  items.forEach((val) => {
    const btn = document.createElement("button");
    btn.className = "filter-button";
    btn.textContent = val;
    btn.onclick = () => {
      if (activeFilters[filterKey].has(val)) {
        activeFilters[filterKey].delete(val);
        btn.classList.remove("active");
      } else {
        activeFilters[filterKey].add(val);
        btn.classList.add("active");
      }
      renderFilteredSchedule();
      updateStats();
      updateFilterFab();
    };
    container.appendChild(btn);
  });
}
window.createFilterButtons = createFilterButtons;

// === 4) Рендер фильтрованного расписания (десктоп + мобайл) ===
function renderFilteredSchedule() {
  if (typeof renderDesktopSchedule === "function") renderDesktopSchedule();
  if (typeof renderMobileSchedule === "function") renderMobileSchedule();
}
window.renderFilteredSchedule = renderFilteredSchedule;

// === 5) Обновление счётчика на FAB-кнопке ===
function updateFilterFab() {
  const count =
    (activeFilters.showMyGroupsOnly ? 1 : 0) +
    activeFilters.teachers.size +
    activeFilters.levels.size +
    activeFilters.types.size +
    activeFilters.locations.size;
  const tags = document.getElementById("filter-fab-tags");
  if (tags) tags.textContent = count > 0 ? `(${count})` : "";
}
window.updateFilterFab = updateFilterFab;

// === 6) Режим редактирования "Моих групп" ===
function toggleMyGroupsEditMode() {
  isSelectMode = !isSelectMode;
  tempSelectedGroups.clear();
  createMyGroupsControls();
}
window.toggleMyGroupsEditMode = toggleMyGroupsEditMode;

// === 7) Сброс всех фильтров ===
function clearAllFilters() {
  activeFilters = {
    teachers: new Set(),
    levels: new Set(),
    types: new Set(),
    locations: new Set(),
    showMyGroupsOnly: false,
  };
  document
    .querySelectorAll(".filter-button.active")
    .forEach((b) => b.classList.remove("active"));
  renderFilteredSchedule();
  updateStats();
  updateFilterFab();
}
window.clearAllFilters = clearAllFilters;

// === 8) Свернуть/развернуть группу фильтров ===
function toggleFilterGroup(groupId) {
  const el = document.getElementById(groupId);
  if (!el) return;
  el.classList.toggle("expanded");
}
window.toggleFilterGroup = toggleFilterGroup;

// === 9) Off-canvas: открыть/закрыть фильтры ===
function toggleFilters() {
  document.getElementById("filters-overlay").classList.toggle("active");
  document.getElementById("filters-sidebar").classList.toggle("active");
}
window.toggleFilters = toggleFilters;

function closeFilters() {
  document.getElementById("filters-overlay").classList.remove("active");
  document.getElementById("filters-sidebar").classList.remove("active");
}
window.closeFilters = closeFilters;

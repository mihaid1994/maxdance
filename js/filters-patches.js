// ---------------------------------------------
// Патчи для отсутствующих функций и кнопок
// ---------------------------------------------

// 1) Собираем данные для создания кнопок-фильтров
function extractAllData() {
  const teachers = new Set(),
    levels = new Set(),
    types = new Set(),
    locations = new Set();

  for (const time of timeSlots || []) {
    for (let d = 0; d < (dayNames || []).length; d++) {
      const arr = (scheduleData[time] && scheduleData[time][d]) || [];
      arr.forEach((c) => {
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

// 2) СreateFilterButtons — заполняем filters-sidebar кнопками
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

// 3) renderFilteredSchedule — перерисовка расписания
function renderFilteredSchedule() {
  // Если у вас два разных рендера для desktop/mobile —
  // просто вызовите их оба или объедините логику здесь.
  if (typeof renderDesktopSchedule === "function") renderDesktopSchedule();
  if (typeof renderMobileSchedule === "function") renderMobileSchedule();
}
window.renderFilteredSchedule = renderFilteredSchedule;

// 4) updateFilterFab — обновляем «иконку» FAB-фильтров
function updateFilterFab() {
  const count =
    (activeFilters.showMyGroupsOnly ? 1 : 0) +
    activeFilters.teachers.size +
    activeFilters.levels.size +
    activeFilters.types.size +
    activeFilters.locations.size;
  const tags = document.getElementById("filter-fab-tags");
  if (!tags) return;
  tags.innerHTML = count > 0 ? `(${count})` : "";
}
window.updateFilterFab = updateFilterFab;

// 5) toggleMyGroupsEditMode — переключаем режим редактирования «Моих групп»
function toggleMyGroupsEditMode() {
  isSelectMode = !isSelectMode;
  tempSelectedGroups.clear();
  createMyGroupsControls(); // перерисуем controls
}
window.toggleMyGroupsEditMode = toggleMyGroupsEditMode;

// 6) clearAllFilters — сброс всех фильтров
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

// 7) toggleFilters / closeFilters — off-canvas поведение
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

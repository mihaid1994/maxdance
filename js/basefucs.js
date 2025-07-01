// === MAXDANCE V2.0 - ОПТИМИЗИРОВАННЫЙ BASEFUCS.JS ===

// Глобальные переменные
let scheduleData = {};
let timeSlots = [];
let dayNames = [];
let typeNames = {};
let locationNames = {};
const daysCount = 7;

// Переменные для аутентификации (будут определены в auth.js)
let currentUser = null;
let userProfile = null;
let supabase = null;

// Массив исключений для типов занятий
const excludedTypes = [
  "bachata-advanced",
  "bachata-continuing",
  "bachata-general",
];

// Справочник соответствий уровней
const levelMapping = {
  набор: "Набор",
  "идет набор": "Набор",
  0: "Набор",
  общий: "Набор",
  "общий уровень": "Набор",
  "0,2": "Начинающие",
  "0,3": "Начинающие",
  "0,4": "Начинающие",
  "0,5": "Начинающие",
  начинающие: "Начинающие",
  "начинающая группа": "Начинающие",
  "0,6": "Продолжающие",
  "0,7": "Продолжающие",
  "0,8": "Продолжающие",
  "0,8-1": "Продолжающие",
  продолжающие: "Продолжающие",
  1: "Продвинутые",
  "1-2": "Продвинутые",
  продвинутые: "Продвинутые",
  "продвинутая группа": "Продвинутые",
  профи: "Продвинутые",
  хорео: "Продвинутые",
  курс: "Продвинутые",
  "базовый курс": "Продвинутые",
  детская: "Дети",
  дети: "Дети",
  "3-5 лет": "Дети",
  "7-10 лет": "Дети",
};

let activeFilters = {
  teachers: new Set(),
  levels: new Set(),
  types: new Set(),
  locations: new Set(),
  showMyGroupsOnly: false,
};

// Переменные для функционала "Мои группы"
let myGroups = new Set();
let isSelectMode = false;
let tempSelectedGroups = new Set();

let openFilterGroups = new Set();
let collapsedMobileDays = new Set();

// Переменные для админ-панели
let adminPanelData = {
  scheduleClasses: [],
  classTypes: [],
  locations: [],
  teachers: [],
};
let isAdminPanelOpen = false;

// === ЗАГРУЗКА ДАННЫХ ===

async function loadData() {
  try {
    console.log("📡 Загрузка данных расписания...");

    let data;

    try {
      // Пытаемся загрузить из базы данных с персональными занятиями
      if (typeof loadScheduleWithPersonalClasses === "function") {
        data = await loadScheduleWithPersonalClasses();
        console.log(
          "✅ Данные загружены из базы данных с персональными занятиями"
        );
      } else if (typeof loadScheduleFromDatabase === "function") {
        data = await loadScheduleFromDatabase();
        console.log("✅ Данные загружены из базы данных");
      } else {
        throw new Error("База данных недоступна");
      }
    } catch (dbError) {
      console.warn("⚠️ Ошибка загрузки из базы, используем JSON:", dbError);

      // Fallback к JSON файлу
      const response = await fetch("./data/data.json");
      data = await response.json();
      console.log("✅ Данные загружены из JSON файла");
    }

    // Обновляем глобальные переменные
    scheduleData = data.schedule;
    timeSlots = data.timeSlots;
    dayNames = data.dayNames;
    typeNames = data.typeNames;
    locationNames = data.locationNames;

    // Загружаем группы пользователя
    if (currentUser && typeof getUserSavedGroups === "function") {
      try {
        const userGroups = await getUserSavedGroups();
        myGroups = new Set(userGroups);
        console.log(`✅ Загружено ${myGroups.size} групп пользователя`);
      } catch (error) {
        console.error("⚠️ Ошибка загрузки групп:", error);
        myGroups = new Set();
      }
    } else if (data.myGroups) {
      myGroups = new Set(data.myGroups);
      activeFilters.showMyGroupsOnly = true;
    }

    return data;
  } catch (error) {
    console.error("❌ Ошибка загрузки данных:", error);
    scheduleData = {};
    timeSlots = [];
    dayNames = [];
    typeNames = {};
    locationNames = {};
    myGroups = new Set();
  }
}

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===

function getClassKey(classItem, time, day) {
  if (classItem.isPersonal) {
    return `personal_${classItem.personalId}`;
  }
  if (classItem.id) {
    return `db_${classItem.id}`;
  }
  return `${classItem.name}_${classItem.level}_${classItem.teacher}_${classItem.location}_${time}_${day}`;
}

function isAdmin() {
  return currentUser && userProfile && userProfile.is_admin === true;
}

function extractAllData() {
  const teachers = new Set();
  const levels = new Set();
  const types = new Set();
  const locations = new Set();

  Object.values(scheduleData).forEach((timeData) => {
    Object.values(timeData).forEach((dayClasses) => {
      dayClasses.forEach((classItem) => {
        // Показываем персональные занятия только их создателю
        if (classItem.isPersonal && classItem.userId !== currentUser?.id) {
          return;
        }

        const teacherList = classItem.teacher
          .split(/[,/]|\sи\s/)
          .map((t) => t.trim());
        teacherList.forEach((teacher) => teachers.add(teacher));

        const mappedLevel =
          levelMapping[classItem.level.toLowerCase()] || classItem.level;
        levels.add(mappedLevel);

        types.add(classItem.type);
        locations.add(classItem.location);
      });
    });
  });

  return { teachers, levels, types, locations };
}

function matchesFilters(classItem, time, day) {
  // Персональные занятия видны только их создателю
  if (classItem.isPersonal && classItem.userId !== currentUser?.id) {
    return false;
  }

  if (activeFilters.showMyGroupsOnly) {
    const classKey = getClassKey(classItem, time, day);
    return myGroups.has(classKey);
  }

  if (activeFilters.teachers.size > 0) {
    const teacherList = classItem.teacher
      .split(/[,/]|\sи\s/)
      .map((t) => t.trim());
    const hasMatchingTeacher = teacherList.some((teacher) =>
      activeFilters.teachers.has(teacher)
    );
    if (!hasMatchingTeacher) return false;
  }

  if (activeFilters.levels.size > 0) {
    const mappedLevel =
      levelMapping[classItem.level.toLowerCase()] || classItem.level;
    if (!activeFilters.levels.has(mappedLevel)) return false;
  }

  if (activeFilters.types.size > 0 && !activeFilters.types.has(classItem.type))
    return false;
  if (
    activeFilters.locations.size > 0 &&
    !activeFilters.locations.has(classItem.location)
  )
    return false;

  return true;
}

// === СОЗДАНИЕ ЭЛЕМЕНТА ЗАНЯТИЯ ===

function createClassItem(classData, time, day) {
  const locationClass =
    classData.location === "8 марта" ? "loc-8marta" : "loc-libknehta";
  const locationText = classData.location === "8 марта" ? "8М" : "КЛ";

  const classKey = getClassKey(classData, time, day);
  const isMyGroup = myGroups.has(classKey);

  let additionalClasses = "";
  let showStar = false;

  // Специальный стиль для персональных занятий
  if (classData.isPersonal) {
    additionalClasses += " personal-class";
  }

  if (isSelectMode) {
    const isCurrentlySelected = tempSelectedGroups.has(classKey);
    if (isCurrentlySelected) {
      additionalClasses += " selected-group";
    }
  } else {
    if (isMyGroup) {
      additionalClasses += " my-group";
      showStar = true;
    }
  }

  // Кнопки для авторизованных пользователей
  let actionButtons = "";
  if (currentUser && !isSelectMode) {
    if (classData.isPersonal && classData.userId === currentUser.id) {
      // Кнопки для персональных занятий (только для создателя)
      actionButtons = `
        <div class="class-actions">
          <button class="edit-personal-btn" 
                  onclick="event.stopPropagation(); editPersonalClass(${classData.personalId})"
                  title="Редактировать занятие">✏️</button>
          <button class="delete-personal-btn" 
                  onclick="event.stopPropagation(); deletePersonalClassQuick(${classData.personalId})"
                  title="Удалить занятие">🗑️</button>
        </div>
      `;
    } else if (
      !classData.isPersonal &&
      typeof addToPersonalSchedule === "function"
    ) {
      // Кнопки для обычных занятий
      const safeClassData = JSON.stringify(classData).replace(/"/g, "&quot;");
      actionButtons = `
        <div class="class-actions">
          <button class="add-to-personal-btn" 
                  onclick="event.stopPropagation(); addToPersonalSchedule(${safeClassData}, '${time}', ${day})"
                  title="Добавить в персональное расписание">➕</button>
        </div>
      `;
    }
  }

  // Кнопки админа (только для обычных занятий)
  let adminButtons = "";
  if (isAdmin() && !isSelectMode && classData.id && !classData.isPersonal) {
    adminButtons = `
      <div class="admin-actions">
        <button class="edit-class-btn" 
                onclick="event.stopPropagation(); editScheduleClassQuick(${classData.id})"
                title="Быстрое редактирование">✏️</button>
        <button class="delete-class-btn" 
                onclick="event.stopPropagation(); deleteScheduleClassQuick(${classData.id})"
                title="Удалить занятие">🗑️</button>
      </div>
    `;
  }

  const clickHandler = isSelectMode
    ? `handleMyGroupsSelection(${JSON.stringify(classData).replace(
        /"/g,
        "&quot;"
      )}, '${time}', ${day}, this)`
    : `showClassDetails('${classData.name}', '${classData.level}', '${classData.teacher}', '${classData.location}')`;

  // Добавляем индикатор персонального занятия
  const personalIndicator = classData.isPersonal
    ? '<div class="personal-indicator">👤</div>'
    : "";

  return `
    <div class="class-item ${
      classData.type
    }${additionalClasses}" onclick="${clickHandler}">
      ${showStar ? '<div class="my-group-star">⭐</div>' : ""}
      ${personalIndicator}
      <div class="class-location ${locationClass}">${locationText}</div>
      <div class="class-name">${classData.name}</div>
      <div class="class-level">${classData.level}</div>
      <div class="class-teacher">${classData.teacher}</div>
      ${actionButtons}
      ${adminButtons}
    </div>
  `;
}

// === РЕНДЕРИНГ РАСПИСАНИЯ ===

function renderTableSchedule() {
  const tbody = document.getElementById("schedule-body");
  tbody.innerHTML = "";

  timeSlots.forEach((time) => {
    const row = document.createElement("tr");

    // Ячейка времени
    const timeCell = document.createElement("td");
    timeCell.className = "time-cell";
    timeCell.textContent = time;
    row.appendChild(timeCell);

    // Ячейки для каждого дня недели
    for (let day = 0; day < daysCount; day++) {
      const dayCell = document.createElement("td");
      dayCell.className = "class-cell";

      if (scheduleData[time] && scheduleData[time][day]) {
        const classes = scheduleData[time][day].filter((cls) =>
          matchesFilters(cls, time, day)
        );
        if (classes.length > 0) {
          dayCell.innerHTML = classes
            .map((cls) => createClassItem(cls, time, day))
            .join("");
        } else {
          dayCell.innerHTML = '<div class="empty-cell">—</div>';
        }
      } else {
        dayCell.innerHTML = '<div class="empty-cell">—</div>';
      }

      row.appendChild(dayCell);
    }

    tbody.appendChild(row);
  });
}

function renderMobileSchedule() {
  const container = document.getElementById("mobile-schedule");
  container.innerHTML = "";

  dayNames.forEach((dayName, dayIndex) => {
    const dayCard = document.createElement("div");
    dayCard.className = "mobile-day-card";
    dayCard.setAttribute("data-day-index", dayIndex);

    const dayTitle = document.createElement("div");
    dayTitle.className = "mobile-day-title";
    dayTitle.textContent = dayName;
    dayTitle.onclick = () => toggleMobileDay(dayIndex);
    dayTitle.style.cursor = "pointer";
    dayCard.appendChild(dayTitle);

    const dayContent = document.createElement("div");
    dayContent.className = "mobile-day-content";

    let hasClasses = false;

    timeSlots.forEach((time) => {
      if (scheduleData[time] && scheduleData[time][dayIndex]) {
        const classes = scheduleData[time][dayIndex].filter((cls) =>
          matchesFilters(cls, time, dayIndex)
        );
        if (classes.length > 0) {
          hasClasses = true;

          const timeSlot = document.createElement("div");
          timeSlot.className = "mobile-time-slot";

          const timeHeader = document.createElement("div");
          timeHeader.className = "mobile-time-header";
          timeHeader.textContent = time;
          timeSlot.appendChild(timeHeader);

          const classesContainer = document.createElement("div");
          classesContainer.className = "mobile-classes";
          classesContainer.innerHTML = classes
            .map((cls) => createClassItem(cls, time, dayIndex))
            .join("");
          timeSlot.appendChild(classesContainer);

          dayContent.appendChild(timeSlot);
        }
      }
    });

    if (hasClasses) {
      dayCard.appendChild(dayContent);
      container.appendChild(dayCard);
    }

    // Восстанавливаем состояние сворачивания
    if (collapsedMobileDays.has(dayIndex)) {
      dayContent.style.display = "none";
    }
  });
}

function renderFilteredSchedule() {
  renderTableSchedule();
  renderMobileSchedule();
}

// === УПРАВЛЕНИЕ ФИЛЬТРАМИ ===

function toggleFilters() {
  const overlay = document.getElementById("filters-overlay");
  const sidebar = document.getElementById("filters-sidebar");

  overlay.classList.toggle("active");
  sidebar.classList.toggle("active");

  document.body.style.overflow = sidebar.classList.contains("active")
    ? "hidden"
    : "";
}

function closeFilters() {
  const overlay = document.getElementById("filters-overlay");
  const sidebar = document.getElementById("filters-sidebar");

  overlay.classList.remove("active");
  sidebar.classList.remove("active");
  document.body.style.overflow = "";
}

function toggleFilter(type, value, button) {
  const wasPreviouslyActive = activeFilters[type].has(value);

  if (wasPreviouslyActive) {
    activeFilters[type].delete(value);
    button.classList.remove("active");
  } else {
    activeFilters[type].add(value);
    button.classList.add("active");
  }

  renderFilteredSchedule();
  updateStats();
  updateFilterFab();
}

function clearAllFilters() {
  activeFilters = {
    teachers: new Set(),
    levels: new Set(),
    types: new Set(),
    locations: new Set(),
    showMyGroupsOnly: false,
  };

  document.querySelectorAll(".filter-button").forEach((btn) => {
    btn.classList.remove("active");
  });

  if (isSelectMode) {
    toggleMyGroupsEditMode();
  }

  renderFilteredSchedule();
  updateStats();
  updateFilterFab();
}

function toggleFilterGroup(groupId) {
  const options = document.getElementById(groupId);
  const toggle = document.querySelector(
    `[onclick="toggleFilterGroup('${groupId}')"] .filter-toggle`
  );

  if (openFilterGroups.has(groupId)) {
    options.classList.remove("expanded");
    options.classList.add("collapsed");
    toggle.classList.add("collapsed");
    openFilterGroups.delete(groupId);
  } else {
    openFilterGroups.forEach((openGroupId) => {
      const openOptions = document.getElementById(openGroupId);
      const openToggle = document.querySelector(
        `[onclick="toggleFilterGroup('${openGroupId}')"] .filter-toggle`
      );
      if (openOptions && openToggle) {
        openOptions.classList.remove("expanded");
        openOptions.classList.add("collapsed");
        openToggle.classList.add("collapsed");
      }
    });
    openFilterGroups.clear();

    options.classList.remove("collapsed");
    options.classList.add("expanded");
    toggle.classList.remove("collapsed");
    openFilterGroups.add(groupId);
  }
}

// === МОИ ГРУППЫ ===

function toggleMyGroupsEditMode() {
  isSelectMode = !isSelectMode;

  const editBtn = document.getElementById("my-groups-edit-btn");
  const saveBtn = document.getElementById("my-groups-save-btn");

  if (isSelectMode) {
    editBtn.classList.add("active");
    editBtn.textContent = "❌";
    editBtn.title = "Отменить выбор групп";
    saveBtn.style.display = "flex";

    // ИСПРАВЛЕНИЕ: Предзаполняем текущие группы для редактирования
    tempSelectedGroups = new Set(myGroups);

    showMyGroupsInstructions();
  } else {
    editBtn.classList.remove("active");
    editBtn.textContent = "✏️";
    editBtn.title = "Редактировать мои группы";
    saveBtn.style.display = "none";
    tempSelectedGroups.clear();
    hideMyGroupsInstructions();
  }

  renderFilteredSchedule();
}

function handleMyGroupsSelection(classItem, time, day, element) {
  if (!isSelectMode) return;

  const classKey = getClassKey(classItem, time, day);

  if (tempSelectedGroups.has(classKey)) {
    tempSelectedGroups.delete(classKey);
    element.classList.remove("selected-group");
  } else {
    tempSelectedGroups.add(classKey);
    element.classList.add("selected-group");
  }
}

async function saveMyGroupsData() {
  if (!isSelectMode) return;

  try {
    if (currentUser && typeof saveUserGroups === "function") {
      await saveUserGroups([...tempSelectedGroups]);
      myGroups = new Set(tempSelectedGroups);

      showNotification(
        `✅ Группы сохранены! Выбрано: ${myGroups.size}`,
        "success"
      );
    } else {
      throw new Error("Пользователь не авторизован или функция недоступна");
    }

    toggleMyGroupsEditMode();
    createMyGroupsControls();
    renderFilteredSchedule();
    updateStats();
    updateFilterFab();
  } catch (error) {
    console.error("❌ Ошибка сохранения:", error);
    showNotification(
      "❌ Ошибка при сохранении групп: " + error.message,
      "error"
    );
  }
}

function toggleMyGroupsFilter() {
  activeFilters.showMyGroupsOnly = !activeFilters.showMyGroupsOnly;

  const button = document.getElementById("my-groups-toggle");
  if (activeFilters.showMyGroupsOnly) {
    button.classList.add("active");
  } else {
    button.classList.remove("active");
  }

  renderFilteredSchedule();
  updateStats();
  updateFilterFab();
}

function createMyGroupsControls() {
  const container = document.getElementById("myGroupsFilters");
  container.innerHTML = "";

  const toggleButton = document.createElement("button");
  toggleButton.id = "my-groups-toggle";
  toggleButton.className = "filter-button my-groups-main-toggle";

  const groupsText = `⭐ Мои группы (${myGroups.size})`;
  toggleButton.textContent = groupsText;

  if (activeFilters.showMyGroupsOnly) {
    toggleButton.classList.add("active");
  }
  toggleButton.onclick = toggleMyGroupsFilter;
  container.appendChild(toggleButton);

  // Кнопки для авторизованных пользователей
  if (currentUser) {
    // Кнопка создания персонального занятия
    const createPersonalButton = document.createElement("button");
    createPersonalButton.className = "filter-button create-personal-btn";
    createPersonalButton.textContent = "➕ Создать занятие";
    createPersonalButton.onclick = showCreatePersonalClassModal;
    container.appendChild(createPersonalButton);

    const personalScheduleButton = document.createElement("button");
    personalScheduleButton.className = "filter-button personal-schedule-btn";
    personalScheduleButton.textContent = "📅 Персональное расписание";
    personalScheduleButton.onclick = () => {
      if (typeof showPersonalSchedule === "function") {
        showPersonalSchedule();
      } else {
        alert("🚧 Персональное расписание - в разработке!");
      }
    };
    container.appendChild(personalScheduleButton);
  }

  // Кнопка админ-панели
  if (isAdmin()) {
    const adminPanelButton = document.createElement("button");
    adminPanelButton.className = "filter-button admin-panel-btn";
    adminPanelButton.textContent = "⚙️ Админ-панель";
    adminPanelButton.onclick = showAdminPanel;
    container.appendChild(adminPanelButton);
  }

  if (myGroups.size === 0) {
    const message = document.createElement("div");
    message.className = "no-groups-message";
    message.textContent =
      "Группы не выбраны. Используйте кнопку редактирования для добавления.";
    container.appendChild(message);
  } else {
    // Показываем список групп с возможностью удаления
    const groupsList = document.createElement("div");
    groupsList.className = "my-groups-list";

    myGroups.forEach((groupKey) => {
      const groupItem = document.createElement("div");
      groupItem.className = "my-group-item";

      // Находим информацию о группе по ключу
      const groupInfo = findGroupByKey(groupKey);
      const displayText = groupInfo
        ? `${groupInfo.name} (${groupInfo.level}) - ${groupInfo.teacher}`
        : groupKey;

      groupItem.innerHTML = `
        <span class="group-text">${displayText}</span>
        <button class="remove-group-btn" onclick="removeFromMyGroups('${groupKey}')" title="Удалить группу">🗑️</button>
      `;

      groupsList.appendChild(groupItem);
    });

    container.appendChild(groupsList);
  }

  if (isSelectMode) {
    showMyGroupsInstructions();
  }
}

// Новая функция для поиска группы по ключу
function findGroupByKey(groupKey) {
  for (const time of timeSlots) {
    for (let day = 0; day < daysCount; day++) {
      if (scheduleData[time] && scheduleData[time][day]) {
        const found = scheduleData[time][day].find((cls) => {
          return getClassKey(cls, time, day) === groupKey;
        });
        if (found) return found;
      }
    }
  }
  return null;
}

// Новая функция для удаления группы
async function removeFromMyGroups(groupKey) {
  if (!currentUser) {
    showNotification("❌ Требуется авторизация", "error");
    return;
  }

  try {
    myGroups.delete(groupKey);
    await saveUserGroups([...myGroups]);

    createMyGroupsControls();
    renderFilteredSchedule();
    updateStats();
    updateFilterFab();

    showNotification("✅ Группа удалена", "success");
  } catch (error) {
    console.error("❌ Ошибка удаления группы:", error);
    showNotification("❌ Ошибка удаления группы: " + error.message, "error");
  }
}

function showMyGroupsInstructions() {
  const container = document.getElementById("myGroupsFilters");
  let instructionDiv = container.querySelector(".select-mode-instructions");

  if (!instructionDiv) {
    instructionDiv = document.createElement("div");
    instructionDiv.className = "select-mode-instructions";
    instructionDiv.innerHTML = `
      <strong>🎯 Режим выбора групп активен!</strong><br>
      Кликайте по занятиям в расписании для выбора ваших групп.<br>
      Нажмите 💾 для сохранения выбранных групп.
    `;
    container.appendChild(instructionDiv);
  }
}

function hideMyGroupsInstructions() {
  const container = document.getElementById("myGroupsFilters");
  const instructionDiv = container.querySelector(".select-mode-instructions");
  if (instructionDiv) {
    instructionDiv.remove();
  }
}

// === ПЕРСОНАЛЬНЫЕ ЗАНЯТИЯ ===

// Новая функция для создания персонального занятия
function showCreatePersonalClassModal() {
  const modalHtml = `
    <div id="personal-class-modal" class="modal" style="display: block;">
      <div class="modal-content">
        <span class="close" onclick="closePersonalClassModal()">&times;</span>
        <div class="modal-header">Создать персональное занятие</div>
        <div class="modal-body">
          <form id="personal-class-form">
            <div class="form-group">
              <label>Название занятия:</label>
              <input type="text" id="personal-name" required>
            </div>
            <div class="form-group">
              <label>Уровень:</label>
              <input type="text" id="personal-level" placeholder="Например: Начинающие">
            </div>
            <div class="form-group">
              <label>Преподаватель:</label>
              <input type="text" id="personal-teacher" placeholder="Ваше имя или преподаватель">
            </div>
            <div class="form-group">
              <label>Локация:</label>
              <select id="personal-location">
                <option value="8 марта">ул. 8 Марта (Мытный Двор)</option>
                <option value="либкнехта">ул. К.Либкнехта (Консул)</option>
                <option value="дома">Дома</option>
                <option value="другое">Другое место</option>
              </select>
            </div>
            <div class="form-group">
              <label>День недели:</label>
              <select id="personal-day" required>
                <option value="0">Понедельник</option>
                <option value="1">Вторник</option>
                <option value="2">Среда</option>
                <option value="3">Четверг</option>
                <option value="4">Пятница</option>
                <option value="5">Суббота</option>
                <option value="6">Воскресенье</option>
              </select>
            </div>
            <div class="form-group">
              <label>Время:</label>
              <input type="time" id="personal-time" required>
            </div>
            <div class="form-actions">
              <button type="button" onclick="closePersonalClassModal()">Отмена</button>
              <button type="submit">Создать</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHtml);

  document.getElementById("personal-class-form").onsubmit = async function (e) {
    e.preventDefault();
    await createPersonalClass();
  };
}

function closePersonalClassModal() {
  const modal = document.getElementById("personal-class-modal");
  if (modal) {
    modal.remove();
  }
}

async function createPersonalClass() {
  try {
    const classData = {
      name: document.getElementById("personal-name").value,
      level: document.getElementById("personal-level").value || "Персональное",
      teacher: document.getElementById("personal-teacher").value || "Я",
      location: document.getElementById("personal-location").value,
      day_of_week: parseInt(document.getElementById("personal-day").value),
      time_slot: document.getElementById("personal-time").value,
      type: "personal",
    };

    const newClass = await window.createPersonalClass(classData);

    // Добавляем в мои группы автоматически
    const classKey = `personal_${newClass.id}`;
    myGroups.add(classKey);
    await saveUserGroups([...myGroups]);

    closePersonalClassModal();
    await reloadScheduleWithAuth();
    createMyGroupsControls();
    renderFilteredSchedule();
    updateStats();
    updateFilterFab();

    showNotification("✅ Персональное занятие создано!", "success");
  } catch (error) {
    console.error("❌ Ошибка создания занятия:", error);
    showNotification("❌ Ошибка создания занятия: " + error.message, "error");
  }
}

// Новая функция для редактирования персонального занятия
async function editPersonalClass(personalId) {
  try {
    const classData = await window.getPersonalClassById(personalId);

    const modalHtml = `
      <div id="edit-personal-class-modal" class="modal" style="display: block;">
        <div class="modal-content">
          <span class="close" onclick="closeEditPersonalClassModal()">&times;</span>
          <div class="modal-header">Редактировать персональное занятие</div>
          <div class="modal-body">
            <form id="edit-personal-class-form">
              <div class="form-group">
                <label>Название занятия:</label>
                <input type="text" id="edit-personal-name" value="${
                  classData.name
                }" required>
              </div>
              <div class="form-group">
                <label>Уровень:</label>
                <input type="text" id="edit-personal-level" value="${
                  classData.level
                }" placeholder="Например: Начинающие">
              </div>
              <div class="form-group">
                <label>Преподаватель:</label>
                <input type="text" id="edit-personal-teacher" value="${
                  classData.teacher
                }" placeholder="Ваше имя или преподаватель">
              </div>
              <div class="form-group">
                <label>Локация:</label>
                <select id="edit-personal-location">
                  <option value="8 марта" ${
                    classData.location === "8 марта" ? "selected" : ""
                  }>ул. 8 Марта (Мытный Двор)</option>
                  <option value="либкнехта" ${
                    classData.location === "либкнехта" ? "selected" : ""
                  }>ул. К.Либкнехта (Консул)</option>
                  <option value="дома" ${
                    classData.location === "дома" ? "selected" : ""
                  }>Дома</option>
                  <option value="другое" ${
                    classData.location === "другое" ? "selected" : ""
                  }>Другое место</option>
                </select>
              </div>
              <div class="form-group">
                <label>День недели:</label>
                <select id="edit-personal-day" required>
                  <option value="0" ${
                    classData.day_of_week === 0 ? "selected" : ""
                  }>Понедельник</option>
                  <option value="1" ${
                    classData.day_of_week === 1 ? "selected" : ""
                  }>Вторник</option>
                  <option value="2" ${
                    classData.day_of_week === 2 ? "selected" : ""
                  }>Среда</option>
                  <option value="3" ${
                    classData.day_of_week === 3 ? "selected" : ""
                  }>Четверг</option>
                  <option value="4" ${
                    classData.day_of_week === 4 ? "selected" : ""
                  }>Пятница</option>
                  <option value="5" ${
                    classData.day_of_week === 5 ? "selected" : ""
                  }>Суббота</option>
                  <option value="6" ${
                    classData.day_of_week === 6 ? "selected" : ""
                  }>Воскресенье</option>
                </select>
              </div>
              <div class="form-group">
                <label>Время:</label>
                <input type="time" id="edit-personal-time" value="${
                  classData.time_slot
                }" required>
              </div>
              <div class="form-actions">
                <button type="button" onclick="closeEditPersonalClassModal()">Отмена</button>
                <button type="submit">Сохранить</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", modalHtml);

    document.getElementById("edit-personal-class-form").onsubmit =
      async function (e) {
        e.preventDefault();
        await updatePersonalClassData(personalId);
      };
  } catch (error) {
    console.error("❌ Ошибка загрузки данных занятия:", error);
    showNotification(
      "❌ Ошибка загрузки данных занятия: " + error.message,
      "error"
    );
  }
}

function closeEditPersonalClassModal() {
  const modal = document.getElementById("edit-personal-class-modal");
  if (modal) {
    modal.remove();
  }
}

async function updatePersonalClassData(personalId) {
  try {
    const updatedData = {
      name: document.getElementById("edit-personal-name").value,
      level:
        document.getElementById("edit-personal-level").value || "Персональное",
      teacher: document.getElementById("edit-personal-teacher").value || "Я",
      location: document.getElementById("edit-personal-location").value,
      day_of_week: parseInt(document.getElementById("edit-personal-day").value),
      time_slot: document.getElementById("edit-personal-time").value,
      type: "personal",
    };

    await window.updatePersonalClass(personalId, updatedData);

    closeEditPersonalClassModal();
    await reloadScheduleWithAuth();
    renderFilteredSchedule();
    updateStats();
    updateFilterFab();

    showNotification("✅ Персональное занятие обновлено!", "success");
  } catch (error) {
    console.error("❌ Ошибка обновления занятия:", error);
    showNotification("❌ Ошибка обновления занятия: " + error.message, "error");
  }
}

// Новая функция для быстрого удаления персонального занятия
async function deletePersonalClassQuick(personalId) {
  if (!confirm("Вы уверены, что хотите удалить это персональное занятие?")) {
    return;
  }

  try {
    await window.deletePersonalClassWithUpdate(personalId);
    showNotification("✅ Персональное занятие удалено", "success");
  } catch (error) {
    console.error("❌ Ошибка удаления:", error);
    showNotification("❌ Ошибка удаления занятия: " + error.message, "error");
  }
}

// === АДМИН-ПАНЕЛЬ (УПРОЩЕННАЯ) ===

async function showAdminPanel() {
  if (!isAdmin()) {
    alert("Доступ запрещен: требуются права администратора");
    return;
  }

  try {
    await loadAdminPanelData();
    alert(
      `⚙️ Админ-панель загружена!\nВсего занятий: ${adminPanelData.scheduleClasses.length}\nФункция в разработке.`
    );
  } catch (error) {
    console.error("❌ Ошибка админ-панели:", error);
    alert("❌ Ошибка загрузки админ-панели: " + error.message);
  }
}

async function loadAdminPanelData() {
  if (!supabase) {
    adminPanelData = {
      scheduleClasses: [],
      classTypes: [],
      locations: [],
      teachers: [],
    };
    return;
  }

  try {
    const { data: scheduleClasses, error } = await supabase
      .from("schedule_classes")
      .select("*")
      .order("day_of_week", { ascending: true })
      .order("time_slot", { ascending: true });

    if (error) throw error;

    adminPanelData.scheduleClasses = scheduleClasses || [];
  } catch (error) {
    console.error("❌ Ошибка загрузки админ данных:", error);
    adminPanelData = {
      scheduleClasses: [],
      classTypes: [],
      locations: [],
      teachers: [],
    };
  }
}

// === СТАТИСТИКА И ИНТЕРФЕЙС ===

function updateStats() {
  let totalClasses = 0;

  Object.keys(scheduleData).forEach((time) => {
    Object.keys(scheduleData[time]).forEach((day) => {
      totalClasses += scheduleData[time][day].filter((cls) =>
        matchesFilters(cls, time, parseInt(day))
      ).length;
    });
  });

  let activeFiltersCount = 0;
  if (activeFilters.showMyGroupsOnly) activeFiltersCount++;
  activeFiltersCount += activeFilters.teachers.size;
  activeFiltersCount += activeFilters.levels.size;
  activeFiltersCount += activeFilters.types.size;
  activeFiltersCount += activeFilters.locations.size;

  let userInfo = "";
  if (currentUser && userProfile) {
    userInfo = ` | <span style="color: #27ae60;">👤 ${
      userProfile.full_name || currentUser.email
    }</span>`;

    if (isAdmin()) {
      userInfo += ` <span class="admin-indicator">АДМИН</span>`;
    }
  }

  document.getElementById("stats").innerHTML = `
    <span style="color: #f39c12;">📊 Показано занятий:</span> <strong>${totalClasses}</strong> | 
    <span style="color: #f39c12;">🎯 Активных фильтров:</span> <strong>${activeFiltersCount}</strong>${userInfo}
  `;
}

function updateFilterFab() {
  const tagsContainer = document.getElementById("filter-fab-tags");
  const fab = document.getElementById("filter-fab");

  const activeTags = [];

  if (activeFilters.showMyGroupsOnly) {
    activeTags.push({ type: "myGroups", value: "Мои группы" });
  }

  activeFilters.teachers.forEach((teacher) => {
    activeTags.push({ type: "teacher", value: teacher.split(" ")[0] });
  });

  activeFilters.levels.forEach((level) => {
    activeTags.push({ type: "level", value: level });
  });

  activeFilters.types.forEach((type) => {
    const displayName = typeNames[type] || type;
    activeTags.push({ type: "type", value: displayName.split(" ")[0] });
  });

  activeFilters.locations.forEach((location) => {
    const displayName = locationNames[location] || location;
    activeTags.push({
      type: "location",
      value: displayName.includes("8 Марта") ? "8 Марта" : "Карла Л.",
    });
  });

  tagsContainer.innerHTML = "";

  const maxTags = 4;
  const displayTags = activeTags.slice(0, maxTags);

  displayTags.forEach((tag) => {
    const tagElement = document.createElement("span");
    tagElement.className = "filter-fab-tag";
    tagElement.textContent = tag.value;
    tagsContainer.appendChild(tagElement);
  });

  if (activeTags.length > maxTags) {
    const moreTag = document.createElement("span");
    moreTag.className = "filter-fab-tag";
    moreTag.textContent = `+${activeTags.length - maxTags}`;
    tagsContainer.appendChild(moreTag);
  }

  if (activeTags.length > 0) {
    fab.style.minWidth = "120px";
  } else {
    fab.style.minWidth = "60px";
  }
}

function toggleMobileDay(dayIndex) {
  if (window.innerWidth <= 768) {
    const dayCard = document.querySelector(`[data-day-index="${dayIndex}"]`);
    const content = dayCard.querySelector(".mobile-day-content");

    if (collapsedMobileDays.has(dayIndex)) {
      content.style.display = "block";
      collapsedMobileDays.delete(dayIndex);
    } else {
      content.style.display = "none";
      collapsedMobileDays.add(dayIndex);
    }
  }
}

// Функция для показа уведомлений
function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.textContent = message;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// === МОДАЛЬНОЕ ОКНО ===

function showClassDetails(name, level, teacher, location) {
  const locationName =
    location === "8 марта"
      ? "ул. 8 Марта, 8Д (ТЦ Мытный Двор, 2 этаж)"
      : "ул. Карла Либкнехта, 22 (БЦ Консул, 2 этаж)";

  document.getElementById("modal-title").textContent = name;
  document.getElementById("modal-body").innerHTML = `
    <div class="detail-row">
      <div class="detail-label">Уровень:</div>
      <div>${level}</div>
    </div>
    <div class="detail-row">
      <div class="detail-label">Преподаватель:</div>
      <div>${teacher}</div>
    </div>
    <div class="detail-row">
      <div class="detail-label">Локация:</div>
      <div>${locationName}</div>
    </div>
  `;

  document.getElementById("class-modal").style.display = "block";
}

function closeModal() {
  document.getElementById("class-modal").style.display = "none";
}

// === ИНИЦИАЛИЗАЦИЯ ===

function createFilterButtons(container, items, filterType) {
  container.innerHTML = "";
  [...items].sort().forEach((item) => {
    const button = document.createElement("button");
    button.className = "filter-button";
    button.textContent = item;
    button.onclick = () => toggleFilter(filterType, item, button);
    container.appendChild(button);
  });
}

// === Инициализация приложения ===
async function initializeApp() {
  console.log("🚀 Инициализация MaxDance v2.0...");

  // Просто грузим расписание (гость или юзер — разберётся в loadData/reloadScheduleWithAuth)
  await loadData();

  const { teachers, levels, types, locations } = extractAllData();

  // Построение фильтров (без всяких ожиданий auth)
  createFilterButtons(
    document.getElementById("teacherFilters"),
    teachers,
    "teachers"
  );

  // Уровни в фиксированном порядке
  const levelContainer = document.getElementById("levelFilters");
  levelContainer.innerHTML = "";
  ["Набор", "Начинающие", "Продолжающие", "Продвинутые", "Дети"].forEach(
    (lvl) => {
      if (levels.has(lvl)) {
        const btn = document.createElement("button");
        btn.className = "filter-button";
        btn.textContent = lvl;
        btn.onclick = () => toggleFilter("levels", lvl, btn);
        levelContainer.appendChild(btn);
      }
    }
  );

  // Типы занятий (с фильтром исключений)
  const typeButtons = document.getElementById("typeFilters");
  typeButtons.innerHTML = "";
  [...types]
    .filter((t) => !excludedTypes.includes(t))
    .sort()
    .forEach((type) => {
      const btn = document.createElement("button");
      btn.className = "filter-button";
      btn.textContent = typeNames[type] || type;
      btn.onclick = () => toggleFilter("types", type, btn);
      typeButtons.appendChild(btn);
    });

  // Локации
  const locationButtons = document.getElementById("locationFilters");
  locationButtons.innerHTML = "";
  [...locations].sort().forEach((loc) => {
    const btn = document.createElement("button");
    btn.className = "filter-button";
    btn.textContent = locationNames[loc] || loc;
    btn.onclick = () => toggleFilter("locations", loc, btn);
    locationButtons.appendChild(btn);
  });

  // Кнопки «Мои группы»
  createMyGroupsControls();

  // Свернём все группы фильтров, кроме «Мои группы»
  ["teacherFilters", "levelFilters", "typeFilters", "locationFilters"].forEach(
    (id) => {
      const opts = document.getElementById(id);
      const tog = document.querySelector(
        `[onclick="toggleFilterGroup('${id}')"] .filter-toggle`
      );
      if (opts && tog) {
        opts.classList.add("collapsed");
        tog.classList.add("collapsed");
      }
    }
  );
  openFilterGroups.add("myGroupsFilters");

  // Финальный рендер расписания и статистики
  renderFilteredSchedule();
  updateStats();
  updateFilterFab();

  // Перерисовка на ресайз
  window.addEventListener("resize", renderFilteredSchedule);

  console.log("✅ Инициализация завершена!");
}

// === СОБЫТИЯ ===

window.onclick = function (event) {
  const modal = document.getElementById("class-modal");
  if (event.target === modal) {
    closeModal();
  }
};

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    closeModal();
    closeFilters();
    closePersonalClassModal();
    closeEditPersonalClassModal();
  }
});

// === ЭКСПОРТ ФУНКЦИЙ ===

window.removeFromMyGroups = removeFromMyGroups;
window.showCreatePersonalClassModal = showCreatePersonalClassModal;
window.closePersonalClassModal = closePersonalClassModal;
window.createPersonalClass = createPersonalClass;
window.editPersonalClass = editPersonalClass;
window.closeEditPersonalClassModal = closeEditPersonalClassModal;
window.updatePersonalClassData = updatePersonalClassData;
window.deletePersonalClassQuick = deletePersonalClassQuick;
window.showNotification = showNotification;

// Запуск приложения
document.addEventListener("DOMContentLoaded", initializeApp);

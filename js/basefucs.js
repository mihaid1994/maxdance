// Глобальные переменные
let scheduleData = {};
let timeSlots = [];
let dayNames = [];
let typeNames = {};
let locationNames = {};
const daysCount = 7;

// Массив исключений для типов занятий (не будут показаны в фильтрах)
const excludedTypes = [
  "bachata-advanced",
  "bachata-continuing",
  "bachata-general",
];

// Справочник соответствий уровней (невидимый для пользователя)
const levelMapping = {
  // Набор
  набор: "Набор",
  "идет набор": "Набор",
  0: "Набор",
  общий: "Набор",
  "общий уровень": "Набор",

  // Начинающие
  "0,2": "Начинающие",
  "0,3": "Начинающие",
  "0,4": "Начинающие",
  "0,5": "Начинающие",
  начинающие: "Начинающие",
  "начинающая группа": "Начинающие",

  // Продолжающие
  "0,6": "Продолжающие",
  "0,7": "Продолжающие",
  "0,8": "Продолжающие",
  "0,8-1": "Продолжающие",
  продолжающие: "Продолжающие",

  // Продвинутые
  1: "Продвинутые",
  "1-2": "Продвинутые",
  продвинутые: "Продвинутые",
  "продвинутая группа": "Продвинутые",
  профи: "Продвинутые",
  хорео: "Продвинутые",
  курс: "Продвинутые",
  "базовый курс": "Продвинутые",

  // Дети
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
let myGroups = new Set(); // Сохраненные группы пользователя
let isSelectMode = false; // Режим выбора групп
let tempSelectedGroups = new Set(); // Временно выбранные группы

let openFilterGroups = new Set(); // Отслеживание открытых групп фильтров
let collapsedMobileDays = new Set(); // Отслеживание свернутых дней в мобильной версии

// Загрузка данных
async function loadData() {
  try {
    const response = await fetch("./data/data.json");
    const data = await response.json();
    scheduleData = data.schedule;
    timeSlots = data.timeSlots;
    dayNames = data.dayNames;
    typeNames = data.typeNames;
    locationNames = data.locationNames;

    // Загружаем сохраненные группы пользователя, если они есть
    if (data.myGroups) {
      myGroups = new Set(data.myGroups);
      // По умолчанию показываем только мои группы
      activeFilters.showMyGroupsOnly = true;
    }
  } catch (error) {
    console.error("Ошибка загрузки данных:", error);
    // Fallback данные в случае ошибки
    scheduleData = {};
    timeSlots = [];
  }
}

// Генерация уникального ключа для занятия
function getClassKey(classItem, time, day) {
  return `${classItem.name}_${classItem.level}_${classItem.teacher}_${classItem.location}_${time}_${day}`;
}

// Извлечение всех данных для фильтров
function extractAllData() {
  const teachers = new Set();
  const levels = new Set();
  const types = new Set();
  const locations = new Set();

  Object.values(scheduleData).forEach((timeData) => {
    Object.values(timeData).forEach((dayClasses) => {
      dayClasses.forEach((classItem) => {
        // Извлекаем всех преподавателей
        const teacherList = classItem.teacher
          .split(/[,/]|\sи\s/)
          .map((t) => t.trim());
        teacherList.forEach((teacher) => teachers.add(teacher));

        // Маппинг уровней через справочник
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

// Управление off-canvas фильтрами
function toggleFilters() {
  const overlay = document.getElementById("filters-overlay");
  const sidebar = document.getElementById("filters-sidebar");

  overlay.classList.toggle("active");
  sidebar.classList.toggle("active");

  // Предотвращаем прокрутку body при открытом сайдбаре
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

// Переключение режима редактирования групп
function toggleMyGroupsEditMode() {
  isSelectMode = !isSelectMode;

  const editBtn = document.getElementById("my-groups-edit-btn");
  const saveBtn = document.getElementById("my-groups-save-btn");

  if (isSelectMode) {
    console.log("🎯 Вход в режим выбора групп");

    // Активируем кнопку редактирования
    editBtn.classList.add("active");
    editBtn.textContent = "❌";
    editBtn.title = "Отменить выбор групп";

    // Показываем кнопку сохранения
    saveBtn.style.display = "flex";

    // ВАЖНО: Начинаем с пустого набора - выбираем только то, что хотим сохранить
    tempSelectedGroups.clear();
    console.log("📝 Начинаем выбор с чистого листа");

    // Показываем инструкции
    showMyGroupsInstructions();
  } else {
    console.log("🚪 Выход из режима выбора групп");

    // Деактивируем кнопку редактирования
    editBtn.classList.remove("active");
    editBtn.textContent = "✏️";
    editBtn.title = "Редактировать мои группы";

    // Скрываем кнопку сохранения
    saveBtn.style.display = "none";

    // Очищаем временный набор
    tempSelectedGroups.clear();
    console.log("🗑️ Временный выбор очищен");

    // Убираем инструкции
    hideMyGroupsInstructions();
  }

  renderFilteredSchedule();
}

// Сохранение данных моих групп
async function saveMyGroupsData() {
  if (!isSelectMode) return;

  try {
    console.log(
      "💾 Сохранение выбранных групп:",
      Array.from(tempSelectedGroups)
    );

    // Обновляем сохраненные группы ТОЛЬКО теми, что выбрали в режиме
    myGroups = new Set(tempSelectedGroups);

    // Загружаем текущий JSON
    const response = await fetch("./data/data.json");
    const data = await response.json();
    data.myGroups = Array.from(myGroups);

    // Создаем и скачиваем обновленный файл
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "data.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log("✅ Новые группы сохранены:", Array.from(myGroups));

    // Выходим из режима редактирования
    toggleMyGroupsEditMode();

    // Обновляем интерфейс
    createMyGroupsControls();
    renderFilteredSchedule();
    updateStats();
    updateFilterFab();

    alert(
      `✅ Группы сохранены! Выбрано групп: ${myGroups.size}\nФайл data.json скачан. Замените его в папке data/ вашего приложения.`
    );
  } catch (error) {
    console.error("❌ Ошибка сохранения:", error);
    alert("❌ Ошибка при сохранении групп: " + error.message);
  }
}

// Показать инструкции для режима редактирования
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

// Скрыть инструкции для режима редактирования
function hideMyGroupsInstructions() {
  const container = document.getElementById("myGroupsFilters");
  const instructionDiv = container.querySelector(".select-mode-instructions");
  if (instructionDiv) {
    instructionDiv.remove();
  }
}

// Обработка клика на занятие в режиме редактирования
function handleMyGroupsSelection(classItem, time, day, element) {
  if (!isSelectMode) return;

  const classKey = getClassKey(classItem, time, day);

  if (tempSelectedGroups.has(classKey)) {
    // Убираем из выбранных
    tempSelectedGroups.delete(classKey);
    element.classList.remove("selected-group");
    console.log("➖ Убрано из групп:", classItem.name);
  } else {
    // Добавляем в выбранные
    tempSelectedGroups.add(classKey);
    element.classList.add("selected-group");
    console.log("➕ Добавлено в группы:", classItem.name);
  }

  console.log("📊 Всего выбрано групп:", tempSelectedGroups.size);
}

// Переключение фильтра "Показать только мои группы"
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

// Создание элементов управления для фильтра "Мои группы"
function createMyGroupsControls() {
  const container = document.getElementById("myGroupsFilters");
  container.innerHTML = "";

  // Создаем главную кнопку-переключатель
  const toggleButton = document.createElement("button");
  toggleButton.id = "my-groups-toggle";
  toggleButton.className = "filter-button my-groups-main-toggle";
  toggleButton.textContent = `⭐ Показать только мои группы (${myGroups.size})`;
  if (activeFilters.showMyGroupsOnly) {
    toggleButton.classList.add("active");
  }
  toggleButton.onclick = toggleMyGroupsFilter;

  container.appendChild(toggleButton);

  // Если нет групп, показываем сообщение
  if (myGroups.size === 0) {
    const message = document.createElement("div");
    message.className = "no-groups-message";
    message.textContent =
      "Группы не выбраны. Используйте кнопку редактирования для добавления.";
    container.appendChild(message);
  }

  // Показываем инструкции если активен режим выбора
  if (isSelectMode) {
    showMyGroupsInstructions();
  }
}

// Обновление плавающей кнопки фильтров
function updateFilterFab() {
  const tagsContainer = document.getElementById("filter-fab-tags");
  const fab = document.getElementById("filter-fab");

  // Собираем все активные фильтры
  const activeTags = [];

  if (activeFilters.showMyGroupsOnly) {
    activeTags.push({ type: "myGroups", value: "Мои группы" });
  }

  activeFilters.teachers.forEach((teacher) => {
    activeTags.push({ type: "teacher", value: teacher.split(" ")[0] }); // Только имя
  });

  activeFilters.levels.forEach((level) => {
    activeTags.push({ type: "level", value: level });
  });

  activeFilters.types.forEach((type) => {
    const displayName = typeNames[type] || type;
    activeTags.push({ type: "type", value: displayName.split(" ")[0] }); // Только первое слово
  });

  activeFilters.locations.forEach((location) => {
    const displayName = locationNames[location] || location;
    activeTags.push({
      type: "location",
      value: displayName.includes("8 Марта") ? "8 Марта" : "Карла Л.",
    });
  });

  // Очищаем контейнер
  tagsContainer.innerHTML = "";

  // Добавляем теги (максимум 4)
  const maxTags = 4;
  const displayTags = activeTags.slice(0, maxTags);

  displayTags.forEach((tag) => {
    const tagElement = document.createElement("span");
    tagElement.className = "filter-fab-tag";
    tagElement.textContent = tag.value;
    tagsContainer.appendChild(tagElement);
  });

  // Если есть еще фильтры, показываем счетчик
  if (activeTags.length > maxTags) {
    const moreTag = document.createElement("span");
    moreTag.className = "filter-fab-tag";
    moreTag.textContent = `+${activeTags.length - maxTags}`;
    tagsContainer.appendChild(moreTag);
  }

  // Обновляем стиль кнопки в зависимости от наличия фильтров
  if (activeTags.length > 0) {
    fab.style.minWidth = "120px";
  } else {
    fab.style.minWidth = "60px";
  }
}

// Создание кнопок фильтров с фиксированным порядком
function createLevelFilterButtons(container, levels) {
  container.innerHTML = "";
  // Жестко заданный порядок уровней
  const fixedOrder = [
    "Набор",
    "Начинающие",
    "Продолжающие",
    "Продвинутые",
    "Дети",
  ];

  fixedOrder.forEach((level) => {
    if (levels.has(level)) {
      const button = document.createElement("button");
      button.className = "filter-button";
      button.textContent = level;
      button.onclick = () => toggleFilter("levels", level, button);
      container.appendChild(button);
    }
  });
}

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

// Переключение фильтра с учетом мобильных устройств
function toggleFilter(type, value, button) {
  const wasPreviouslyActive = activeFilters[type].has(value);

  if (wasPreviouslyActive) {
    activeFilters[type].delete(value);
    button.classList.remove("active");

    // Принудительно сбрасываем все стили при деактивации
    button.style.background = "";
    button.style.color = "";
    button.style.transform = "";
    button.style.boxShadow = "";
    button.style.borderColor = "";

    // Возвращаем базовые стили
    setTimeout(() => {
      if (!button.classList.contains("active")) {
        button.style.background = "linear-gradient(145deg, #ffffff, #f8f9fa)";
        button.style.color = "#495057";
        button.style.borderColor = "rgba(108, 117, 125, 0.2)";
        button.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.05)";
      }
    }, 50);
  } else {
    activeFilters[type].add(value);
    button.classList.add("active");
  }

  renderFilteredSchedule();
  updateStats();
  updateFilterFab();
}

// Очистка всех фильтров
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

  // Если находимся в режиме редактирования, выходим из него
  if (isSelectMode) {
    toggleMyGroupsEditMode();
  }

  renderFilteredSchedule();
  updateStats();
  updateFilterFab();
}

// Переключение отдельного фильтра (accordion behavior)
function toggleFilterGroup(groupId) {
  const options = document.getElementById(groupId);
  const toggle = document.querySelector(
    `[onclick="toggleFilterGroup('${groupId}')"] .filter-toggle`
  );

  // Если группа уже открыта - закрываем
  if (openFilterGroups.has(groupId)) {
    options.classList.remove("expanded");
    options.classList.add("collapsed");
    toggle.classList.add("collapsed");
    openFilterGroups.delete(groupId);
  } else {
    // Закрываем все открытые группы
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

    // Открываем текущую группу
    options.classList.remove("collapsed");
    options.classList.add("expanded");
    toggle.classList.remove("collapsed");
    openFilterGroups.add(groupId);
  }
}

// Проверка соответствия фильтрам
function matchesFilters(classItem, time, day) {
  // Если активен фильтр "Показать только мои группы"
  if (activeFilters.showMyGroupsOnly) {
    const classKey = getClassKey(classItem, time, day);
    return myGroups.has(classKey);
  }

  // Проверка преподавателей (поиск по любому из указанных)
  if (activeFilters.teachers.size > 0) {
    const teacherList = classItem.teacher
      .split(/[,/]|\sи\s/)
      .map((t) => t.trim());
    const hasMatchingTeacher = teacherList.some((teacher) =>
      activeFilters.teachers.has(teacher)
    );
    if (!hasMatchingTeacher) return false;
  }

  // Проверка уровня с использованием маппинга
  if (activeFilters.levels.size > 0) {
    const mappedLevel =
      levelMapping[classItem.level.toLowerCase()] || classItem.level;
    if (!activeFilters.levels.has(mappedLevel)) {
      return false;
    }
  }

  // Проверка типа
  if (
    activeFilters.types.size > 0 &&
    !activeFilters.types.has(classItem.type)
  ) {
    return false;
  }

  // Проверка локации
  if (
    activeFilters.locations.size > 0 &&
    !activeFilters.locations.has(classItem.location)
  ) {
    return false;
  }

  return true;
}

// Переключение видимости дня в мобильной версии
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

function createClassItem(classData, time, day) {
  const locationClass =
    classData.location === "8 марта" ? "loc-8marta" : "loc-libknehta";
  const locationText = classData.location === "8 марта" ? "8М" : "КЛ";

  const classKey = getClassKey(classData, time, day);
  const isMyGroup = myGroups.has(classKey);

  let additionalClasses = "";
  let showStar = false;

  if (isSelectMode) {
    // В режиме выбора показываем только те, что выбираем сейчас
    const isCurrentlySelected = tempSelectedGroups.has(classKey);
    if (isCurrentlySelected) {
      additionalClasses += " selected-group";
    }
  } else {
    // В обычном режиме показываем мои сохраненные группы
    if (isMyGroup) {
      additionalClasses += " my-group";
      showStar = true;
    }
  }

  const clickHandler = isSelectMode
    ? `handleMyGroupsSelection(${JSON.stringify(classData).replace(
        /"/g,
        "&quot;"
      )}, '${time}', ${day}, this)`
    : `showClassDetails('${classData.name}', '${classData.level}', '${classData.teacher}', '${classData.location}')`;

  return `
        <div class="class-item ${
          classData.type
        }${additionalClasses}" onclick="${clickHandler}">
            ${showStar ? '<div class="my-group-star">⭐</div>' : ""}
            <div class="class-location ${locationClass}">${locationText}</div>
            <div class="class-name">${classData.name}</div>
            <div class="class-level">${classData.level}</div>
            <div class="class-teacher">${classData.teacher}</div>
        </div>
    `;
}

// Отрисовка отфильтрованного расписания (таблица)
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

// Отрисовка мобильного карточного представления
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
    } else {
      // Показываем день, даже если нет занятий
      const emptySlot = document.createElement("div");
      emptySlot.className = "mobile-time-slot";
      emptySlot.innerHTML = '<div class="empty-cell">Занятий нет</div>';
      dayContent.appendChild(emptySlot);
      dayCard.appendChild(dayContent);
      container.appendChild(dayCard);
    }

    // Восстанавливаем состояние сворачивания
    if (collapsedMobileDays.has(dayIndex)) {
      dayContent.style.display = "none";
    }
  });
}

// Общая функция отрисовки
function renderFilteredSchedule() {
  renderTableSchedule();
  renderMobileSchedule();
}

// Обновление статистики
function updateStats() {
  let totalClasses = 0;

  Object.keys(scheduleData).forEach((time) => {
    Object.keys(scheduleData[time]).forEach((day) => {
      totalClasses += scheduleData[time][day].filter((cls) =>
        matchesFilters(cls, time, parseInt(day))
      ).length;
    });
  });

  // Подсчитываем активные фильтры
  let activeFiltersCount = 0;
  if (activeFilters.showMyGroupsOnly) activeFiltersCount++;
  activeFiltersCount += activeFilters.teachers.size;
  activeFiltersCount += activeFilters.levels.size;
  activeFiltersCount += activeFilters.types.size;
  activeFiltersCount += activeFilters.locations.size;

  document.getElementById("stats").innerHTML = `
        <span style="color: #f39c12;">📊 Показано занятий:</span> <strong>${totalClasses}</strong> | 
        <span style="color: #f39c12;">🎯 Активных фильтров:</span> <strong>${activeFiltersCount}</strong>
    `;
}

// Показ деталей занятия в модальном окне
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

// Закрытие модального окна
function closeModal() {
  document.getElementById("class-modal").style.display = "none";
}

// Закрытие модального окна при клике вне его
window.onclick = function (event) {
  const modal = document.getElementById("class-modal");
  if (event.target === modal) {
    closeModal();
  }
};

// Обработчик клавиши Escape
document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    closeModal();
    closeFilters();
  }
});

// Инициализация приложения
async function initializeApp() {
  console.log("🚀 Инициализация приложения...");

  await loadData();

  const { teachers, levels, types, locations } = extractAllData();

  // Создание фильтров преподавателей
  createFilterButtons(
    document.getElementById("teacherFilters"),
    teachers,
    "teachers"
  );

  // Создание фильтров уровней с жестко заданным порядком
  const levelContainer = document.getElementById("levelFilters");
  levelContainer.innerHTML = "";
  const fixedOrder = [
    "Набор",
    "Начинающие",
    "Продолжающие",
    "Продвинутые",
    "Дети",
  ];

  fixedOrder.forEach((level) => {
    if (levels.has(level)) {
      const button = document.createElement("button");
      button.className = "filter-button";
      button.textContent = level;
      button.onclick = () => toggleFilter("levels", level, button);
      levelContainer.appendChild(button);
    }
  });

  // Создание фильтров типов с читаемыми названиями (с исключениями)
  const typeButtons = document.getElementById("typeFilters");
  typeButtons.innerHTML = "";

  // Фильтруем типы, исключая нежелательные
  const filteredTypes = [...types].filter(
    (type) => !excludedTypes.includes(type)
  );

  filteredTypes.sort().forEach((type) => {
    const button = document.createElement("button");
    button.className = "filter-button";
    button.textContent = typeNames[type] || type;
    button.onclick = () => toggleFilter("types", type, button);
    typeButtons.appendChild(button);
  });

  // Создание фильтров локаций с читаемыми названиями
  const locationButtons = document.getElementById("locationFilters");
  locationButtons.innerHTML = "";
  [...locations].sort().forEach((location) => {
    const button = document.createElement("button");
    button.className = "filter-button";
    button.textContent = locationNames[location] || location;
    button.onclick = () => toggleFilter("locations", location, button);
    locationButtons.appendChild(button);
  });

  // Создание фильтра "Мои группы"
  createMyGroupsControls();

  // По умолчанию все секции фильтров свернуты, кроме "Мои группы"
  ["teacherFilters", "levelFilters", "typeFilters", "locationFilters"].forEach(
    (groupId) => {
      const options = document.getElementById(groupId);
      const toggle = document.querySelector(
        `[onclick="toggleFilterGroup('${groupId}')"] .filter-toggle`
      );
      if (options && toggle) {
        options.classList.add("collapsed");
        toggle.classList.add("collapsed");
      }
    }
  );

  // Фильтр "Мои группы" открыт по умолчанию - просто добавляем в набор открытых
  openFilterGroups.add("myGroupsFilters");

  // Первоначальная отрисовка
  renderFilteredSchedule();
  updateStats();
  updateFilterFab();

  // Обработчик изменения размера окна
  window.addEventListener("resize", () => {
    // При изменении размера окна может понадобиться перерисовка
    renderFilteredSchedule();
  });

  console.log("✅ Инициализация завершена! Групп загружено:", myGroups.size);
}

// Запуск приложения при загрузке DOM
document.addEventListener("DOMContentLoaded", initializeApp);

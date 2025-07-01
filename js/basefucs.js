// === MAXDANCE V2.0 - ПОЛНЫЙ BASEFUCS.JS ===

// === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
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

// Переменные для персонального расписания
let personalScheduleData = {};
let isPersonalScheduleOpen = false;
let editingPersonalClass = null;

// Переменные для админ-панели
let adminPanelData = {
  scheduleClasses: [],
  classTypes: [],
  locations: [],
  teachers: [],
};
let isAdminPanelOpen = false;
let editingAdminItem = null;
let currentAdminTab = "schedule";

// === ЗАГРУЗКА ДАННЫХ С БАЗЫ ДАННЫХ ===

// Загрузка данных с учетом авторизации (ОБНОВЛЕНО)
async function loadData() {
  try {
    console.log("📡 Загрузка данных расписания...");

    let data;

    try {
      // Пытаемся загрузить из базы данных
      data = await loadScheduleFromDatabase();
      console.log("✅ Данные загружены из базы данных");
    } catch (dbError) {
      console.warn(
        "⚠️ Ошибка загрузки из базы, используем fallback к JSON:",
        dbError
      );

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

    // Если пользователь авторизован, загружаем его группы
    if (currentUser) {
      console.log("👤 Загрузка персональных данных...");
      try {
        const userGroups = await getUserSavedGroups();
        myGroups = new Set(userGroups);
        console.log(`✅ Загружено ${myGroups.size} групп пользователя`);
      } catch (error) {
        console.error("⚠️ Ошибка загрузки групп пользователя:", error);
        // Продолжаем с пустым набором групп
        myGroups = new Set();
      }
    } else {
      // Для неавторизованных пользователей используем группы из JSON (если есть)
      if (data.myGroups) {
        myGroups = new Set(data.myGroups);
        activeFilters.showMyGroupsOnly = true;
      } else {
        myGroups = new Set();
      }
      console.log("📂 Загружены локальные группы:", myGroups.size);
    }

    return data;
  } catch (error) {
    console.error("❌ Ошибка загрузки данных:", error);
    // Создаем пустые данные в случае ошибки
    scheduleData = {};
    timeSlots = [];
    dayNames = [];
    typeNames = {};
    locationNames = {};
    myGroups = new Set();
  }
}

// Перезагрузка расписания с авторизацией
async function reloadScheduleWithAuth() {
  await loadData();
  createMyGroupsControls();
  renderFilteredSchedule();
  updateStats();
  updateFilterFab();
}

// === ФУНКЦИИ ДЛЯ РАБОТЫ С ЗАНЯТИЯМИ ===

// Генерация уникального ключа для занятия (ОБНОВЛЕНО)
function getClassKey(classItem, time, day) {
  // Если у занятия есть ID из базы данных, используем его
  if (classItem.id) {
    return `db_${classItem.id}`;
  }
  // Иначе используем старый метод для обратной совместимости
  return `${classItem.name}_${classItem.level}_${classItem.teacher}_${classItem.location}_${time}_${day}`;
}

function createClassItem(classData, time, day) {
  console.log("🏗️ Создаем элемент занятия:", classData);

  const locationClass =
    classData.location === "8 марта" ? "loc-8marta" : "loc-libknehta";
  const locationText = classData.location === "8 марта" ? "8М" : "КЛ";

  const classKey = getClassKey(classData, time, day);
  const isMyGroup = myGroups.has(classKey);

  let additionalClasses = "";
  let showStar = false;

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
    const safeClassData = JSON.stringify(classData).replace(/"/g, "&quot;");
    actionButtons = `
      <div class="class-actions">
        <button class="add-to-personal-btn" 
                onclick="event.stopPropagation(); addToPersonalSchedule(${safeClassData}, '${time}', ${day})"
                title="Добавить в персональное расписание">
          ➕
        </button>
      </div>
    `;
  }

  // Кнопки админа
  let adminButtons = "";
  if (isAdmin() && !isSelectMode && classData.id) {
    adminButtons = `
      <div class="admin-actions">
        <button class="edit-class-btn" 
                onclick="event.stopPropagation(); editScheduleClassQuick(${classData.id})"
                title="Быстрое редактирование">
          ✏️
        </button>
        <button class="delete-class-btn" 
                onclick="event.stopPropagation(); deleteScheduleClassQuick(${classData.id})"
                title="Удалить занятие">
          🗑️
        </button>
      </div>
    `;
  }

  const clickHandler = isSelectMode
    ? `handleMyGroupsSelection(${JSON.stringify(classData).replace(
        /"/g,
        "&quot;"
      )}, '${time}', ${day}, this)`
    : `showClassDetails('${classData.name}', '${classData.level}', '${classData.teacher}', '${classData.location}')`;

  const result = `
    <div class="class-item ${
      classData.type
    }${additionalClasses}" onclick="${clickHandler}">
      ${showStar ? '<div class="my-group-star">⭐</div>' : ""}
      <div class="class-location ${locationClass}">${locationText}</div>
      <div class="class-name">${classData.name}</div>
      <div class="class-level">${classData.level}</div>
      <div class="class-teacher">${classData.teacher}</div>
      ${actionButtons}
      ${adminButtons}
    </div>
  `;

  console.log("✅ HTML элемента создан");
  return result;
}

// === ФУНКЦИИ ДЛЯ РАБОТЫ С ПЕРСОНАЛЬНЫМ РАСПИСАНИЕМ ===

// Добавление занятия в персональное расписание
async function addToPersonalSchedule(classData, time, day) {
  if (!currentUser) {
    showNotification(
      "Войдите в аккаунт для добавления занятий в персональное расписание",
      "error"
    );
    return;
  }

  try {
    // Проверяем, не добавлено ли уже это занятие
    const personalClasses = await getUserPersonalClasses();
    const duplicate = personalClasses.find(
      (pc) =>
        pc.name === classData.name &&
        pc.day_of_week === day &&
        pc.time_slot === time &&
        pc.teacher === classData.teacher
    );

    if (duplicate) {
      showNotification(
        `Занятие "${classData.name}" уже добавлено в ваше персональное расписание`,
        "info"
      );
      return;
    }

    await addClassToPersonal(classData, time, day);
    showNotification(
      `✅ Занятие "${classData.name}" добавлено в персональное расписание!`,
      "success"
    );

    // Обновляем отображение
    await reloadScheduleWithAuth();
  } catch (error) {
    console.error("❌ Ошибка добавления в персональное расписание:", error);
    showNotification(
      "Ошибка при добавлении занятия: " + error.message,
      "error"
    );
  }
}

// === БЫСТРЫЕ ФУНКЦИИ ДЛЯ АДМИНИСТРАТОРОВ ===

// Быстрое редактирование занятия (упрощенная версия)
async function editScheduleClassQuick(classId) {
  if (!isAdmin()) {
    showNotification(
      "Доступ запрещен: требуются права администратора",
      "error"
    );
    return;
  }

  try {
    // Найдем занятие в текущих данных
    let classToEdit = null;
    Object.values(scheduleData).forEach((timeData) => {
      Object.values(timeData).forEach((dayClasses) => {
        const found = dayClasses.find((c) => c.id === classId);
        if (found) classToEdit = found;
      });
    });

    if (!classToEdit) {
      showNotification("Занятие не найдено", "error");
      return;
    }

    // Простые промпты для быстрого редактирования
    const newName = prompt("Название занятия:", classToEdit.name);
    if (newName === null) return; // Отмена

    const newLevel = prompt("Уровень:", classToEdit.level);
    if (newLevel === null) return;

    const newTeacher = prompt("Преподаватель:", classToEdit.teacher);
    if (newTeacher === null) return;

    if (!newName.trim()) {
      showNotification("Название занятия не может быть пустым", "error");
      return;
    }

    // Обновляем занятие
    const updatedClass = await updateScheduleClass(classId, {
      name: newName.trim(),
      level: newLevel.trim(),
      teacher: newTeacher.trim(),
      type: classToEdit.type,
      location: classToEdit.location,
      day_of_week: classToEdit.day_of_week || 0,
      time_slot: classToEdit.time_slot || "19:00",
    });

    showNotification(`✅ Занятие "${updatedClass.name}" обновлено!`, "success");
    await reloadScheduleWithAuth();
  } catch (error) {
    console.error("❌ Ошибка обновления занятия:", error);
    showNotification(
      "Ошибка при обновлении занятия: " + error.message,
      "error"
    );
  }
}

// Быстрое удаление занятия
async function deleteScheduleClassQuick(classId) {
  if (!isAdmin()) {
    showNotification(
      "Доступ запрещен: требуются права администратора",
      "error"
    );
    return;
  }

  if (!classId) {
    showNotification("❌ Ошибка: ID занятия не найден", "error");
    return;
  }

  // Найдем название занятия для подтверждения
  let className = "занятие";
  Object.values(scheduleData).forEach((timeData) => {
    Object.values(timeData).forEach((dayClasses) => {
      const found = dayClasses.find((c) => c.id === classId);
      if (found) className = found.name;
    });
  });

  if (!confirm(`Вы уверены, что хотите удалить занятие "${className}"?`)) {
    return;
  }

  try {
    await deleteScheduleClass(classId);
    showNotification(`✅ Занятие "${className}" удалено!`, "success");
    await reloadScheduleWithAuth();
  } catch (error) {
    console.error("❌ Ошибка удаления занятия:", error);
    showNotification("Ошибка при удалении занятия: " + error.message, "error");
  }
}

// === ИНТЕРФЕЙС ПЕРСОНАЛЬНОГО РАСПИСАНИЯ ===

// Показать персональное расписание (ОБНОВЛЕНО)
async function showPersonalSchedule() {
  if (!currentUser) {
    showNotification(
      "Войдите в аккаунт для доступа к персональному расписанию",
      "error"
    );
    return;
  }

  try {
    // Загружаем персональные занятия
    const personalClasses = await getUserPersonalClasses();
    personalScheduleData = organizePersonalSchedule(personalClasses);

    // Создаем и показываем модальное окно
    createPersonalScheduleModal();
    isPersonalScheduleOpen = true;

    console.log("📅 Персональное расписание открыто");
  } catch (error) {
    console.error("❌ Ошибка загрузки персонального расписания:", error);
    showNotification("Ошибка загрузки персонального расписания", "error");
  }
}

// Организация данных персонального расписания
function organizePersonalSchedule(classes) {
  const organized = {};

  classes.forEach((classItem) => {
    const time = classItem.time_slot;
    const day = classItem.day_of_week;

    if (!organized[time]) {
      organized[time] = {};
    }

    if (!organized[time][day]) {
      organized[time][day] = [];
    }

    organized[time][day].push(classItem);
  });

  return organized;
}

// Создание модального окна персонального расписания
function createPersonalScheduleModal() {
  // Удаляем существующее модальное окно если есть
  const existingModal = document.getElementById("personal-schedule-modal");
  if (existingModal) {
    existingModal.remove();
  }

  const modal = document.createElement("div");
  modal.id = "personal-schedule-modal";
  modal.className = "personal-schedule-modal";

  modal.innerHTML = `
    <div class="personal-schedule-content">
      <div class="personal-schedule-header">
        <h2>📅 Персональное расписание</h2>
        <button class="personal-schedule-close" onclick="closePersonalSchedule()">×</button>
      </div>
      
      <div class="personal-schedule-tabs">
        <button class="personal-tab active" data-tab="schedule" onclick="switchPersonalTab('schedule')">
          📋 Мое расписание
        </button>
        <button class="personal-tab" data-tab="add" onclick="switchPersonalTab('add')">
          ➕ Добавить занятие
        </button>
      </div>
      
      <div class="personal-schedule-body">
        <div id="personal-tab-schedule" class="personal-tab-content active">
          ${renderPersonalScheduleGrid()}
        </div>
        
        <div id="personal-tab-add" class="personal-tab-content">
          ${renderAddClassForm()}
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Показываем модальное окно с анимацией
  setTimeout(() => {
    modal.classList.add("active");
  }, 10);
}

// Отрисовка сетки персонального расписания
function renderPersonalScheduleGrid() {
  if (Object.keys(personalScheduleData).length === 0) {
    return `
      <div class="personal-schedule-empty">
        <div class="empty-icon">📅</div>
        <h3>Ваше персональное расписание пусто</h3>
        <p>Добавьте занятия из общего расписания или создайте собственные</p>
        <button class="personal-btn personal-btn-primary" onclick="switchPersonalTab('add')">
          ➕ Добавить первое занятие
        </button>
      </div>
    `;
  }

  // Получаем все уникальные временные слоты
  const allTimeSlots = [
    ...new Set([...Object.keys(personalScheduleData), ...timeSlots]),
  ].sort((a, b) => {
    const timeA = parseInt(a.split(":")[0]) * 60 + parseInt(a.split(":")[1]);
    const timeB = parseInt(b.split(":")[0]) * 60 + parseInt(b.split(":")[1]);
    return timeA - timeB;
  });

  let html = `
    <div class="personal-schedule-grid">
      <div class="personal-schedule-table">
        <table>
          <thead>
            <tr>
              <th>Время</th>
              ${dayNames.map((day) => `<th>${day}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
  `;

  allTimeSlots.forEach((time) => {
    html += `<tr>`;
    html += `<td class="personal-time-cell">${time}</td>`;

    for (let day = 0; day < 7; day++) {
      html += `<td class="personal-class-cell">`;

      if (personalScheduleData[time] && personalScheduleData[time][day]) {
        html += personalScheduleData[time][day]
          .map((classItem) => renderPersonalClassItem(classItem))
          .join("");
      } else {
        html += `<div class="personal-empty-cell">—</div>`;
      }

      html += `</td>`;
    }

    html += `</tr>`;
  });

  html += `
          </tbody>
        </table>
      </div>
      
      <div class="personal-schedule-stats">
        <div class="personal-stat">
          <span class="personal-stat-number">${getTotalPersonalClasses()}</span>
          <span class="personal-stat-label">Всего занятий</span>
        </div>
        <div class="personal-stat">
          <span class="personal-stat-number">${getUniquePersonalDays()}</span>
          <span class="personal-stat-label">Дней в неделю</span>
        </div>
        <div class="personal-stat">
          <span class="personal-stat-number">${getPersonalHoursPerWeek()}</span>
          <span class="personal-stat-label">Часов в неделю</span>
        </div>
      </div>
    </div>
  `;

  return html;
}

// Отрисовка элемента персонального занятия
function renderPersonalClassItem(classItem) {
  return `
    <div class="personal-class-item ${classItem.type || "personal"}">
      <div class="personal-class-name">${classItem.name}</div>
      <div class="personal-class-level">${classItem.level}</div>
      <div class="personal-class-teacher">${classItem.teacher}</div>
      ${
        classItem.location
          ? `<div class="personal-class-location">${classItem.location}</div>`
          : ""
      }
      
      <div class="personal-class-actions">
        <button class="personal-action-btn edit" onclick="editPersonalClass(${
          classItem.id
        })" title="Редактировать">
          ✏️
        </button>
        <button class="personal-action-btn delete" onclick="deletePersonalClass(${
          classItem.id
        })" title="Удалить">
          🗑️
        </button>
      </div>
    </div>
  `;
}

// Форма добавления нового занятия
function renderAddClassForm() {
  const isEditing = editingPersonalClass !== null;
  const classData = isEditing
    ? editingPersonalClass
    : {
        name: "",
        level: "",
        teacher: "",
        location: "",
        day_of_week: 0,
        time_slot: "19:00",
        type: "personal",
      };

  return `
    <div class="personal-add-form">
      <h3>${
        isEditing ? "✏️ Редактировать занятие" : "➕ Добавить новое занятие"
      }</h3>
      
      <form id="personal-class-form" onsubmit="savePersonalClass(event)">
        <div class="personal-form-row">
          <div class="personal-form-group">
            <label class="personal-form-label">Название занятия *</label>
            <input type="text" id="personal-name" class="personal-form-input" 
                   value="${
                     classData.name
                   }" placeholder="Например: Бачата" required>
          </div>
          
          <div class="personal-form-group">
            <label class="personal-form-label">Уровень</label>
            <input type="text" id="personal-level" class="personal-form-input" 
                   value="${
                     classData.level
                   }" placeholder="Например: начинающие">
          </div>
        </div>
        
        <div class="personal-form-row">
          <div class="personal-form-group">
            <label class="personal-form-label">Преподаватель</label>
            <input type="text" id="personal-teacher" class="personal-form-input" 
                   value="${classData.teacher}" placeholder="Имя преподавателя">
          </div>
          
          <div class="personal-form-group">
            <label class="personal-form-label">Локация</label>
            <select id="personal-location" class="personal-form-select">
              <option value="">Выберите локацию</option>
              <option value="8 марта" ${
                classData.location === "8 марта" ? "selected" : ""
              }>
                ул. 8 Марта (Мытный Двор)
              </option>
              <option value="либкнехта" ${
                classData.location === "либкнехта" ? "selected" : ""
              }>
                ул. К.Либкнехта (Консул)
              </option>
              <option value="дома" ${
                classData.location === "дома" ? "selected" : ""
              }>
                Дома (онлайн)
              </option>
              <option value="другое" ${
                classData.location === "другое" ? "selected" : ""
              }>
                Другое место
              </option>
            </select>
          </div>
        </div>
        
        <div class="personal-form-row">
          <div class="personal-form-group">
            <label class="personal-form-label">День недели *</label>
            <select id="personal-day" class="personal-form-select" required>
              ${dayNames
                .map(
                  (day, index) =>
                    `<option value="${index}" ${
                      classData.day_of_week == index ? "selected" : ""
                    }>${day}</option>`
                )
                .join("")}
            </select>
          </div>
          
          <div class="personal-form-group">
            <label class="personal-form-label">Время *</label>
            <select id="personal-time" class="personal-form-select" required>
              ${generateTimeOptions(classData.time_slot)}
            </select>
          </div>
        </div>
        
        <div class="personal-form-group">
          <label class="personal-form-label">Тип занятия</label>
          <select id="personal-type" class="personal-form-select">
            <option value="personal" ${
              classData.type === "personal" ? "selected" : ""
            }>Персональное</option>
            <option value="group" ${
              classData.type === "group" ? "selected" : ""
            }>Групповое</option>
            <option value="online" ${
              classData.type === "online" ? "selected" : ""
            }>Онлайн</option>
            <option value="practice" ${
              classData.type === "practice" ? "selected" : ""
            }>Практика</option>
          </select>
        </div>
        
        <div class="personal-form-actions">
          <button type="button" class="personal-btn personal-btn-secondary" onclick="cancelEditPersonalClass()">
            Отмена
          </button>
          <button type="submit" class="personal-btn personal-btn-primary">
            ${isEditing ? "💾 Сохранить изменения" : "➕ Добавить занятие"}
          </button>
        </div>
      </form>
    </div>
  `;
}

// Генерация опций времени
function generateTimeOptions(selectedTime = "") {
  const times = [];
  for (let hour = 8; hour <= 23; hour++) {
    for (let minute of ["00", "30"]) {
      const timeStr = `${hour.toString().padStart(2, "0")}:${minute}`;
      times.push(
        `<option value="${timeStr}" ${
          selectedTime === timeStr ? "selected" : ""
        }>${timeStr}</option>`
      );
    }
  }
  return times.join("");
}

// Переключение вкладок
function switchPersonalTab(tabName) {
  // Обновляем активные вкладки
  document.querySelectorAll(".personal-tab").forEach((tab) => {
    tab.classList.remove("active");
  });
  document.querySelector(`[data-tab="${tabName}"]`).classList.add("active");

  // Обновляем активный контент
  document.querySelectorAll(".personal-tab-content").forEach((content) => {
    content.classList.remove("active");
  });
  document.getElementById(`personal-tab-${tabName}`).classList.add("active");

  // Если переходим на вкладку добавления, сбрасываем форму редактирования
  if (tabName === "add" && !editingPersonalClass) {
    updateAddForm();
  }
}

// Сохранение персонального занятия
async function savePersonalClass(event) {
  event.preventDefault();

  const formData = {
    name: document.getElementById("personal-name").value.trim(),
    level: document.getElementById("personal-level").value.trim(),
    teacher: document.getElementById("personal-teacher").value.trim(),
    location: document.getElementById("personal-location").value,
    day_of_week: parseInt(document.getElementById("personal-day").value),
    time_slot: document.getElementById("personal-time").value,
    type: document.getElementById("personal-type").value,
  };

  if (!formData.name) {
    showNotification("Введите название занятия", "error");
    return;
  }

  try {
    if (editingPersonalClass) {
      // Обновляем существующее занятие
      await updatePersonalClass(editingPersonalClass.id, formData);
      showNotification("Занятие обновлено!", "success");
      editingPersonalClass = null;
    } else {
      // Создаем новое занятие
      await createPersonalClass(formData);
      showNotification("Занятие добавлено!", "success");
    }

    // Перезагружаем данные и обновляем интерфейс
    const personalClasses = await getUserPersonalClasses();
    personalScheduleData = organizePersonalSchedule(personalClasses);

    // Обновляем содержимое вкладки расписания
    document.getElementById("personal-tab-schedule").innerHTML =
      renderPersonalScheduleGrid();

    // Очищаем форму и переключаемся на расписание
    document.getElementById("personal-class-form").reset();
    switchPersonalTab("schedule");
  } catch (error) {
    console.error("❌ Ошибка сохранения занятия:", error);
    showNotification("Ошибка сохранения занятия: " + error.message, "error");
  }
}

// Редактирование персонального занятия
async function editPersonalClass(classId) {
  try {
    const personalClasses = await getUserPersonalClasses();
    editingPersonalClass = personalClasses.find((c) => c.id === classId);

    if (!editingPersonalClass) {
      showNotification("Занятие не найдено", "error");
      return;
    }

    // Переключаемся на вкладку добавления и обновляем форму
    switchPersonalTab("add");
    updateAddForm();
  } catch (error) {
    console.error("❌ Ошибка загрузки занятия для редактирования:", error);
    showNotification("Ошибка загрузки занятия", "error");
  }
}

// Удаление персонального занятия
async function deletePersonalClass(classId) {
  if (!confirm("Вы уверены, что хотите удалить это занятие?")) {
    return;
  }

  try {
    await window.deletePersonalClass(classId);
    showNotification("Занятие удалено", "success");

    // Перезагружаем данные
    const personalClasses = await getUserPersonalClasses();
    personalScheduleData = organizePersonalSchedule(personalClasses);

    // Обновляем интерфейс
    document.getElementById("personal-tab-schedule").innerHTML =
      renderPersonalScheduleGrid();
  } catch (error) {
    console.error("❌ Ошибка удаления занятия:", error);
    showNotification("Ошибка удаления занятия: " + error.message, "error");
  }
}

// Отмена редактирования
function cancelEditPersonalClass() {
  editingPersonalClass = null;
  switchPersonalTab("schedule");
}

// Обновление формы добавления
function updateAddForm() {
  document.getElementById("personal-tab-add").innerHTML = renderAddClassForm();
}

// Закрытие персонального расписания
function closePersonalSchedule() {
  const modal = document.getElementById("personal-schedule-modal");
  if (modal) {
    modal.classList.remove("active");
    setTimeout(() => {
      modal.remove();
      isPersonalScheduleOpen = false;
      editingPersonalClass = null;
    }, 300);
  }
}

// Статистические функции
function getTotalPersonalClasses() {
  let total = 0;
  Object.values(personalScheduleData).forEach((timeData) => {
    Object.values(timeData).forEach((dayClasses) => {
      total += dayClasses.length;
    });
  });
  return total;
}

function getUniquePersonalDays() {
  const days = new Set();
  Object.values(personalScheduleData).forEach((timeData) => {
    Object.keys(timeData).forEach((day) => {
      days.add(day);
    });
  });
  return days.size;
}

function getPersonalHoursPerWeek() {
  return getTotalPersonalClasses(); // Приблизительно, можно улучшить
}

// === ИНТЕРФЕЙС АДМИН-ПАНЕЛИ ===

// Показать админ-панель (ОБНОВЛЕНО)
async function showAdminPanel() {
  if (!isAdmin()) {
    showNotification(
      "Доступ запрещен: требуются права администратора",
      "error"
    );
    return;
  }

  try {
    // Загружаем все данные для админ-панели
    await loadAdminPanelData();

    // Создаем и показываем модальное окно
    createAdminPanelModal();
    isAdminPanelOpen = true;

    console.log("⚙️ Админ-панель открыта");
  } catch (error) {
    console.error("❌ Ошибка загрузки админ-панели:", error);
    showNotification("Ошибка загрузки админ-панели", "error");
  }
}

// Загрузка данных для админ-панели
async function loadAdminPanelData() {
  try {
    // Упрощенный запрос без JOIN к user_profiles
    const { data: scheduleClasses, error: scheduleError } = await supabase
      .from("schedule_classes")
      .select("*")
      .order("day_of_week", { ascending: true })
      .order("time_slot", { ascending: true });

    if (scheduleError) throw scheduleError;

    // Загружаем справочники упрощенно
    const { data: classTypes, error: typesError } = await supabase
      .from("class_types")
      .select("*")
      .order("sort_order", { ascending: true });

    const { data: locations, error: locationsError } = await supabase
      .from("locations")
      .select("*")
      .order("sort_order", { ascending: true });

    const { data: teachers, error: teachersError } = await supabase
      .from("teachers")
      .select("*")
      .order("sort_order", { ascending: true });

    // Игнорируем ошибки справочников если таблиц нет
    adminPanelData = {
      scheduleClasses: scheduleClasses || [],
      classTypes: classTypes || [],
      locations: locations || [],
      teachers: teachers || [],
    };

    console.log("✅ Данные админ-панели загружены", adminPanelData);
  } catch (error) {
    console.error("❌ Ошибка загрузки данных админ-панели:", error);
    // Создаем пустые данные вместо падения
    adminPanelData = {
      scheduleClasses: [],
      classTypes: [],
      locations: [],
      teachers: [],
    };
  }
}

// Создание модального окна админ-панели
function createAdminPanelModal() {
  // Удаляем существующее модальное окно если есть
  const existingModal = document.getElementById("admin-panel-modal");
  if (existingModal) {
    existingModal.remove();
  }

  const modal = document.createElement("div");
  modal.id = "admin-panel-modal";
  modal.className = "admin-panel-modal";

  modal.innerHTML = `
    <div class="admin-panel-content">
      <div class="admin-panel-header">
        <h2>⚙️ Панель администратора</h2>
        <div class="admin-panel-user">
          <span class="admin-indicator">АДМИН</span>
          <span class="admin-user-name">${
            userProfile?.full_name || currentUser?.email
          }</span>
        </div>
        <button class="admin-panel-close" onclick="closeAdminPanel()">×</button>
      </div>
      
      <div class="admin-panel-tabs">
        <button class="admin-tab active" data-tab="schedule" onclick="switchAdminTab('schedule')">
          📋 Расписание
        </button>
        <button class="admin-tab" data-tab="references" onclick="switchAdminTab('references')">
          📚 Справочники
        </button>
        <button class="admin-tab" data-tab="analytics" onclick="switchAdminTab('analytics')">
          📊 Аналитика
        </button>
        <button class="admin-tab" data-tab="settings" onclick="switchAdminTab('settings')">
          ⚙️ Настройки
        </button>
      </div>
      
      <div class="admin-panel-body">
        <div id="admin-tab-schedule" class="admin-tab-content active">
          ${renderScheduleManagement()}
        </div>
        
        <div id="admin-tab-references" class="admin-tab-content">
          ${renderReferencesManagement()}
        </div>
        
        <div id="admin-tab-analytics" class="admin-tab-content">
          ${renderAnalytics()}
        </div>
        
        <div id="admin-tab-settings" class="admin-tab-content">
          ${renderSettings()}
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Показываем модальное окно с анимацией
  setTimeout(() => {
    modal.classList.add("active");
  }, 10);
}

// === УПРАВЛЕНИЕ РАСПИСАНИЕМ ===

function renderScheduleManagement() {
  return `
    <div class="admin-section">
      <div class="admin-section-header">
        <h3>📋 Управление общим расписанием</h3>
        <button class="admin-btn admin-btn-primary" onclick="showAddClassForm()">
          ➕ Добавить занятие
        </button>
      </div>
      
      <div class="admin-filters">
        <select id="admin-filter-day" onchange="filterAdminSchedule()" class="admin-form-select">
          <option value="">Все дни</option>
          ${dayNames
            .map((day, index) => `<option value="${index}">${day}</option>`)
            .join("")}
        </select>
        
        <select id="admin-filter-type" onchange="filterAdminSchedule()" class="admin-form-select">
          <option value="">Все типы</option>
          ${adminPanelData.classTypes
            .map(
              (type) =>
                `<option value="${type.id}">${type.display_name}</option>`
            )
            .join("")}
        </select>
        
        <select id="admin-filter-location" onchange="filterAdminSchedule()" class="admin-form-select">
          <option value="">Все локации</option>
          ${adminPanelData.locations
            .map(
              (loc) => `<option value="${loc.id}">${loc.display_name}</option>`
            )
            .join("")}
        </select>
        
        <select id="admin-filter-status" onchange="filterAdminSchedule()" class="admin-form-select">
          <option value="">Все статусы</option>
          <option value="true">Активные</option>
          <option value="false">Неактивные</option>
        </select>
      </div>
      
      <div class="admin-schedule-table-container">
        ${renderScheduleTable()}
      </div>
    </div>
  `;
}

function renderScheduleTable() {
  const filteredClasses = getFilteredScheduleClasses();

  return `
    <table class="admin-table">
      <thead>
        <tr>
          <th>День</th>
          <th>Время</th>
          <th>Название</th>
          <th>Уровень</th>
          <th>Преподаватель</th>
          <th>Тип</th>
          <th>Локация</th>
          <th>Статус</th>
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        ${filteredClasses
          .map(
            (classItem) => `
          <tr class="${!classItem.is_active ? "inactive-row" : ""}">
            <td>${dayNames[classItem.day_of_week]}</td>
            <td>${classItem.time_slot}</td>
            <td><strong>${classItem.name}</strong></td>
            <td><span class="level-badge">${classItem.level}</span></td>
            <td>${classItem.teacher}</td>
            <td>${getTypeDisplayName(classItem.type)}</td>
            <td>${getLocationDisplayName(classItem.location)}</td>
            <td>
              <span class="status-badge ${
                classItem.is_active ? "active" : "inactive"
              }">
                ${classItem.is_active ? "Активно" : "Неактивно"}
              </span>
            </td>
            <td>
              <div class="admin-table-actions">
                <button class="admin-table-btn admin-table-btn-edit" 
                        onclick="editScheduleClassAdmin(${classItem.id})" 
                        title="Редактировать">
                  ✏️
                </button>
                <button class="admin-table-btn admin-table-btn-toggle" 
                        onclick="toggleScheduleClassStatus(${
                          classItem.id
                        }, ${!classItem.is_active})" 
                        title="${
                          classItem.is_active
                            ? "Деактивировать"
                            : "Активировать"
                        }">
                  ${classItem.is_active ? "🔴" : "🟢"}
                </button>
                <button class="admin-table-btn admin-table-btn-delete" 
                        onclick="deleteScheduleClassAdmin(${classItem.id})" 
                        title="Удалить">
                  🗑️
                </button>
              </div>
            </td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
    
    <div class="admin-table-stats">
      <span>Всего занятий: <strong>${
        adminPanelData.scheduleClasses.length
      }</strong></span>
      <span>Показано: <strong>${filteredClasses.length}</strong></span>
      <span>Активных: <strong>${
        adminPanelData.scheduleClasses.filter((c) => c.is_active).length
      }</strong></span>
    </div>
  `;
}

// === УПРАВЛЕНИЕ СПРАВОЧНИКАМИ ===

function renderReferencesManagement() {
  return `
    <div class="admin-section">
      <div class="admin-references-tabs">
        <button class="admin-ref-tab active" data-ref="types" onclick="switchReferenceTab('types')">
          💃 Типы занятий
        </button>
        <button class="admin-ref-tab" data-ref="locations" onclick="switchReferenceTab('locations')">
          📍 Локации
        </button>
        <button class="admin-ref-tab" data-ref="teachers" onclick="switchReferenceTab('teachers')">
          👨‍🏫 Преподаватели
        </button>
      </div>
      
      <div class="admin-references-content">
        <div id="admin-ref-types" class="admin-ref-content active">
          ${renderClassTypesTable()}
        </div>
        
        <div id="admin-ref-locations" class="admin-ref-content">
          ${renderLocationsTable()}
        </div>
        
        <div id="admin-ref-teachers" class="admin-ref-content">
          ${renderTeachersTable()}
        </div>
      </div>
    </div>
  `;
}

function renderClassTypesTable() {
  return `
    <div class="admin-ref-section">
      <div class="admin-section-header">
        <h3>💃 Типы занятий</h3>
        <button class="admin-btn admin-btn-primary" onclick="showAddClassTypeForm()">
          ➕ Добавить тип
        </button>
      </div>
      
      <table class="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Название</th>
            <th>Описание</th>
            <th>Цвет</th>
            <th>Порядок</th>
            <th>Статус</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          ${adminPanelData.classTypes
            .map(
              (type) => `
            <tr class="${!type.is_active ? "inactive-row" : ""}">
              <td><code>${type.id}</code></td>
              <td><strong>${type.display_name}</strong></td>
              <td>${type.description || "—"}</td>
              <td>
                <div class="color-indicator" style="background-color: ${
                  type.color_code || "#f39c12"
                }"></div>
                ${type.color_code || "—"}
              </td>
              <td>${type.sort_order}</td>
              <td>
                <span class="status-badge ${
                  type.is_active ? "active" : "inactive"
                }">
                  ${type.is_active ? "Активен" : "Неактивен"}
                </span>
              </td>
              <td>
                <div class="admin-table-actions">
                  <button class="admin-table-btn admin-table-btn-edit" 
                          onclick="editClassType('${type.id}')" 
                          title="Редактировать">
                    ✏️
                  </button>
                  <button class="admin-table-btn admin-table-btn-delete" 
                          onclick="deleteClassType('${type.id}')" 
                          title="Удалить">
                    🗑️
                  </button>
                </div>
              </td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderLocationsTable() {
  return `
    <div class="admin-ref-section">
      <div class="admin-section-header">
        <h3>📍 Локации</h3>
        <button class="admin-btn admin-btn-primary" onclick="showAddLocationForm()">
          ➕ Добавить локацию
        </button>
      </div>
      
      <table class="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Название</th>
            <th>Полный адрес</th>
            <th>Порядок</th>
            <th>Статус</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          ${adminPanelData.locations
            .map(
              (location) => `
            <tr class="${!location.is_active ? "inactive-row" : ""}">
              <td><code>${location.id}</code></td>
              <td><strong>${location.display_name}</strong></td>
              <td>${location.full_address || "—"}</td>
              <td>${location.sort_order}</td>
              <td>
                <span class="status-badge ${
                  location.is_active ? "active" : "inactive"
                }">
                  ${location.is_active ? "Активна" : "Неактивна"}
                </span>
              </td>
              <td>
                <div class="admin-table-actions">
                  <button class="admin-table-btn admin-table-btn-edit" 
                          onclick="editLocation('${location.id}')" 
                          title="Редактировать">
                    ✏️
                  </button>
                  <button class="admin-table-btn admin-table-btn-delete" 
                          onclick="deleteLocation('${location.id}')" 
                          title="Удалить">
                    🗑️
                  </button>
                </div>
              </td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderTeachersTable() {
  return `
    <div class="admin-ref-section">
      <div class="admin-section-header">
        <h3>👨‍🏫 Преподаватели</h3>
        <button class="admin-btn admin-btn-primary" onclick="showAddTeacherForm()">
          ➕ Добавить преподавателя
        </button>
      </div>
      
      <table class="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Полное имя</th>
            <th>Специализации</th>
            <th>Порядок</th>
            <th>Статус</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          ${adminPanelData.teachers
            .map(
              (teacher) => `
            <tr class="${!teacher.is_active ? "inactive-row" : ""}">
              <td><code>${teacher.id}</code></td>
              <td><strong>${teacher.full_name}</strong></td>
              <td>
                ${
                  teacher.specializations
                    ? teacher.specializations
                        .map(
                          (spec) =>
                            `<span class="specialization-badge">${getTypeDisplayName(
                              spec
                            )}</span>`
                        )
                        .join(" ")
                    : "—"
                }
              </td>
              <td>${teacher.sort_order}</td>
              <td>
                <span class="status-badge ${
                  teacher.is_active ? "active" : "inactive"
                }">
                  ${teacher.is_active ? "Активен" : "Неактивен"}
                </span>
              </td>
              <td>
                <div class="admin-table-actions">
                  <button class="admin-table-btn admin-table-btn-edit" 
                          onclick="editTeacher(${teacher.id})" 
                          title="Редактировать">
                    ✏️
                  </button>
                  <button class="admin-table-btn admin-table-btn-delete" 
                          onclick="deleteTeacher(${teacher.id})" 
                          title="Удалить">
                    🗑️
                  </button>
                </div>
              </td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

// === АНАЛИТИКА ===

function renderAnalytics() {
  const stats = calculateAnalytics();

  return `
    <div class="admin-section">
      <h3>📊 Аналитика и статистика</h3>
      
      <div class="admin-analytics-grid">
        <div class="admin-analytics-card">
          <div class="analytics-number">${stats.totalClasses}</div>
          <div class="analytics-label">Всего занятий</div>
        </div>
        
        <div class="admin-analytics-card">
          <div class="analytics-number">${stats.activeClasses}</div>
          <div class="analytics-label">Активных занятий</div>
        </div>
        
        <div class="admin-analytics-card">
          <div class="analytics-number">${stats.uniqueTeachers}</div>
          <div class="analytics-label">Преподавателей</div>
        </div>
        
        <div class="admin-analytics-card">
          <div class="analytics-number">${stats.classTypes}</div>
          <div class="analytics-label">Типов занятий</div>
        </div>
        
        <div class="admin-analytics-card">
          <div class="analytics-number">${stats.locations}</div>
          <div class="analytics-label">Локаций</div>
        </div>
        
        <div class="admin-analytics-card">
          <div class="analytics-number">${stats.weeklyHours}</div>
          <div class="analytics-label">Часов в неделю</div>
        </div>
      </div>
      
      <div class="admin-analytics-charts">
        <div class="analytics-chart">
          <h4>📊 Занятия по дням недели</h4>
          <div class="chart-bars">
            ${dayNames
              .map((day, index) => {
                const count = stats.classesByDay[index] || 0;
                const maxCount = Math.max(...Object.values(stats.classesByDay));
                const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
                return `
                <div class="chart-bar">
                  <div class="bar-fill" style="height: ${height}%"></div>
                  <div class="bar-label">${day.substring(0, 2)}</div>
                  <div class="bar-count">${count}</div>
                </div>
              `;
              })
              .join("")}
          </div>
        </div>
        
        <div class="analytics-chart">
          <h4>💃 Популярные типы занятий</h4>
          <div class="chart-list">
            ${Object.entries(stats.classesByType)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 5)
              .map(
                ([type, count]) => `
                <div class="chart-list-item">
                  <span class="chart-item-label">${getTypeDisplayName(
                    type
                  )}</span>
                  <span class="chart-item-count">${count}</span>
                </div>
              `
              )
              .join("")}
          </div>
        </div>
      </div>
    </div>
  `;
}

// === НАСТРОЙКИ ===

function renderSettings() {
  return `
    <div class="admin-section">
      <h3>⚙️ Настройки системы</h3>
      
      <div class="admin-settings-grid">
        <div class="admin-settings-card">
          <h4>🔄 Синхронизация</h4>
          <p>Перезагрузить данные из базы</p>
          <button class="admin-btn admin-btn-primary" onclick="refreshSystemData()">
            🔄 Обновить данные
          </button>
        </div>
        
        <div class="admin-settings-card">
          <h4>📤 Экспорт</h4>
          <p>Экспорт расписания в различных форматах</p>
          <div class="admin-settings-buttons">
            <button class="admin-btn admin-btn-secondary" onclick="exportSchedule('json')">
              📄 JSON
            </button>
            <button class="admin-btn admin-btn-secondary" onclick="exportSchedule('csv')">
              📊 CSV
            </button>
          </div>
        </div>
        
        <div class="admin-settings-card">
          <h4>🔐 Права доступа</h4>
          <p>Управление администраторами</p>
          <button class="admin-btn admin-btn-secondary" onclick="manageAdmins()">
            👥 Управление админами
          </button>
        </div>
        
        <div class="admin-settings-card">
          <h4>🧹 Очистка</h4>
          <p>Удаление неактивных данных</p>
          <button class="admin-btn admin-btn-danger" onclick="cleanupInactiveData()">
            🗑️ Очистить данные
          </button>
        </div>
      </div>
      
      <div class="admin-system-info">
        <h4>ℹ️ Информация о системе</h4>
        <div class="system-info-grid">
          <div>Версия системы: <code>2.0.0</code></div>
          <div>База данных: <code>Supabase PostgreSQL</code></div>
          <div>Последнее обновление: <code>${new Date().toLocaleString(
            "ru-RU"
          )}</code></div>
          <div>Текущий админ: <code>${
            userProfile?.full_name || currentUser?.email
          }</code></div>
        </div>
      </div>
    </div>
  `;
}

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ АДМИН-ПАНЕЛИ ===

// Переключение вкладок админ-панели
function switchAdminTab(tabName) {
  currentAdminTab = tabName;

  // Обновляем активные вкладки
  document.querySelectorAll(".admin-tab").forEach((tab) => {
    tab.classList.remove("active");
  });
  document.querySelector(`[data-tab="${tabName}"]`).classList.add("active");

  // Обновляем активный контент
  document.querySelectorAll(".admin-tab-content").forEach((content) => {
    content.classList.remove("active");
  });
  document.getElementById(`admin-tab-${tabName}`).classList.add("active");
}

// Переключение вкладок справочников
function switchReferenceTab(refName) {
  // Обновляем активные вкладки
  document.querySelectorAll(".admin-ref-tab").forEach((tab) => {
    tab.classList.remove("active");
  });
  document.querySelector(`[data-ref="${refName}"]`).classList.add("active");

  // Обновляем активный контент
  document.querySelectorAll(".admin-ref-content").forEach((content) => {
    content.classList.remove("active");
  });
  document.getElementById(`admin-ref-${refName}`).classList.add("active");
}

// Закрытие админ-панели
function closeAdminPanel() {
  const modal = document.getElementById("admin-panel-modal");
  if (modal) {
    modal.classList.remove("active");
    setTimeout(() => {
      modal.remove();
      isAdminPanelOpen = false;
      editingAdminItem = null;
    }, 300);
  }
}

// Вспомогательные функции для отображения
function getTypeDisplayName(typeId) {
  const type = adminPanelData.classTypes.find((t) => t.id === typeId);
  return type ? type.display_name : typeId;
}

function getLocationDisplayName(locationId) {
  const location = adminPanelData.locations.find((l) => l.id === locationId);
  return location ? location.display_name : locationId;
}

function getFilteredScheduleClasses() {
  const dayFilter = document.getElementById("admin-filter-day")?.value;
  const typeFilter = document.getElementById("admin-filter-type")?.value;
  const locationFilter = document.getElementById(
    "admin-filter-location"
  )?.value;
  const statusFilter = document.getElementById("admin-filter-status")?.value;

  return adminPanelData.scheduleClasses.filter((classItem) => {
    if (dayFilter && classItem.day_of_week.toString() !== dayFilter)
      return false;
    if (typeFilter && classItem.type !== typeFilter) return false;
    if (locationFilter && classItem.location !== locationFilter) return false;
    if (statusFilter && classItem.is_active.toString() !== statusFilter)
      return false;
    return true;
  });
}

function calculateAnalytics() {
  const classes = adminPanelData.scheduleClasses;

  return {
    totalClasses: classes.length,
    activeClasses: classes.filter((c) => c.is_active).length,
    uniqueTeachers: new Set(classes.map((c) => c.teacher)).size,
    classTypes: adminPanelData.classTypes.length,
    locations: adminPanelData.locations.length,
    weeklyHours: classes.filter((c) => c.is_active).length, // Приблизительно
    classesByDay: classes.reduce((acc, c) => {
      acc[c.day_of_week] = (acc[c.day_of_week] || 0) + 1;
      return acc;
    }, {}),
    classesByType: classes.reduce((acc, c) => {
      acc[c.type] = (acc[c.type] || 0) + 1;
      return acc;
    }, {}),
  };
}

// === СИСТЕМА УВЕДОМЛЕНИЙ ===

function showNotification(message, type = "info", duration = 3000) {
  // Удаляем существующие уведомления
  const existingNotifications = document.querySelectorAll(".notification");
  existingNotifications.forEach((notification) => notification.remove());

  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.textContent = message;

  document.body.appendChild(notification);

  // Автоматически удаляем уведомление
  setTimeout(() => {
    notification.style.animation = "slideOutRight 0.3s ease-out";
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, duration);
}

// === ОСТАЛЬНЫЕ ФУНКЦИИ РАСПИСАНИЯ ===

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

// Создание кнопок фильтров
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

// Переключение фильтра
function toggleFilter(filterType, value, button) {
  if (activeFilters[filterType].has(value)) {
    activeFilters[filterType].delete(value);
    button.classList.remove("active");
  } else {
    activeFilters[filterType].add(value);
    button.classList.add("active");
  }
  renderFilteredSchedule();
  updateStats();
  updateFilterFab();
}

// Создание элементов управления для фильтра "Мои группы" (ОБНОВЛЕНО)
function createMyGroupsControls() {
  const container = document.getElementById("myGroupsFilters");
  container.innerHTML = "";

  // Создаем главную кнопку-переключатель
  const toggleButton = document.createElement("button");
  toggleButton.id = "my-groups-toggle";
  toggleButton.className = "filter-button my-groups-main-toggle";

  // Обновляем текст кнопки в зависимости от авторизации
  const groupsText =
    currentUser && userProfile
      ? `⭐ Мои группы (${myGroups.size})`
      : `⭐ Показать только мои группы (${myGroups.size})`;
  toggleButton.textContent = groupsText;

  if (activeFilters.showMyGroupsOnly) {
    toggleButton.classList.add("active");
  }
  toggleButton.onclick = toggleMyGroupsFilter;

  container.appendChild(toggleButton);

  // Добавляем кнопку для перехода к персональному расписанию (только для авторизованных)
  if (currentUser) {
    const personalScheduleButton = document.createElement("button");
    personalScheduleButton.className = "filter-button personal-schedule-btn";
    personalScheduleButton.textContent = "📅 Персональное расписание";
    personalScheduleButton.onclick = showPersonalSchedule;
    container.appendChild(personalScheduleButton);
  }

  // Добавляем кнопку админ-панели (только для администраторов)
  if (isAdmin()) {
    const adminPanelButton = document.createElement("button");
    adminPanelButton.className = "filter-button admin-panel-btn";
    adminPanelButton.textContent = "⚙️ Админ-панель";
    adminPanelButton.onclick = showAdminPanel;
    container.appendChild(adminPanelButton);
  }

  // Если нет групп, показываем сообщение
  if (myGroups.size === 0) {
    const message = document.createElement("div");
    message.className = "no-groups-message";
    message.textContent = currentUser
      ? "Группы не выбраны. Используйте кнопку редактирования для добавления."
      : "Группы не выбраны. Войдите в аккаунт или используйте кнопку редактирования.";
    container.appendChild(message);
  }

  // Показываем инструкции если активен режим выбора
  if (isSelectMode) {
    showMyGroupsInstructions();
  }
}

// Переключение фильтра "Мои группы"
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

// Проверка соответствия фильтрам
function matchesFilters(classItem, time, day) {
  // Фильтр "Мои группы"
  if (activeFilters.showMyGroupsOnly) {
    const classKey = getClassKey(classItem, time, day);
    if (!myGroups.has(classKey)) {
      return false;
    }
  }

  // Фильтр преподавателей
  if (activeFilters.teachers.size > 0) {
    const teacherList = classItem.teacher
      .split(/[,/]|\sи\s/)
      .map((t) => t.trim());
    const hasMatchingTeacher = teacherList.some((teacher) =>
      activeFilters.teachers.has(teacher)
    );
    if (!hasMatchingTeacher) {
      return false;
    }
  }

  // Фильтр уровней
  if (activeFilters.levels.size > 0) {
    const mappedLevel =
      levelMapping[classItem.level.toLowerCase()] || classItem.level;
    if (!activeFilters.levels.has(mappedLevel)) {
      return false;
    }
  }

  // Фильтр типов
  if (activeFilters.types.size > 0) {
    if (!activeFilters.types.has(classItem.type)) {
      return false;
    }
  }

  // Фильтр локаций
  if (activeFilters.locations.size > 0) {
    if (!activeFilters.locations.has(classItem.location)) {
      return false;
    }
  }

  return true;
}

// Отрисовка отфильтрованного расписания
function renderFilteredSchedule() {
  const isMobile = window.innerWidth <= 768;

  if (isMobile) {
    renderMobileSchedule();
  } else {
    renderDesktopSchedule();
  }
}

// Отрисовка расписания для десктопа
function renderDesktopSchedule() {
  const scheduleContainer = document.getElementById("schedule");
  scheduleContainer.innerHTML = "";

  console.log("🖥️ Рендеринг десктопного расписания...");
  console.log("Контейнер найден:", !!scheduleContainer);
  console.log("Временных слотов:", timeSlots.length);
  console.log("Данных расписания:", Object.keys(scheduleData).length);

  // Создаем таблицу
  const table = document.createElement("table");
  table.className = "schedule-table";

  // Создаем заголовок
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  headerRow.innerHTML = `<th class="time-header">Время</th>`;

  dayNames.forEach((day, index) => {
    const th = document.createElement("th");
    th.className = "day-header";
    th.textContent = day;
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Создаем тело таблицы
  const tbody = document.createElement("tbody");

  // Проверяем каждый временной слот
  timeSlots.forEach((time) => {
    console.log(`⏰ Обрабатываем время ${time}:`, scheduleData[time]);

    const row = document.createElement("tr");
    row.className = "time-row";

    // Ячейка времени
    const timeCell = document.createElement("td");
    timeCell.className = "time-cell";
    timeCell.textContent = time;
    row.appendChild(timeCell);

    // Ячейки для каждого дня
    for (let day = 0; day < 7; day++) {
      const dayCell = document.createElement("td");
      dayCell.className = "day-cell";

      // Проверяем наличие занятий
      if (scheduleData[time] && scheduleData[time][day]) {
        console.log(
          `📅 ${dayNames[day]} ${time}: найдено ${scheduleData[time][day].length} занятий`
        );

        const filteredClasses = scheduleData[time][day].filter((classItem) =>
          matchesFilters(classItem, time, day)
        );

        console.log(`✅ После фильтрации: ${filteredClasses.length} занятий`);

        filteredClasses.forEach((classItem) => {
          console.log(`🎯 Создаем элемент для:`, classItem);
          const classElement = document.createElement("div");
          classElement.innerHTML = createClassItem(classItem, time, day);
          dayCell.appendChild(classElement.firstChild);
        });
      } else {
        // Добавляем пустую ячейку
        const emptyDiv = document.createElement("div");
        emptyDiv.className = "empty-cell";
        emptyDiv.textContent = "—";
        dayCell.appendChild(emptyDiv);
      }

      row.appendChild(dayCell);
    }

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  scheduleContainer.appendChild(table);

  console.log("✅ Таблица создана и добавлена в DOM");
}
// Отрисовка расписания для мобильных устройств
function renderMobileSchedule() {
  const scheduleContainer = document.getElementById("schedule");
  scheduleContainer.innerHTML = "";

  dayNames.forEach((day, dayIndex) => {
    // Создаем блок дня
    const dayBlock = document.createElement("div");
    dayBlock.className = "mobile-day-block";

    // Заголовок дня
    const dayHeader = document.createElement("div");
    dayHeader.className = "mobile-day-header";
    dayHeader.onclick = () => toggleMobileDay(dayIndex);

    const isCollapsed = collapsedMobileDays.has(dayIndex);
    dayHeader.innerHTML = `
      <span class="mobile-day-name">${day}</span>
      <span class="mobile-day-toggle ${
        isCollapsed ? "collapsed" : ""
      }"">▼</span>
      <span class="mobile-day-count">${countDayClasses(dayIndex)}</span>
    `;

    dayBlock.appendChild(dayHeader);

    // Контент дня
    const dayContent = document.createElement("div");
    dayContent.className = `mobile-day-content ${
      isCollapsed ? "collapsed" : ""
    }`;

    timeSlots.forEach((time) => {
      if (scheduleData[time] && scheduleData[time][dayIndex]) {
        const filteredClasses = scheduleData[time][dayIndex].filter(
          (classItem) => matchesFilters(classItem, time, dayIndex)
        );

        if (filteredClasses.length > 0) {
          const timeBlock = document.createElement("div");
          timeBlock.className = "mobile-time-block";

          const timeHeader = document.createElement("div");
          timeHeader.className = "mobile-time-header";
          timeHeader.textContent = time;
          timeBlock.appendChild(timeHeader);

          filteredClasses.forEach((classItem) => {
            const classElement = document.createElement("div");
            classElement.innerHTML = createClassItem(classItem, time, dayIndex);
            timeBlock.appendChild(classElement.firstChild);
          });

          dayContent.appendChild(timeBlock);
        }
      }
    });

    dayBlock.appendChild(dayContent);
    scheduleContainer.appendChild(dayBlock);
  });
}

// Подсчет занятий в дне (для мобильной версии)
function countDayClasses(dayIndex) {
  let count = 0;
  timeSlots.forEach((time) => {
    if (scheduleData[time] && scheduleData[time][dayIndex]) {
      count += scheduleData[time][dayIndex].filter((classItem) =>
        matchesFilters(classItem, time, dayIndex)
      ).length;
    }
  });
  return count;
}

// Переключение сворачивания дня в мобильной версии
function toggleMobileDay(dayIndex) {
  const toggle = document.querySelector(
    `.mobile-day-block:nth-child(${dayIndex + 1}) .mobile-day-toggle`
  );
  const content = document.querySelector(
    `.mobile-day-block:nth-child(${dayIndex + 1}) .mobile-day-content`
  );

  if (collapsedMobileDays.has(dayIndex)) {
    collapsedMobileDays.delete(dayIndex);
    toggle.classList.remove("collapsed");
    content.classList.remove("collapsed");
  } else {
    collapsedMobileDays.add(dayIndex);
    toggle.classList.add("collapsed");
    content.classList.add("collapsed");
  }
}

// Обновленная функция отображения статистики с индикатором админа
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

  // Добавляем информацию о пользователе, если авторизован
  let userInfo = "";
  if (currentUser && userProfile) {
    userInfo = ` | <span style="color: #27ae60;">👤 ${
      userProfile.full_name || currentUser.email
    }</span>`;

    // Добавляем индикатор администратора
    if (isAdmin()) {
      userInfo += ` <span class="admin-indicator">АДМИН</span>`;
    }
  }

  document.getElementById("stats").innerHTML = `
    <span style="color: #f39c12;">📊 Показано занятий:</span> <strong>${totalClasses}</strong> | 
    <span style="color: #f39c12;">🎯 Активных фильтров:</span> <strong>${activeFiltersCount}</strong>${userInfo}
  `;
}

// Обновление плавающей кнопки фильтров
function updateFilterFab() {
  const filterFab = document.getElementById("filter-fab");
  if (!filterFab) return;

  let activeFiltersCount = 0;
  if (activeFilters.showMyGroupsOnly) activeFiltersCount++;
  activeFiltersCount += activeFilters.teachers.size;
  activeFiltersCount += activeFilters.levels.size;
  activeFilters.types.size;
  activeFiltersCount += activeFilters.locations.size;

  const badge = filterFab.querySelector(".filter-fab-badge");
  if (activeFiltersCount > 0) {
    badge.textContent = activeFiltersCount;
    badge.style.display = "block";
    filterFab.classList.add("has-filters");
  } else {
    badge.style.display = "none";
    filterFab.classList.remove("has-filters");
  }
}

// Показ деталей занятия
function showClassDetails(name, level, teacher, location) {
  const modal = document.getElementById("class-details-modal");
  const content = document.getElementById("class-details-content");

  content.innerHTML = `
    <h3>${name}</h3>
    <p><strong>Уровень:</strong> ${level}</p>
    <p><strong>Преподаватель:</strong> ${teacher}</p>
    <p><strong>Локация:</strong> ${locationNames[location] || location}</p>
  `;

  modal.style.display = "block";
}

// Закрытие модального окна деталей
function closeClassDetails() {
  document.getElementById("class-details-modal").style.display = "none";
}

// Переключение группы фильтров
function toggleFilterGroup(groupId) {
  const options = document.getElementById(groupId);
  const toggle = document.querySelector(
    `[onclick="toggleFilterGroup('${groupId}')"] .filter-toggle`
  );

  if (openFilterGroups.has(groupId)) {
    openFilterGroups.delete(groupId);
    options.classList.add("collapsed");
    toggle.classList.add("collapsed");
  } else {
    openFilterGroups.add(groupId);
    options.classList.remove("collapsed");
    toggle.classList.remove("collapsed");
  }
}

// Очистка всех фильтров
function clearAllFilters() {
  // Очищаем фильтры
  activeFilters.teachers.clear();
  activeFilters.levels.clear();
  activeFilters.types.clear();
  activeFilters.locations.clear();
  activeFilters.showMyGroupsOnly = false;

  // Обновляем кнопки
  document.querySelectorAll(".filter-button").forEach((button) => {
    button.classList.remove("active");
  });

  renderFilteredSchedule();
  updateStats();
  updateFilterFab();
}

// Переключение панели фильтров на мобильных устройствах
function toggleMobileFilters() {
  const filtersPanel = document.getElementById("filters");
  const filterFab = document.getElementById("filter-fab");

  if (filtersPanel.classList.contains("mobile-open")) {
    filtersPanel.classList.remove("mobile-open");
    filterFab.classList.remove("filters-open");
  } else {
    filtersPanel.classList.add("mobile-open");
    filterFab.classList.add("filters-open");
  }
}

// Обновленная функция инициализации приложения
async function initializeApp() {
  console.log("🚀 Инициализация приложения MaxDance v2.0...");

  // Ждем инициализации аутентификации
  let authInitialized = false;
  let attempts = 0;

  while (!authInitialized && attempts < 50) {
    if (typeof currentUser !== "undefined") {
      authInitialized = true;
    } else {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }
  }

  // Загружаем данные
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

  // Фильтр "Мои группы" открыт по умолчанию
  openFilterGroups.add("myGroupsFilters");

  // Первоначальная отрисовка
  renderFilteredSchedule();
  updateStats();
  updateFilterFab();

  // Обработчик изменения размера окна
  window.addEventListener("resize", () => {
    renderFilteredSchedule();
  });

  console.log("✅ Инициализация MaxDance завершена!");

  // Выводим информацию о статусе
  if (currentUser) {
    const status = isAdmin() ? "Администратор" : "Пользователь";
    console.log(
      `👤 ${status}: ${userProfile?.full_name || currentUser.email}, групп: ${
        myGroups.size
      }`
    );
  } else {
    console.log(`📂 Гостевой режим, групп загружено: ${myGroups.size}`);
  }

  // Показываем приветственное сообщение для новых админов
  if (isAdmin() && myGroups.size === 0) {
    setTimeout(() => {
      showNotification(
        "🎉 Добро пожаловать в админ-панель MaxDance! Откройте ⚙️ Админ-панель для управления расписанием.",
        "info",
        5000
      );
    }, 2000);
  }
}

// Функция проверки состояния системы (для отладки)
function checkSystemStatus() {
  const status = {
    authenticated: !!currentUser,
    isAdmin: isAdmin(),
    userProfile: userProfile,
    myGroupsCount: myGroups.size,
    scheduleDataLoaded: Object.keys(scheduleData).length > 0,
    timeSlots: timeSlots.length,
    functions: {
      showPersonalSchedule: typeof showPersonalSchedule === "function",
      showAdminPanel: typeof showAdminPanel === "function",
      loadScheduleFromDatabase: typeof loadScheduleFromDatabase === "function",
    },
  };

  console.table(status);
  return status;
}

// === ЗАГЛУШКИ ДЛЯ БУДУЩИХ ФУНКЦИЙ ===

function showAddClassForm() {
  showNotification("🚧 Форма добавления занятия - в разработке!", "info");
}

function editScheduleClassAdmin(id) {
  showNotification(
    `🚧 Редактирование занятия ID ${id} - в разработке!`,
    "info"
  );
}

function deleteScheduleClassAdmin(id) {
  showNotification(`🚧 Удаление занятия ID ${id} - в разработке!`, "info");
}

function toggleScheduleClassStatus(id, newStatus) {
  showNotification(
    `🚧 Изменение статуса занятия ID ${id} - в разработке!`,
    "info"
  );
}

function filterAdminSchedule() {
  // Перерисовываем таблицу с новыми фильтрами
  const container = document.querySelector(".admin-schedule-table-container");
  if (container) {
    container.innerHTML = renderScheduleTable();
  }
}

function showAddClassTypeForm() {
  showNotification("🚧 Добавление типа занятия - в разработке!", "info");
}

function showAddLocationForm() {
  showNotification("🚧 Добавление локации - в разработке!", "info");
}

function showAddTeacherForm() {
  showNotification("🚧 Добавление преподавателя - в разработке!", "info");
}

function refreshSystemData() {
  showNotification("🔄 Обновление данных системы...", "info");
  setTimeout(async () => {
    await reloadScheduleWithAuth();
    showNotification("✅ Данные системы обновлены!", "success");
  }, 2000);
}

function exportSchedule(format) {
  showNotification(
    `🚧 Экспорт в ${format.toUpperCase()} - в разработке!`,
    "info"
  );
}

function manageAdmins() {
  showNotification("🚧 Управление администраторами - в разработке!", "info");
}

function cleanupInactiveData() {
  if (confirm("Вы уверены, что хотите удалить все неактивные данные?")) {
    showNotification("🚧 Очистка данных - в разработке!", "info");
  }
}

// === ЭКСПОРТ ФУНКЦИЙ В ГЛОБАЛЬНУЮ ОБЛАСТЬ ВИДИМОСТИ ===

// Основные функции
window.addToPersonalSchedule = addToPersonalSchedule;
window.editScheduleClassQuick = editScheduleClassQuick;
window.deleteScheduleClassQuick = deleteScheduleClassQuick;
window.checkSystemStatus = checkSystemStatus;

// Функции персонального расписания
window.showPersonalSchedule = showPersonalSchedule;
window.closePersonalSchedule = closePersonalSchedule;
window.switchPersonalTab = switchPersonalTab;
window.savePersonalClass = savePersonalClass;
window.editPersonalClass = editPersonalClass;
window.deletePersonalClass = deletePersonalClass;
window.cancelEditPersonalClass = cancelEditPersonalClass;

// Функции админ-панели
window.showAdminPanel = showAdminPanel;
window.closeAdminPanel = closeAdminPanel;
window.switchAdminTab = switchAdminTab;
window.switchReferenceTab = switchReferenceTab;
window.filterAdminSchedule = filterAdminSchedule;
window.showAddClassForm = showAddClassForm;
window.editScheduleClassAdmin = editScheduleClassAdmin;
window.deleteScheduleClassAdmin = deleteScheduleClassAdmin;
window.toggleScheduleClassStatus = toggleScheduleClassStatus;
window.showAddClassTypeForm = showAddClassTypeForm;
window.showAddLocationForm = showAddLocationForm;
window.showAddTeacherForm = showAddTeacherForm;
window.refreshSystemData = refreshSystemData;
window.exportSchedule = exportSchedule;
window.manageAdmins = manageAdmins;
window.cleanupInactiveData = cleanupInactiveData;

// Функции интерфейса
window.showNotification = showNotification;
window.showClassDetails = showClassDetails;
window.closeClassDetails = closeClassDetails;
window.toggleFilterGroup = toggleFilterGroup;
window.clearAllFilters = clearAllFilters;
window.toggleMobileFilters = toggleMobileFilters;
window.toggleMobileDay = toggleMobileDay;

// === ФУНКЦИИ "МОИ ГРУППЫ" (ПРОДОЛЖЕНИЕ) ===

// Переключение режима редактирования моих групп
function toggleMyGroupsEditMode() {
  isSelectMode = !isSelectMode;

  if (isSelectMode) {
    // Входим в режим выбора
    tempSelectedGroups = new Set([...myGroups]);
    showMyGroupsInstructions();

    // Добавляем кнопки управления
    const container = document.getElementById("myGroupsFilters");
    const controlsDiv = document.createElement("div");
    controlsDiv.className = "my-groups-controls";
    controlsDiv.innerHTML = `
      <button class="filter-button save-groups-btn" onclick="saveMyGroupsSelection()">
        💾 Сохранить выбор
      </button>
      <button class="filter-button cancel-groups-btn" onclick="cancelMyGroupsSelection()">
        ❌ Отмена
      </button>
    `;
    container.appendChild(controlsDiv);
  } else {
    // Выходим из режима выбора
    tempSelectedGroups.clear();
    hideMyGroupsInstructions();

    // Удаляем кнопки управления
    const controls = document.querySelector(".my-groups-controls");
    if (controls) {
      controls.remove();
    }
  }

  renderFilteredSchedule();
}

// Обработка выбора группы в режиме редактирования
function handleMyGroupsSelection(classData, time, day, element) {
  if (!isSelectMode) return;

  const classKey = getClassKey(classData, time, day);

  if (tempSelectedGroups.has(classKey)) {
    tempSelectedGroups.delete(classKey);
    element.classList.remove("selected-group");
  } else {
    tempSelectedGroups.add(classKey);
    element.classList.add("selected-group");
  }

  updateMyGroupsInstructions();
}

// Сохранение выбора моих групп
async function saveMyGroupsSelection() {
  try {
    myGroups = new Set([...tempSelectedGroups]);

    // Сохраняем в базу данных если пользователь авторизован
    if (currentUser) {
      await saveUserGroups([...myGroups]);
      showNotification(`✅ Сохранено ${myGroups.size} групп!`, "success");
    } else {
      showNotification(`💾 Выбрано ${myGroups.size} групп (локально)`, "info");
    }

    // Выходим из режима выбора
    toggleMyGroupsEditMode();

    // Обновляем интерфейс
    createMyGroupsControls();
    renderFilteredSchedule();
    updateStats();
  } catch (error) {
    console.error("❌ Ошибка сохранения групп:", error);
    showNotification("Ошибка сохранения групп: " + error.message, "error");
  }
}

// Отмена выбора моих групп
function cancelMyGroupsSelection() {
  tempSelectedGroups.clear();
  toggleMyGroupsEditMode();
  renderFilteredSchedule();
}

// Показ инструкций для режима выбора групп
function showMyGroupsInstructions() {
  const container = document.getElementById("myGroupsFilters");

  let instructions = document.getElementById("my-groups-instructions");
  if (!instructions) {
    instructions = document.createElement("div");
    instructions.id = "my-groups-instructions";
    instructions.className = "my-groups-instructions";
    container.appendChild(instructions);
  }

  updateMyGroupsInstructions();
}

// Обновление инструкций
function updateMyGroupsInstructions() {
  const instructions = document.getElementById("my-groups-instructions");
  if (instructions) {
    instructions.innerHTML = `
      <div class="instructions-text">
        📝 Режим выбора групп активен<br>
        Нажимайте на занятия для добавления/удаления<br>
        <strong>Выбрано: ${tempSelectedGroups.size} групп</strong>
      </div>
    `;
  }
}

// Скрытие инструкций
function hideMyGroupsInstructions() {
  const instructions = document.getElementById("my-groups-instructions");
  if (instructions) {
    instructions.remove();
  }
}

// Быстрое добавление всех отфильтрованных занятий в мои группы
function addAllFilteredToMyGroups() {
  if (!isSelectMode) {
    toggleMyGroupsEditMode();
  }

  // Добавляем все отфильтрованные занятия
  Object.keys(scheduleData).forEach((time) => {
    Object.keys(scheduleData[time]).forEach((day) => {
      scheduleData[time][day].forEach((classItem) => {
        if (matchesFilters(classItem, time, parseInt(day))) {
          const classKey = getClassKey(classItem, time, day);
          tempSelectedGroups.add(classKey);
        }
      });
    });
  });

  renderFilteredSchedule();
  updateMyGroupsInstructions();
  showNotification(
    `Добавлено ${tempSelectedGroups.size} занятий для выбора`,
    "info"
  );
}

// Экспорт функций "Мои группы"
window.toggleMyGroupsEditMode = toggleMyGroupsEditMode;
window.handleMyGroupsSelection = handleMyGroupsSelection;
window.saveMyGroupsSelection = saveMyGroupsSelection;
window.cancelMyGroupsSelection = cancelMyGroupsSelection;
window.addAllFilteredToMyGroups = addAllFilteredToMyGroups;

// === ОБРАБОТЧИКИ СОБЫТИЙ ===

// Закрытие модальных окон по клику вне их области
document.addEventListener("click", function (event) {
  // Закрытие модального окна деталей занятия
  const classModal = document.getElementById("class-details-modal");
  if (classModal && event.target === classModal) {
    closeClassDetails();
  }

  // Закрытие персонального расписания
  const personalModal = document.getElementById("personal-schedule-modal");
  if (personalModal && event.target === personalModal) {
    closePersonalSchedule();
  }

  // Закрытие админ-панели
  const adminModal = document.getElementById("admin-panel-modal");
  if (adminModal && event.target === adminModal) {
    closeAdminPanel();
  }
});

// Обработка клавиш Escape для закрытия модальных окон
document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    // Закрываем любое открытое модальное окно
    closeClassDetails();
    closePersonalSchedule();
    closeAdminPanel();

    // Выходим из режима выбора групп
    if (isSelectMode) {
      cancelMyGroupsSelection();
    }
  }
});

// === СЛУЖЕБНЫЕ ФУНКЦИИ ===

// Функция для безопасного выполнения асинхронных операций
async function safeAsync(asyncFn, errorMessage = "Произошла ошибка") {
  try {
    return await asyncFn();
  } catch (error) {
    console.error(`❌ ${errorMessage}:`, error);
    showNotification(`${errorMessage}: ${error.message}`, "error");
    throw error;
  }
}

// Функция для форматирования времени
function formatTime(timeString) {
  try {
    const [hours, minutes] = timeString.split(":");
    return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
  } catch {
    return timeString;
  }
}

// Функция для форматирования даты
function formatDate(date) {
  if (!date) return "";

  try {
    if (typeof date === "string") {
      date = new Date(date);
    }
    return date.toLocaleDateString("ru-RU");
  } catch {
    return date.toString();
  }
}

// Функция для получения цвета типа занятия
function getTypeColor(type) {
  const colors = {
    bachata: "#e74c3c",
    salsa: "#f39c12",
    kizomba: "#9b59b6",
    zouk: "#3498db",
    reggaeton: "#e67e22",
    "lady-style": "#e91e63",
    stretching: "#27ae60",
    personal: "#34495e",
    practice: "#95a5a6",
  };

  return colors[type] || "#f39c12";
}

// Функция для получения иконки типа занятия
function getTypeIcon(type) {
  const icons = {
    bachata: "💃",
    salsa: "🕺",
    kizomba: "💕",
    zouk: "🎵",
    reggaeton: "🔥",
    "lady-style": "👑",
    stretching: "🧘‍♀️",
    personal: "👤",
    practice: "🎯",
  };

  return icons[type] || "💃";
}

// Функция для дебаунса (ограничения частоты выполнения)
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Дебаунсированная версия рендеринга (для оптимизации)
const debouncedRender = debounce(renderFilteredSchedule, 100);

// === ЭКСПОРТ СЛУЖЕБНЫХ ФУНКЦИЙ ===

window.safeAsync = safeAsync;
window.formatTime = formatTime;
window.formatDate = formatDate;
window.getTypeColor = getTypeColor;
window.getTypeIcon = getTypeIcon;
window.debounce = debounce;
window.debouncedRender = debouncedRender;
window.debugScheduleData = debugScheduleData;

// === ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ ===

// Запуск приложения при загрузке DOM
document.addEventListener("DOMContentLoaded", initializeApp);

// === КОНЕЦ ФАЙЛА ===
console.log("📦 basefucs.js загружен успешно!");

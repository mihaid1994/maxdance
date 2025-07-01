// Обновленный basefucs.js с загрузкой из базы данных
// Интерфейс персонального расписания
// Интерфейс админ-панели
// Финальные обновления basefucs.js

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

// === ОБНОВЛЕННАЯ ЗАГРУЗКА ДАННЫХ ===

async function loadData() {
  try {
    console.log("📡 Загрузка данных расписания...");

    let data;
    try {
      data = await loadScheduleFromDatabase();
      console.log("✅ Данные загружены из базы данных");
    } catch (dbError) {
      console.warn(
        "⚠️ Ошибка загрузки из базы, используем fallback к JSON:",
        dbError
      );
      const response = await fetch("./data/data.json");
      data = await response.json();
      console.log("✅ Данные загружены из JSON файла");
    }

    scheduleData = data.schedule;
    timeSlots = data.timeSlots;
    dayNames = data.dayNames;
    typeNames = data.typeNames;
    locationNames = data.locationNames;

    if (currentUser) {
      console.log("👤 Загрузка персональных данных...");
      try {
        const userGroups = await getUserSavedGroups();
        myGroups = new Set(userGroups);
        console.log(`✅ Загружено ${myGroups.size} групп пользователя`);
      } catch (error) {
        console.error("⚠️ Ошибка загрузки групп пользователя:", error);
        myGroups = new Set();
      }
    } else {
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
    scheduleData = {};
    timeSlots = [];
    dayNames = [];
    typeNames = {};
    locationNames = {};
    myGroups = new Set();
  }
}

async function reloadScheduleWithAuth() {
  await loadData();
  createMyGroupsControls();
  renderFilteredSchedule();
  updateStats();
  updateFilterFab();
}

// === ФУНКЦИИ ДЛЯ ЗАНЯТИЙ ===

function getClassKey(classItem, time, day) {
  if (classItem.id) {
    return `db_${classItem.id}`;
  }
  return `${classItem.name}_${classItem.level}_${classItem.teacher}_${classItem.location}_${time}_${day}`;
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
    if (tempSelectedGroups.has(classKey)) {
      additionalClasses += " selected-group";
    }
  } else {
    if (isMyGroup) {
      additionalClasses += " my-group";
      showStar = true;
    }
  }

  let actionButtons = "";
  if (currentUser && !isSelectMode) {
    const safeData = JSON.stringify(classData).replace(/"/g, "&quot;");
    actionButtons = `
      <div class="class-actions">
        <button class="add-to-personal-btn"
                onclick="event.stopPropagation(); addToPersonalSchedule(${safeData}, '${time}', ${day})"
                title="Добавить в персональное расписание">➕</button>
      </div>
    `;
  }

  let adminButtons = "";
  if (isAdmin() && !isSelectMode && classData.id) {
    adminButtons = `
      <div class="admin-actions">
        <button class="edit-class-btn" onclick="event.stopPropagation(); editScheduleClassQuick(${classData.id})" title="Быстрое редактирование">✏️</button>
        <button class="delete-class-btn" onclick="event.stopPropagation(); deleteScheduleClassQuick(${classData.id})" title="Удалить занятие">🗑️</button>
      </div>
    `;
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
      ${actionButtons}
      ${adminButtons}
    </div>
  `;
}

// === ПЕРСОНАЛЬНОЕ РАСПИСАНИЕ ===

async function addToPersonalSchedule(classData, time, day) {
  if (!currentUser) {
    showNotification(
      "Войдите в аккаунт для добавления занятий в персональное расписание",
      "error"
    );
    return;
  }
  try {
    const personalClasses = await getUserPersonalClasses();
    const duplicate = personalClasses.find(
      (pc) =>
        pc.name === classData.name &&
        pc.day_of_week === day &&
        pc.time_slot === time &&
        pc.teacher === classData.teacher
    );
    if (duplicate) {
      showNotification(`Занятие "${classData.name}" уже добавлено`, "info");
      return;
    }
    await addClassToPersonal(classData, time, day);
    showNotification(`✅ Добавлено "${classData.name}"`, "success");
    await reloadScheduleWithAuth();
  } catch (error) {
    console.error(error);
    showNotification(
      "Ошибка при добавлении занятия: " + error.message,
      "error"
    );
  }
}

function createMyGroupsControls() {
  const container = document.getElementById("myGroupsFilters");
  container.innerHTML = "";

  const toggleButton = document.createElement("button");
  toggleButton.id = "my-groups-toggle";
  toggleButton.className = "filter-button my-groups-main-toggle";
  const groupsText =
    currentUser && userProfile
      ? `⭐ Мои группы (${myGroups.size})`
      : `⭐ Показать только мои группы (${myGroups.size})`;
  toggleButton.textContent = groupsText;
  if (activeFilters.showMyGroupsOnly) toggleButton.classList.add("active");
  toggleButton.onclick = toggleMyGroupsFilter;
  container.appendChild(toggleButton);

  if (currentUser) {
    const psBtn = document.createElement("button");
    psBtn.className = "filter-button personal-schedule-btn";
    psBtn.textContent = "📅 Персональное расписание";
    psBtn.onclick = showPersonalSchedule;
    container.appendChild(psBtn);
  }

  if (isAdmin()) {
    const apBtn = document.createElement("button");
    apBtn.className = "filter-button admin-panel-btn";
    apBtn.textContent = "⚙️ Админ-панель";
    apBtn.onclick = showAdminPanel;
    container.appendChild(apBtn);
  }

  if (myGroups.size === 0) {
    const message = document.createElement("div");
    message.className = "no-groups-message";
    message.textContent = currentUser
      ? "Группы не выбраны. Используйте кнопку редактирования."
      : "Группы не выбраны. Войдите или используйте кнопку редактирования.";
    container.appendChild(message);
  }

  if (isSelectMode) showMyGroupsInstructions();
}

async function showPersonalSchedule() {
  if (!currentUser) {
    showNotification("Войдите в аккаунт для доступа", "error");
    return;
  }
  try {
    const personalClasses = await getUserPersonalClasses();
    personalScheduleData = organizePersonalSchedule(personalClasses);
    createPersonalScheduleModal();
    isPersonalScheduleOpen = true;
    console.log("📅 Персональное расписание открыто");
  } catch (error) {
    console.error(error);
    showNotification("Ошибка загрузки персонального расписания", "error");
  }
}

function organizePersonalSchedule(classes) {
  const organized = {};
  classes.forEach((c) => {
    const { time_slot: time, day_of_week: day } = c;
    if (!organized[time]) organized[time] = {};
    if (!organized[time][day]) organized[time][day] = [];
    organized[time][day].push(c);
  });
  return organized;
}

function createPersonalScheduleModal() {
  const existing = document.getElementById("personal-schedule-modal");
  if (existing) existing.remove();
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
        <button class="personal-tab active" data-tab="schedule" onclick="switchPersonalTab('schedule')">📋 Мое расписание</button>
        <button class="personal-tab" data-tab="add" onclick="switchPersonalTab('add')">➕ Добавить занятие</button>
      </div>
      <div class="personal-schedule-body">
        <div id="personal-tab-schedule" class="personal-tab-content active">${renderPersonalScheduleGrid()}</div>
        <div id="personal-tab-add" class="personal-tab-content">${renderAddClassForm()}</div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add("active"), 10);
}

function renderPersonalScheduleGrid() {
  if (Object.keys(personalScheduleData).length === 0) {
    return `
      <div class="personal-schedule-empty">
        <div class="empty-icon">📅</div>
        <h3>Ваше персональное расписание пусто</h3>
        <p>Добавьте занятия из общего расписания или создайте собственные</p>
        <button class="personal-btn personal-btn-primary" onclick="switchPersonalTab('add')">➕ Добавить первое занятие</button>
      </div>
    `;
  }

  const allTimeSlots = [
    ...new Set([...Object.keys(personalScheduleData), ...timeSlots]),
  ].sort((a, b) => {
    const [ha, ma] = a.split(":").map(Number);
    const [hb, mb] = b.split(":").map(Number);
    return ha * 60 + ma - (hb * 60 + mb);
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
    html += `<tr><td class="personal-time-cell">${time}</td>`;
    for (let d = 0; d < daysCount; d++) {
      html += `<td class="personal-class-cell">`;
      if (personalScheduleData[time]?.[d]) {
        html += personalScheduleData[time][d]
          .map(renderPersonalClassItem)
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
        })" title="Редактировать">✏️</button>
        <button class="personal-action-btn delete" onclick="deletePersonalClass(${
          classItem.id
        })" title="Удалить">🗑️</button>
      </div>
    </div>
  `;
}

function renderAddClassForm() {
  const isEditing = editingPersonalClass !== null;
  const data = isEditing
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
            <label>Название занятия *</label>
            <input type="text" id="personal-name" value="${data.name}" required>
          </div>
          <div class="personal-form-group">
            <label>Уровень</label>
            <input type="text" id="personal-level" value="${data.level}">
          </div>
        </div>
        <div class="personal-form-row">
          <div class="personal-form-group">
            <label>Преподаватель</label>
            <input type="text" id="personal-teacher" value="${data.teacher}">
          </div>
          <div class="personal-form-group">
            <label>Локация</label>
            <select id="personal-location">
              <option value="">Выберите локацию</option>
              <option value="8 марта" ${
                data.location === "8 марта" ? "selected" : ""
              }>ул. 8 Марта</option>
              <option value="либкнехта" ${
                data.location === "либкнехта" ? "selected" : ""
              }>ул. К.Либкнехта</option>
              <option value="дома" ${
                data.location === "дома" ? "selected" : ""
              }>Дома (онлайн)</option>
              <option value="другое" ${
                data.location === "другое" ? "selected" : ""
              }>Другое место</option>
            </select>
          </div>
        </div>
        <div class="personal-form-row">
          <div class="personal-form-group">
            <label>День недели *</label>
            <select id="personal-day" required>
              ${dayNames
                .map(
                  (d, i) =>
                    `<option value="${i}" ${
                      data.day_of_week == i ? "selected" : ""
                    }>${d}</option>`
                )
                .join("")}
            </select>
          </div>
          <div class="personal-form-group">
            <label>Время *</label>
            <select id="personal-time" required>${generateTimeOptions(
              data.time_slot
            )}</select>
          </div>
        </div>
        <div class="personal-form-group">
          <label>Тип занятия</label>
          <select id="personal-type">
            <option value="personal" ${
              data.type === "personal" ? "selected" : ""
            }>Персональное</option>
            <option value="group" ${
              data.type === "group" ? "selected" : ""
            }>Групповое</option>
            <option value="online" ${
              data.type === "online" ? "selected" : ""
            }>Онлайн</option>
            <option value="practice" ${
              data.type === "practice" ? "selected" : ""
            }>Практика</option>
          </select>
        </div>
        <div class="personal-form-actions">
          <button type="button" onclick="cancelEditPersonalClass()">Отмена</button>
          <button type="submit">${
            isEditing ? "💾 Сохранить" : "➕ Добавить"
          }</button>
        </div>
      </form>
    </div>
  `;
}

function generateTimeOptions(selected = "") {
  let opts = "";
  for (let h = 8; h <= 23; h++) {
    for (let m of ["00", "30"]) {
      const t = `${h.toString().padStart(2, "0")}:${m}`;
      opts += `<option value="${t}" ${
        t === selected ? "selected" : ""
      }>${t}</option>`;
    }
  }
  return opts;
}

function switchPersonalTab(tab) {
  document
    .querySelectorAll(".personal-tab")
    .forEach((t) => t.classList.remove("active"));
  document.querySelector(`[data-tab="${tab}"]`).classList.add("active");
  document
    .querySelectorAll(".personal-tab-content")
    .forEach((c) => c.classList.remove("active"));
  document.getElementById(`personal-tab-${tab}`).classList.add("active");
  if (tab === "add" && !editingPersonalClass) updateAddForm();
}

async function savePersonalClass(e) {
  e.preventDefault();
  const formData = {
    name: document.getElementById("personal-name").value.trim(),
    level: document.getElementById("personal-level").value.trim(),
    teacher: document.getElementById("personal-teacher").value.trim(),
    location: document.getElementById("personal-location").value,
    day_of_week: +document.getElementById("personal-day").value,
    time_slot: document.getElementById("personal-time").value,
    type: document.getElementById("personal-type").value,
  };
  if (!formData.name)
    return showNotification("Введите название занятия", "error");
  try {
    if (editingPersonalClass) {
      await updatePersonalClass(editingPersonalClass.id, formData);
      showNotification("Занятие обновлено!", "success");
      editingPersonalClass = null;
    } else {
      await createPersonalClass(formData);
      showNotification("Занятие добавлено!", "success");
    }
    const classes = await getUserPersonalClasses();
    personalScheduleData = organizePersonalSchedule(classes);
    document.getElementById("personal-tab-schedule").innerHTML =
      renderPersonalScheduleGrid();
    document.getElementById("personal-class-form").reset();
    switchPersonalTab("schedule");
  } catch (error) {
    console.error(error);
    showNotification("Ошибка сохранения занятия: " + error.message, "error");
  }
}

async function editPersonalClass(id) {
  try {
    const classes = await getUserPersonalClasses();
    editingPersonalClass = classes.find((c) => c.id === id);
    if (!editingPersonalClass)
      return showNotification("Занятие не найдено", "error");
    switchPersonalTab("add");
    updateAddForm();
  } catch (error) {
    console.error(error);
    showNotification("Ошибка загрузки занятия", "error");
  }
}

async function deletePersonalClass(id) {
  if (!confirm("Удалить занятие?")) return;
  try {
    await window.deletePersonalClass(id);
    showNotification("Занятие удалено", "success");
    const classes = await getUserPersonalClasses();
    personalScheduleData = organizePersonalSchedule(classes);
    document.getElementById("personal-tab-schedule").innerHTML =
      renderPersonalScheduleGrid();
  } catch (error) {
    console.error(error);
    showNotification("Ошибка удаления занятия: " + error.message, "error");
  }
}

function cancelEditPersonalClass() {
  editingPersonalClass = null;
  switchPersonalTab("schedule");
}

function updateAddForm() {
  document.getElementById("personal-tab-add").innerHTML = renderAddClassForm();
}

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

function getTotalPersonalClasses() {
  return Object.values(personalScheduleData)
    .flatMap((td) => Object.values(td))
    .flat().length;
}

function getUniquePersonalDays() {
  return new Set(
    Object.values(personalScheduleData).flatMap((td) => Object.keys(td))
  ).size;
}

function getPersonalHoursPerWeek() {
  return getTotalPersonalClasses();
}

// === УВЕДОМЛЕНИЯ ===

function showNotification(message, type = "info", duration = 3000) {
  document.querySelectorAll(".notification").forEach((n) => n.remove());
  const notif = document.createElement("div");
  notif.className = `notification ${type}`;
  notif.textContent = message;
  document.body.appendChild(notif);
  setTimeout(() => {
    notif.style.animation = "slideOutRight 0.3s ease-out";
    setTimeout(() => notif.remove(), 300);
  }, duration);
}

// === АДМИН-ПАНЕЛЬ ===

let adminPanelData = {
  scheduleClasses: [],
  classTypes: [],
  locations: [],
  teachers: [],
};
let isAdminPanelOpen = false;
let editingAdminItem = null;
let currentAdminTab = "schedule";

async function showAdminPanel() {
  if (!isAdmin()) return showNotification("Доступ запрещен", "error");
  try {
    await loadAdminPanelData();
    createAdminPanelModal();
    isAdminPanelOpen = true;
    console.log("⚙️ Админ-панель открыта");
  } catch (error) {
    console.error(error);
    showNotification("Ошибка загрузки админ-панели", "error");
  }
}

async function loadAdminPanelData() {
  try {
    const { data: scheduleClasses, error: scheduleError } = await supabase
      .from("schedule_classes")
      .select(
        `*, created_by_profile:user_profiles!schedule_classes_created_by_fkey(full_name), updated_by_profile:user_profiles!schedule_classes_updated_by_fkey(full_name)`
      )
      .order("day_of_week", { ascending: true })
      .order("time_slot", { ascending: true });
    if (scheduleError) throw scheduleError;
    const ref = await loadReferenceData();
    adminPanelData = {
      scheduleClasses: scheduleClasses || [],
      classTypes: ref.classTypes || [],
      locations: ref.locations || [],
      teachers: ref.teachers || [],
    };
    console.log("✅ Данные админ-панели загружены");
  } catch (error) {
    console.error(error);
    throw error;
  }
}

function createAdminPanelModal() {
  const existing = document.getElementById("admin-panel-modal");
  if (existing) existing.remove();
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
        <button class="admin-tab active" data-tab="schedule" onclick="switchAdminTab('schedule')">📋 Расписание</button>
        <button class="admin-tab" data-tab="references" onclick="switchAdminTab('references')">📚 Справочники</button>
        <button class="admin-tab" data-tab="analytics" onclick="switchAdminTab('analytics')">📊 Аналитика</button>
        <button class="admin-tab" data-tab="settings" onclick="switchAdminTab('settings')">⚙️ Настройки</button>
      </div>
      <div class="admin-panel-body">
        <div id="admin-tab-schedule" class="admin-tab-content active">${renderScheduleManagement()}</div>
        <div id="admin-tab-references" class="admin-tab-content">${renderReferencesManagement()}</div>
        <div id="admin-tab-analytics" class="admin-tab-content">${renderAnalytics()}</div>
        <div id="admin-tab-settings" class="admin-tab-content">${renderSettings()}</div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add("active"), 10);
}

// (здесь подключаются renderScheduleManagement, renderReferencesManagement, renderAnalytics, renderSettings,
//  а также вспомогательные функции для админки, аналогично примеру выше — оставлены без изменений для краткости)

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

function switchAdminTab(tab) {
  currentAdminTab = tab;
  document
    .querySelectorAll(".admin-tab")
    .forEach((t) => t.classList.remove("active"));
  document.querySelector(`[data-tab="${tab}"]`).classList.add("active");
  document
    .querySelectorAll(".admin-tab-content")
    .forEach((c) => c.classList.remove("active"));
  document.getElementById(`admin-tab-${tab}`).classList.add("active");
}

// === ФИНАЛЬНЫЕ ОБНОВЛЕНИЯ ===

function updateStats() {
  let totalClasses = 0;
  Object.keys(scheduleData).forEach((time) =>
    Object.keys(scheduleData[time]).forEach(
      (day) =>
        (totalClasses += scheduleData[time][day].filter((cls) =>
          matchesFilters(cls, time, +day)
        ).length)
    )
  );

  let activeCount = activeFilters.showMyGroupsOnly ? 1 : 0;
  activeCount += activeFilters.teachers.size;
  activeCount += activeFilters.levels.size;
  activeCount += activeFilters.types.size;
  activeCount += activeFilters.locations.size;

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
    <span style="color: #f39c12;">🎯 Активных фильтров:</span> <strong>${activeCount}</strong>${userInfo}
  `;
}

async function initializeApp() {
  console.log("🚀 Инициализация приложения MaxDance v2.0...");
  let initialized = false,
    attempts = 0;
  while (!initialized && attempts < 50) {
    if (typeof currentUser !== "undefined") initialized = true;
    else {
      await new Promise((r) => setTimeout(r, 100));
      attempts++;
    }
  }
  await loadData();
  const { teachers, levels, types, locations } = extractAllData();
  createFilterButtons(
    document.getElementById("teacherFilters"),
    teachers,
    "teachers"
  );
  // ... остальная инициализация фильтров, рендер расписания и т.д.
  renderFilteredSchedule();
  updateStats();
  updateFilterFab();
  window.addEventListener("resize", renderFilteredSchedule);
  console.log("✅ Инициализация MaxDance завершена!");
  if (isAdmin() && myGroups.size === 0) {
    setTimeout(
      () =>
        showNotification(
          "🎉 Добро пожаловать в админ-панель MaxDance!",
          "info",
          5000
        ),
      2000
    );
  }
}

document.addEventListener("DOMContentLoaded", initializeApp);

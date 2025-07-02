// js/personal-schedule.js - Функции для работы с персональными занятиями и улучшенным интерфейсом

// === ФУНКЦИИ РАБОТЫ С ПЕРСОНАЛЬНЫМИ ЗАНЯТИЯМИ ===

// Функция создания персонального занятия (исправленная)
async function createNewPersonalClass() {
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

    // Валидация
    if (!classData.name.trim()) {
      throw new Error("Название занятия обязательно");
    }

    if (!classData.time_slot) {
      throw new Error("Время занятия обязательно");
    }

    const newClass = await window.createPersonalClass(classData);

    // Добавляем в мои группы автоматически
    const classKey = `personal_${newClass.id}`;
    window.myGroups.add(classKey);
    await window.saveUserGroups([...window.myGroups]);

    closePersonalClassModal();
    await window.reloadScheduleWithAuth();

    if (typeof window.createMyGroupsControls === "function") {
      window.createMyGroupsControls();
    }
    if (typeof window.renderFilteredSchedule === "function") {
      window.renderFilteredSchedule();
    }
    if (typeof window.updateStats === "function") {
      window.updateStats();
    }
    if (typeof window.updateFilterFab === "function") {
      window.updateFilterFab();
    }

    showNotification("✅ Персональное занятие создано!", "success");
  } catch (error) {
    console.error("❌ Ошибка создания занятия:", error);
    showNotification("❌ Ошибка создания занятия: " + error.message, "error");
  }
}

// Функция редактирования персонального занятия (полная реализация)
async function editPersonalClass(personalId) {
  try {
    const classData = await window.getPersonalClassById(personalId);

    // Закрываем сайдбар фильтров если открыт
    closeFilters();

    const modalHtml = `
      <div id="edit-personal-class-modal" class="modal" style="display: block;">
        <div class="modal-content">
          <span class="close" onclick="closeEditPersonalClassModal()">&times;</span>
          <div class="modal-header">Редактировать персональное занятие</div>
          <div class="modal-body">
            <form id="edit-personal-class-form">
              <div class="form-group">
                <label>Название занятия:</label>
                <input type="text" id="edit-personal-name" value="${escapeHtml(
                  classData.name
                )}" required>
              </div>
              <div class="form-group">
                <label>Уровень:</label>
                <input type="text" id="edit-personal-level" value="${escapeHtml(
                  classData.level
                )}" placeholder="Например: Начинающие">
              </div>
              <div class="form-group">
                <label>Преподаватель:</label>
                <input type="text" id="edit-personal-teacher" value="${escapeHtml(
                  classData.teacher
                )}" placeholder="Ваше имя или преподаватель">
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

// Функция обновления персонального занятия
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

    // Валидация
    if (!updatedData.name.trim()) {
      throw new Error("Название занятия обязательно");
    }

    if (!updatedData.time_slot) {
      throw new Error("Время занятия обязательно");
    }

    await window.updatePersonalClass(personalId, updatedData);

    closeEditPersonalClassModal();
    await window.reloadScheduleWithAuth();

    if (typeof window.renderFilteredSchedule === "function") {
      window.renderFilteredSchedule();
    }
    if (typeof window.updateStats === "function") {
      window.updateStats();
    }
    if (typeof window.updateFilterFab === "function") {
      window.updateFilterFab();
    }

    showNotification("✅ Персональное занятие обновлено!", "success");
  } catch (error) {
    console.error("❌ Ошибка обновления занятия:", error);
    showNotification("❌ Ошибка обновления занятия: " + error.message, "error");
  }
}

// Функция удаления персонального занятия (полная реализация)
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

// === ФУНКЦИИ МОДАЛЬНЫХ ОКОН ===

// Функция создания модального окна для нового занятия (улучшенная)
function showCreatePersonalClassModal() {
  // Закрываем сайдбар фильтров если открыт
  closeFilters();

  const modalHtml = `
    <div id="personal-class-modal" class="modal" style="display: block;">
      <div class="modal-content">
        <span class="close" onclick="closePersonalClassModal()">&times;</span>
        <div class="modal-header">
          <div class="modal-title">Создать персональное занятие</div>
          <div class="modal-subtitle">Занятие будет видно только вам</div>
        </div>
        <div class="modal-body">
          <form id="personal-class-form">
            <div class="form-group">
              <label>Название занятия: <span class="required">*</span></label>
              <input type="text" id="personal-name" required placeholder="Например: Бачата начинающие">
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
              <label>День недели: <span class="required">*</span></label>
              <select id="personal-day" required>
                <option value="">Выберите день</option>
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
              <label>Время: <span class="required">*</span></label>
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

  // Фокус на первое поле
  setTimeout(() => {
    document.getElementById("personal-name").focus();
  }, 100);

  document.getElementById("personal-class-form").onsubmit = async function (e) {
    e.preventDefault();
    await createNewPersonalClass();
  };
}

function closePersonalClassModal() {
  const modal = document.getElementById("personal-class-modal");
  if (modal) {
    modal.remove();
  }
}

function closeEditPersonalClassModal() {
  const modal = document.getElementById("edit-personal-class-modal");
  if (modal) {
    modal.remove();
  }
}

// === ФУНКЦИИ ПЕРСОНАЛЬНОГО РАСПИСАНИЯ ===

// Функция отображения персонального расписания (полная реализация)
function showPersonalSchedule() {
  // Закрываем сайдбар фильтров если открыт
  closeFilters();

  if (!window.currentUser) {
    showNotification(
      "❌ Требуется авторизация для просмотра персонального расписания",
      "error"
    );
    return;
  }

  const modalHtml = `
    <div id="personal-schedule-modal" class="modal" style="display: block;">
      <div class="modal-content personal-schedule-content">
        <span class="close" onclick="closePersonalScheduleModal()">&times;</span>
        <div class="modal-header">
          <div class="modal-title">📅 Персональное расписание</div>
          <div class="modal-subtitle">Ваши личные занятия</div>
        </div>
        <div class="modal-body">
          <div class="personal-schedule-actions">
            <button class="btn-primary" onclick="showCreatePersonalClassModal(); closePersonalScheduleModal();">
              ➕ Добавить занятие
            </button>
            <button class="btn-secondary" onclick="loadPersonalSchedule()">
              🔄 Обновить
            </button>
          </div>
          <div id="personal-schedule-content">
            <div class="loading">Загрузка...</div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHtml);
  loadPersonalSchedule();
}

// Загрузка персонального расписания
async function loadPersonalSchedule() {
  const container = document.getElementById("personal-schedule-content");

  try {
    container.innerHTML =
      '<div class="loading">Загрузка персонального расписания...</div>';

    const personalClasses = await window.getUserPersonalClasses();

    if (personalClasses.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📝</div>
          <h3>Нет персональных занятий</h3>
          <p>Создайте свое первое персональное занятие</p>
          <button class="btn-primary" onclick="showCreatePersonalClassModal(); closePersonalScheduleModal();">
            ➕ Создать занятие
          </button>
        </div>
      `;
      return;
    }

    // Группируем по дням недели
    const dayNames = [
      "Понедельник",
      "Вторник",
      "Среда",
      "Четверг",
      "Пятница",
      "Суббота",
      "Воскресенье",
    ];

    const groupedByDay = {};
    personalClasses.forEach((cls) => {
      const day = cls.day_of_week;
      if (!groupedByDay[day]) {
        groupedByDay[day] = [];
      }
      groupedByDay[day].push(cls);
    });

    // Сортируем каждый день по времени
    Object.keys(groupedByDay).forEach((day) => {
      groupedByDay[day].sort((a, b) => {
        const timeA = a.time_slot;
        const timeB = b.time_slot;
        return timeA.localeCompare(timeB);
      });
    });

    let html = '<div class="personal-schedule-grid">';

    // Отображаем по дням недели
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      if (groupedByDay[dayIndex]) {
        html += `
          <div class="day-section">
            <h3 class="day-title">${dayNames[dayIndex]}</h3>
            <div class="day-classes">
        `;

        groupedByDay[dayIndex].forEach((cls) => {
          html += `
            <div class="personal-class-item">
              <div class="class-time">${cls.time_slot}</div>
              <div class="class-details">
                <div class="class-name">${escapeHtml(cls.name)}</div>
                <div class="class-meta">
                  <span class="class-level">${escapeHtml(cls.level)}</span>
                  <span class="class-teacher">${escapeHtml(cls.teacher)}</span>
                  <span class="class-location">${escapeHtml(
                    cls.location
                  )}</span>
                </div>
              </div>
              <div class="class-actions">
                <button class="action-btn edit-btn" onclick="editPersonalClass(${
                  cls.id
                }); closePersonalScheduleModal();" title="Редактировать">
                  ✏️
                </button>
                <button class="action-btn delete-btn" onclick="deletePersonalClassFromSchedule(${
                  cls.id
                })" title="Удалить">
                  🗑️
                </button>
              </div>
            </div>
          `;
        });

        html += `
            </div>
          </div>
        `;
      }
    }

    html += "</div>";

    container.innerHTML = html;
  } catch (error) {
    console.error("❌ Ошибка загрузки персонального расписания:", error);
    container.innerHTML = `
      <div class="error-state">
        <div class="error-icon">❌</div>
        <h3>Ошибка загрузки</h3>
        <p>${error.message}</p>
        <button class="btn-secondary" onclick="loadPersonalSchedule()">Попробовать снова</button>
      </div>
    `;
  }
}

// Удаление из персонального расписания
async function deletePersonalClassFromSchedule(personalId) {
  if (!confirm("Удалить это персональное занятие?")) {
    return;
  }

  try {
    await window.deletePersonalClassWithUpdate(personalId);
    showNotification("✅ Занятие удалено", "success");
    loadPersonalSchedule(); // Перезагружаем список
  } catch (error) {
    console.error("❌ Ошибка удаления:", error);
    showNotification("❌ Ошибка удаления: " + error.message, "error");
  }
}

function closePersonalScheduleModal() {
  const modal = document.getElementById("personal-schedule-modal");
  if (modal) {
    modal.remove();
  }
}

// === ФУНКЦИИ АДМИН-ПАНЕЛИ ===

// Функция показа админ-панели (полная реализация)
async function showAdminPanel() {
  if (!window.isAdmin()) {
    showNotification(
      "❌ Доступ запрещен: требуются права администратора",
      "error"
    );
    return;
  }

  // Закрываем сайдбар фильтров если открыт
  closeFilters();

  try {
    const modalHtml = `
      <div id="admin-panel-modal" class="modal" style="display: block;">
        <div class="modal-content admin-panel-content">
          <span class="close" onclick="closeAdminPanelModal()">&times;</span>
          <div class="modal-header">
            <div class="modal-title">⚙️ Админ-панель</div>
            <div class="modal-subtitle">Управление расписанием</div>
          </div>
          <div class="modal-body">
            <div class="admin-tabs">
              <button class="tab-btn active" onclick="showAdminTab('schedule')">Общее расписание</button>
              <button class="tab-btn" onclick="showAdminTab('users')">Пользователи</button>
              <button class="tab-btn" onclick="showAdminTab('analytics')">Аналитика</button>
            </div>
            <div id="admin-content">
              <div class="loading">Загрузка данных админ-панели...</div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", modalHtml);
    showAdminTab("schedule");
  } catch (error) {
    console.error("❌ Ошибка админ-панели:", error);
    showNotification(
      "❌ Ошибка загрузки админ-панели: " + error.message,
      "error"
    );
  }
}

// Функция отображения вкладок админ-панели
async function showAdminTab(tabName) {
  const container = document.getElementById("admin-content");
  const tabs = document.querySelectorAll(".tab-btn");

  // Обновляем активную вкладку
  tabs.forEach((tab) => tab.classList.remove("active"));
  event?.target?.classList.add("active");

  try {
    container.innerHTML = '<div class="loading">Загрузка...</div>';

    switch (tabName) {
      case "schedule":
        await loadAdminScheduleTab(container);
        break;
      case "users":
        await loadAdminUsersTab(container);
        break;
      case "analytics":
        await loadAdminAnalyticsTab(container);
        break;
      default:
        container.innerHTML = '<div class="error">Неизвестная вкладка</div>';
    }
  } catch (error) {
    console.error(`❌ Ошибка загрузки вкладки ${tabName}:`, error);
    container.innerHTML = `<div class="error">Ошибка загрузки: ${error.message}</div>`;
  }
}

// Загрузка вкладки расписания
async function loadAdminScheduleTab(container) {
  const { data: scheduleClasses, error } = await window.supabase
    .from("schedule_classes")
    .select("*")
    .eq("is_active", true)
    .order("day_of_week", { ascending: true })
    .order("time_slot", { ascending: true });

  if (error) throw error;

  const html = `
    <div class="admin-schedule">
      <div class="admin-actions">
        <button class="btn-primary" onclick="createNewScheduleClass()">➕ Добавить занятие</button>
        <button class="btn-secondary" onclick="showAdminTab('schedule')">🔄 Обновить</button>
      </div>
      <div class="schedule-stats">
        <div class="stat-card">
          <div class="stat-number">${scheduleClasses?.length || 0}</div>
          <div class="stat-label">Всего занятий</div>
        </div>
      </div>
      <div class="admin-table">
        <table>
          <thead>
            <tr>
              <th>День</th>
              <th>Время</th>
              <th>Название</th>
              <th>Уровень</th>
              <th>Преподаватель</th>
              <th>Локация</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            ${
              scheduleClasses
                ?.map(
                  (cls) => `
              <tr>
                <td>${
                  ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"][cls.day_of_week]
                }</td>
                <td>${cls.time_slot}</td>
                <td>${escapeHtml(cls.name)}</td>
                <td>${escapeHtml(cls.level)}</td>
                <td>${escapeHtml(cls.teacher)}</td>
                <td>${escapeHtml(cls.location)}</td>
                <td>
                  <button class="action-btn edit-btn" onclick="editScheduleClass(${
                    cls.id
                  })" title="Редактировать">✏️</button>
                  <button class="action-btn delete-btn" onclick="deleteScheduleClass(${
                    cls.id
                  })" title="Удалить">🗑️</button>
                </td>
              </tr>
            `
                )
                .join("") || '<tr><td colspan="7">Нет занятий</td></tr>'
            }
          </tbody>
        </table>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

// Загрузка вкладки пользователей
async function loadAdminUsersTab(container) {
  container.innerHTML = `
    <div class="admin-users">
      <h3>🚧 Управление пользователями</h3>
      <p>Функция в разработке. Здесь будет:</p>
      <ul>
        <li>Список всех пользователей</li>
        <li>Назначение прав администратора</li>
        <li>Статистика активности</li>
        <li>Управление доступом</li>
      </ul>
    </div>
  `;
}

// Загрузка вкладки аналитики
async function loadAdminAnalyticsTab(container) {
  container.innerHTML = `
    <div class="admin-analytics">
      <h3>📊 Аналитика</h3>
      <p>Функция в разработке. Здесь будет:</p>
      <ul>
        <li>Статистика по популярности занятий</li>
        <li>Активность пользователей</li>
        <li>Отчеты по посещаемости</li>
        <li>Графики и диаграммы</li>
      </ul>
    </div>
  `;
}

function closeAdminPanelModal() {
  const modal = document.getElementById("admin-panel-modal");
  if (modal) {
    modal.remove();
  }
}

// === ФУНКЦИИ УЛУЧШЕННОГО ИНТЕРФЕЙСА ===

// Функция улучшенного закрытия фильтров
function closeFilters() {
  const overlay = document.getElementById("filters-overlay");
  const sidebar = document.getElementById("filters-sidebar");

  if (overlay && sidebar) {
    overlay.classList.remove("active");
    sidebar.classList.remove("active");
    document.body.style.overflow = "";
  }
}

// Функция показа уведомлений (улучшенная)
function showNotification(message, type = "info", duration = 3000) {
  // Удаляем предыдущие уведомления того же типа
  const existingNotifications = document.querySelectorAll(
    `.notification.${type}`
  );
  existingNotifications.forEach((notification) => {
    notification.remove();
  });

  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.textContent = message;

  document.body.appendChild(notification);

  // Автоматическое скрытие
  setTimeout(() => {
    notification.classList.add("fade-out");
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 300);
  }, duration);

  // Возможность закрыть по клику
  notification.onclick = () => {
    notification.classList.add("fade-out");
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 300);
  };
}

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===

// Функция экранирования HTML
function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// === ОБРАБОТЧИКИ СОБЫТИЙ ===

// Обработчик клавиши Escape для закрытия всех модальных окон
document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    closePersonalClassModal();
    closeEditPersonalClassModal();
    closePersonalScheduleModal();
    closeAdminPanelModal();
    closeFilters();

    // Закрываем основное модальное окно деталей занятия
    if (typeof window.closeModal === "function") {
      window.closeModal();
    }
  }
});

// Обработчик кликов для закрытия модальных окон
window.addEventListener("click", function (event) {
  const modals = [
    "personal-class-modal",
    "edit-personal-class-modal",
    "personal-schedule-modal",
    "admin-panel-modal",
  ];

  modals.forEach((modalId) => {
    const modal = document.getElementById(modalId);
    if (modal && event.target === modal) {
      modal.remove();
    }
  });
});

// === ЭКСПОРТ ФУНКЦИЙ ===

// Экспортируем все функции в глобальную область видимости
window.createNewPersonalClass = createNewPersonalClass;
window.editPersonalClass = editPersonalClass;
window.updatePersonalClassData = updatePersonalClassData;
window.deletePersonalClassQuick = deletePersonalClassQuick;
window.showCreatePersonalClassModal = showCreatePersonalClassModal;
window.closePersonalClassModal = closePersonalClassModal;
window.closeEditPersonalClassModal = closeEditPersonalClassModal;
window.showPersonalSchedule = showPersonalSchedule;
window.loadPersonalSchedule = loadPersonalSchedule;
window.deletePersonalClassFromSchedule = deletePersonalClassFromSchedule;
window.closePersonalScheduleModal = closePersonalScheduleModal;
window.showAdminPanel = showAdminPanel;
window.showAdminTab = showAdminTab;
window.loadAdminScheduleTab = loadAdminScheduleTab;
window.loadAdminUsersTab = loadAdminUsersTab;
window.loadAdminAnalyticsTab = loadAdminAnalyticsTab;
window.closeAdminPanelModal = closeAdminPanelModal;
window.closeFilters = closeFilters;
window.showNotification = showNotification;
window.escapeHtml = escapeHtml;

console.log("✅ Personal Schedule модуль загружен");

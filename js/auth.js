// js/auth.js - Supabase аутентификация
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Инициализация Supabase клиента с ТВОИМИ данными
const supabaseUrl = "https://rxwtfqnzrhzpiupkawgq.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4d3RmcW56cmh6cGl1cGthd2dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEzNDUzMDUsImV4cCI6MjA2NjkyMTMwNX0.AP3S-aRZDm2XD-Ld9aSSfxtIigV8hWXC3rXb7TUwxSI";
const supabase = createClient(supabaseUrl, supabaseKey);

// Глобальные переменные для аутентификации
let currentUser = null;
let userProfile = null;

// === БАЗОВАЯ АУТЕНТИФИКАЦИЯ ===

// === Инициализация аутентификации ===
async function initAuth() {
  console.log("🔐 Инициализация аутентификации...");

  // Проверяем текущую сессию один раз при загрузке
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) {
    await handleAuthSuccess(session.user);
  }

  // Слушаем изменения состояния (вход/выход)
  supabase.auth.onAuthStateChange(async (event, session) => {
    console.log("🔄 Auth state changed:", event);

    // При INITIAL_SESSION или SIGNED_IN восстанавливаем авторизованного пользователя
    if ((event === "INITIAL_SESSION" || event === "SIGNED_IN") && session) {
      await handleAuthSuccess(session.user);
    }
    // При SIGNED_OUT проверяем, не осталось ли ещё активной сессии
    else if (event === "SIGNED_OUT") {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      // Если сессии действительно нет — делаем выход
      if (!currentSession) {
        handleAuthSignOut();
      } else {
        console.log("ℹ️ IGNORE SIGNED_OUT — активная сессия всё ещё жива");
      }
    }
  });

  updateAuthUI();
}

// === Обработка успешного входа ===
async function handleAuthSuccess(user) {
  console.log("✅ Пользователь авторизован:", user.email);

  currentUser = user;

  // Получаем или создаём профиль
  try {
    let { data: profile, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error && error.code === "PGRST116") {
      const { data: newProfile, error: insertError } = await supabase
        .from("user_profiles")
        .insert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata.full_name || user.email,
          avatar_url: user.user_metadata.avatar_url,
        })
        .select()
        .single();
      if (insertError) throw insertError;
      profile = newProfile;
    } else if (error) {
      throw error;
    }

    userProfile = profile;
  } catch (err) {
    console.error("❌ Ошибка получения/создания профиля:", err);
    userProfile = { id: user.id, email: user.email, full_name: user.email };
  }

  // Пробросим в глобал для basefucs.js
  window.currentUser = currentUser;
  window.userProfile = userProfile;

  updateAuthUI();

  // Перезагрузим расписание уже как авторизованный
  if (typeof reloadScheduleWithAuth === "function") {
    await reloadScheduleWithAuth();
  }
}

// === Обработка выхода из аккаунта ===
function handleAuthSignOut() {
  console.log("🚪 Пользователь вышел");

  currentUser = null;
  userProfile = null;

  // Пробросим сброс в глобал
  window.currentUser = null;
  window.userProfile = null;

  updateAuthUI();

  // Перезагрузим расписание уже как гость
  if (typeof reloadScheduleWithAuth === "function") {
    reloadScheduleWithAuth();
  }
}

// Вход через Google (ИСПРАВЛЕННАЯ ВЕРСИЯ)
async function signInWithGoogle() {
  console.log("🔑 Вход через Google...");

  try {
    // Определяем правильный redirect URL в зависимости от окружения
    const redirectURL =
      window.location.hostname === "localhost"
        ? "http://localhost:3000"
        : "https://maxdance.netlify.app";

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectURL,
      },
    });

    if (error) {
      console.error("❌ Ошибка входа:", error);
      alert("Ошибка входа через Google: " + error.message);
    }
  } catch (error) {
    console.error("❌ Ошибка входа:", error);
    alert("Ошибка входа через Google");
  }
}

// Выход
async function logout() {
  console.log("🚪 Выход из аккаунта...");

  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("❌ Ошибка выхода:", error);
    }
  } catch (error) {
    console.error("❌ Ошибка выхода:", error);
  }
}

// Обновление UI аутентификации
function updateAuthUI() {
  const loginSection = document.getElementById("login-section");
  const userSection = document.getElementById("user-section");

  if (currentUser && userProfile) {
    loginSection.style.display = "none";
    userSection.style.display = "block";

    document.getElementById("user-name").textContent =
      userProfile.full_name || currentUser.email;

    const avatarImg = document.getElementById("user-avatar");
    if (userProfile.avatar_url) {
      avatarImg.src = userProfile.avatar_url;
      avatarImg.style.display = "block";
    } else {
      avatarImg.style.display = "none";
    }

    console.log("👤 UI обновлен для пользователя:", userProfile.full_name);
  } else {
    loginSection.style.display = "block";
    userSection.style.display = "none";
    console.log("🔓 UI для неавторизованного пользователя");
  }
}

// === ФУНКЦИИ РАБОТЫ С ПОЛЬЗОВАТЕЛЬСКИМИ ГРУППАМИ ===

// Получение сохраненных групп пользователя
async function getUserSavedGroups() {
  if (!currentUser) return [];

  try {
    const { data, error } = await supabase
      .from("user_saved_groups")
      .select("group_key")
      .eq("user_id", currentUser.id);

    if (error) {
      console.error("❌ Ошибка загрузки групп:", error);
      return [];
    }

    return data.map((row) => row.group_key);
  } catch (error) {
    console.error("❌ Ошибка загрузки групп:", error);
    return [];
  }
}

// Сохранение групп пользователя
async function saveUserGroups(groupKeys) {
  if (!currentUser) {
    throw new Error("Пользователь не авторизован");
  }

  try {
    console.log(`💾 Сохранение ${groupKeys.length} групп...`);

    // Удаляем старые группы
    const { error: deleteError } = await supabase
      .from("user_saved_groups")
      .delete()
      .eq("user_id", currentUser.id);

    if (deleteError) {
      throw deleteError;
    }

    // Добавляем новые группы
    if (groupKeys.length > 0) {
      const groupsToInsert = groupKeys.map((groupKey) => ({
        user_id: currentUser.id,
        group_key: groupKey,
      }));

      const { error: insertError } = await supabase
        .from("user_saved_groups")
        .insert(groupsToInsert);

      if (insertError) {
        throw insertError;
      }
    }

    console.log("✅ Группы сохранены");
    return true;
  } catch (error) {
    console.error("❌ Ошибка сохранения групп:", error);
    throw error;
  }
}

// === ФУНКЦИИ РАБОТЫ С ПЕРСОНАЛЬНЫМИ ЗАНЯТИЯМИ ===

// Получение личных занятий пользователя
async function getUserPersonalClasses() {
  if (!currentUser) return [];

  try {
    const { data, error } = await supabase
      .from("user_personal_classes")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("day_of_week", { ascending: true })
      .order("time_slot", { ascending: true });

    if (error) {
      console.error("❌ Ошибка загрузки личных занятий:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("❌ Ошибка загрузки личных занятий:", error);
    return [];
  }
}

// Создание личного занятия
async function createPersonalClass(classData) {
  if (!currentUser) {
    throw new Error("Пользователь не авторизован");
  }

  try {
    const { data, error } = await supabase
      .from("user_personal_classes")
      .insert({
        user_id: currentUser.id,
        name: classData.name,
        level: classData.level || "",
        teacher: classData.teacher || "",
        location: classData.location || "",
        day_of_week: classData.day_of_week,
        time_slot: classData.time_slot,
        type: classData.type || "personal",
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    console.log("✅ Личное занятие создано:", data.name);
    return data;
  } catch (error) {
    console.error("❌ Ошибка создания занятия:", error);
    throw error;
  }
}

// Обновление личного занятия
async function updatePersonalClass(classId, classData) {
  if (!currentUser) {
    throw new Error("Пользователь не авторизован");
  }

  try {
    const { data, error } = await supabase
      .from("user_personal_classes")
      .update({
        name: classData.name,
        level: classData.level || "",
        teacher: classData.teacher || "",
        location: classData.location || "",
        day_of_week: classData.day_of_week,
        time_slot: classData.time_slot,
        type: classData.type || "personal",
      })
      .eq("id", classId)
      .eq("user_id", currentUser.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    console.log("✅ Личное занятие обновлено:", data.name);
    return data;
  } catch (error) {
    console.error("❌ Ошибка обновления занятия:", error);
    throw error;
  }
}

// Удаление личного занятия
async function deletePersonalClass(classId) {
  if (!currentUser) {
    throw new Error("Пользователь не авторизован");
  }

  try {
    const { error } = await supabase
      .from("user_personal_classes")
      .delete()
      .eq("id", classId)
      .eq("user_id", currentUser.id);

    if (error) {
      throw error;
    }

    console.log("✅ Личное занятие удалено");
    return true;
  } catch (error) {
    console.error("❌ Ошибка удаления занятия:", error);
    throw error;
  }
}

// === ФУНКЦИИ РАБОТЫ С ОБЩИМ РАСПИСАНИЕМ ===

// Загрузка общего расписания из базы данных
async function loadScheduleFromDatabase() {
  try {
    console.log("🔄 Загрузка расписания из базы данных...");

    // Загружаем все занятия
    const { data: classes, error } = await supabase
      .from("schedule_classes")
      .select("*")
      .eq("is_active", true)
      .order("day_of_week")
      .order("time_slot");

    if (error) throw error;

    console.log("📊 Получено занятий из базы:", classes?.length || 0);
    console.log("📝 Первое занятие:", classes?.[0]);

    // Создаем структуру данных как ожидает basefucs.js
    const schedule = {};
    const timeSlotsSet = new Set();
    const typeNamesMap = {};
    const locationNamesMap = {};

    classes?.forEach((classItem) => {
      const time = classItem.time_slot;
      const day = classItem.day_of_week;

      timeSlotsSet.add(time);

      if (!schedule[time]) {
        schedule[time] = {};
      }
      if (!schedule[time][day]) {
        schedule[time][day] = [];
      }

      // Преобразуем данные из базы в формат как в JSON
      const scheduleClass = {
        id: classItem.id,
        name: classItem.name,
        level: classItem.level,
        teacher: classItem.teacher,
        type: classItem.type,
        location: classItem.location,
      };

      schedule[time][day].push(scheduleClass);

      // Собираем типы и локации для справочников
      typeNamesMap[classItem.type] = classItem.type;
      locationNamesMap[classItem.location] = classItem.location;
    });

    // Сортируем временные слоты
    const timeSlots = Array.from(timeSlotsSet).sort((a, b) => {
      const timeA = parseInt(a.split(":")[0]) * 60 + parseInt(a.split(":")[1]);
      const timeB = parseInt(b.split(":")[0]) * 60 + parseInt(b.split(":")[1]);
      return timeA - timeB;
    });

    const dayNames = [
      "Понедельник",
      "Вторник",
      "Среда",
      "Четверг",
      "Пятница",
      "Суббота",
      "Воскресенье",
    ];

    const result = {
      schedule,
      timeSlots,
      dayNames,
      typeNames: typeNamesMap,
      locationNames: {
        "8 марта": "ул. 8 Марта (Мытный Двор)",
        либкнехта: "ул. К.Либкнехта (Консул)",
        ...locationNamesMap,
      },
    };

    console.log("✅ Структура расписания создана:");
    console.log("- Временных слотов:", timeSlots.length);
    console.log("- Дней:", dayNames.length);
    console.log("- Типов занятий:", Object.keys(typeNamesMap).length);
    console.log("📋 Пример структуры:", {
      firstTimeSlot: timeSlots[0],
      firstDayClasses: schedule[timeSlots[0]]?.[0] || "нет занятий",
    });

    return result;
  } catch (error) {
    console.error("❌ Ошибка загрузки из базы данных:", error);
    throw error;
  }
}

// Обновленная функция для загрузки расписания с персональными занятиями
async function loadScheduleWithPersonalClasses() {
  try {
    console.log("🔄 Загрузка расписания с персональными занятиями...");

    // Загружаем общее расписание
    const scheduleResult = await loadScheduleFromDatabase();

    // Если пользователь авторизован, добавляем его персональные занятия
    if (currentUser) {
      const personalClasses = await getUserPersonalClasses();
      console.log(`📋 Найдено ${personalClasses.length} персональных занятий`);

      personalClasses.forEach((personalClass) => {
        const time = personalClass.time_slot;
        const day = personalClass.day_of_week;

        // Убеждаемся что временной слот существует в расписании
        if (!scheduleResult.timeSlots.includes(time)) {
          scheduleResult.timeSlots.push(time);
          scheduleResult.timeSlots.sort((a, b) => {
            const timeA =
              parseInt(a.split(":")[0]) * 60 + parseInt(a.split(":")[1]);
            const timeB =
              parseInt(b.split(":")[0]) * 60 + parseInt(b.split(":")[1]);
            return timeA - timeB;
          });
        }

        // Инициализируем структуру если не существует
        if (!scheduleResult.schedule[time]) {
          scheduleResult.schedule[time] = {};
        }
        if (!scheduleResult.schedule[time][day]) {
          scheduleResult.schedule[time][day] = [];
        }

        // Преобразуем персональное занятие в формат расписания
        const scheduleClass = {
          id: `personal_${personalClass.id}`,
          name: personalClass.name,
          level: personalClass.level,
          teacher: personalClass.teacher,
          type: personalClass.type || "personal",
          location: personalClass.location,
          isPersonal: true,
          personalId: personalClass.id,
          userId: personalClass.user_id,
        };

        scheduleResult.schedule[time][day].push(scheduleClass);

        // Добавляем тип персональных занятий если его нет
        if (!scheduleResult.typeNames["personal"]) {
          scheduleResult.typeNames["personal"] = "Персональные";
        }
      });
    }

    return scheduleResult;
  } catch (error) {
    console.error(
      "❌ Ошибка загрузки расписания с персональными занятиями:",
      error
    );
    // Fallback к обычной загрузке
    return await loadScheduleFromDatabase();
  }
}

// === Перезагрузка расписания после входа/выхода ===
async function reloadScheduleWithAuth() {
  // Забираем актуальные window.currentUser / window.userProfile
  currentUser = window.currentUser;
  userProfile = window.userProfile;

  // И заново грузим данные и UI
  if (typeof loadData === "function") {
    await loadData();
    renderFilteredSchedule();
    updateStats();
    updateFilterFab();
    createMyGroupsControls();
  }
}

// Функция для удаления персонального занятия с обновлением UI
async function deletePersonalClassWithUpdate(personalId) {
  if (!currentUser) {
    throw new Error("Пользователь не авторизован");
  }

  try {
    await deletePersonalClass(personalId);

    // Удаляем из моих групп если там есть
    const personalKey = `personal_${personalId}`;
    if (
      typeof window.myGroups !== "undefined" &&
      window.myGroups.has(personalKey)
    ) {
      window.myGroups.delete(personalKey);
      await saveUserGroups([...window.myGroups]);
    }

    // Перезагружаем интерфейс
    await reloadScheduleWithAuth();

    console.log("✅ Персональное занятие удалено и интерфейс обновлен");
    return true;
  } catch (error) {
    console.error("❌ Ошибка удаления персонального занятия:", error);
    throw error;
  }
}

// Получение персонального занятия по ID
async function getPersonalClassById(personalId) {
  if (!currentUser) {
    throw new Error("Пользователь не авторизован");
  }

  try {
    const { data, error } = await supabase
      .from("user_personal_classes")
      .select("*")
      .eq("id", personalId)
      .eq("user_id", currentUser.id)
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error("❌ Ошибка получения персонального занятия:", error);
    throw error;
  }
}

// === ДОПОЛНИТЕЛЬНАЯ ОТЛАДОЧНАЯ ФУНКЦИЯ ===
// Добавьте эту функцию в basefucs.js для отладки:

function debugScheduleData() {
  console.log("🔍 ОТЛАДКА РАСПИСАНИЯ:");
  console.log("scheduleData:", scheduleData);
  console.log("timeSlots:", timeSlots);
  console.log("dayNames:", dayNames);

  // Проверяем первый день и время
  if (timeSlots.length > 0 && Object.keys(scheduleData).length > 0) {
    const firstTime = timeSlots[0];
    const firstDay = 0;
    console.log(
      `Занятия в ${dayNames[firstDay]} в ${firstTime}:`,
      scheduleData[firstTime]?.[firstDay]
    );

    // Проверяем фильтры
    if (scheduleData[firstTime]?.[firstDay]?.[0]) {
      const testClass = scheduleData[firstTime][firstDay][0];
      console.log("Тестовое занятие:", testClass);
      console.log(
        "Проходит фильтры:",
        matchesFilters(testClass, firstTime, firstDay)
      );
    }
  }

  // Проверяем элемент расписания
  const scheduleElement = document.getElementById("schedule");
  console.log("Элемент расписания найден:", !!scheduleElement);
  console.log(
    "Содержимое элемента:",
    scheduleElement?.innerHTML?.substring(0, 200) + "..."
  );
}

// Загрузка справочников для админ-панели
async function loadReferenceData() {
  if (!isAdmin()) {
    throw new Error("Доступ запрещен: требуются права администратора");
  }

  try {
    const [classTypes, locations, teachers] = await Promise.all([
      supabase.from("class_types").select("*").order("sort_order"),
      supabase.from("locations").select("*").order("sort_order"),
      supabase.from("teachers").select("*").order("sort_order"),
    ]);

    return {
      classTypes: classTypes.data || [],
      locations: locations.data || [],
      teachers: teachers.data || [],
    };
  } catch (error) {
    console.error("❌ Ошибка загрузки справочников:", error);
    throw error;
  }
}

// === ФУНКЦИИ УПРАВЛЕНИЯ ОБЩИМ РАСПИСАНИЕМ (ТОЛЬКО ДЛЯ АДМИНОВ) ===

// Создание нового занятия в общем расписании
async function createScheduleClass(classData) {
  if (!isAdmin()) {
    throw new Error("Доступ запрещен: требуются права администратора");
  }

  try {
    const { data, error } = await supabase
      .from("schedule_classes")
      .insert({
        name: classData.name,
        level: classData.level,
        teacher: classData.teacher,
        type: classData.type,
        location: classData.location,
        day_of_week: classData.day_of_week,
        time_slot: classData.time_slot,
        created_by: currentUser.id,
        updated_by: currentUser.id,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    console.log("✅ Занятие добавлено в общее расписание:", data.name);
    return data;
  } catch (error) {
    console.error("❌ Ошибка создания занятия:", error);
    throw error;
  }
}

// Обновление занятия в общем расписании
async function updateScheduleClass(classId, classData) {
  if (!isAdmin()) {
    throw new Error("Доступ запрещен: требуются права администратора");
  }

  try {
    const { data, error } = await supabase
      .from("schedule_classes")
      .update({
        name: classData.name,
        level: classData.level,
        teacher: classData.teacher,
        type: classData.type,
        location: classData.location,
        day_of_week: classData.day_of_week,
        time_slot: classData.time_slot,
        updated_by: currentUser.id,
      })
      .eq("id", classId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    console.log("✅ Занятие обновлено:", data.name);
    return data;
  } catch (error) {
    console.error("❌ Ошибка обновления занятия:", error);
    throw error;
  }
}

// Удаление занятия из общего расписания (мягкое удаление)
async function deleteScheduleClass(classId) {
  if (!isAdmin()) {
    throw new Error("Доступ запрещен: требуются права администратора");
  }

  try {
    const { data, error } = await supabase
      .from("schedule_classes")
      .update({
        is_active: false,
        updated_by: currentUser.id,
      })
      .eq("id", classId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    console.log("✅ Занятие удалено:", data.name);
    return data;
  } catch (error) {
    console.error("❌ Ошибка удаления занятия:", error);
    throw error;
  }
}

// === ФУНКЦИИ ДОБАВЛЕНИЯ ИЗ ОБЩЕГО В ПЕРСОНАЛЬНОЕ РАСПИСАНИЕ ===

// Добавление занятия из общего расписания в личные
async function addClassToPersonal(scheduleClass, time, day) {
  if (!currentUser) {
    throw new Error("Пользователь не авторизован");
  }

  try {
    const { data, error } = await supabase
      .from("user_personal_classes")
      .insert({
        user_id: currentUser.id,
        name: scheduleClass.name,
        level: scheduleClass.level,
        teacher: scheduleClass.teacher,
        location: scheduleClass.location,
        day_of_week: day,
        time_slot: time,
        type: scheduleClass.type || "added_from_schedule",
        // Дополнительное поле для связи с общим расписанием
        source_schedule_class_id: scheduleClass.id,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    console.log("✅ Занятие добавлено в персональное расписание:", data.name);
    return data;
  } catch (error) {
    console.error("❌ Ошибка добавления в персональное расписание:", error);
    throw error;
  }
}

// === ФУНКЦИИ УПРАВЛЕНИЯ СПРАВОЧНИКАМИ (ТОЛЬКО ДЛЯ АДМИНОВ) ===

// Управление типами занятий
async function createClassType(typeData) {
  if (!isAdmin()) {
    throw new Error("Доступ запрещен: требуются права администратора");
  }

  try {
    const { data, error } = await supabase
      .from("class_types")
      .insert(typeData)
      .select()
      .single();

    if (error) {
      throw error;
    }

    console.log("✅ Тип занятия создан:", data.display_name);
    return data;
  } catch (error) {
    console.error("❌ Ошибка создания типа занятия:", error);
    throw error;
  }
}

async function updateClassType(typeId, typeData) {
  if (!isAdmin()) {
    throw new Error("Доступ запрещен: требуются права администратора");
  }

  try {
    const { data, error } = await supabase
      .from("class_types")
      .update(typeData)
      .eq("id", typeId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    console.log("✅ Тип занятия обновлен:", data.display_name);
    return data;
  } catch (error) {
    console.error("❌ Ошибка обновления типа занятия:", error);
    throw error;
  }
}

// Управление локациями
async function createLocation(locationData) {
  if (!isAdmin()) {
    throw new Error("Доступ запрещен: требуются права администратора");
  }

  try {
    const { data, error } = await supabase
      .from("locations")
      .insert(locationData)
      .select()
      .single();

    if (error) {
      throw error;
    }

    console.log("✅ Локация создана:", data.display_name);
    return data;
  } catch (error) {
    console.error("❌ Ошибка создания локации:", error);
    throw error;
  }
}

async function updateLocation(locationId, locationData) {
  if (!isAdmin()) {
    throw new Error("Доступ запрещен: требуются права администратора");
  }

  try {
    const { data, error } = await supabase
      .from("locations")
      .update(locationData)
      .eq("id", locationId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    console.log("✅ Локация обновлена:", data.display_name);
    return data;
  } catch (error) {
    console.error("❌ Ошибка обновления локации:", error);
    throw error;
  }
}

// Управление преподавателями
async function createTeacher(teacherData) {
  if (!isAdmin()) {
    throw new Error("Доступ запрещен: требуются права администратора");
  }

  try {
    const { data, error } = await supabase
      .from("teachers")
      .insert(teacherData)
      .select()
      .single();

    if (error) {
      throw error;
    }

    console.log("✅ Преподаватель создан:", data.full_name);
    return data;
  } catch (error) {
    console.error("❌ Ошибка создания преподавателя:", error);
    throw error;
  }
}

async function updateTeacher(teacherId, teacherData) {
  if (!isAdmin()) {
    throw new Error("Доступ запрещен: требуются права администратора");
  }

  try {
    const { data, error } = await supabase
      .from("teachers")
      .update(teacherData)
      .eq("id", teacherId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    console.log("✅ Преподаватель обновлен:", data.full_name);
    return data;
  } catch (error) {
    console.error("❌ Ошибка обновления преподавателя:", error);
    throw error;
  }
}

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===

// Проверка админских прав
function isAdmin() {
  return userProfile && userProfile.is_admin === true;
}

// === ЭКСПОРТ ВСЕХ ФУНКЦИЙ ===

// Экспортируем базовые функции аутентификации
window.signInWithGoogle = signInWithGoogle;
window.logout = logout;
window.currentUser = currentUser;
window.userProfile = userProfile;
window.isAdmin = isAdmin;

// Экспортируем функции работы с пользовательскими данными
window.getUserSavedGroups = getUserSavedGroups;
window.saveUserGroups = saveUserGroups;
window.getUserPersonalClasses = getUserPersonalClasses;
window.createPersonalClass = createPersonalClass;
window.updatePersonalClass = updatePersonalClass;
window.deletePersonalClass = deletePersonalClass;
window.getPersonalClassById = getPersonalClassById;

// Экспортируем функции работы с общим расписанием
window.loadScheduleFromDatabase = loadScheduleFromDatabase;
window.loadScheduleWithPersonalClasses = loadScheduleWithPersonalClasses;
window.loadReferenceData = loadReferenceData;
window.createScheduleClass = createScheduleClass;
window.updateScheduleClass = updateScheduleClass;
window.deleteScheduleClass = deleteScheduleClass;
window.addClassToPersonal = addClassToPersonal;

// Экспортируем функции работы со справочниками
window.createClassType = createClassType;
window.updateClassType = updateClassType;
window.createLocation = createLocation;
window.updateLocation = updateLocation;
window.createTeacher = createTeacher;
window.updateTeacher = updateTeacher;

// Экспортируем новые функции
window.reloadScheduleWithAuth = reloadScheduleWithAuth;
window.deletePersonalClassWithUpdate = deletePersonalClassWithUpdate;

// === Быстрое редактирование занятия (для админа) ===
async function editScheduleClassQuick(classId) {
  if (!isAdmin()) {
    return showNotification(
      "❌ Доступ запрещён: требуются права администратора",
      "error"
    );
  }
  try {
    const { data: classItem, error } = await supabase
      .from("schedule_classes")
      .select("*")
      .eq("id", classId)
      .single();
    if (error) throw error;

    const newName = prompt("Название занятия:", classItem.name);
    if (newName == null) return; // отмена
    const newLevel = prompt("Уровень:", classItem.level) || classItem.level;
    const newTeacher =
      prompt("Преподаватель:", classItem.teacher) || classItem.teacher;
    const newLocation =
      prompt("Локация:", classItem.location) || classItem.location;

    await updateScheduleClass(classId, {
      name: newName,
      level: newLevel,
      teacher: newTeacher,
      type: classItem.type,
      location: newLocation,
      day_of_week: classItem.day_of_week,
      time_slot: classItem.time_slot,
    });

    await reloadScheduleWithAuth();
    showNotification("✅ Занятие обновлено", "success");
  } catch (err) {
    console.error("❌ Ошибка быстрой правки занятия:", err);
    showNotification("❌ Не удалось обновить занятие: " + err.message, "error");
  }
}

// === Быстрое удаление занятия (для админа) ===
async function deleteScheduleClassQuick(classId) {
  if (!isAdmin()) {
    return showNotification(
      "❌ Доступ запрещён: требуются права администратора",
      "error"
    );
  }
  if (!confirm("Вы уверены, что хотите удалить это занятие?")) return;
  try {
    await deleteScheduleClass(classId);
    await reloadScheduleWithAuth();
    showNotification("✅ Занятие удалено", "success");
  } catch (err) {
    console.error("❌ Ошибка удаления занятия:", err);
    showNotification("❌ Не удалось удалить занятие: " + err.message, "error");
  }
}

// Экспорт новых функций
window.editScheduleClassQuick = editScheduleClassQuick;
window.deleteScheduleClassQuick = deleteScheduleClassQuick;

// Экспортируем Supabase клиент для других модулей
window.supabase = supabase;

// Инициализация при загрузке
document.addEventListener("DOMContentLoaded", initAuth);

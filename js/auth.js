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

// Инициализация аутентификации
async function initAuth() {
  console.log("🔐 Инициализация аутентификации...");

  // Проверяем текущую сессию
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    await handleAuthSuccess(session.user);
  }

  // Слушаем изменения авторизации
  supabase.auth.onAuthStateChange(async (event, session) => {
    console.log("🔄 Auth state changed:", event);

    if (event === "SIGNED_IN" && session) {
      await handleAuthSuccess(session.user);
    } else if (event === "SIGNED_OUT") {
      handleAuthSignOut();
    }
  });

  updateAuthUI();
}

// Обработка успешной авторизации
async function handleAuthSuccess(user) {
  console.log("✅ Пользователь авторизован:", user.email);

  currentUser = user;

  // Получаем или создаем профиль пользователя
  try {
    let { data: profile, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error && error.code === "PGRST116") {
      // Профиль не найден, создаем
      const { data: newProfile, error: insertError } = await supabase
        .from("user_profiles")
        .insert({
          id: user.id,
          email: user.email,
          full_name:
            user.user_metadata.full_name ||
            user.user_metadata.name ||
            user.email,
          avatar_url: user.user_metadata.avatar_url,
        })
        .select()
        .single();

      if (insertError) {
        console.error("❌ Ошибка создания профиля:", insertError);
      } else {
        profile = newProfile;
        console.log("✅ Профиль создан");
      }
    } else if (error) {
      console.error("❌ Ошибка получения профиля:", error);
    }

    userProfile = profile;
  } catch (error) {
    console.error("❌ Ошибка обработки профиля:", error);
  }

  updateAuthUI();

  // Перезагружаем данные приложения
  if (typeof reloadScheduleWithAuth === "function") {
    await reloadScheduleWithAuth();
  }
}

// Обработка выхода
function handleAuthSignOut() {
  console.log("🚪 Пользователь вышел");
  currentUser = null;
  userProfile = null;
  updateAuthUI();

  // Перезагружаем данные без авторизации
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
    console.log("📡 Загрузка расписания из базы данных...");

    // Загружаем активные занятия
    const { data: classes, error: classesError } = await supabase
      .from("schedule_classes")
      .select("*")
      .eq("is_active", true)
      .order("day_of_week", { ascending: true })
      .order("time_slot", { ascending: true });

    if (classesError) {
      throw classesError;
    }

    // Загружаем справочники
    const { data: classTypes, error: typesError } = await supabase
      .from("class_types")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    const { data: locations, error: locationsError } = await supabase
      .from("locations")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (typesError || locationsError) {
      throw typesError || locationsError;
    }

    // Преобразуем данные в формат, совместимый с существующим кодом
    const schedule = {};
    const timeSlots = new Set();
    const dayNames = [
      "Понедельник",
      "Вторник",
      "Среда",
      "Четверг",
      "Пятница",
      "Суббота",
      "Воскресенье",
    ];

    // Создаем объект типов
    const typeNames = {};
    classTypes.forEach((type) => {
      typeNames[type.id] = type.display_name;
    });

    // Создаем объект локаций
    const locationNames = {};
    locations.forEach((location) => {
      locationNames[location.id] = location.display_name;
    });

    // Группируем занятия по времени и дням
    classes.forEach((classItem) => {
      const time = classItem.time_slot;
      const day = classItem.day_of_week;

      timeSlots.add(time);

      if (!schedule[time]) {
        schedule[time] = {};
      }

      if (!schedule[time][day]) {
        schedule[time][day] = [];
      }

      schedule[time][day].push({
        id: classItem.id, // Добавляем ID для редактирования
        name: classItem.name,
        level: classItem.level,
        teacher: classItem.teacher,
        type: classItem.type,
        location: classItem.location,
      });
    });

    // Сортируем слоты времени
    const sortedTimeSlots = Array.from(timeSlots).sort((a, b) => {
      const timeA = parseInt(a.split(":")[0]) * 60 + parseInt(a.split(":")[1]);
      const timeB = parseInt(b.split(":")[0]) * 60 + parseInt(b.split(":")[1]);
      return timeA - timeB;
    });

    console.log(`✅ Загружено ${classes.length} занятий из базы данных`);

    return {
      schedule,
      timeSlots: sortedTimeSlots,
      dayNames,
      typeNames,
      locationNames,
    };
  } catch (error) {
    console.error("❌ Ошибка загрузки расписания из базы:", error);
    throw error;
  }
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

// Экспортируем функции работы с общим расписанием
window.loadScheduleFromDatabase = loadScheduleFromDatabase;
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

// Экспортируем Supabase клиент для других модулей
window.supabase = supabase;

// Инициализация при загрузке
document.addEventListener("DOMContentLoaded", initAuth);

// ================================
// 1) Собираем teachers/levels/types/locations
// ================================
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

// ================================
// 2) toggleMyGroupsFilter — переключатель «Мои группы»
// ================================
function toggleMyGroupsFilter() {
  activeFilters.showMyGroupsOnly = !activeFilters.showMyGroupsOnly;
  // перерисовываем расписание
  if (typeof reloadScheduleWithAuth === "function") {
    reloadScheduleWithAuth();
  } else {
    renderFilteredSchedule();
    updateStats();
    updateFilterFab();
  }
}
window.toggleMyGroupsFilter = toggleMyGroupsFilter;

// ================================
// 3) Открытие/закрытие off-canvas-фильтров
// ================================
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

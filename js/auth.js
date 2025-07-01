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

// Вход через Google
async function signInWithGoogle() {
  console.log("🔑 Вход через Google...");

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      // Убираем options полностью
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

// Проверка админских прав
function isAdmin() {
  return userProfile && userProfile.is_admin === true;
}

// Экспортируем функции глобально для совместимости
window.signInWithGoogle = signInWithGoogle;
window.logout = logout;
window.currentUser = currentUser;
window.userProfile = userProfile;
window.getUserSavedGroups = getUserSavedGroups;
window.saveUserGroups = saveUserGroups;
window.getUserPersonalClasses = getUserPersonalClasses;
window.createPersonalClass = createPersonalClass;
window.updatePersonalClass = updatePersonalClass;
window.deletePersonalClass = deletePersonalClass;
window.isAdmin = isAdmin;

// Экспортируем Supabase клиент для других модулей
window.supabase = supabase;

// Инициализация при загрузке
document.addEventListener("DOMContentLoaded", initAuth);

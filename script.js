document.addEventListener("DOMContentLoaded", function () {
  // Request notification permission
  if ("Notification" in window && Notification.permission !== "granted") {
    Notification.requestPermission();
  }

  // DOM Elements

  const taskInput = document.getElementById("taskInput");
  const addTaskBtn = document.getElementById("addTaskBtn");
  const taskList = document.getElementById("taskList");
  const filterSelect = document.getElementById("filterSelect");
  const priorityFilter = document.getElementById("priorityFilter");
  const categoryFilter = document.getElementById("categoryFilter");
  const searchInput = document.getElementById("searchInput");
  const searchBtn = document.getElementById("searchBtn");
  const themeToggle = document.getElementById("themeToggle");
  const totalTasksEl = document.getElementById("totalTasks");
  const completedTasksEl = document.getElementById("completedTasks");
  const pendingTasksEl = document.getElementById("pendingTasks");
  const taskDetailsModal = document.getElementById("taskDetailsModal");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const editTaskText = document.getElementById("editTaskText");
  const editTaskPriority = document.getElementById("editTaskPriority");
  const editTaskDueDate = document.getElementById("editTaskDueDate");
  const editTaskCategory = document.getElementById("editTaskCategory");
  const addCategoryBtn = document.getElementById("addCategoryBtn");
  const categoryTags = document.getElementById("categoryTags");
  const saveTaskBtn = document.getElementById("saveTaskBtn");
  const cancelEditBtn = document.getElementById("cancelEditBtn");

  const dailyRateEl = document.getElementById("dailyRate");
  const taskStreakEl = document.getElementById("taskStreak");
  const taskChartCtx = document.getElementById("taskChart").getContext("2d");

  let taskHistory = JSON.parse(localStorage.getItem("taskHistory")) || {};

  function updatePerformanceIndicators() {
    const today = new Date().toISOString().split("T")[0];
    const todayTasks = tasks.filter((task) => task.createdAt.startsWith(today));
    const completedToday = todayTasks.filter((t) => t.completed).length;
    const completionRate =
      todayTasks.length > 0
        ? Math.round((completedToday / todayTasks.length) * 100)
        : 0;

    // Update localStorage streak data
    if (!taskHistory[today]) {
      taskHistory[today] = completedToday;
      localStorage.setItem("taskHistory", JSON.stringify(taskHistory));
    }

    // Calculate streak
    const streak = calculateStreak(Object.keys(taskHistory));

    // Update DOM
    dailyRateEl.textContent = `${completionRate}%`;
    taskStreakEl.textContent = streak;

    renderTaskChart();
  }

  function calculateStreak(dates) {
    const sorted = dates.sort().reverse();
    let streak = 0;
    let current = new Date();

    for (let date of sorted) {
      const dateStr = current.toISOString().split("T")[0];
      if (dateStr === date) {
        streak++;
        current.setDate(current.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }

  function renderTaskChart() {
    const labels = Object.keys(taskHistory).sort().slice(-7);
    const data = labels.map((date) => taskHistory[date] || 0);

    new Chart(taskChartCtx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Tasks Completed",
            data,
            backgroundColor: "rgba(74, 111, 165, 0.6)",
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1 },
          },
        },
      },
    });
  }

  // State variables
  let tasks = JSON.parse(localStorage.getItem("tasks")) || [];
  let categories = JSON.parse(localStorage.getItem("categories")) || [
    "Work",
    "Personal",
    "Shopping",
  ];
  let currentEditId = null;
  let currentCategories = [];
  let dragStartIndex;

  // Initialize the app
  init();

  // Event Listeners
  addTaskBtn.addEventListener("click", addTask);
  taskInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter") addTask();
  });

  filterSelect.addEventListener("change", renderTasks);
  priorityFilter.addEventListener("change", renderTasks);
  categoryFilter.addEventListener("change", renderTasks);

  searchBtn.addEventListener("click", renderTasks);
  searchInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter") renderTasks();
  });

  themeToggle.addEventListener("click", toggleTheme);

  closeModalBtn.addEventListener("click", closeModal);
  saveTaskBtn.addEventListener("click", saveTaskChanges);
  cancelEditBtn.addEventListener("click", closeModal);
  addCategoryBtn.addEventListener("click", addCategory);
  editTaskCategory.addEventListener("keypress", function (e) {
    if (e.key === "Enter") addCategory();
  });

  // Initialize drag and drop
  initDragAndDrop();

  // Functions
  function init() {
    // Check for saved theme preference
    const savedTheme = localStorage.getItem("theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);
    updateThemeIcon(savedTheme);

    // Render initial tasks and categories
    renderTasks();
    updateCategoryFilter();
    updateStats();
  }
  document.getElementById("downloadReportBtn").addEventListener("click", () => {
    const report = {
      totalTasks: tasks.length,
      completedTasks: tasks.filter((t) => t.completed).length,
      pendingTasks: tasks.filter((t) => !t.completed).length,
      tasksByPriority: {
        high: tasks.filter((t) => t.priority === "high").length,
        medium: tasks.filter((t) => t.priority === "medium").length,
        low: tasks.filter((t) => t.priority === "low").length,
      },
      streak: taskStreakEl.textContent,
      completionRateToday: dailyRateEl.textContent,
      generatedAt: new Date().toLocaleString(),
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `ToDo_Report_${new Date().toISOString().split("T")[0]}.json`;
    a.click();

    URL.revokeObjectURL(url);
  });

  function addTask() {
    const taskText = taskInput.value.trim();
    if (!taskText) return;

    const newTask = {
      reminderTime: document.getElementById("reminderInput").value || null,
      id: Date.now(),
      text: taskText,
      completed: false,
      priority: "medium",
      dueDate: "",
      categories: [],
      createdAt: new Date().toISOString(),
    };

    tasks.unshift(newTask);
    if (newTask.reminderTime) {
      scheduleReminder(newTask);
    }
    saveTasks();
    taskInput.value = "";
    document.getElementById("reminderInput").value = "";
    renderTasks();
    updateStats();
  }

  function renderTasks() {
    const filterValue = filterSelect.value;
    const priorityValue = priorityFilter.value;
    const categoryValue = categoryFilter.value;
    const searchValue = searchInput.value.toLowerCase();

    const filteredTasks = tasks.filter((task) => {
      // Filter by status
      if (filterValue === "completed" && !task.completed) return false;
      if (filterValue === "pending" && task.completed) return false;

      // Filter by priority
      if (priorityValue !== "all" && task.priority !== priorityValue)
        return false;

      // Filter by category
      if (categoryValue !== "all") {
        if (!task.categories || !task.categories.includes(categoryValue))
          return false;
      }

      // Filter by search
      if (searchValue && !task.text.toLowerCase().includes(searchValue))
        return false;

      return true;
    });

    if (filteredTasks.length === 0) {
      taskList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-tasks"></i>
                    <p>No tasks found</p>
                    <small>Try changing your filters or add a new task</small>
                </div>
            `;
      return;
    }

    taskList.innerHTML = "";
    filteredTasks.forEach((task, index) => {
      const taskItem = document.createElement("li");
      taskItem.className = "task-item";
      taskItem.setAttribute("data-id", task.id);
      taskItem.setAttribute("draggable", "true");

      // Check if task is overdue
      const todayStr = new Date().toISOString().split("T")[0];
      const isDueToday = task.dueDate === todayStr;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = task.dueDate ? new Date(task.dueDate) : null;
      const isOverdue = dueDate && dueDate < today && !task.completed;

      taskItem.innerHTML = `
                <input type="checkbox" class="task-checkbox" ${
                  task.completed ? "checked" : ""
                }>
                <span class="task-text ${task.completed ? "completed" : ""}">${
        task.text
      }</span>
                ${
                  task.priority
                    ? `<span class="task-priority priority-${task.priority}">${task.priority}</span>`
                    : ""
                }
                ${
                  task.dueDate
                    ? `<span class="task-due-date ${
                        isOverdue ? "overdue" : isDueToday ? "due-today" : ""
                      }">
                        <i class="far fa-calendar-alt"></i>
                        ${formatDate(task.dueDate)}
                        ${
                          isOverdue
                            ? "<span class='badge overdue-badge'>Overdue</span>"
                            : ""
                        }
                        ${
                          isDueToday
                            ? "<span class='badge today-badge'>Today</span>"
                            : ""
                        }
                      </span>`
                    : ""
                }
                ${
                  task.categories && task.categories.length > 0
                    ? `
                    <span class="task-category">${task.categories[0]}</span>
                `
                    : ""
                }
                <div class="task-actions">
                    <button class="btn-icon edit-btn" data-id="${task.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon delete-btn" data-id="${task.id}">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            `;

      taskList.appendChild(taskItem);

      // Add event listeners to the new elements
      const checkbox = taskItem.querySelector(".task-checkbox");
      const editBtn = taskItem.querySelector(".edit-btn");
      const deleteBtn = taskItem.querySelector(".delete-btn");

      checkbox.addEventListener("change", () => toggleTaskComplete(task.id));
      editBtn.addEventListener("click", () => openEditModal(task.id));
      deleteBtn.addEventListener("click", () => deleteTask(task.id));

      // Drag events
      taskItem.addEventListener("dragstart", dragStart);
      taskItem.addEventListener("dragover", dragOver);
      taskItem.addEventListener("drop", drop);
      taskItem.addEventListener("dragend", dragEnd);
    });
  }
  updatePerformanceIndicators();

  function toggleTaskComplete(id) {
    const task = tasks.find((task) => task.id === id);
    if (task) {
      task.completed = !task.completed;
      saveTasks();
      updateStats();
    }
  }

  function deleteTask(id) {
    if (confirm("Are you sure you want to delete this task?")) {
      tasks = tasks.filter((task) => task.id !== id);
      saveTasks();
      renderTasks();
      updateStats();
    }
  }

  function openEditModal(id) {
    const task = tasks.find((task) => task.id === id);
    if (!task) return;

    currentEditId = id;
    currentCategories = [...task.categories];

    editTaskText.value = task.text;
    editTaskPriority.value = task.priority;
    editTaskDueDate.value = task.dueDate || "";

    // Render categories
    renderCategoryTags();

    taskDetailsModal.style.display = "flex";
  }

  function closeModal() {
    taskDetailsModal.style.display = "none";
    currentEditId = null;
    currentCategories = [];
  }

  function saveTaskChanges() {
    if (!currentEditId) return;

    const task = tasks.find((task) => task.id === currentEditId);
    if (!task) return;

    task.text = editTaskText.value.trim();
    task.priority = editTaskPriority.value;
    task.dueDate = editTaskDueDate.value || "";
    task.categories = [...currentCategories];

    saveTasks();
    renderTasks();
    updateCategoryFilter();
    closeModal();
  }

  function addCategory() {
    const category = editTaskCategory.value.trim();
    if (!category || currentCategories.includes(category)) return;

    currentCategories.push(category);

    // Add to global categories if not exists
    if (!categories.includes(category)) {
      categories.push(category);
      localStorage.setItem("categories", JSON.stringify(categories));
      updateCategoryFilter();
    }

    editTaskCategory.value = "";
    renderCategoryTags();
  }

  function removeCategory(category) {
    currentCategories = currentCategories.filter((cat) => cat !== category);
    renderCategoryTags();
  }

  function renderCategoryTags() {
    categoryTags.innerHTML = "";
    currentCategories.forEach((category) => {
      const tag = document.createElement("span");
      tag.className = "category-tag";
      tag.innerHTML = `
                ${category}
                <button onclick="removeCategory('${category}')">
                    <i class="fas fa-times"></i>
                </button>
            `;
      categoryTags.appendChild(tag);
    });
  }

  function updateCategoryFilter() {
    categoryFilter.innerHTML = `
            <option value="all">All Categories</option>
            ${categories
              .map(
                (category) => `
                <option value="${category}">${category}</option>
            `
              )
              .join("")}
        `;
  }

  function saveTasks() {
    localStorage.setItem("tasks", JSON.stringify(tasks));
  }

  function updateStats() {
    totalTasksEl.textContent = tasks.length;
    completedTasksEl.textContent = tasks.filter(
      (task) => task.completed
    ).length;
    pendingTasksEl.textContent = tasks.filter((task) => !task.completed).length;
  }

  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";

    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
    updateThemeIcon(newTheme);
  }

  function updateThemeIcon(theme) {
    const icon = themeToggle.querySelector("i");
    icon.className = theme === "dark" ? "fas fa-sun" : "fas fa-moon";
  }

  function formatDate(dateString) {
    const options = { year: "numeric", month: "short", day: "numeric" };
    return new Date(dateString).toLocaleDateString(undefined, options);
  }

  // Drag and Drop functions
  function initDragAndDrop() {
    const listItems = document.querySelectorAll(".task-item");

    listItems.forEach((item) => {
      item.addEventListener("dragstart", dragStart);
      item.addEventListener("dragover", dragOver);
      item.addEventListener("drop", drop);
      item.addEventListener("dragend", dragEnd);
    });
  }

  function dragStart(e) {
    dragStartIndex = +this.closest("li").getAttribute("data-id");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", this.innerHTML);
    this.classList.add("dragging");
  }

  function dragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    return false;
  }

  function drop(e) {
    e.stopPropagation();
    e.preventDefault();

    const dragEndIndex = +this.getAttribute("data-id");
    if (dragStartIndex === dragEndIndex) return;

    // Reorder tasks array
    const startIdx = tasks.findIndex((task) => task.id === dragStartIndex);
    const endIdx = tasks.findIndex((task) => task.id === dragEndIndex);

    if (startIdx === -1 || endIdx === -1) return;

    const [removed] = tasks.splice(startIdx, 1);
    tasks.splice(endIdx, 0, removed);

    saveTasks();
    renderTasks();
  }

  function dragEnd() {
    this.classList.remove("dragging");
  }

  // Make removeCategory available globally for the category tags
  window.removeCategory = removeCategory;
});
function scheduleReminder(task) {
  const now = new Date().getTime();
  const reminderTime = new Date(task.reminderTime).getTime();
  const timeUntilReminder = reminderTime - now;

  if (timeUntilReminder > 0) {
    setTimeout(() => {
      if (Notification.permission === "granted") {
        new Notification("⏰ Task Reminder", {
          body: task.text,
          icon: "https://cdn-icons-png.flaticon.com/512/847/847969.png",
        });
      }
    }, timeUntilReminder);
  }
}

// Pomodoro Timer Logic
let pomodoroTime = 25 * 60; // 25 minutes
let pomodoroInterval = null;
const pomodoroDisplay = document.getElementById("pomodoroDisplay");
const startPomodoro = document.getElementById("startPomodoro");
const pausePomodoro = document.getElementById("pausePomodoro");
const resetPomodoro = document.getElementById("resetPomodoro");

function updatePomodoroDisplay() {
  const minutes = Math.floor(pomodoroTime / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (pomodoroTime % 60).toString().padStart(2, "0");
  pomodoroDisplay.textContent = `${minutes}:${seconds}`;
}

startPomodoro.addEventListener("click", () => {
  if (pomodoroInterval) return;
  pomodoroInterval = setInterval(() => {
    if (pomodoroTime > 0) {
      pomodoroTime--;
      updatePomodoroDisplay();
    } else {
      clearInterval(pomodoroInterval);
      pomodoroInterval = null;
      new Notification("Pomodoro Session Completed!", {
        body: "Take a short break.",
        icon: "https://cdn-icons-png.flaticon.com/512/847/847969.png",
      });
    }
  }, 1000);
});

pausePomodoro.addEventListener("click", () => {
  clearInterval(pomodoroInterval);
  pomodoroInterval = null;
});

resetPomodoro.addEventListener("click", () => {
  clearInterval(pomodoroInterval);
  pomodoroTime = 25 * 60;
  updatePomodoroDisplay();
  pomodoroInterval = null;
});

updatePomodoroDisplay();

tasks.forEach((task) => {
  if (task.reminderTime) {
    scheduleReminder(task);
  }
});

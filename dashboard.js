"use strict";

const DASHBOARD_KEY = "japanquiz-dashboard-v1";

let dashboardData = {
  goal: 10,
  days: {},
  last: null
};

let dashboardCanSave = true;
let pendingDashboardPage = null;

function dashboardDate(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function validDashboardData(value) {
  if (!value ||
      ![10, 20, 30].includes(value.goal) ||
      !value.days ||
      typeof value.days !== "object" ||
      Array.isArray(value.days)) {
    return false;
  }

  for (const [date, day] of Object.entries(value.days)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !day ||
        !Number.isSafeInteger(day.answered) ||
        !Number.isSafeInteger(day.correct) ||
        day.answered < 0 ||
        day.correct < 0 ||
        day.correct > day.answered) {
      return false;
    }
  }

  return value.last === null || (
    value.last &&
    typeof value.last.quiz === "string" &&
    Object.prototype.hasOwnProperty.call(
      QUIZZES,
      value.last.quiz
    ) &&
    Number.isInteger(value.last.levelId)
  );
}

try {
  const saved = localStorage.getItem(DASHBOARD_KEY);

  if (saved !== null) {
    const parsed = JSON.parse(saved);

    if (!validDashboardData(parsed)) {
      throw new Error("Invalid dashboard data");
    }

    dashboardData = parsed;
  }
} catch (error) {
  dashboardCanSave = false;
  console.error(error);

  notify(t("dashboardLoadFail"));
}

function saveDashboardData() {
  if (!dashboardCanSave) return;

  try {
    localStorage.setItem(
      DASHBOARD_KEY,
      JSON.stringify(dashboardData)
    );
  } catch {
    dashboardCanSave = false;

    notify(t("dashboardSaveFail"));
  }
}

// Add the navigation bar.
const dashboardNav = document.createElement("nav");
dashboardNav.className = "dashboard-nav";
dashboardNav.dataset.i18nAria = "mainNav";

const dashboardPages = [
  ["home", "🏠", "navHome"],
  ["continue", "▶", "navContinue"],
  ["progress", "📊", "navProgress"],
  ["goal", "🎯", "navGoal"],
  ["streak", "🔥", "navStreak"],
  ["scores", "🏆", "navScores"]
];

for (const [page, icon, labelKey] of dashboardPages) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.dashboard = page;

  const symbol = makeElement("span", icon, "dashboard-icon");
  symbol.setAttribute("aria-hidden", "true");

  const label = makeElement("span", t(labelKey), "dashboard-label");
  label.dataset.i18n = labelKey;

  button.append(symbol, label);

  button.addEventListener("click", () => {
    requestDashboardPage(page, button);
  });

  dashboardNav.append(button);
}

document.querySelector(".app-header").after(dashboardNav);

// Add the three information screens.
const dashboardScreenContainer = document.createElement("div");

dashboardScreenContainer.innerHTML = `
  <section id="dashboard-progress-screen" class="screen"
           aria-labelledby="dashboard-progress-title" hidden>
    <p class="eyebrow" data-i18n="progressEyebrow">YOUR LEARNING JOURNEY</p>
    <h1 id="dashboard-progress-title" data-i18n="progressTitle">Your Progress</h1>
    <p data-i18n="progressIntro">Completed game levels for each quiz.</p>
    <div id="dashboard-progress-list"
         class="dashboard-card-grid"></div>
  </section>

  <section id="dashboard-goal-screen" class="screen"
           aria-labelledby="dashboard-goal-title" hidden>
    <p class="eyebrow" data-i18n="goalEyebrow">ONE STEP EVERY DAY</p>
    <h1 id="dashboard-goal-title" data-i18n="goalTitle">Daily Goal</h1>

    <article class="dashboard-panel">
      <label for="dashboard-goal-select" data-i18n="goalLabel">
        Questions to answer each day
      </label>

      <select id="dashboard-goal-select">
        <option value="10" data-i18n="goal10">10 questions</option>
        <option value="20" data-i18n="goal20">20 questions</option>
        <option value="30" data-i18n="goal30">30 questions</option>
      </select>

      <p id="dashboard-goal-count" class="dashboard-big"></p>

      <progress id="dashboard-goal-progress"
                value="0" max="10"
                data-i18n-aria="goalProgress"></progress>

      <p id="dashboard-goal-message" role="status"></p>
      <p id="dashboard-today-correct"></p>

      <p class="dashboard-note" data-i18n="goalNote">
        Correct and incorrect answers count toward your goal.
        Unanswered questions that time out do not count.
        Regular quizzes and practice modes both count.
      </p>
    </article>
  </section>

  <section id="dashboard-scores-screen" class="screen"
           aria-labelledby="dashboard-scores-title" hidden>
    <p class="eyebrow" data-i18n="scoresEyebrow">TOP 5 NAMES</p>
    <h1 id="dashboard-scores-title" data-i18n="highScores">High scores</h1>
    <p data-i18n="scoresPick">Choose N5, N4, N3, or N2 to see who scored the most.</p>

    <article class="dashboard-panel">
      <div class="scores-filters">
        <label for="scores-exam-select" data-i18n="scoresExam">JLPT level</label>
        <select id="scores-exam-select"></select>
      </div>
      <p id="dashboard-scores-status"></p>
      <ol id="dashboard-scores-list" class="scores-list"></ol>
    </article>
  </section>

  <section id="dashboard-streak-screen" class="screen"
           aria-labelledby="dashboard-streak-title" hidden>
    <p class="eyebrow" data-i18n="streakEyebrow">KEEP THE HABIT GOING</p>
    <h1 id="dashboard-streak-title" data-i18n="streakTitle">Learning Streak</h1>

    <article class="dashboard-panel">
      <p id="dashboard-streak-count" class="dashboard-big"></p>
      <p id="dashboard-streak-message"></p>

      <h2 data-i18n="last7">Last 7 Days</h2>
      <div id="dashboard-week" class="dashboard-week"></div>

      <p class="dashboard-note" data-i18n="streakNote">
        Answer at least one question each day to keep your streak.
        Dates follow this device’s local calendar.
      </p>
    </article>
  </section>
`;

while (dashboardScreenContainer.firstChild) {
  document.querySelector("main").append(
    dashboardScreenContainer.firstChild
  );
}

// Keep the guide available from every screen.
document.body.append($("guide-dialog"));

$("dashboard-goal-select").value =
  String(dashboardData.goal);

$("dashboard-goal-select").addEventListener("change", () => {
  dashboardData.goal = Number(
    $("dashboard-goal-select").value
  );

  saveDashboardData();
  refreshDashboard();
});

function dashboardQuizProgress(type) {
  const levels = QUIZZES[type].levels;

  const completed = levels.filter(
    (level) => getRecord(type, level.id).passed
  ).length;

  return {
    completed,
    total: levels.length
  };
}

function dashboardStreak() {
  const date = new Date();

  // Use noon when moving between calendar days.
  date.setHours(12, 0, 0, 0);

  const today = dashboardData.days[dashboardDate(date)];

  // Yesterday's streak stays visible until today ends.
  if (!today || today.answered === 0) {
    date.setDate(date.getDate() - 1);
  }

  let count = 0;

  while (
    dashboardData.days[dashboardDate(date)]?.answered > 0
  ) {
    count++;
    date.setDate(date.getDate() - 1);
  }

  return count;
}

function refreshDashboard() {
  // Add progress to the existing JLPT cards.
  for (const card of document.querySelectorAll("[data-exam]")) {
    const exam = card.dataset.exam;

    const hiragana = dashboardQuizProgress(
      `${exam}-hiragana`
    );

    const kanji = dashboardQuizProgress(
      `${exam}-kanji`
    );

    let label = card.querySelector(".exam-progress-label");

    if (!label) {
      label = makeElement(
        "span",
        "",
        "exam-progress-label"
      );

      card.insertBefore(
        label,
        card.querySelector(".type-action")
      );
    }

    label.textContent = t("examProgress", {
      done: hiragana.completed + kanji.completed,
      total: hiragana.total + kanji.total
    });
  }

  // Detailed progress screen.
  const progressList = $("dashboard-progress-list");
  progressList.replaceChildren();

  for (const [type, quiz] of Object.entries(QUIZZES)) {
    const count = dashboardQuizProgress(type);
    const card = makeElement(
      "article",
      undefined,
      "dashboard-panel"
    );

    const bar = document.createElement("progress");
    bar.max = Math.max(1, count.total);
    bar.value = count.completed;
    bar.setAttribute(
      "aria-label",
      t("progressAria", { name: quizLabel(type) })
    );

    card.append(
      makeElement("h2", quizLabel(type)),
      makeElement(
        "p",
        t("levelsCompleted", {
          done: count.completed,
          total: count.total
        })
      ),
      bar
    );

    progressList.append(card);
  }

  // Today's goal.
  const today = dashboardData.days[dashboardDate()] || {
    answered: 0,
    correct: 0
  };

  $("dashboard-goal-count").textContent =
    `${today.answered} / ${dashboardData.goal}`;

  $("dashboard-goal-progress").max = dashboardData.goal;
  $("dashboard-goal-progress").value = Math.min(
    today.answered,
    dashboardData.goal
  );

  $("dashboard-goal-message").textContent =
    today.answered >= dashboardData.goal
      ? t("goalDone")
      : t("goalMore", {
          n: dashboardData.goal - today.answered
        });

  $("dashboard-today-correct").textContent = t("todayCorrect", {
    n: today.correct
  });

  // Streak and activity calendar.
  const streak = dashboardStreak();

  $("dashboard-streak-count").textContent = uiLang === "si"
    ? t("streakCount", { n: streak })
    : t("streakCount", {
        n: streak,
        unit: t(streak === 1 ? "day" : "days")
      });

  $("dashboard-streak-message").textContent = today.answered > 0
    ? t("streakDone")
    : t("streakNeed");

  const week = $("dashboard-week");
  week.replaceChildren();

  for (let offset = 6; offset >= 0; offset--) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - offset);

    const key = dashboardDate(date);
    const activity = dashboardData.days[key]?.answered || 0;

    const day = makeElement(
      "div",
      undefined,
      "dashboard-day"
    );

    day.classList.toggle("done", activity > 0);
    day.title = t("dayAnswers", { date: key, count: activity });

    day.append(
      makeElement("span", weekdayLabel(date)),
      makeElement("strong", activity > 0 ? "✓" : "—"),
      makeElement("small", String(date.getDate()))
    );

    week.append(day);
  }
}

function continueDashboardLearning() {
  const saved = dashboardData.last;

  // No previous regular quiz: let the user choose one.
  if (!saved || !QUIZZES[saved.quiz]) {
    openHome();
    notify(t("continueFirst"));
    return;
  }

  const type = saved.quiz;
  const levels = QUIZZES[type].levels;

  if (levels.length === 0) {
    openHome();
    notify(t("continueEmpty"));
    return;
  }

  selectedExam = type.split("-")[0];

  // Continue with the first unfinished level.
  const nextIndex = levels.findIndex(
    (level, index) =>
      !getRecord(type, level.id).passed &&
      levelUnlocked(type, index)
  );

  openLevels(type);

  if (nextIndex === -1) {
    notify(t("continueDone"));
    return;
  }

  notify("");
  startLevel(nextIndex);
}

function openDashboardPage(page) {
  stopQuestionTimer();
  quizActive = false;

  if (page === "home") {
    openHome();
  } else if (page === "continue") {
    continueDashboardLearning();
  } else if (page === "scores") {
    showScreen("dashboard-scores-screen");
    showHighScorePage();
  } else {
    refreshDashboard();
    showScreen(`dashboard-${page}-screen`);
  }
}

function requestDashboardPage(page, trigger) {
  // Continue keeps an active attempt on screen.
  if (quizActive && page === "continue") return;

  if (quizActive) {
    pendingDashboardPage = page;

    // Use the existing Leave Quiz confirmation.
    requestLeave("home", trigger);
    return;
  }

  openDashboardPage(page);
}

// Navigate only if the user confirmed leaving.
// Cancel / Escape keeps the current attempt.
$("quit-dialog").addEventListener("cancel", () => {
  pendingDashboardPage = null;
});

$("quit-dialog").addEventListener("close", () => {
  const page = pendingDashboardPage;
  pendingDashboardPage = null;

  if (page !== null && !quizActive) {
    openDashboardPage(page);
  }
});

// Track the last regular quiz without changing practice mode.
const dashboardOriginalStartLevel = startLevel;

startLevel = function (index) {
  const level = QUIZZES[quizType]?.levels[index];

  if (!level || !levelUnlocked(quizType, index)) return;

  dashboardOriginalStartLevel(index);

  dashboardData.last = {
    quiz: quizType,
    levelId: level.id
  };

  saveDashboardData();
};

// Count actual answers once.
// A timeout passes null instead of an answer button.
const dashboardOriginalChooseAnswer = chooseAnswer;

chooseAnswer = function (choice, button) {
  if (answerLocked || !quizActive) return;

  const before = answers.length;
  dashboardOriginalChooseAnswer(choice, button);

  if (!button || answers.length !== before + 1) return;

  const key = dashboardDate();

  const day = dashboardData.days[key] || {
    answered: 0,
    correct: 0
  };

  day.answered++;

  if (answers[answers.length - 1].correct) {
    day.correct++;
  }

  dashboardData.days[key] = day;
  saveDashboardData();
};

// Keep the active navigation button in sync.
const dashboardOriginalShowScreen = showScreen;

showScreen = function (id) {
  dashboardOriginalShowScreen(id);

  let page = "home";

  if (id === "quiz-screen" || id === "results-screen") {
    page = "continue";
  } else if (id.startsWith("dashboard-")) {
    page = id
      .replace("dashboard-", "")
      .replace("-screen", "");
  }

  for (const button of dashboardNav.querySelectorAll("button")) {
    const active = button.dataset.dashboard === page;
    button.classList.toggle("active", active);

    if (active) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  }

  if (id === "home-screen" || id.startsWith("dashboard-")) {
    refreshDashboard();
  }
};

// Update dates after returning to the app.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    refreshDashboard();
  }
});

function refreshLanguageSurfaces() {
  applyStaticTexts();
  refreshDashboard();

  if (selectedExam) renderHome();

  const screen = [...document.querySelectorAll(".screen")]
    .find((item) => !item.hidden);

  if (!screen) return;

  if (screen.id === "levels-screen" && quizType) {
    openLevels(quizType);
  } else if (screen.id === "study-screen" && studyView) {
    renderStudyList();
  } else if (screen.id === "quiz-screen") {
    refreshQuizChrome();
  } else if (screen.id === "results-screen") {
    paintResults();
  } else if (screen.id === "dashboard-scores-screen") {
    showHighScorePage();
  }
}

document.addEventListener("japanquiz-lang", refreshLanguageSurfaces);

refreshLanguageSurfaces();
dashboardNav
  .querySelector('[data-dashboard="home"]')
  .classList.add("active");

dashboardNav
  .querySelector('[data-dashboard="home"]')
  .setAttribute("aria-current", "page");
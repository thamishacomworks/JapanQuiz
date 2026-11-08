"use strict";

const $ = (id) => document.getElementById(id);
const STORAGE_KEY = "japanquiz-jlpt-progress-v1";

const QUIZZES = {
  "n5-hiragana": {
    name: "N5 · Hiragana Quiz",
    levels: window.HIRAGANA_N5_LEVELS
  },
  "n5-kanji": {
    name: "N5 · Kanji Quiz",
    levels: window.KANJI_N5_LEVELS
  },
  "n4-hiragana": {
    name: "N4 · Hiragana Quiz",
    levels: window.HIRAGANA_N4_LEVELS
  },
  "n4-kanji": {
    name: "N4 · Kanji Quiz",
    levels: window.KANJI_N4_LEVELS
  },
  "n3-hiragana": {
    name: "N3 · Hiragana Quiz",
    levels: window.HIRAGANA_N3_LEVELS
  },
   "n3-kanji": {
    name: "N3 · Kanji Quiz",
    levels: window.KANJI_N3_LEVELS
  },
  "n2-hiragana": {
    name: "N2 · Hiragana Quiz",
    levels: window.HIRAGANA_N2_LEVELS
  },
  "n2-kanji": {
    name: "N2 · Kanji Quiz",
    levels: window.KANJI_N2_LEVELS
  }
};

let progress = Object.fromEntries(
  Object.keys(QUIZZES).map((key) => [key, {}])
);

let selectedExam = null;

let canSave = true;
let quizType = null;
let currentLevel = null;
let questions = [];
let questionIndex = 0;
let answers = [];
let answerLocked = false;
let quizActive = false;
let lastTrigger = null;

function makeElement(tag, text, className) {
  const node = document.createElement(tag);

  if (text !== undefined) {
    node.textContent = text;
  }

  if (className) {
    node.className = className;
  }

  return node;
}

function notify(text) {
  $("app-message").textContent = text;
}

function shuffle(items) {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

function showScreen(id) {
  for (const screen of document.querySelectorAll(".screen")) {
    screen.hidden = screen.id !== id;
  }

  window.scrollTo(0, 0);

  const heading = $(id).querySelector("h1");

  if (heading) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true, focusVisible: false });
  }
}

function validProgress(value) {
  if (!value || typeof value !== "object") return false;

  for (const type of Object.keys(QUIZZES)) {
    const records = value[type];

    if (!records || typeof records !== "object" ||
        Array.isArray(records)) {
      return false;
    }

    for (const record of Object.values(records)) {
      if (!record ||
          typeof record !== "object" ||
          !Number.isInteger(record.bestPercent) ||
          record.bestPercent < 0 ||
          record.bestPercent > 100 ||
          typeof record.passed !== "boolean") {
        return false;
      }
    }
  }

  return true;
}

function loadProgress() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved === null) return;

    const parsed = JSON.parse(saved);

    if (!parsed || typeof parsed !== "object" ||
        Array.isArray(parsed)) {
      throw new Error("Invalid progress");
    }

    // Keep existing progress and initialize new quiz categories.
    const updated = Object.fromEntries(
      Object.keys(QUIZZES).map((key) => [
        key,
        Object.prototype.hasOwnProperty.call(parsed, key)
          ? parsed[key]
          : {}
      ])
    );

    if (!validProgress(updated)) {
      throw new Error("Invalid progress");
    }

    progress = updated;
  } catch (error) {
    canSave = false;
    console.error("Progress loading failed:", error);

    notify(t("progressLoadFail"));
  }
}

function saveProgress() {
  if (!canSave) return;

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(progress)
    );
  } catch {
    notify(t("progressSaveFail"));
  }
}

function validateQuestions() {
  for (const [type, quiz] of Object.entries(QUIZZES)) {
   if (!Array.isArray(quiz.levels)) {
      throw new Error(
        t("questionsMissing", { name: quiz.name })
      );
    }

    const ids = new Set();

    for (const level of quiz.levels) {
      if (!Number.isInteger(level.id) ||
          level.id < 1 ||
          ids.has(level.id) ||
          typeof level.title !== "string" ||
          !level.title.trim() ||
          !Array.isArray(level.questions) ||
          level.questions.length === 0) {
        throw new Error(`Check the levels in ${type}.js.`);
      }

      ids.add(level.id);

      for (const question of level.questions) {
        if (!question ||
            typeof question.word !== "string" ||
            !question.word.trim() ||
            typeof question.answer !== "string" ||
            !question.answer.trim() ||
            !Array.isArray(question.choices) ||
            question.choices.length !== 4 ||
            question.choices.some((choice) =>
              typeof choice !== "string" || !choice.trim()
            ) ||
            new Set(question.choices).size !== 4 ||
            !question.choices.includes(question.answer) ||
            (question.reading !== undefined &&
              typeof question.reading !== "string")) {
          throw new Error(
            `Check a question in ${type}.js, Level ${level.id}. ` +
            "Each question needs four different choices, " +
            "including the exact answer."
          );
        }
      }
    }
  }
}

function getRecord(type, levelId) {
  return progress[type][String(levelId)] || {
    bestPercent: 0,
    passed: false
  };
}

function levelUnlocked(type, index) {
  if (index === 0) return true;

  // Unlock only when all earlier levels have been passed.
  return QUIZZES[type].levels
    .slice(0, index)
    .every((level) => getRecord(type, level.id).passed);
}

function renderHome() {
  if (!selectedExam) return;

  for (const type of ["hiragana", "kanji"]) {
    const key = `${selectedExam}-${type}`;
    const levels = QUIZZES[key].levels;

    const completed = levels.filter(
      (level) => getRecord(key, level.id).passed
    ).length;

    const button = document.querySelector(
      `[data-quiz="${type}"]`
    );

    button.disabled = levels.length === 0;

    $(`${type}-progress`).textContent =
      levels.length === 0
        ? t("comingSoon")
        : t("levelsCompleted", {
            done: completed,
            total: levels.length
          });

    button.querySelector(".type-action").textContent =
      levels.length === 0
        ? t("questionsSoon")
        : t("chooseLevel");
  }
}

function openHome() {
  quizActive = false;
  showScreen("home-screen");
}

function openQuizTypes(exam) {
    notify("");
  quizActive = false;
  selectedExam = exam;

  $("selected-exam-label").textContent =
    `JLPT ${exam.toUpperCase()}`;

  renderHome();
  showScreen("type-screen");
}

function openLevels(type) {
    practiceMode = false;
  quizActive = false;
  quizType = type;

  const quiz = QUIZZES[type];

  $("levels-category").textContent = quizLabel(type);
  $("levels-title").textContent = t("levelsTitle");

  const grid = $("levels-grid");
  grid.replaceChildren();

  quiz.levels.forEach((level, index) => {
    const record = getRecord(type, level.id);
    const unlocked = levelUnlocked(type, index);

    const button = makeElement(
      "button",
      undefined,
      "level-card"
    );

    button.type = "button";
    button.disabled = !unlocked;
    button.classList.toggle("completed", record.passed);

    let status = t("ready");

    if (!unlocked) {
      status = t("locked");
    } else if (record.passed) {
      status = t("completedBest", { percent: record.bestPercent });
    } else if (record.bestPercent > 0) {
      status = t("bestTry", { percent: record.bestPercent });
    }

    button.append(
      makeElement(
        "span",
        t("levelNumber", { id: level.id }),
        "level-number"
      ),
      makeElement("span", level.title, "level-name"),
      makeElement(
        "span",
        t("questionCount", {
          n: Math.min(10, level.questions.length)
        }),
        "level-status"
      ),
      makeElement("span", status, "level-status")
    );

    button.addEventListener("click", () => {
      startLevel(index);
    });

       const levelGroup = makeElement(
      "div",
      undefined,
      "level-group"
    );

    const wordListButton = makeElement(
      "button",
      t("wordList"),
      "secondary-button word-list-button"
    );

    wordListButton.type = "button";
    wordListButton.disabled = !unlocked;

    wordListButton.addEventListener("click", () => {
      openWordList(index);
    });

    levelGroup.append(button, wordListButton);
    grid.append(levelGroup);
  });
updateStudyButtons();
  showScreen("levels-screen");
}

function startLevel(index) {
    practiceMode = false;
  if (!levelUnlocked(quizType, index)) return;

  currentLevel = QUIZZES[quizType].levels[index];

  questions = shuffle(currentLevel.questions).slice(0, 10);
  questionIndex = 0;
  answers = [];
  answerLocked = false;
  quizActive = true;

  $("quiz-level-label").textContent = t("quizLevel", {
    name: quizLabel(quizType),
    id: currentLevel.id
  });

  showScreen("quiz-screen");
  renderQuestion();
}

function renderQuestion() {
  answerLocked = false;

  const question = questions[questionIndex];

  $("question-counter").textContent = t("questionCounter", {
    current: questionIndex + 1,
    total: questions.length
  });

  const correctCount = answers.filter(
    (answer) => answer.correct
  ).length;

  $("quiz-score").textContent = t("score", {
    n: correctCount * 10
  });

  $("quiz-progress").max = questions.length;
  $("quiz-progress").value = answers.length;

   const isKanjiQuiz = quizType.endsWith("-kanji");

  $("question-instruction").textContent = t(
    isKanjiQuiz ? "instructionReading" : "instructionMeaning"
  );

  $("question-character").textContent = question.word;
  updateFavoriteButton(question);

  $("answer-feedback").textContent = "";
  $("answer-feedback").className = "answer-feedback";

  $("next-question").hidden = true;
  $("next-question").textContent = t(
    questionIndex === questions.length - 1
      ? "viewResults"
      : "nextQuestion"
  );

  const options = $("answer-options");
  options.replaceChildren();

  for (const choice of shuffle(question.choices)) {
    const button = makeElement(
      "button",
      choice,
      "answer-button"
    );

    button.type = "button";
  button.lang = isKanjiQuiz ? "ja" : "si";

    button.addEventListener("click", () => {
      chooseAnswer(choice, button);
    });

    options.append(button);
  }
  startQuestionTimer();
}

function chooseAnswer(choice, selectedButton) {
  if (answerLocked || !quizActive) return;
  stopQuestionTimer();

  answerLocked = true;

  const question = questions[questionIndex];
  const correct = choice === question.answer;
  rememberAnswer(question, correct);

  answers.push({
    question,
    selected: choice,
    correct
  });

  for (const button of $("answer-options").children) {
    button.disabled = true;

    if (button.textContent === question.answer) {
      button.classList.add("correct");
    }
  }

  if (!correct && selectedButton) {
  selectedButton.classList.add("incorrect");
}

  const feedback = $("answer-feedback");
  feedback.className =
    `answer-feedback ${correct ? "correct" : "incorrect"}`;

    const isKanjiQuiz = quizType.endsWith("-kanji");

  feedback.textContent = [
    correct ? t("correctPoints") : t("incorrect"),
    t("correctAnswer", { answer: question.answer }),
    isKanjiQuiz && question.meaning
      ? t("sinhalaMeaning", { meaning: question.meaning })
      : ""
  ]
    .filter(Boolean)
    .join("\n");

  $("quiz-score").textContent = t("score", {
    n: answers.filter((answer) => answer.correct).length * 10
  });

  $("quiz-progress").value = answers.length;
  $("next-question").hidden = false;
  $("next-question").focus({ preventScroll: true });
}

function finishLevel() {
  stopQuestionTimer();
    if (practiceMode) {
    finishMistakePractice();
    return;
  }
  quizActive = false;

  const correctCount = answers.filter(
    (answer) => answer.correct
  ).length;

  const percent = Math.round(
    (correctCount / questions.length) * 100
  );

  const required = Math.ceil(questions.length * 0.7);
  const passed = correctCount >= required;

  const record = getRecord(quizType, currentLevel.id);

  progress[quizType][String(currentLevel.id)] = {
    bestPercent: Math.max(record.bestPercent, percent),
    passed: record.passed || passed
  };

  saveProgress();
  renderHome();

  const levels = QUIZZES[quizType].levels;
  const levelIndex = levels.indexOf(currentLevel);
  const hasNext = levelIndex + 1 < levels.length;

  lastResult = {
    icon: passed ? "🏆" : "💪",
    titleKey: passed ? "levelPassed" : "keepPracticing",
    summaryKey: "resultsSummary",
    summaryVars: {
      correct: correctCount,
      total: questions.length,
      percent
    },
    pointsKey: "points",
    pointsVars: { n: correctCount * 10 },
    unlockKey: passed && hasNext
      ? "unlockNext"
      : passed
        ? "unlockFinal"
        : "needCorrect",
    unlockVars: { n: required },
    showNext: hasNext && levelUnlocked(quizType, levelIndex + 1),
    detailed: true,
    showScores: true,
    mistakes: answers.filter((answer) => !answer.correct)
  };

  paintResults();
  showScreen("results-screen");
  loadExamScores(quizType.split("-")[0], {
    quizKey: quizType,
    levelId: currentLevel.id,
    score: correctCount * 10
  });
}

let lastResult = null;

function paintResults() {
  const result = lastResult;
  if (!result) return;

  $("results-icon").textContent = result.icon;
  $("results-title").textContent = t(result.titleKey);
  $("results-summary").textContent = t(
    result.summaryKey,
    result.summaryVars
  );
  $("results-points").textContent = t(
    result.pointsKey,
    result.pointsVars
  );
  $("unlock-message").textContent = t(
    result.unlockKey,
    result.unlockVars
  );
  $("next-level").hidden = !result.showNext;

  if (result.showScores && typeof renderActiveScores === "function") {
    renderActiveScores();
  } else if ($("scores-section")) {
    $("scores-section").hidden = true;
  }

  $("review-section").hidden = result.mistakes.length === 0;
  $("review-list").replaceChildren();

  for (const mistake of result.mistakes) {
    const item = makeElement("article", undefined, "review-item");
    const word = makeElement(
      "p",
      mistake.question.word,
      "review-character"
    );

    word.lang = "ja";
    item.append(word);

    if (result.detailed && mistake.question.reading) {
      item.append(makeElement(
        "p",
        t("reading", { value: mistake.question.reading })
      ));
    }

    if (result.detailed) {
      item.append(makeElement(
        "p",
        t("yourAnswer", {
          value: displayAnswer(mistake.selected)
        })
      ));
    }

    item.append(makeElement(
      "p",
      t("correctAnswer", { answer: mistake.question.answer }),
      "review-correct"
    ));

    if (!result.detailed && mistake.question.meaning) {
      item.append(makeElement(
        "p",
        t("meaning", { value: mistake.question.meaning })
      ));
    }

    $("review-list").append(item);
  }
}

function refreshQuizChrome() {
  if (!quizType || $("quiz-screen").hidden) return;

  $("quiz-level-label").textContent = practiceMode
    ? t("practiceHeading", {
        name: quizLabel(quizType),
        mode: t(
          reviewKind === "mixed" ? "mixedReview" : "mistakePractice"
        )
      })
    : t("quizLevel", {
        name: quizLabel(quizType),
        id: currentLevel.id
      });

  $("question-counter").textContent = t("questionCounter", {
    current: questionIndex + 1,
    total: questions.length
  });

  $("quiz-score").textContent = t("score", {
    n: answers.filter((answer) => answer.correct).length * 10
  });

  $("question-instruction").textContent = t(
    quizType.endsWith("-kanji")
      ? "instructionReading"
      : "instructionMeaning"
  );

  if (questions[questionIndex]) {
    updateFavoriteButton(questions[questionIndex]);
  }

  $("next-question").textContent = t(
    questionIndex === questions.length - 1
      ? "viewResults"
      : "nextQuestion"
  );

  if (!$("question-timer").hidden) {
    $("question-timer").textContent = timerRemaining <= 0
      ? `⏱️ ${t("timeExpired")}`
      : t("timerValue", {
          n: Math.max(0, Math.ceil(timerRemaining / 1000))
        });
  }

  if (answerLocked && answers.length > 0) {
    const last = answers[answers.length - 1];
    const isKanjiQuiz = quizType.endsWith("-kanji");

    $("answer-feedback").textContent = [
      last.correct ? t("correctPoints") : t("incorrect"),
      t("correctAnswer", { answer: last.question.answer }),
      isKanjiQuiz && last.question.meaning
        ? t("sinhalaMeaning", { meaning: last.question.meaning })
        : ""
    ]
      .filter(Boolean)
      .join("\n");
  }
}

function requestLeave(destination, trigger) {
  if (!quizActive) {
    destination === "home"
      ? openHome()
      : openLevels(quizType);
    return;
  }

  lastTrigger = trigger;
  $("quit-dialog").dataset.destination = destination;
  pauseQuestionTimer();
  $("quit-dialog").showModal();
  $("keep-playing").focus();
}

function bindEvents() {
 for (const button of document.querySelectorAll("[data-exam]")) {
  button.addEventListener("click", () => {
    openQuizTypes(button.dataset.exam);
  });
}

$("type-back").addEventListener("click", openHome);

for (const button of document.querySelectorAll("[data-quiz]")) {
  button.addEventListener("click", () => {
    if (!selectedExam) return;

    const key = `${selectedExam}-${button.dataset.quiz}`;

    if (QUIZZES[key].levels.length > 0) {
      openLevels(key);
    }
  });
}

  $("home-link").addEventListener("click", (event) => {
    event.preventDefault();
    requestLeave("home", event.currentTarget);
  });

 $("levels-back").addEventListener("click", () => {
  openQuizTypes(selectedExam);
});

  $("quit-quiz").addEventListener("click", (event) => {
    requestLeave("levels", event.currentTarget);
  });

  $("keep-playing").addEventListener("click", () => {
    pendingDashboardPage = null;
    $("quit-dialog").close();
  });

  $("quit-dialog").addEventListener("close", () => {
    if (lastTrigger && lastTrigger.isConnected) {
      lastTrigger.focus({ preventScroll: true });
    }
    lastTrigger = null;
  });

  $("confirm-quit").addEventListener("click", () => {
    const destination = $("quit-dialog").dataset.destination;
    const dashboardPage = pendingDashboardPage;
    pendingDashboardPage = null;

    quizActive = false;
    lastTrigger = null;
    $("quit-dialog").close();

    if (dashboardPage) {
      openDashboardPage(dashboardPage);
      return;
    }

    destination === "home"
      ? openHome()
      : openLevels(quizType);
  });

  $("next-question").addEventListener("click", () => {
    if (!answerLocked || !quizActive) return;

    questionIndex++;

    if (questionIndex >= questions.length) {
      finishLevel();
    } else {
      renderQuestion();
      $("answer-options").querySelector("button")?.focus();
    }
  });

 $("retry-level").addEventListener("click", () => {
  if (practiceMode) {
    startMistakePractice(true);
    return;
  }

  const index = QUIZZES[quizType].levels.indexOf(currentLevel);
  startLevel(index);
});

  $("next-level").addEventListener("click", () => {
    const index = QUIZZES[quizType].levels.indexOf(currentLevel);
    const next = index + 1;

    if (next < QUIZZES[quizType].levels.length) {
      startLevel(next);
    }
  });

  $("results-levels").addEventListener("click", () => {
    openLevels(quizType);
  });

  $("results-home").addEventListener("click", openHome);
}

try {
  validateQuestions();
  loadProgress();
  bindEvents();
  openHome();
} catch (error) {
  console.error(error);
  notify(error.message);

  for (const button of document.querySelectorAll("[data-quiz]")) {
    button.disabled = true;
  }
}

$("open-guide").addEventListener("click", () => {
  $("guide-dialog").showModal();
  $("close-guide").focus();
});

$("close-guide").addEventListener("click", () => {
  $("guide-dialog").close();
});
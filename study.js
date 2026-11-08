"use strict";

const LEARNING_KEY = "japanquiz-learning-v1";

let learning = {
  favorites: [],
  mistakes: []
};

let learningCanSave = true;
let practiceMode = false;
let practiceBatch = [];
let studyView = null;
let reviewKind = "mistakes";

let questionTimer = null;
let timerDeadline = 0;
let timerRemaining = 0;

// Save IDs instead of copies of questions.
// Shuffled answer choices do not change these IDs.
function studyKey(type, question) {
  return JSON.stringify([
    type,
    question.word,
    question.answer
  ]);
}

function loadLearning() {
  try {
    const raw = localStorage.getItem(LEARNING_KEY);
    if (raw === null) return;

    const parsed = JSON.parse(raw);

    if (!parsed ||
        !Array.isArray(parsed.favorites) ||
        !Array.isArray(parsed.mistakes) ||
        !parsed.favorites.every((id) => typeof id === "string") ||
        !parsed.mistakes.every((id) => typeof id === "string")) {
      throw new Error("Invalid learning data");
    }

    learning = {
      favorites: [...new Set(parsed.favorites)],
      mistakes: [...new Set(parsed.mistakes)]
    };
  } catch (error) {
    learningCanSave = false;
    console.error(error);
    notify(t("learningLoadFail"));
  }
}

function saveLearning(next) {
  if (!learningCanSave) {
    notify(t("learningSaveBlocked"));
    return false;
  }

  try {
    localStorage.setItem(
      LEARNING_KEY,
      JSON.stringify(next)
    );

    learning = next;
    return true;
  } catch {
    notify(t("learningSaveFail"));
    return false;
  }
}

function quizStudyItems(type) {
  const unique = new Map();

  for (const level of QUIZZES[type].levels) {
    for (const question of level.questions) {
      const key = studyKey(type, question);

      if (!unique.has(key)) {
        unique.set(key, { key, question, level });
      }
    }
  }

  return [...unique.values()];
}

function savedStudyItems(kind) {
  const saved = new Set(learning[kind]);

  return quizStudyItems(quizType).filter(
    (item) => saved.has(item.key)
  );
}

function rememberAnswer(question, correct) {
  const key = studyKey(quizType, question);
  const mistakes = new Set(learning.mistakes);

  // A correct answer removes the word from the mistakes list.
  if (correct) {
    mistakes.delete(key);
  } else {
    mistakes.add(key);
  }

  if (mistakes.has(key) === learning.mistakes.includes(key)) {
    return;
  }

  saveLearning({
    favorites: [...learning.favorites],
    mistakes: [...mistakes]
  });
}

function isFavorite(question) {
  return learning.favorites.includes(
    studyKey(quizType, question)
  );
}

function favoriteLabel(question) {
  return t(isFavorite(question) ? "savedWord" : "saveWord");
}

function toggleFavorite(question) {
  const key = studyKey(quizType, question);
  const favorites = new Set(learning.favorites);

  if (favorites.has(key)) {
    favorites.delete(key);
  } else {
    favorites.add(key);
  }

  return saveLearning({
    favorites: [...favorites],
    mistakes: [...learning.mistakes]
  });
}

function updateFavoriteButton(question) {
  const button = $("favorite-question");

  button.textContent = favoriteLabel(question);
  button.setAttribute(
    "aria-pressed",
    String(isFavorite(question))
  );
}

function updateStudyButtons() {
  const mistakeCount = savedStudyItems("mistakes").length;
  const favoriteCount = savedStudyItems("favorites").length;

  $("practice-mistakes").textContent = t("practiceMistakes", {
    count: mistakeCount
  });

  $("practice-mistakes").disabled = mistakeCount === 0;

  $("open-favorites").textContent = t("favoritesCount", {
    count: favoriteCount
  });
}

function appendStudyWord(container, question, level) {
  const card = makeElement(
    "article",
    undefined,
    "study-word-card"
  );

  const word = makeElement(
    "h2",
    question.word,
    "study-word"
  );

  word.lang = "ja";
  card.append(word);

  if (quizType.endsWith("-kanji")) {
    const reading = makeElement(
      "p",
      t("reading", { value: question.answer }),
      "study-reading"
    );

    reading.lang = "ja";
    card.append(reading);

    if (question.meaning) {
      card.append(
        makeElement(
          "p",
          t("meaning", { value: question.meaning })
        )
      );
    }
  } else {
    card.append(
      makeElement(
        "p",
        t("meaning", { value: question.answer })
      )
    );
  }

  card.append(
    makeElement(
      "p",
      t("levelMeta", { id: level.id, title: level.title }),
      "study-level"
    )
  );

  const favorite = makeElement(
    "button",
    favoriteLabel(question),
    "secondary-button favorite-button"
  );

  favorite.type = "button";
  favorite.setAttribute(
    "aria-pressed",
    String(isFavorite(question))
  );

  favorite.addEventListener("click", () => {
    if (!toggleFavorite(question)) return;

    if (studyView.kind === "favorites") {
      renderStudyList();
    } else {
      favorite.textContent = favoriteLabel(question);
      favorite.setAttribute(
        "aria-pressed",
        String(isFavorite(question))
      );
    }

    updateStudyButtons();
  });

  card.append(favorite);
  container.append(card);
}

function renderStudyList() {
  $("study-category").textContent = quizLabel(quizType);
  const list = $("study-list");
  list.replaceChildren();

  let items;

  if (studyView.kind === "favorites") {
    $("study-title").textContent = t("favoriteWords");
    $("study-description").textContent = t("favoriteDesc");

    items = savedStudyItems("favorites");
  } else {
    const level = QUIZZES[quizType].levels[
      studyView.levelIndex
    ];

    $("study-title").textContent = t("wordListTitle", {
      id: level.id
    });

    $("study-description").textContent = t("wordListDesc");

    items = level.questions.map((question) => ({
      question,
      level
    }));
  }

  if (items.length === 0) {
    list.append(
      makeElement(
        "p",
        t("noSaved")
      )
    );
    return;
  }

  for (const item of items) {
    appendStudyWord(
      list,
      item.question,
      item.level
    );
  }
}

function openWordList(levelIndex) {
  if (!levelUnlocked(quizType, levelIndex)) return;

  studyView = {
    kind: "level",
    levelIndex
  };

  renderStudyList();
  showScreen("study-screen");
}

function startMistakePractice(repeat = false) {
      if (!repeat) {
    reviewKind = "mistakes";
  }
  const source = repeat
    ? practiceBatch
    : savedStudyItems("mistakes").map(
        (item) => item.question
      );

  if (source.length === 0) {
    notify(t("noMistakes"));
    return;
  }

  practiceMode = true;
  practiceBatch = shuffle(source).slice(0, 10);
  questions = [...practiceBatch];

  questionIndex = 0;
  answers = [];
  answerLocked = false;
  quizActive = true;

 $("quiz-level-label").textContent = t("practiceHeading", {
    name: quizLabel(quizType),
    mode: t(
      reviewKind === "mixed" ? "mixedReview" : "mistakePractice"
    )
  });

  showScreen("quiz-screen");
  renderQuestion();
}

function finishMistakePractice() {
  quizActive = false;

  const correctCount = answers.filter(
    (answer) => answer.correct
  ).length;

  const remaining = savedStudyItems("mistakes").length;

  lastResult = {
    icon: correctCount === questions.length ? "🎉" : "💪",
    titleKey: reviewKind === "mixed" ? "mixedDone" : "mistakeDone",
    summaryKey: "practiceSummary",
    summaryVars: {
      correct: correctCount,
      total: questions.length
    },
    pointsKey: "practicePoints",
    pointsVars: { n: correctCount * 10 },
    unlockKey: reviewKind === "mixed" ? "mixedUnlock" : "mistakeUnlock",
    unlockVars: { n: remaining },
    showNext: false,
    detailed: false,
    mistakes: answers.filter((answer) => !answer.correct)
  };

  paintResults();
  showScreen("results-screen");
}

loadLearning();

$("favorite-question").addEventListener("click", () => {
  if (!quizActive) return;

  const question = questions[questionIndex];

  if (toggleFavorite(question)) {
    updateFavoriteButton(question);
  }
});

$("practice-mistakes").addEventListener("click", () => {
  startMistakePractice();
});

$("open-favorites").addEventListener("click", () => {
  studyView = { kind: "favorites" };
  renderStudyList();
  showScreen("study-screen");
});

$("study-back").addEventListener("click", () => {
  openLevels(quizType);
});

// MIXED REVIEW
function startMixedReview() {
  const unique = new Map();

  QUIZZES[quizType].levels.forEach((level, index) => {
    if (!levelUnlocked(quizType, index)) return;

    for (const question of level.questions) {
      unique.set(
        studyKey(quizType, question),
        question
      );
    }
  });

  if (unique.size === 0) {
    notify(t("noUnlocked"));
    return;
  }

  reviewKind = "mixed";
  practiceBatch = [...unique.values()];

  // Reuse practice mode without affecting level progress.
  startMistakePractice(true);
}

$("mixed-review").addEventListener(
  "click",
  startMixedReview
);

// OPTIONAL QUESTION TIMER
function selectedTimerSeconds() {
  const seconds = Number($("timer-setting").value);

return [0, 5, 10, 15].includes(seconds)
    ? seconds
    : 0;
}

function stopQuestionTimer() {
  if (questionTimer !== null) {
    clearInterval(questionTimer);
    questionTimer = null;
  }
}

function paintQuestionTimer() {
  const seconds = Math.max(
    0,
    Math.ceil(timerRemaining / 1000)
  );

  $("question-timer").textContent = t("timerValue", { n: seconds });
  $("question-timer").classList.toggle(
    "timer-warning",
    seconds <= 5
  );
}

function runQuestionTimer() {
  stopQuestionTimer();

  if (!quizActive ||
      answerLocked ||
      $("quiz-screen").hidden ||
      document.hidden ||
      $("quit-dialog").open ||
      timerRemaining <= 0) {
    return;
  }

  timerDeadline = performance.now() + timerRemaining;
  paintQuestionTimer();

  questionTimer = setInterval(() => {
    if (!quizActive ||
        answerLocked ||
        $("quiz-screen").hidden) {
      stopQuestionTimer();
      return;
    }

    timerRemaining = Math.max(
      0,
      timerDeadline - performance.now()
    );

    paintQuestionTimer();

    if (timerRemaining <= 0) {
      stopQuestionTimer();
      $("question-timer").textContent = `⏱️ ${t("timeExpired")}`;

      // No answer was selected.
      chooseAnswer(TIME_EXPIRED, null);
    }
  }, 100);
}

function startQuestionTimer() {
  stopQuestionTimer();

  const seconds = selectedTimerSeconds();

  timerRemaining = seconds * 1000;
  $("question-timer").hidden = seconds === 0;
  $("question-timer").classList.remove("timer-warning");

  if (seconds > 0) {
    paintQuestionTimer();
    runQuestionTimer();
  }
}

function pauseQuestionTimer() {
  if (questionTimer === null) return;

  timerRemaining = Math.max(
    0,
    timerDeadline - performance.now()
  );

  stopQuestionTimer();
}

// Pause when the user switches apps or browser tabs.
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    pauseQuestionTimer();
  } else {
    runQuestionTimer();
  }
});

// Resume after cancelling the Leave Quiz popup.
// If the user leaves the quiz, quizActive is already false.
$("quit-dialog").addEventListener("close", () => {
  runQuestionTimer();
});
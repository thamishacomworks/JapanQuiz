"use strict";

let scoreRequest = 0;

const SCORE_EXAMS = ["n5", "n4", "n3", "n2"];

let scoreView = {
  exam: null,
  rows: [],
  statusKey: "",
  statusVars: null
};

function playerDisplayName(user) {
  const meta = user?.user_metadata || {};
  const raw = meta.full_name || meta.name || user?.email || "Player";

  return String(raw).replace(/\s+/g, " ").trim().slice(0, 40) || "Player";
}

function fillScoreList(list, rows) {
  list.replaceChildren();

  rows.forEach((row, index) => {
    const item = document.createElement("li");
    item.className = "score-row";

    if (quizAuthUser && row.user_id === quizAuthUser.id) {
      item.classList.add("mine");
    }

    item.append(
      makeElement("span", String(index + 1), "score-rank"),
      makeElement("span", row.player_name, "score-name"),
      makeElement("span", t("points", { n: row.score }), "score-value")
    );

    list.append(item);
  });
}

function scoreStatusText() {
  const parts = [];

  if (scoreView.statusKey) {
    parts.push(t(scoreView.statusKey, scoreView.statusVars || undefined));
  }

  if (
    !quizAuthUser &&
    scoreView.statusKey !== "scoresLoading" &&
    scoreView.statusKey !== "scoresUnavailable"
  ) {
    parts.push(t("scoresSignIn"));
  }

  return parts.filter(Boolean).join(" ");
}

function renderActiveScores() {
  const text = scoreStatusText();

  const examLabel = scoreView.exam
    ? t("examScores", { exam: scoreView.exam.toUpperCase() })
    : "";

  if ($("scores-section") && !$("results-screen").hidden && lastResult?.showScores) {
    $("scores-section").hidden = false;
    $("scores-exam-label").textContent = examLabel;
    $("scores-status").textContent = text;
    fillScoreList($("scores-list"), scoreView.rows);
  }

  if ($("dashboard-scores-screen") && !$("dashboard-scores-screen").hidden) {
    $("dashboard-scores-status").textContent = text;
    fillScoreList($("dashboard-scores-list"), scoreView.rows);
  }
}

async function fetchExamScores(exam) {
  if (!quizAuthClient) {
    throw new Error("Supabase is not ready");
  }

  const { data, error } = await quizAuthClient
    .from("level_scores")
    .select("user_id, player_name, score, updated_at")
    .in("quiz_key", [`${exam}-hiragana`, `${exam}-kanji`])
    .limit(10000);

  if (error) throw error;

  const totals = new Map();

  for (const row of data || []) {
    const current = totals.get(row.user_id) || {
      user_id: row.user_id,
      player_name: row.player_name,
      score: 0,
      updated_at: row.updated_at || ""
    };

    current.score += row.score;

    if (String(row.updated_at || "") >= current.updated_at) {
      current.updated_at = String(row.updated_at || "");
      current.player_name = row.player_name;
    }

    totals.set(row.user_id, current);
  }

  return [...totals.values()]
    .sort((a, b) =>
      b.score - a.score ||
      a.updated_at.localeCompare(b.updated_at)
    )
    .slice(0, 5);
}

async function saveBestScore(quizKey, levelId, score) {
  const user = quizAuthUser;
  if (!user || !quizAuthClient) return;

  const existing = await quizAuthClient
    .from("level_scores")
    .select("score")
    .eq("user_id", user.id)
    .eq("quiz_key", quizKey)
    .eq("level_id", levelId)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data && existing.data.score >= score) return;

  const { error } = await quizAuthClient.from("level_scores").upsert({
    user_id: user.id,
    quiz_key: quizKey,
    level_id: levelId,
    player_name: playerDisplayName(user),
    score,
    updated_at: new Date().toISOString()
  });

  if (error) throw error;
}

async function loadExamScores(exam, saveInfo) {
  const request = ++scoreRequest;

  scoreView = {
    exam,
    rows: [],
    statusKey: "scoresLoading",
    statusVars: null
  };
  renderActiveScores();

  try {
    if (saveInfo && Number.isInteger(saveInfo.score)) {
      await saveBestScore(saveInfo.quizKey, saveInfo.levelId, saveInfo.score);
    }

    const rows = await fetchExamScores(exam);
    if (request !== scoreRequest) return;

    scoreView.rows = rows;
    scoreView.statusKey = rows.length ? "" : "scoresEmpty";
  } catch (error) {
    console.error(error);
    if (request !== scoreRequest) return;

    scoreView.rows = [];
    scoreView.statusKey = "scoresUnavailable";
  }

  renderActiveScores();
}

function showHighScorePage() {
  const select = $("scores-exam-select");
  const previous = select.value;

  select.replaceChildren();

  for (const exam of SCORE_EXAMS) {
    const option = document.createElement("option");
    option.value = exam;
    option.textContent = exam.toUpperCase();
    select.append(option);
  }

  const savedExam = String(dashboardData.last?.quiz || "").split("-")[0];
  const fallback = SCORE_EXAMS.includes(savedExam)
    ? savedExam
    : (SCORE_EXAMS.includes(selectedExam) ? selectedExam : "n5");
  const exam = SCORE_EXAMS.includes(previous) ? previous : fallback;

  select.value = exam;

  if (scoreView.exam === exam && scoreView.statusKey !== "scoresLoading") {
    renderActiveScores();
  } else {
    loadExamScores(exam);
  }
}

$("scores-exam-select").addEventListener("change", () => {
  loadExamScores($("scores-exam-select").value);
});

document.addEventListener("japanquiz-lang", () => {
  if (scoreView.exam) renderActiveScores();
});

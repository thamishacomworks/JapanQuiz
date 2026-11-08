"use strict";

// Project URL only. Do not add /rest/v1/ or /auth/v1/.
const QUIZ_SUPABASE_URL =
  "https://yxhmgiguwgmynmlmqjvn.supabase.co";

const QUIZ_SUPABASE_PUBLIC_KEY =
  "sb_publishable_qJBRVkKz0QOH2fHfuljN-w_qPDzjBa3";

// Login returns to your published quiz app.
const QUIZ_LOGIN_REDIRECT =
  "https://japan-quize.netlify.app/";

let quizAuthClient = null;
let quizAuthUser = null;
let authInitialized = false;
let guestSelected = false;

let authMessageKey = "";

function authMessage(key) {
  authMessageKey = key || "";
  $("auth-message").textContent = key ? t(key) : "";
}

function openAuthDialog() {
  if (!$("auth-dialog").open) {
    $("auth-dialog").showModal();
  }
}

function closeAuthDialog() {
  if ($("auth-dialog").open) {
    $("auth-dialog").close();
  }
}

function renderAccount(user) {
  quizAuthUser = user;

  $("account-name").textContent = user
    ? (
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        t("signedIn")
      )
    : t("guest");

  $("open-login").hidden = Boolean(user);
  $("sign-out").hidden = !user;
}

$("open-login").addEventListener("click", () => {
  if (quizActive) {
    notify(t("authBusyQuiz"));
    return;
  }

  authMessage("");
  openAuthDialog();
});

$("guest-login").addEventListener("click", () => {
  guestSelected = true;
  closeAuthDialog();
  notify("");
  openHome();
});

// Escape also lets the user continue as a guest.
$("auth-dialog").addEventListener("cancel", () => {
  guestSelected = true;
});

$("google-login").addEventListener("click", async () => {
  if (!quizAuthClient) {
    authMessage("authGoogleNotReady");
    return;
  }

  if (!navigator.onLine) {
    authMessage("authOffline");
    return;
  }

  $("google-login").disabled = true;
  authMessage("authOpening");

  try {
    const { error } = await quizAuthClient.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: QUIZ_LOGIN_REDIRECT
      }
    });

    if (error) throw error;
  } catch (error) {
    console.error(error);
    authMessage("authGoogleFailed");
    $("google-login").disabled = false;
  }
});

$("sign-out").addEventListener("click", async () => {
  if (!quizAuthClient) return;

  if (quizActive) {
    notify(t("authSignOutBusy"));
    return;
  }

  $("sign-out").disabled = true;

  try {
    const { error } = await quizAuthClient.auth.signOut({
      scope: "local"
    });

    if (error) throw error;

    guestSelected = false;
    renderAccount(null);

    authMessage("authSignedOut");
    openHome();
    openAuthDialog();
  } catch (error) {
    console.error(error);
    notify(t("authSignOutFailed"));
  } finally {
    $("sign-out").disabled = false;
  }
});

function initializeQuizAuth() {
  const configMissing =
    QUIZ_SUPABASE_URL.includes("PASTE_") ||
    QUIZ_SUPABASE_PUBLIC_KEY.includes("PASTE_");

  if (configMissing) {
    $("google-login").disabled = true;

    authMessage("authConfigMissing");

    openAuthDialog();
    return;
  }

  if (!window.supabase) {
    $("google-login").disabled = true;

    authMessage("authServiceMissing");

    openAuthDialog();
    return;
  }

  try {
    quizAuthClient = window.supabase.createClient(
      QUIZ_SUPABASE_URL,
      QUIZ_SUPABASE_PUBLIC_KEY
    );

    quizAuthClient.auth.onAuthStateChange((event, session) => {
      const user = session?.user || null;
      renderAccount(user);

      if (event === "INITIAL_SESSION" && !authInitialized) {
        authInitialized = true;

        if (user) {
          closeAuthDialog();
        } else if (!guestSelected) {
          openAuthDialog();
        }
      }

      if (event === "SIGNED_IN") {
        guestSelected = false;
        $("google-login").disabled = false;

        if ($("auth-dialog").open) {
          closeAuthDialog();
          openHome();
        }

        authMessage("");
      }

      if (event === "SIGNED_OUT") {
        renderAccount(null);
      }
    });
  } catch (error) {
    console.error(error);
    $("google-login").disabled = true;
    authMessage("authInitFailed");
    openAuthDialog();
  }
}

renderAccount(null);
initializeQuizAuth();

document.addEventListener("japanquiz-lang", () => {
  renderAccount(quizAuthUser);

  if (authMessageKey) {
    $("auth-message").textContent = t(authMessageKey);
  }
});
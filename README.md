# JapanQuiz 🇯🇵

**Learn. Play. Level up.**

A Japanese vocabulary and Kanji practice web app for learners studying JLPT N5, N4, N3, and N2. Practice with Sinhala meanings, switch between English and Sinhala, and build your knowledge one quiz at a time.

[Visit JapanQuiz](https://japan-quize.netlify.app/)

## Features

- **JLPT N5–N2 practice** — Hiragana vocabulary and Kanji question sets for four JLPT levels.
- **Progressive quizzes** — Answer 10 questions and score at least 7 to unlock the next quiz level.
- **English and Sinhala interface** — Switch languages from the header.
- **Review and practice** — Revisit mistakes and save favorite words.
- **Learning dashboard** — Track daily activity and choose a daily goal of 10, 20, or 30 answers.
- **Saved progress** — Keep quiz progress, favorites, mistakes, and dashboard activity in your browser.
- **Guest access** — Start learning without creating an account.
- **Google sign-in and high scores** — Use Supabase authentication and store signed-in players’ best scores.

## How to Play

1. Choose a JLPT level: N5, N4, N3, or N2.
2. Select Hiragana or Kanji.
3. Open an available quiz level and answer its 10 questions.
4. Get at least 7 correct answers to unlock the next level.
5. Review mistakes and favorite words to keep practicing.

## Built With

- HTML5
- CSS3
- Vanilla JavaScript
- Browser Local Storage
- Supabase Auth and PostgreSQL
- Netlify hosting

## Run Locally

Clone the repository:

```bash
git clone https://github.com/thamishacomworks/JapanQuiz.git
cd JapanQuiz
```

Serve the folder with a local static server, such as VS Code’s Live Server extension, and open the provided local URL. No frontend build step or package installation is required.

An internet connection is needed for the Supabase JavaScript library, Google sign-in, and online high scores.

### Set Up Your Own Supabase Project

To use authentication and high scores with your own deployment:

1. Create a Supabase project.
2. Run `supabase/level_scores.sql` in its SQL editor to create the score table and access policies.
3. Enable and configure Google sign-in in Supabase Authentication.
4. Update these values in `auth.js`:
   - `QUIZ_SUPABASE_URL`: your Supabase project URL.
   - `QUIZ_SUPABASE_PUBLIC_KEY`: your public/publishable client key.
   - `QUIZ_LOGIN_REDIRECT`: your app’s local or deployed URL.
5. Add your app’s redirect URL to the allowed redirect URLs in Supabase Authentication.

Use a public/publishable key in the browser. Never put a Supabase service-role key in frontend files.

## Project Structure

```text
JapanQuiz/
├── index.html           # Main app page
├── style.css            # App styles
├── app.js               # Quiz flow and browser progress
├── i18n.js              # English and Sinhala translations
├── study.js             # Favorites, mistakes, and practice
├── dashboard.js         # Learning activity and daily goals
├── auth.js              # Supabase authentication
├── scores.js            # Online high scores
├── questions/           # Hiragana and Kanji questions for N5–N2
└── supabase/
    └── level_scores.sql # Score table and access policies
```

## Deploy

Deploy this folder as a static site on Netlify. No build command is required; publish the folder containing `index.html`.

For your own deployment, update the login redirect in `auth.js`, the allowed redirect URLs in Supabase, and the site URL metadata in `index.html`.

## Data Storage

Quiz progress, favorites, mistakes, and dashboard activity are stored locally in the current browser. Clearing browser site data removes that information. Signing in enables online score storage; it does not automatically sync all local learning data across devices.

## Feedback

Found a problem or have an idea? [Open an issue](https://github.com/thamishacomworks/JapanQuiz/issues).





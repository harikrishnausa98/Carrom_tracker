# 🏆 Innova Carrom Tracker - Features Overview

Welcome to the **Innova Carrom Tracker**, a real-time web application built to manage carrom games, track player statistics, and handle room queueing. Below is a comprehensive list of all features currently available in the application.

---

## 🎮 Match Tracking & Gameplay
*   **Record Matches:** Log game results easily for both **Singles (1v1)** and **Doubles (2v2)** formats.
*   **Smart Auto-Complete:** When entering player names, the system provides a dropdown suggestion of all previously recorded players, making logging fast and preventing typos.
*   **Quick Undo:** After submitting a match, a toast notification appears for 60 seconds allowing you to instantly "Undo" the submission if a mistake was made.
*   **Recent Matches Feed:** Displays a live feed of the 5 most recently played matches with scores and dates.

## 📊 Leaderboards & Statistics
*   **Top Champions Dashboard:** The Home page instantly highlights the top-performing Singles player and the top-performing Doubles team.
*   **Dynamic Leaderboards:** View ranked standings categorized by Singles or Doubles. 
*   **Head-to-Head (Versus) Stats:** See direct matchup statistics to see who historically wins between specific players or teams.
*   **Advanced Player Metrics:** The Player Profiles and Leaderboards track comprehensive data:
    *   **Win/Loss Ratio & Total Matches:** General game data per player.
    *   **Form:** Displays the results of a player's last 5 matches (e.g., `W-W-L-W-L`).
    *   **Streaks:** Tracks active winning or losing streaks (e.g., 🔥 5W or 🧊 2L).
    *   **High Scores:** Tracks the highest score achieved by each player.

## 🚪 Live Room Management & LFG (Looking for Game)
*   **Live Room Status:** A real-time toggle that displays whether the carrom room is currently "🟢 Available" or "🔴 Occupied".
*   **Waiting Queue (LFG):** Players can join a waiting list if the room is occupied. 
*   **Wait Timers:** The queue displays exactly how many minutes each player has been waiting.
*   **Browser Notifications:** If you are in the waiting queue and the room status changes to "🟢 Available", you will automatically receive a desktop browser notification letting you know it is your turn!

## 👤 Player Identity & Engagement
*   **Identify Yourself:** Players can securely log in using a pseudo-authentication system by identifying their name.
*   **Today's Logins:** The system tracks which players are active in the office or on the app today.
*   **Dialogue Ticker:** A fun, scrolling left-hand ticker that displays custom dialogues or announcements fetched dynamically from `dialogues.json`.

## ⚙️ Admin & Data Management
*   **Secure Admin Login:** Password-protected portal to manage raw app data (password pulled securely from `config.json`).
*   **Edit Match History:** Admins can edit historical matches (e.g., fixing incorrect scores or wrong player names).
*   **Delete/Reset Data:** Admins can delete specific mistaken matches, or execute a master reset to wipe all historical match data for a new season.
*   **Daily Analytics:** Admins can see exactly who logged in today (with timestamps) and who played matches today.
*   **Data Export (CSV):** Export match history to a `.csv` file filtered by a specific start and end date for offline analysis or company reporting.

## 🎨 UI & Customization
*   **Dark Mode:** A responsive Dark Mode/Light Mode toggle. Preferences are saved automatically to the browser's local storage so it remembers your choice for your next visit.
*   **Mobile-Friendly Sidebar:** A responsive sliding navigation drawer for seamlessly moving between the Dashboard, Leaderboards, and Profiles on mobile devices.
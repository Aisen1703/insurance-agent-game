// Состояние игры
let currentCaseIndex = 0;
let currentClientIndex = 0;
let totalScore = 0;
let correctAnswers = 0;
let wrongAnswers = 0;
let currentStreak = 0;
let gameCompleted = false;
let playerName = localStorage.getItem('playerName') || '';

const TOTAL_POSSIBLE_SCORE = 140;
const TOTAL_CLIENTS = 14;

// Элементы DOM
const gameArea = document.getElementById('game-area');
const scoreSpan = document.getElementById('score');
const ratingSpan = document.getElementById('rating');
const clientsServedSpan = document.getElementById('clients-served');
const successRateSpan = document.getElementById('success-rate');
const correctCountSpan = document.getElementById('correct-count');
const wrongCountSpan = document.getElementById('wrong-count');
const streakSpan = document.getElementById('streak');
const clientsDoneSpan = document.getElementById('clients-done');
const totalClientsSpan = document.getElementById('total-clients');
const progressPercentSpan = document.getElementById('progress-percent');
const playerNameDisplay = document.getElementById('player-name-display');
const resetBtn = document.getElementById('reset-btn');
const saveBtn = document.getElementById('save-btn');

totalClientsSpan.textContent = TOTAL_CLIENTS;

// Обновление статистики
function updateStats() {
    scoreSpan.textContent = totalScore;
    clientsServedSpan.textContent = correctAnswers + wrongAnswers;
    correctCountSpan.textContent = correctAnswers;
    wrongCountSpan.textContent = wrongAnswers;
    streakSpan.textContent = currentStreak;
    
    const totalAnswered = correctAnswers + wrongAnswers;
    const successRate = totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0;
    successRateSpan.textContent = successRate;
    
    // Рейтинг (0-5 звёзд)
    const rating = Math.min(5, Math.floor(totalScore / 28));
    ratingSpan.textContent = '★'.repeat(rating) + '☆'.repeat(5 - rating);
    
    // Прогресс
    const processed = correctAnswers + wrongAnswers;
    clientsDoneSpan.textContent = processed;
    const progressPercent = (processed / TOTAL_CLIENTS) * 100;
    progressPercentSpan.textContent = Math.round(progressPercent) + '%';
    
    // Обновляем круговой прогресс
    const progressCircle = document.querySelector('.progress-circle');
    if (progressCircle) {
        const angle = (processed / TOTAL_CLIENTS) * 360;
        progressCircle.style.background = `conic-gradient(#f39c12 ${angle}deg, #ecf0f1 ${angle}deg)`;
    }
}

// ========== КЛАСС ДЛЯ ТАБЛИЦЫ ЛИДЕРОВ ==========
class Leaderboard {
    static STORAGE_KEY = 'insurance_leaderboard_sim';
    
    static getAll() {
        const data = localStorage.getItem(this.STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    }
    
    static addScore(name, score) {
        const scores = this.getAll();
        scores.push({
            name: name,
            score: score,
            date: new Date().toISOString(),
            formattedDate: new Date().toLocaleString('ru-RU')
        });
        scores.sort((a, b) => b.score - a.score);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(scores.slice(0, 20)));
        return scores;
    }
    
    static getTop10() {
        return this.getAll().slice(0, 10);
    }
    
    static getRank(score) {
        const all = this.getAll();
        const rank = all.findIndex(entry => entry.score <= score) + 1;
        return rank || all.length + 1;
    }
    
    static renderMini() {
        const top5 = this.getAll().slice(0, 5);
        const container = document.getElementById('leaderboard-mini');
        if (!container) return;
        
        if (top5.length === 0) {
            container.innerHTML = '<div class="loading">Пока нет результатов</div>';
            return;
        }
        
        container.innerHTML = top5.map((entry, idx) => `
            <div class="leaderboard-mini-item ${entry.name === playerName ? 'current-user-mini' : ''}">
                <span class="rank">${idx + 1}</span>
                <span class="name">${this.escapeHtml(entry.name)}</span>
                <span class="score">${entry.score}</span>
            </div>
        `).join('');
    }
    
    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// ========== КЛАСС ДЛЯ СОХРАНЕНИЯ ПРОГРЕССА ==========
class GameSave {
    static STORAGE_KEY = 'insurance_game_save_sim';
    
    static save(state) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    }
    
    static load() {
        const data = localStorage.getItem(this.STORAGE_KEY);
        return data ? JSON.parse(data) : null;
    }
    
    static clear() {
        localStorage.removeItem(this.STORAGE_KEY);
    }
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

function getCurrentCase() {
    if (currentCaseIndex >= caseOrder.length) return null;
    return casesData[caseOrder[currentCaseIndex]];
}

function getCurrentClient() {
    const currentCase = getCurrentCase();
    if (!currentCase) return null;
    if (currentClientIndex >= currentCase.clients.length) return null;
    return currentCase.clients[currentClientIndex];
}

// ========== ОСНОВНАЯ ЛОГИКА ИГРЫ ==========
function initGame(loadSaved = true) {
    if (loadSaved) {
        const saved = GameSave.load();
        if (saved && !saved.gameCompleted && saved.caseOrder) {
            if (confirm('Найдено сохранение. Продолжить?')) {
                caseOrder.length = 0;
                saved.caseOrder.forEach(id => caseOrder.push(id));
                currentCaseIndex = saved.currentCaseIndex;
                currentClientIndex = saved.currentClientIndex;
                totalScore = saved.totalScore;
                correctAnswers = saved.correctAnswers || 0;
                wrongAnswers = saved.wrongAnswers || 0;
                currentStreak = saved.currentStreak || 0;
                gameCompleted = false;
                updateStats();
                loadCurrentClient();
                return;
            }
        }
    }
    
    shuffleCaseOrder();
    currentCaseIndex = 0;
    currentClientIndex = 0;
    totalScore = 0;
    correctAnswers = 0;
    wrongAnswers = 0;
    currentStreak = 0;
    gameCompleted = false;
    updateStats();
    
    if (!playerName) {
        askForName(() => loadCurrentClient());
    } else {
        playerNameDisplay.textContent = playerName;
        loadCurrentClient();
    }
}

function shuffleCaseOrder() {
    const allCaseIds = [1, 2, 3, 4, 5, 6];
    for (let i = allCaseIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allCaseIds[i], allCaseIds[j]] = [allCaseIds[j], allCaseIds[i]];
    }
    caseOrder.length = 0;
    allCaseIds.forEach(id => caseOrder.push(id));
}

function askForName(callback) {
    gameArea.innerHTML = `
        <div class="name-input-modal" style="position: relative; background: transparent; padding: 0;">
            <div class="name-input-content" style="max-width: 350px; margin: 0 auto;">
                <h2>👋 Добро пожаловать в симулятор!</h2>
                <p style="margin-bottom: 16px;">Введите имя страхового агента</p>
                <input type="text" id="player-name-input" class="name-input-field" placeholder="Ваше имя" maxlength="20">
                <button id="submit-name-btn" class="primary-btn">Начать работу →</button>
            </div>
        </div>
    `;
    
    const input = document.getElementById('player-name-input');
    const submitBtn = document.getElementById('submit-name-btn');
    
    submitBtn.onclick = () => {
        let name = input.value.trim();
        if (name === '') name = 'Агент ' + Math.floor(Math.random() * 1000);
        playerName = name;
        localStorage.setItem('playerName', playerName);
        playerNameDisplay.textContent = playerName;
        callback();
    };
    
    input.onkeypress = (e) => { if (e.key === 'Enter') submitBtn.click(); };
    input.focus();
}

function loadCurrentClient() {
    if (gameCompleted) return;
    
    if (currentCaseIndex >= caseOrder.length) {
        completeGame();
        return;
    }
    
    const currentCase = getCurrentCase();
    
    if (currentClientIndex >= currentCase.clients.length) {
        currentCaseIndex++;
        currentClientIndex = 0;
        saveGameProgress();
        loadCurrentClient();
        return;
    }
    
    const client = getCurrentClient();
    renderClientScreen(client, currentCase);
}

function renderClientScreen(client, currentCase) {
    const processed = correctAnswers + wrongAnswers;
    const caseNumber = currentCaseIndex + 1;
    const clientNumber = currentClientIndex + 1;
    const totalClientsInCase = currentCase.clients.length;
    
    gameArea.innerHTML = `
        <div class="client-card-sim">
            <div class="client-avatar-sim">
                <img src="${client.imageUrl || ''}" 
                     alt="${client.name}"
                     onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\"font-size: 4rem;\">${client.avatar}</div>'">
            </div>
            <h2 class="client-name-sim">${client.name}</h2>
            <div class="client-problem-sim">
                <strong>📢 Проблема клиента:</strong><br>
                "${client.problem}"
            </div>
            <div class="client-meta" style="margin: 10px 0; font-size: 0.85rem; color: #f39c12;">
                Кейс ${caseNumber}/${caseOrder.length} • Клиент ${clientNumber}/${totalClientsInCase}
            </div>
            <button class="help-btn-sim" id="help-client-btn">🤝 Помочь клиенту</button>
        </div>
    `;
    
    document.getElementById('help-client-btn').onclick = () => showDialog(client);
}

function showDialog(client) {
    const options = [client.correctChoice, ...client.wrongChoices].sort(() => Math.random() - 0.5);
    let answered = false;
    
    gameArea.innerHTML = `
        <div class="dialog-modal-sim">
            <div class="dialog-content-sim">
                <div class="client-avatar-dialog-sim">
                    <img src="${client.imageUrl || ''}" 
                         alt="${client.name}"
                         onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\"font-size: 4rem;\">${client.avatar}</div>'">
                </div>
                <h2 class="dialog-client-name-sim">${client.name}</h2>
                <div class="dialog-question-sim">
                    <strong>📋 Какой совет ты дашь клиенту?</strong>
                </div>
                <div class="dialog-options-sim">
                    ${options.map(opt => `
                        <button class="dialog-option-sim" data-option="${opt.replace(/'/g, '&#39;').replace(/"/g, '&quot;')}">${opt}</button>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    
    document.querySelectorAll('.dialog-option-sim').forEach(btn => {
        btn.onclick = () => {
            if (answered) return;
            answered = true;
            const chosen = btn.dataset.option;
            const isCorrect = (chosen === client.correctChoice);
            
            if (isCorrect) {
                totalScore += 10;
                correctAnswers++;
                currentStreak++;
            } else {
                wrongAnswers++;
                currentStreak = 0;
            }
            updateStats();
            
            const feedbackClass = isCorrect ? 'feedback-correct' : 'feedback-wrong';
            const feedbackMessage = isCorrect 
                ? `✅ Правильно! ${client.explanation}`
                : `❌ Не совсем. ${client.explanation}`;
            
            gameArea.innerHTML = `
                <div class="dialog-modal-sim">
                    <div class="dialog-content-sim">
                        <div class="client-avatar-dialog-sim">
                            <img src="${client.imageUrl || ''}" 
                                 alt="${client.name}"
                                 onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\"font-size: 4rem;\">${client.avatar}</div>'">
                        </div>
                        <div class="feedback-box-sim ${feedbackClass}">
                            ${feedbackMessage}
                        </div>
                        <button class="next-btn-sim" id="continue-btn">➡️ Следующий клиент</button>
                    </div>
                </div>
            `;
            
            document.getElementById('continue-btn').onclick = () => {
                currentClientIndex++;
                saveGameProgress();
                loadCurrentClient();
            };
        };
    });
}

function completeGame() {
    gameCompleted = true;
    GameSave.clear();
    Leaderboard.addScore(playerName, totalScore);
    Leaderboard.renderMini();
    
    const top10 = Leaderboard.getTop10();
    const rank = Leaderboard.getRank(totalScore);
    
    let emoji = '', message = '';
    if (totalScore === TOTAL_POSSIBLE_SCORE) {
        emoji = '🏆';
        message = 'Ты настоящий страховой гений! Все 14 клиентов довольны!';
    } else if (totalScore >= 110) {
        emoji = '🎉';
        message = 'Отличная работа! Ты помог почти всем клиентам!';
    } else if (totalScore >= 90) {
        emoji = '👍';
        message = 'Хороший результат! Ещё немного практики!';
    } else if (totalScore >= 70) {
        emoji = '📚';
        message = 'Неплохо, но стоит повторить основы страхования.';
    } else {
        emoji = '💪';
        message = 'Не сдавайся! Пройди симулятор ещё раз!';
    }
    
    gameArea.innerHTML = `
        <div class="results-card-sim">
            <div class="results-icon">${emoji}</div>
            <h2 class="results-title">🎉 Симуляция завершена! 🎉</h2>
            <div class="results-score-sim">${totalScore} / ${TOTAL_POSSIBLE_SCORE} очков</div>
            <div class="results-message-sim">
                <strong>${Leaderboard.escapeHtml(playerName)}</strong>, ${message}<br>
                📊 Успешно обслужено: ${correctAnswers} из ${TOTAL_CLIENTS} клиентов<br>
                🏅 Место: ${rank}-е из ${Leaderboard.getAll().length}
            </div>
            <div class="leaderboard-full">
                <h4>🏆 Доска лидеров</h4>
                <table class="leaderboard-table-sim">
                    <thead>
                        <tr><th>#</th><th>Игрок</th><th>Очки</th><th>Дата</th>\\
                    </thead>
                    <tbody>
                        ${top10.map((entry, i) => `
                            <tr class="${entry.name === playerName ? 'current-user' : ''}">
                                <td>${i + 1}</td>
                                <td>${Leaderboard.escapeHtml(entry.name)}</td>
                                <td><strong>${entry.score}</strong></td>
                                <td>${entry.formattedDate?.split(',')[0] || ''}</td>
                            </tr>
                        `).join('')}
                        ${top10.length === 0 ? '<tr><td colspan="4">Пока нет результатов. Стань первым!</td></tr>' : ''}
                    </tbody>
                 </table>
            </div>
            <div class="share-buttons-sim">
                <button class="share-btn-sim share-telegram-sim" id="share-telegram">📱 Telegram</button>
                <button class="share-btn-sim share-vk-sim" id="share-vk">🌐 VK</button>
                <button class="share-btn-sim share-copy-sim" id="share-copy">📋 Копировать</button>
            </div>
            <button class="play-again-btn-sim" id="play-again">🔄 Начать новую смену</button>
        </div>
    `;
    
    document.getElementById('play-again').onclick = () => initGame(false);
    document.getElementById('share-telegram').onclick = () => shareResult('telegram');
    document.getElementById('share-vk').onclick = () => shareResult('vk');
    document.getElementById('share-copy').onclick = () => shareResult('copy');
}

function shareResult(platform) {
    const text = `🏢 Я прошёл симулятор "Страховой агент" и набрал ${totalScore} из ${TOTAL_POSSIBLE_SCORE} очков! Попробуй и ты: `;
    const url = window.location.href;
    
    if (platform === 'telegram') {
        window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
    } else if (platform === 'vk') {
        window.open(`https://vk.com/share.php?url=${encodeURIComponent(url)}&title=Страховой агент&description=${encodeURIComponent(text)}`, '_blank');
    } else if (platform === 'copy') {
        navigator.clipboard.writeText(`${text} ${url}`).then(() => showToast('✅ Результат скопирован!'));
    }
}

function saveGameProgress() {
    if (!gameCompleted && (currentCaseIndex > 0 || currentClientIndex > 0)) {
        GameSave.save({
            caseOrder: [...caseOrder],
            currentCaseIndex: currentCaseIndex,
            currentClientIndex: currentClientIndex,
            totalScore: totalScore,
            correctAnswers: correctAnswers,
            wrongAnswers: wrongAnswers,
            currentStreak: currentStreak,
            gameCompleted: false
        });
        showToast('💾 Прогресс сохранён!');
    } else if (gameCompleted) {
        showToast('Игра уже завершена! Начните новую.');
    } else {
        showToast('Сначала начните игру!');
    }
}

// ========== ОБРАБОТЧИКИ КНОПОК ==========
resetBtn.onclick = () => {
    if (confirm('Начать новую смену? Весь прогресс будет потерян.')) {
        GameSave.clear();
        initGame(false);
    }
};

saveBtn.onclick = () => {
    if (!gameCompleted) {
        saveGameProgress();
    } else {
        showToast('Игра уже завершена! Начните новую.');
    }
};

// ========== ПЕРЕКЛЮЧЕНИЕ ТЁМНОЙ/СВЕТЛОЙ ТЕМЫ ==========
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        document.body.classList.remove('light-theme');
        const themeBtn = document.getElementById('theme-toggle');
        if (themeBtn) themeBtn.innerHTML = '☀️ Светлая тема';
    } else {
        document.body.classList.add('light-theme');
        document.body.classList.remove('dark-theme');
        const themeBtn = document.getElementById('theme-toggle');
        if (themeBtn) themeBtn.innerHTML = '🌙 Тёмная тема';
    }
}

function toggleTheme() {
    const themeBtn = document.getElementById('theme-toggle');
    if (document.body.classList.contains('dark-theme')) {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
        localStorage.setItem('theme', 'light');
        if (themeBtn) themeBtn.innerHTML = '🌙 Тёмная тема';
    } else {
        document.body.classList.remove('light-theme');
        document.body.classList.add('dark-theme');
        localStorage.setItem('theme', 'dark');
        if (themeBtn) themeBtn.innerHTML = '☀️ Светлая тема';
    }
}

// ========== ЗАПУСК ИГРЫ ==========
// Ждём загрузки DOM перед инициализацией
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
    initGame(true);
    Leaderboard.renderMini();
});
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
const TOTAL_CLIENTS = 7;
let caseOrder = [];

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
const tutorialBtn = document.getElementById('tutorial-btn');

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
    
    const rating = Math.min(5, Math.floor(totalScore / 28));
    ratingSpan.textContent = '★'.repeat(rating) + '☆'.repeat(5 - rating);
    
    const processed = correctAnswers + wrongAnswers;
    clientsDoneSpan.textContent = processed;
    const progressPercent = (processed / TOTAL_CLIENTS) * 100;
    progressPercentSpan.textContent = Math.round(progressPercent) + '%';
    
    const progressCircle = document.querySelector('.progress-circle');
    if (progressCircle) {
        const angle = (processed / TOTAL_CLIENTS) * 360;
        progressCircle.style.background = `conic-gradient(#f39c12 ${angle}deg, #ecf0f1 ${angle}deg)`;
    }
}

// ========== ТАБЛИЦА ЛИДЕРОВ ==========
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
        
        let html = '';
        for (let i = 0; i < top5.length; i++) {
            const entry = top5[i];
            const isCurrent = (entry.name === playerName);
            html += `
                <div class="leaderboard-mini-item ${isCurrent ? 'current-user-mini' : ''}">
                    <span class="rank">${i + 1}</span>
                    <span class="name">${this.escapeHtml(entry.name)}</span>
                    <span class="score">${entry.score}</span>
                </div>
            `;
        }
        container.innerHTML = html;
    }
    
    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// ========== СОХРАНЕНИЕ ПРОГРЕССА ==========
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

// ========== ТУТОРИАЛ ==========
function showTutorial() {
    const existing = document.querySelector('.tutorial-overlay');
    if (existing) existing.remove();
    
    const tutorialHTML = `
        <div class="tutorial-overlay" id="tutorial-overlay" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:20000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(4px);">
            <div style="background:white; border-radius:32px; max-width:550px; width:90%; max-height:80vh; overflow-y:auto; padding:28px 24px; box-shadow:0 25px 40px rgba(0,0,0,0.3); animation:fadeInUp 0.3s ease;">
                <h2 style="font-size:1.6rem; margin-bottom:16px; display:flex; align-items:center; gap:10px; border-bottom:2px solid #004DE5; padding-bottom:12px;">📚 Обучение страхового агента</h2>
                <div style="margin:20px 0; padding:12px; background:#f8f9fa; border-radius:20px; border-left:4px solid #80B2F2;"><strong style="color:#004DE5; display:block; margin-bottom:8px;">🎯 Очки и рейтинг</strong>За каждый правильный ответ ты получаешь <strong>10 очков</strong>. Чем больше очков, тем выше рейтинг (звёзды). Максимум — 5 звёзд.</div>
                <div style="margin:20px 0; padding:12px; background:#f8f9fa; border-radius:20px; border-left:4px solid #80B2F2;"><strong style="color:#004DE5; display:block; margin-bottom:8px;">📊 Панель статистики</strong>Слева вверху видно общее количество очков, рейтинг, число обслуженных клиентов и процент успеха.</div>
                <div style="margin:20px 0; padding:12px; background:#f8f9fa; border-radius:20px; border-left:4px solid #80B2F2;"><strong style="color:#004DE5; display:block; margin-bottom:8px;">📋 Сегодняшние показатели</strong>Здесь показано, сколько правильных и неправильных ответов ты дал за текущую сессию, а также текущая серия успехов.</div>
                <div style="margin:20px 0; padding:12px; background:#f8f9fa; border-radius:20px; border-left:4px solid #80B2F2;"><strong style="color:#004DE5; display:block; margin-bottom:8px;">👥 Клиент и его проблема</strong>В центре появляется клиент с описанием ситуации. Внимательно читай! Нажми «🤝 Помочь клиенту», чтобы дать совет.</div>
                <div style="margin:20px 0; padding:12px; background:#f8f9fa; border-radius:20px; border-left:4px solid #80B2F2;"><strong style="color:#004DE5; display:block; margin-bottom:8px;">💡 Варианты ответов</strong>После нажатия кнопки помощи откроется окно с вариантами страховок. Выбери подходящий. После ответа увидишь объяснение.</div>
                <div style="margin:20px 0; padding:12px; background:#f8f9fa; border-radius:20px; border-left:4px solid #80B2F2;"><strong style="color:#004DE5; display:block; margin-bottom:8px;">📈 Прогресс и управление</strong>Круглый индикатор показывает, сколько клиентов уже обслужено. Кнопки «Начать заново» сбросят игру, «Сохранить прогресс» сохранят текущее состояние.</div>
                <div style="margin:20px 0; padding:12px; background:#f8f9fa; border-radius:20px; border-left:4px solid #80B2F2;"><strong style="color:#004DE5; display:block; margin-bottom:8px;">🏆 Доска лидеров</strong>Твои лучшие результаты сохраняются. После завершения игры ты попадёшь в таблицу рекордов.</div>
                <button id="close-tutorial" style="background:linear-gradient(135deg,#004DE5,#80B2F2); color:white; border:none; padding:12px 24px; border-radius:60px; font-weight:bold; cursor:pointer; width:100%; margin-top:20px; font-size:1rem;">Понятно, начинаем!</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', tutorialHTML);
    const closeBtn = document.getElementById('close-tutorial');
    const overlay = document.getElementById('tutorial-overlay');
    closeBtn.onclick = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

// ========== ОСНОВНАЯ ЛОГИКА ==========
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
        askForName(() => {
            loadCurrentClient();
            if (!localStorage.getItem('tutorialShown')) {
                setTimeout(() => showTutorial(), 500);
                localStorage.setItem('tutorialShown', 'true');
            }
        });
    } else {
        playerNameDisplay.textContent = playerName;
        loadCurrentClient();
        if (!localStorage.getItem('tutorialShown')) {
            setTimeout(() => showTutorial(), 500);
            localStorage.setItem('tutorialShown', 'true');
        }
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
    const caseNumber = currentCaseIndex + 1;
    const clientNumber = currentClientIndex + 1;
    const totalClientsInCase = currentCase.clients.length;
    
    gameArea.innerHTML = `
        <div class="client-card-sim">
            <div class="client-avatar-sim">
                <img src="${client.imageUrl || ''}" alt="${client.name}" onerror="this.style.display='none'">
            </div>
            <h2 class="client-name-sim">${client.name}</h2>
            <div class="client-problem-sim">
                <strong>📢 Проблема клиента:</strong><br>
                "${client.problem}"
            </div>
            <div class="client-meta" style="margin: 10px 0; font-size: 0.85rem; color: #004DE5;">
                Кейс ${caseNumber}/${caseOrder.length} • Клиент ${clientNumber}/${totalClientsInCase}
            </div>
            <button class="help-btn-sim" id="help-client-btn">Помочь клиенту</button>
        </div>
    `;
    document.getElementById('help-client-btn').onclick = () => showDialog(client);
}

function showDialog(client) {
    const allOptions = [client.correctChoice, ...client.wrongChoices];
    const shuffledOptions = [...allOptions];
    for (let i = shuffledOptions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
    }
    let answered = false;
    const optionsHtml = shuffledOptions.map(opt => `
        <button class="dialog-option-sim" data-option="${opt.replace(/'/g, '&#39;').replace(/"/g, '&quot;')}">${opt}</button>
    `).join('');
    
    gameArea.innerHTML = `
        <div class="dialog-modal-sim">
            <div class="dialog-content-sim">
                <div class="client-avatar-dialog-sim">
                    <img src="${client.imageUrl || ''}" alt="${client.name}" onerror="this.style.display='none'">
                </div>
                <h2 class="dialog-client-name-sim">${client.name}</h2>
                <div class="dialog-question-sim">
                    <strong>📋 Какой совет ты дашь клиенту?</strong>
                </div>
                <div class="dialog-options-sim">
                    ${optionsHtml}
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
                            <img src="${client.imageUrl || ''}" alt="${client.name}" onerror="this.style.display='none'">
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
    
    let leaderboardRows = '';
    for (let i = 0; i < top10.length; i++) {
        const entry = top10[i];
        const rowClass = (entry.name === playerName) ? 'current-user' : '';
        leaderboardRows += `<tr class="${rowClass}"><td>${i+1}</td><td>${Leaderboard.escapeHtml(entry.name)}</td><td><strong>${entry.score}</strong></td><td>${entry.formattedDate ? entry.formattedDate.split(',')[0] : ''}</td></tr>`;
    }
    if (top10.length === 0) leaderboardRows = '<tr><td colspan="4">Пока нет результатов. Стань первым!</td></tr>';
    
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
                <table class="leaderboard-table-sim"><thead><tr><th>#</th><th>Игрок</th><th>Очки</th><th>Дата</th></tr></thead><tbody>${leaderboardRows}</tbody></table>
            </div>
            <div class="share-buttons-sim">
                <button class="share-btn-sim share-telegram-sim" id="share-telegram">📱 Telegram</button>
                <button class="share-btn-sim share-vk-sim" id="share-vk">🌐 VK</button>
                <button class="share-btn-sim share-copy-sim" id="share-copy">📋 Копировать</button>
            </div>
            <button class="play-again-btn-sim" id="play-again">🔄 Играть заново</button>
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
    if (platform === 'telegram') window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
    else if (platform === 'vk') window.open(`https://vk.com/share.php?url=${encodeURIComponent(url)}&title=Страховой агент&description=${encodeURIComponent(text)}`, '_blank');
    else if (platform === 'copy') navigator.clipboard.writeText(`${text} ${url}`).then(() => showToast('✅ Результат скопирован!'));
}

function saveGameProgress() {
    if (!gameCompleted && (currentCaseIndex > 0 || currentClientIndex > 0 || correctAnswers+wrongAnswers > 0)) {
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
    } else if (gameCompleted) showToast('Игра уже завершена! Начните новую.');
    else showToast('Сначала начните игру!');
}

resetBtn.onclick = () => {
    if (confirm('Начать новую смену? Весь прогресс будет потерян.')) {
        GameSave.clear();
        initGame(false);
    }
};
saveBtn.onclick = () => { if (!gameCompleted) saveGameProgress(); else showToast('Игра уже завершена! Начните новую.'); };
tutorialBtn.onclick = () => showTutorial();

// Тёмная тема
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        document.body.classList.remove('light-theme');
        document.getElementById('theme-toggle').innerHTML = '☀️ Светлая тема';
    } else {
        document.body.classList.add('light-theme');
        document.body.classList.remove('dark-theme');
        document.getElementById('theme-toggle').innerHTML = '🌙 Тёмная тема';
    }
}
function toggleTheme() {
    const btn = document.getElementById('theme-toggle');
    if (document.body.classList.contains('dark-theme')) {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
        localStorage.setItem('theme', 'light');
        btn.innerHTML = '🌙 Тёмная тема';
    } else {
        document.body.classList.remove('light-theme');
        document.body.classList.add('dark-theme');
        localStorage.setItem('theme', 'dark');
        btn.innerHTML = '☀️ Светлая тема';
    }
}
document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

// Запуск
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initGame(true);
    Leaderboard.renderMini();
});
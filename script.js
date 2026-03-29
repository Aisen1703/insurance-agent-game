// Состояние игры
let currentCaseIndex = 0;
let currentClientIndex = 0;
let totalScore = 0;
let gameCompleted = false;
let playerName = localStorage.getItem('playerName') || '';

const TOTAL_POSSIBLE_SCORE = 140; // 14 клиентов × 10 баллов

// Элементы DOM
const gameArea = document.getElementById('game-area');
const scoreSpan = document.getElementById('score');
const maxScoreSpan = document.getElementById('max-score');
const resetBtn = document.getElementById('reset-btn');
const saveBtn = document.getElementById('save-btn');

if (maxScoreSpan) {
    maxScoreSpan.textContent = `/ ${TOTAL_POSSIBLE_SCORE}`;
}

// ========== КЛАСС ДЛЯ ТАБЛИЦЫ ЛИДЕРОВ ==========
class Leaderboard {
    static STORAGE_KEY = 'insurance_leaderboard_v7';
    
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
        const topScores = scores.slice(0, 20);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(topScores));
        return topScores;
    }
    
    static getTop10() {
        return this.getAll().slice(0, 10);
    }
    
    static getRank(score) {
        const all = this.getAll();
        const rank = all.findIndex(entry => entry.score <= score) + 1;
        return rank || all.length + 1;
    }
}

// ========== КЛАСС ДЛЯ СОХРАНЕНИЯ ПРОГРЕССА ==========
class GameSave {
    static STORAGE_KEY = 'insurance_game_save_v7';
    
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
function showToast(message, duration = 2000) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
}

function updateScore() {
    scoreSpan.textContent = totalScore;
}

function getTotalClients() {
    let total = 0;
    for (let i = 0; i < caseOrder.length; i++) {
        const caseId = caseOrder[i];
        total += casesData[caseId].clients.length;
    }
    return total;
}

function getProcessedClients() {
    let processed = 0;
    for (let i = 0; i < currentCaseIndex; i++) {
        const caseId = caseOrder[i];
        processed += casesData[caseId].clients.length;
    }
    processed += currentClientIndex;
    return processed;
}

function getCurrentCase() {
    if (currentCaseIndex >= caseOrder.length) return null;
    const caseId = caseOrder[currentCaseIndex];
    return casesData[caseId];
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
            if (confirm('Найдено сохранение игры. Продолжить с того же места?')) {
                caseOrder.length = 0;
                saved.caseOrder.forEach(id => caseOrder.push(id));
                currentCaseIndex = saved.currentCaseIndex;
                currentClientIndex = saved.currentClientIndex;
                totalScore = saved.totalScore;
                gameCompleted = false;
                updateScore();
                loadCurrentClient();
                return;
            } else {
                GameSave.clear();
            }
        }
    }
    
    shuffleCaseOrder();
    
    currentCaseIndex = 0;
    currentClientIndex = 0;
    totalScore = 0;
    gameCompleted = false;
    updateScore();
    
    if (!playerName) {
        askForName(() => loadCurrentClient());
    } else {
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
        <div class="name-input-modal">
            <div class="name-input-content">
                <h2>👋 Добро пожаловать, страховой агент!</h2>
                <p style="margin-bottom: 16px; color: #666; font-size: 0.9rem;">Введите своё имя, чтобы попасть в таблицу лидеров</p>
                <input type="text" id="player-name-input" class="name-input-field" placeholder="Ваше имя" maxlength="20">
                <button id="submit-name-btn" class="primary-btn">Начать игру →</button>
            </div>
        </div>
    `;
    
    const input = document.getElementById('player-name-input');
    const submitBtn = document.getElementById('submit-name-btn');
    
    submitBtn.addEventListener('click', () => {
        let name = input.value.trim();
        if (name === '') {
            name = 'Агент ' + Math.floor(Math.random() * 1000);
        }
        playerName = name;
        localStorage.setItem('playerName', playerName);
        callback();
    });
    
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            submitBtn.click();
        }
    });
    
    input.focus();
}

function loadCurrentClient() {
    if (gameCompleted) return;
    
    // Проверяем, все ли кейсы пройдены
    if (currentCaseIndex >= caseOrder.length) {
        completeGame();
        return;
    }
    
    const currentCase = getCurrentCase();
    
    // Если все клиенты в текущем кейсе обработаны — переходим к следующему кейсу (без показа результата)
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
    const totalClients = getTotalClients();
    const processedClients = getProcessedClients();
    const progressPercent = (processedClients / totalClients) * 100;
    const caseNumber = currentCaseIndex + 1;
    const clientNumberInCase = currentClientIndex + 1;
    const totalClientsInCase = currentCase.clients.length;
    
    gameArea.innerHTML = `
        <div class="client-screen">
            <div class="progress-section">
                <div class="progress-bar-container">
                    <div class="progress-bar-fill" style="width: ${progressPercent}%;">
                        ${progressPercent > 15 ? `${Math.round(progressPercent)}%` : ''}
                    </div>
                </div>
                <div class="progress-stats">
                    <span>📋 Кейс ${caseNumber}/${caseOrder.length}: ${currentCase.title}</span>
                    <span>👥 Клиент ${clientNumberInCase}/${totalClientsInCase}</span>
                    <span>⭐ ${totalScore}/${TOTAL_POSSIBLE_SCORE}</span>
                </div>
            </div>
            
            <div class="client-card-large">
                <div class="client-avatar-large">
                    <img src="${client.imageUrl || ''}" 
                         alt="${client.name}"
                         class="client-large-img"
                         onerror="this.style.display='none'; this.parentElement.innerHTML='<div class=\"avatar-emoji-large\">${client.avatar}</div>'">
                </div>
                <h2 class="client-name-large">${client.name}</h2>
                <div class="client-problem-large">
                    <strong>📢 Проблема клиента:</strong><br>
                    "${client.problem}"
                </div>
                <button class="help-btn" id="help-client-btn">🤝 Помочь клиенту</button>
            </div>
        </div>
    `;
    
    document.getElementById('help-client-btn').addEventListener('click', () => {
        showDialog(client);
    });
}

// ========== ДИАЛОГ С БОЛЬШОЙ КАРТИНКОЙ СВЕРХУ И ВАРИАНТАМИ ВНИЗУ ==========
function showDialog(client) {
    const options = [client.correctChoice, ...client.wrongChoices].sort(() => Math.random() - 0.5);
    let answered = false;
    
    gameArea.innerHTML = `
        <div class="dialog-modal">
            <div class="dialog-content dialog-content-large">
                <!-- Большая картинка клиента сверху -->
                <div class="client-avatar-dialog-large">
                    <img src="${client.imageUrl || ''}" 
                         alt="${client.name}"
                         class="dialog-client-img-large"
                         onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\"font-size: 6rem; text-align: center;\">${client.avatar}</div>'">
                </div>
                
                <!-- Имя клиента -->
                <h2 class="dialog-client-name">${client.name}</h2>
                
                <!-- Вопрос -->
                <div class="dialog-question-large">
                    <strong>📋 Какой совет ты дашь клиенту?</strong>
                </div>
                
                <!-- Варианты ответов внизу -->
                <div class="dialog-options-large">
                    ${options.map(opt => `
                        <button class="dialog-option-large" data-option="${opt.replace(/'/g, '&#39;').replace(/"/g, '&quot;')}">${opt}</button>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    
    document.querySelectorAll('.dialog-option-large').forEach(btn => {
        btn.addEventListener('click', () => {
            if (answered) return;
            answered = true;
            const chosen = btn.dataset.option;
            const isCorrect = (chosen === client.correctChoice);
            
            if (isCorrect) {
                totalScore += 10;
                updateScore();
            }
            
            const feedbackClass = isCorrect ? 'feedback-correct' : 'feedback-wrong';
            const feedbackMessage = isCorrect 
                ? `✅ Правильно! ${client.explanation}`
                : `❌ Не совсем. ${client.explanation}`;
            
            gameArea.innerHTML = `
                <div class="dialog-modal">
                    <div class="dialog-content dialog-content-large">
                        <div class="client-avatar-dialog-large">
                            <img src="${client.imageUrl || ''}" 
                                 alt="${client.name}"
                                 class="dialog-client-img-large"
                                 onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\"font-size: 6rem; text-align: center;\">${client.avatar}</div>'">
                        </div>
                        <div class="feedback-box-large ${feedbackClass}">
                            ${feedbackMessage}
                        </div>
                        <button class="next-btn-large" id="continue-btn">➡️ Следующий клиент</button>
                    </div>
                </div>
            `;
            
            document.getElementById('continue-btn').addEventListener('click', () => {
                currentClientIndex++;
                saveGameProgress();
                loadCurrentClient();
            });
        });
    });
}

function completeGame() {
    gameCompleted = true;
    GameSave.clear();
    
    Leaderboard.addScore(playerName, totalScore);
    const top10 = Leaderboard.getTop10();
    const rank = Leaderboard.getRank(totalScore);
    
    let emoji = '';
    let message = '';
    
    if (totalScore === TOTAL_POSSIBLE_SCORE) {
        emoji = '🏆';
        message = 'Ты настоящий страховой гений! Все 14 клиентов довольны и рекомендуют тебя друзьям!';
    } else if (totalScore >= 110) {
        emoji = '🎉';
        message = 'Отличная работа! Ты помог почти всем клиентам. Продолжай в том же духе!';
    } else if (totalScore >= 90) {
        emoji = '👍';
        message = 'Хороший результат! Ещё немного  — и ты станешь экспертом в страховании!';
    } else if (totalScore >= 70) {
        emoji = '📚';
        message = 'Неплохо, но стоит повторить основы страхования. Попробуй пройти гайд ещё раз!';
    } else {
        emoji = '💪';
        message = 'Не сдавайся! Страхование — сложная тема. Пройди гайд ещё раз и запомни правильные ответы!';
    }
    
    gameArea.innerHTML = `
        <div class="results-card">
            <div class="case-icon">${emoji}</div>
            <h2 class="case-title">🎉 Игра завершена! 🎉</h2>
            <div class="results-score">${totalScore} / ${TOTAL_POSSIBLE_SCORE} очков</div>
            <div class="results-message">
                <strong>${playerName}</strong>, ${message}
            </div>
            <p style="margin: 10px 0;">🏅 Твоё место: ${rank}-е из ${Leaderboard.getAll().length}</p>
            
            <div class="leaderboard-section">
                <h3>🏆 ДОСКА ЛИДЕРОВ 🏆</h3>
                <table class="leaderboard-table">
                    <thead>
                        <tr><th>#</th><th>Игрок</th><th>Очки</th><th>Дата</th></tr>
                    </thead>
                    <tbody>
                        ${top10.map((entry, idx) => `
                            <tr class="${entry.name === playerName ? 'current-user' : ''} ${idx === 0 ? 'top-1' : idx === 1 ? 'top-2' : idx === 2 ? 'top-3' : ''}">
                                <td>${idx + 1}</td>
                                <td>${entry.name}</td>
                                <td><strong>${entry.score}</strong></td>
                                <td>${entry.formattedDate.split(',')[0]}</td>
                            </tr>
                        `).join('')}
                        ${top10.length === 0 ? '<tr><td colspan="4">Пока нет результатов. Стань первым!</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
            
            <div class="share-buttons">
                <button class="share-btn share-telegram" id="share-telegram">📱 Telegram</button>
                <button class="share-btn share-vk" id="share-vk">🌐 VK</button>
                <button class="share-btn share-copy" id="share-copy">📋 Копировать</button>
            </div>
            
            <button class="next-btn" id="play-again-btn" style="margin-top: 20px;">🎮 Пройти заново</button>
        </div>
    `;
    
    document.getElementById('play-again-btn').addEventListener('click', () => {
        initGame(false);
    });
    
    document.getElementById('share-telegram').addEventListener('click', () => shareResult('telegram'));
    document.getElementById('share-vk').addEventListener('click', () => shareResult('vk'));
    document.getElementById('share-copy').addEventListener('click', () => shareResult('copy'));
}

function shareResult(platform) {
    const text = `🎯 Я прошёл игру "Страховой агент" и набрал ${totalScore} из ${TOTAL_POSSIBLE_SCORE} очков! ${totalScore === TOTAL_POSSIBLE_SCORE ? 'Стал страховым гением! 🏆' : ''} Попробуй и ты: `;
    const url = window.location.href;
    
    switch(platform) {
        case 'telegram':
            window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
            break;
        case 'vk':
            window.open(`https://vk.com/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent('Страховой агент - интерактивный гайд')}&description=${encodeURIComponent(text)}`, '_blank');
            break;
        case 'copy':
            navigator.clipboard.writeText(`${text} ${url}`).then(() => {
                showToast('✅ Результат скопирован в буфер обмена!');
            }).catch(() => {
                alert('Не удалось скопировать результат');
            });
            break;
    }
}

function saveGameProgress() {
    if (!gameCompleted && (currentCaseIndex > 0 || currentClientIndex > 0)) {
        GameSave.save({
            caseOrder: [...caseOrder],
            currentCaseIndex: currentCaseIndex,
            currentClientIndex: currentClientIndex,
            totalScore: totalScore,
            gameCompleted: false
        });
        showToast('💾 Прогресс сохранён!');
    } else if (gameCompleted) {
        showToast('Игра уже завершена! Начните новую игру.');
    } else {
        showToast('Сначала начните игру!');
    }
}

// ========== ОБРАБОТЧИКИ КНОПОК ==========
resetBtn.addEventListener('click', () => {
    if (confirm('Начать игру заново? Весь прогресс будет потерян.')) {
        GameSave.clear();
        initGame(false);
    }
});

saveBtn.addEventListener('click', () => {
    if (!gameCompleted && (currentCaseIndex > 0 || currentClientIndex > 0)) {
        saveGameProgress();
    } else if (gameCompleted) {
        showToast('Игра уже завершена! Начните новую игру.');
    } else {
        showToast('Сначала начните игру!');
    }
});

// ========== ЗАПУСК ИГРЫ ==========
initGame(true);
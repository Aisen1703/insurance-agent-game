// Состояние игры
let currentCaseIndex = 0;
let currentClientIndex = 0;
let totalScore = 0;
let gameCompleted = false;
let playerName = localStorage.getItem('playerName') || '';
let waitingForNextCase = false;

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
    static STORAGE_KEY = 'insurance_leaderboard_v3';
    
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
    static STORAGE_KEY = 'insurance_game_save_v3';
    
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
    setTimeout(() => {
        toast.remove();
    }, duration);
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

// ========== ОСНОВНАЯ ЛОГИКА ИГРЫ ==========
function initGame(loadSaved = true) {
    if (loadSaved) {
        const saved = GameSave.load();
        if (saved && !saved.gameCompleted && saved.currentCaseIndex !== undefined) {
            if (confirm('Найдено сохранение игры. Продолжить с того же места?')) {
                currentCaseIndex = saved.currentCaseIndex;
                currentClientIndex = saved.currentClientIndex;
                totalScore = saved.totalScore;
                gameCompleted = false;
                waitingForNextCase = false;
                updateScore();
                loadCurrentCase();
                return;
            } else {
                GameSave.clear();
            }
        }
    }
    
    // Новая игра
    currentCaseIndex = 0;
    currentClientIndex = 0;
    totalScore = 0;
    gameCompleted = false;
    waitingForNextCase = false;
    updateScore();
    
    if (!playerName) {
        askForName(() => loadCurrentCase());
    } else {
        loadCurrentCase();
    }
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

function loadCurrentCase() {
    if (gameCompleted || waitingForNextCase) return;
    
    if (currentCaseIndex >= caseOrder.length) {
        completeGame();
        return;
    }
    
    const caseId = caseOrder[currentCaseIndex];
    const currentCase = casesData[caseId];
    
    // Если все клиенты в кейсе обработаны — показываем результаты кейса
    if (currentClientIndex >= currentCase.clients.length) {
        showCaseComplete();
        return;
    }
    
    renderCaseScreen(currentCase);
}

function renderCaseScreen(currentCase) {
    const totalClients = getTotalClients();
    const processedClients = getProcessedClients();
    const progressPercent = (processedClients / totalClients) * 100;
    const remainingClients = currentCase.clients.slice(currentClientIndex);
    
    gameArea.innerHTML = `
        <div class="case-card">
            <div class="case-icon">${currentCase.icon}</div>
            <h2 class="case-title">${currentCase.title}</h2>
            <p class="case-description">${currentCase.description}</p>
            
            <div class="progress-section">
                <div class="progress-bar-container">
                    <div class="progress-bar-fill" style="width: ${progressPercent}%;">
                        ${progressPercent > 15 ? `${Math.round(progressPercent)}%` : ''}
                    </div>
                </div>
                <div class="progress-stats">
                    <span>📋 Кейс ${currentCaseIndex + 1}/${caseOrder.length}</span>
                    <span>👥 Клиенты: ${processedClients}/${totalClients}</span>
                    <span>⭐ ${totalScore}/${TOTAL_POSSIBLE_SCORE}</span>
                </div>
            </div>
            
            <h3>📋 Выбери клиента, который ждёт твоей помощи:</h3>
            <div class="clients-grid" id="clients-grid">
                ${remainingClients.map((client, idx) => `
                    <div class="client-card" data-client-index="${currentClientIndex + idx}">
                        <div class="client-avatar">
                            <img src="${client.imageUrl || ''}" 
                                 alt="${client.name}"
                                 class="client-img"
                                 onerror="this.style.display='none'; this.parentElement.innerHTML='<div class=\\\"avatar-emoji\\\">${client.avatar}</div>'">
                        </div>
                        <div class="client-name">${client.name}</div>
                        <div class="client-problem">"${client.problem.substring(0, 100)}${client.problem.length > 100 ? '...' : ''}"</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    // Добавляем обработчики на карточки клиентов
    document.querySelectorAll('.client-card').forEach(card => {
        card.addEventListener('click', (e) => {
            const index = parseInt(card.dataset.clientIndex);
            startDialogWithClient(currentCase, index);
        });
    });
}

function startDialogWithClient(currentCase, clientIndex) {
    const client = currentCase.clients[clientIndex];
    
    showDialog(client, (isCorrect) => {
        if (isCorrect) {
            totalScore += 10;
            updateScore();
        }
        currentClientIndex++;
        saveGameProgress();
        loadCurrentCase();
    });
}

function showDialog(client, onComplete) {
    const options = [client.correctChoice, ...client.wrongChoices].sort(() => Math.random() - 0.5);
    let answered = false;
    
    gameArea.innerHTML = `
        <div class="dialog-modal">
            <div class="dialog-content">
                <div class="client-avatar-large">
                    <img src="${client.imageUrl || ''}" 
                         alt="${client.name}"
                         class="dialog-client-img"
                         onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\\"font-size: 3rem; text-align: center;\\\">${client.avatar}</div>'">
                </div>
                <div style="font-size: 1.2rem; font-weight: bold; text-align: center; margin: 10px 0;">${client.name}</div>
                <div class="dialog-question">
                    <strong>Проблема:</strong><br>
                    "${client.problem}"
                </div>
                <div class="dialog-options">
                    ${options.map(opt => `
                        <button class="dialog-option" data-option="${opt.replace(/'/g, '&#39;').replace(/"/g, '&quot;')}">${opt}</button>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    
    document.querySelectorAll('.dialog-option').forEach(btn => {
        btn.addEventListener('click', () => {
            if (answered) return;
            answered = true;
            const chosen = btn.dataset.option;
            const isCorrect = (chosen === client.correctChoice);
            
            const feedbackClass = isCorrect ? 'feedback-correct' : 'feedback-wrong';
            const feedbackMessage = isCorrect 
                ? `✅ Правильно! ${client.explanation}`
                : `❌ Не совсем. ${client.explanation}`;
            
            gameArea.innerHTML = `
                <div class="dialog-modal">
                    <div class="dialog-content">
                        <div class="feedback-box ${feedbackClass}">
                            ${feedbackMessage}
                        </div>
                        <button class="next-btn" id="continue-btn">Продолжить →</button>
                    </div>
                </div>
            `;
            
            document.getElementById('continue-btn').addEventListener('click', () => {
                onComplete(isCorrect);
            });
        });
    });
}

function showCaseComplete() {
    const caseId = caseOrder[currentCaseIndex];
    const currentCase = casesData[caseId];
    const caseScore = currentClientIndex * 10;
    const maxCaseScore = currentCase.clients.length * 10;
    
    waitingForNextCase = true;
    
    gameArea.innerHTML = `
        <div class="results-card case-complete">
            <div class="case-icon">${currentCase.icon}</div>
            <h2 class="case-title">✅ Кейс "${currentCase.title}" пройден!</h2>
            <div class="case-score">
                <div class="score-badge">${caseScore}/${maxCaseScore}</div>
                <p>очков за этот кейс</p>
            </div>
            <div class="case-summary">
                <p>📊 Ты помог ${currentClientIndex} из ${currentCase.clients.length} клиентов</p>
                <p>🏆 Общий счёт: ${totalScore}/${TOTAL_POSSIBLE_SCORE}</p>
            </div>
            <button class="next-btn" id="next-case-btn">
                ${currentCaseIndex + 1 >= caseOrder.length ? '🏁 Завершить игру' : '➡️ Следующий кейс'}
            </button>
        </div>
    `;
    
    document.getElementById('next-case-btn').addEventListener('click', () => {
        currentCaseIndex++;
        currentClientIndex = 0;
        waitingForNextCase = false;
        saveGameProgress();
        loadCurrentCase();
    });
}

function completeGame() {
    gameCompleted = true;
    GameSave.clear();
    
    // Сохраняем результат в таблицу лидеров
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
        message = 'Хороший результат! Ещё немного практики — и ты станешь экспертом!';
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
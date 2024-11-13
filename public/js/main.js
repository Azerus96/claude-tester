class ChatInterface {
    constructor() {
        this.isProcessing = false;
        this.conversations = this.loadConversations();
        this.currentConversation = null;
        this.initializeInterface();
    }

    loadConversations() {
        const saved = localStorage.getItem('chatHistory');
        return saved ? JSON.parse(saved) : [];
    }

    saveConversations() {
        localStorage.setItem('chatHistory', JSON.stringify(this.conversations));
    }

    initializeInterface() {
        document.getElementById('newChat').onclick = () => this.startNewChat();
        
        const userInput = document.getElementById('userInput');
        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        userInput.addEventListener('input', (e) => {
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
        });

        // Восстанавливаем последний активный чат
        const lastChat = this.conversations[0];
        if (lastChat) {
            this.currentConversation = lastChat;
            this.renderMessages();
        } else {
            this.startNewChat();
        }

        this.updateHistoryList();
    }

    async sendMessage() {
        if (this.isProcessing) return;

        const input = document.getElementById('userInput');
        const message = input.value.trim();

        if (!message) return;

        try {
            this.isProcessing = true;
            document.getElementById('loading').style.display = 'block';

            // Добавляем сообщение пользователя
            this.addMessage('user', message);
            input.value = '';
            input.style.height = 'auto';

            // Получаем весь контекст беседы
            const context = this.currentConversation.messages.map(m => ({
                role: m.role,
                content: m.content
            }));

            // Отправляем запрос с полным контекстом
            const result = await puter.ai.chat(message, {
                model: 'claude-3-5-sonnet',
                stream: true,
                messages: context
            });

            let fullResponse = '';
            for await (const part of result) {
                if (part?.text) {
                    fullResponse += part.text;
                    this.updateLastMessage(fullResponse);
                }
            }

            // Сохраняем ответ ассистента
            this.addMessage('assistant', fullResponse);
            
            // Добавляем поле для уточняющего вопроса
            this.addFollowUpInput();

        } catch (error) {
            this.addMessage('system', 'Error: ' + error.message);
        } finally {
            this.isProcessing = false;
            document.getElementById('loading').style.display = 'none';
        }
    }

    addMessage(role, content) {
        if (!this.currentConversation) {
            this.startNewChat();
        }

        this.currentConversation.messages.push({
            role,
            content,
            timestamp: new Date()
        });

        // Обновляем в истории
        const index = this.conversations.findIndex(c => c.id === this.currentConversation.id);
        if (index !== -1) {
            this.conversations[index] = this.currentConversation;
        } else {
            this.conversations.unshift(this.currentConversation);
            if (this.conversations.length > MAX_HISTORY) {
                this.conversations.pop();
            }
        }

        this.saveConversations();
        this.renderMessages();
        this.updateHistoryList();
    }

    addFollowUpInput() {
        const messages = document.getElementById('chatMessages');
        const followUp = document.createElement('div');
        followUp.className = 'follow-up';
        followUp.innerHTML = `
            <textarea placeholder="Ask a follow-up question..."></textarea>
            <button onclick="chatInterface.sendFollowUp(this)">Send</button>
        `;
        messages.appendChild(followUp);
    }

    async sendFollowUp(button) {
        const textarea = button.previousElementSibling;
        const message = textarea.value.trim();
        if (message) {
            textarea.value = '';
            button.parentElement.remove();
            await this.sendMessage(message);
        }
    }

    formatMessage(content) {
        // Заменяем блоки кода
        return content.replace(/```([\s\S]*?)```/g, (match, code) => {
            return `<div class="code-block">
                <button class="copy-button" onclick="chatInterface.copyCode(this)">Copy</button>
                <pre>${code}</pre>
            </div>`;
        });
    }

    copyCode(button) {
        const code = button.nextElementSibling.textContent;
        navigator.clipboard.writeText(code).then(() => {
            const originalText = button.textContent;
            button.textContent = 'Copied!';
            setTimeout(() => {
                button.textContent = originalText;
            }, 2000);
        });
    }

    updateLastMessage(content) {
        const messages = document.getElementById('chatMessages');
        const lastMessage = messages.lastElementChild;
        if (lastMessage && lastMessage.classList.contains('message')) {
            lastMessage.querySelector('.message-content').innerHTML = this.formatMessage(content);
            messages.scrollTop = messages.scrollHeight;
        }
    }

    renderMessages() {
        const messages = document.getElementById('chatMessages');
        messages.innerHTML = this.currentConversation.messages.map(msg => `
            <div class="message ${msg.role}">
                <div class="message-content">${this.formatMessage(msg.content)}</div>
                <div class="message-time">${new Date(msg.timestamp).toLocaleTimeString()}</div>
            </div>
        `).join('');
        messages.scrollTop = messages.scrollHeight;
    }

    updateHistoryList() {
        const historyList = document.getElementById('historyList');
        historyList.innerHTML = this.conversations.map((conv, index) => `
            <div class="history-item ${conv === this.currentConversation ? 'active' : ''}"
                 onclick="chatInterface.loadConversation(${index})">
                <div class="history-title">
                    ${this.getConversationTitle(conv)}
                </div>
                <div class="history-time">
                    ${new Date(conv.messages[0].timestamp).toLocaleDateString()}
                </div>
                <button class="delete-btn" 
                        onclick="event.stopPropagation(); chatInterface.deleteConversation(${index})">
                    ×
                </button>
            </div>
        `).join('');
    }

    getConversationTitle(conversation) {
        // Берём первое сообщение пользователя как заголовок
        const firstMessage = conversation.messages.find(m => m.role === 'user');
        return firstMessage ? 
            (firstMessage.content.slice(0, 30) + (firstMessage.content.length > 30 ? '...' : '')) : 
            'New Conversation';
    }

    loadConversation(index) {
        this.currentConversation = this.conversations[index];
        this.renderMessages();
        this.updateHistoryList();
    }

    deleteConversation(index) {
        if (confirm('Are you sure you want to delete this conversation?')) {
            this.conversations.splice(index, 1);
            this.saveConversations();
            
            if (this.currentConversation === this.conversations[index]) {
                this.currentConversation = this.conversations[0] || null;
                if (!this.currentConversation) {
                    this.startNewChat();
                }
            }
            
            this.renderMessages();
            this.updateHistoryList();
        }
    }

    startNewChat() {
        this.currentConversation = {
            id: Date.now(),
            messages: []
        };
        this.renderMessages();
        this.updateHistoryList();
    }

    // Утилиты для работы с localStorage
    clearHistory() {
        if (confirm('Are you sure you want to clear all chat history?')) {
            this.conversations = [];
            this.saveConversations();
            this.startNewChat();
        }
    }

    exportHistory() {
        const data = JSON.stringify(this.conversations);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat-history-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    importHistory() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const imported = JSON.parse(e.target.result);
                        if (Array.isArray(imported)) {
                            this.conversations = imported;
                            this.saveConversations();
                            this.currentConversation = this.conversations[0] || null;
                            if (!this.currentConversation) {
                                this.startNewChat();
                            } else {
                                this.renderMessages();
                                this.updateHistoryList();
                            }
                        }
                    } catch (error) {
                        alert('Invalid history file');
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }
}

// Инициализация интерфейса
const chatInterface = new ChatInterface();

// Добавляем горячие клавиши
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + N - новый чат
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        chatInterface.startNewChat();
    }
    // Ctrl/Cmd + S - сохранить историю
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        chatInterface.exportHistory();
    }
});

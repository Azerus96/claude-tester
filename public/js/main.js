class ChatInterface {
    constructor() {
        this.storage = new StorageManager();
        this.currentConversation = null;
        this.isProcessing = false;
        this.initializeInterface();
    }

    initializeInterface() {
        this.createLayout();
        this.bindEvents();
        this.loadConversations();
        
        // Восстанавливаем последнюю активную беседу
        const lastConversationId = localStorage.getItem('lastActiveConversation');
        if (lastConversationId) {
            this.loadConversation(lastConversationId);
        } else {
            this.startNewChat();
        }
    }

    createLayout() {
        document.body.innerHTML = `
            <div class="chat-container">
                <div class="sidebar">
                    <button id="newChat" class="new-chat-btn">New Chat</button>
                    <div class="history-list" id="historyList"></div>
                </div>
                <div class="main-chat">
                    <div class="chat-messages" id="chatMessages"></div>
                    <div class="input-area">
                        <textarea 
                            id="userInput" 
                            placeholder="Type your message... (Shift + Enter for new line)"
                            rows="1"
                        ></textarea>
                        <button id="sendButton" class="send-button">Send</button>
                    </div>
                </div>
                <div class="code-panel">
                    <div class="code-actions">
                        <button id="copyCode">Copy Code</button>
                        <button id="runCode">Run Code</button>
                    </div>
                    <pre id="codeOutput"></pre>
                </div>
            </div>
        `;
    }

    bindEvents() {
        document.getElementById('sendButton').onclick = () => this.sendMessage();
        document.getElementById('newChat').onclick = () => this.startNewChat();
        document.getElementById('copyCode').onclick = () => this.copyLastCode();
        document.getElementById('runCode').onclick = () => this.runLastCode();

        const userInput = document.getElementById('userInput');
        
        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Автоматическое изменение размера текстового поля
        userInput.addEventListener('input', () => {
            userInput.style.height = 'auto';
            userInput.style.height = userInput.scrollHeight + 'px';
        });

        this.githubAnalyzer = new GitHubAnalyzer();
        this.initializeGitHubAnalyzer();
    }

    async initializeGitHubAnalyzer() {
        await this.githubAnalyzer.initialize();
        const githubPanel = this.githubAnalyzer.createGitHubPanel();
        document.body.appendChild(githubPanel);

        // Добавляем обработчики событий
        document.getElementById('analyzeRepo').onclick = async () => {
            const repoUrl = document.getElementById('repoUrl').value;
            await this.githubAnalyzer.analyzeRepository(repoUrl);
        };

        document.getElementById('configureGithub').onclick = async () => {
            await this.githubAnalyzer.requestGitHubToken();
        };
    }

    async sendCustomMessage(message) {
        if (this.isProcessing) return;
        
        this.isProcessing = true;
        try {
            const response = await puter.ai.chat(message, {
                model: 'claude-3-5-sonnet',
                stream: false
            });
            
            return response.message.content[0].text;
        } catch (error) {
            this.showError(error.message);
            return null;
        } finally {
            this.isProcessing = false;
        }
    }
}
        
        // Обработка вставки кода
        document.addEventListener('paste', (e) => {
            if (e.target === userInput) {
                const text = e.clipboardData.getData('text');
                if (text.includes('\n')) {
                    e.preventDefault();
                    const indentedText = this.formatCodeInput(text);
                    document.execCommand('insertText', false, indentedText);
                }
            }
        });
    }

    formatCodeInput(text) {
        // Добавляем отступы для кода
        return text.split('\n').map(line => '    ' + line).join('\n');
    }

    async sendMessage() {
        if (this.isProcessing) return;

        const input = document.getElementById('userInput');
        const message = input.value.trim();
        
        if (!message) return;
        
        if (!this.currentConversation) {
            this.startNewChat();
        }

        input.value = '';
        input.style.height = 'auto';
        this.isProcessing = true;

        try {
            // Добавляем сообщение пользователя
            this.currentConversation.addMessage('user', message);
            this.renderMessages();

            // Добавляем временное сообщение ассистента
            const tempMessage = this.currentConversation.addMessage('assistant', '');
            this.renderMessages();

            const response = await puter.ai.chat(message, {
                model: 'claude-3-5-sonnet',
                stream: true,
                messages: this.currentConversation.getContext()
            });

            let fullResponse = '';
            for await (const part of response) {
                if (part?.text) {
                    fullResponse += part.text;
                    this.updateLastMessage(fullResponse);
                }
            }

            // Обновляем последнее сообщение с полным ответом
            this.currentConversation.updateMessage(tempMessage.id, fullResponse);
            this.storage.saveConversation(this.currentConversation);
            this.updateHistoryList();
            this.extractAndDisplayCode(fullResponse);

        } catch (error) {
            this.showError(error.message);
            // Удаляем временное сообщение в случае ошибки
            this.currentConversation.messages.pop();
            this.renderMessages();
        } finally {
            this.isProcessing = false;
        }
    }

    updateLastMessage(content) {
        const lastMessage = document.querySelector('.message.assistant:last-child .message-content');
        if (lastMessage) {
            lastMessage.innerHTML = marked(content);
            this.scrollToBottom();
        }
    }

    extractAndDisplayCode(message) {
        const codeBlocks = message.match(/```[\s\S]*?```/g);
        const codeOutput = document.getElementById('codeOutput');
        
        if (codeBlocks) {
            codeOutput.innerHTML = codeBlocks.map(block => {
                const language = block.match(/```(\w+)/)?.[1] || '';
                const code = block
                    .replace(/```(\w*)\n/, '')
                    .replace(/```$/, '')
                    .trim();
                
                return `
                    <div class="code-block" data-language="${language}">
                        <div class="code-header">
                            <span class="code-language">${language}</span>
                        </div>
                        <pre><code>${this.escapeHtml(code)}</code></pre>
                    </div>
                `;
            }).join('\n');
        } else {
            codeOutput.innerHTML = '<div class="no-code">No code blocks in current message</div>';
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    copyLastCode() {
        const codeBlock = document.querySelector('.code-block code');
        if (codeBlock) {
            navigator.clipboard.writeText(codeBlock.textContent)
                .then(() => this.showNotification('Code copied to clipboard!'))
                .catch(err => this.showError('Failed to copy code'));
        }
    }

    async runLastCode() {
        const codeBlock = document.querySelector('.code-block code');
        if (!codeBlock) return;

        const code = codeBlock.textContent;
        const language = codeBlock.parentElement.parentElement.dataset.language;

        // Здесь можно добавить выполнение кода для разных языков
        this.showNotification('Code execution not implemented yet');
    }

    loadConversations() {
        const conversations = this.storage.getConversations();
        this.updateHistoryList(conversations);
    }

    updateHistoryList() {
        const historyList = document.getElementById('historyList');
        const conversations = this.storage.getConversations();
        
        historyList.innerHTML = conversations.map(conv => `
            <div class="history-item ${conv.id === this.currentConversation?.id ? 'active' : ''}" 
                 data-id="${conv.id}">
                <div class="history-title">${conv.title}</div>
                <div class="history-date">
                    ${new Date(conv.lastUpdated).toLocaleDateString()}
                    ${new Date(conv.lastUpdated).toLocaleTimeString()}
                </div>
                <div class="history-actions">
                    <button class="delete-btn" data-id="${conv.id}">×</button>
                </div>
            </div>
        `).join('');

        // Добавляем обработчики событий
        historyList.querySelectorAll('.history-item').forEach(item => {
            item.onclick = (e) => {
                if (!e.target.classList.contains('delete-btn')) {
                    this.loadConversation(item.dataset.id);
                }
            };
        });

        historyList.querySelectorAll('.delete-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                this.deleteConversation(btn.dataset.id);
            };
        });
    }

    startNewChat() {
        this.currentConversation = new Conversation();
        localStorage.setItem('lastActiveConversation', this.currentConversation.id);
        this.renderMessages();
        this.updateHistoryList();
    }

    loadConversation(id) {
        this.currentConversation = this.storage.getConversationById(id);
        localStorage.setItem('lastActiveConversation', id);
        this.renderMessages();
        this.updateHistoryList();
    }

    deleteConversation(id) {
        if (confirm('Are you sure you want to delete this conversation?')) {
            this.storage.deleteConversation(id);
            
            if (this.currentConversation?.id === id) {
                this.startNewChat();
            } else {
                this.updateHistoryList();
            }
        }
    }

    renderMessages() {
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.innerHTML = this.currentConversation.messages.map(msg => `
            <div class="message ${msg.role}" data-message-id="${msg.id}">
                <div class="message-content">${marked(msg.content)}</div>
                <div class="message-footer">
                    <div class="message-time">
                        ${msg.timestamp.toLocaleTimeString()}
                        ${msg.edited ? '(edited)' : ''}
                    </div>
                    <div class="message-actions">
                        ${msg.role === 'assistant' ? `
                            <button class="copy-btn" title="Copy message">
                                <svg width="16" height="16" viewBox="0 0 24 24">
                                    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                                </svg>
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `).join('');

        // Добавляем обработчики для кнопок копирования
        chatMessages.querySelectorAll('.copy-btn').forEach(btn => {
            btn.onclick = (e) => {
                const message = e.target.closest('.message');
                const content = message.querySelector('.message-content').textContent;
                navigator.clipboard.writeText(content)
                    .then(() => this.showNotification('Message copied to clipboard!'))
                    .catch(() => this.showError('Failed to copy message'));
            };
        });

        this.scrollToBottom();
    }

    scrollToBottom() {
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    // Утилиты для работы с кодом
    formatCode(code, language) {
        // Здесь можно добавить форматирование кода для разных языков
        return code.trim();
    }

    // Экспорт/импорт истории
    exportHistory() {
        const data = this.storage.exportHistory();
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

    async importHistory() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const text = await file.text();
                    if (this.storage.importHistory(text)) {
                        this.showNotification('History imported successfully!');
                        this.loadConversations();
                    } else {
                        this.showError('Invalid history file format');
                    }
                } catch (error) {
                    this.showError('Error importing history');
                }
            }
        };

        input.click();
    }

    // Добавление тегов к беседе
    addTag(tag) {
        if (this.currentConversation) {
            this.currentConversation.addTag(tag);
            this.storage.saveConversation(this.currentConversation);
            this.updateHistoryList();
        }
    }

    // Поиск по истории
    searchConversations(query) {
        const conversations = this.storage.getConversations();
        return conversations.filter(conv => {
            const searchText = `${conv.title} ${conv.messages.map(m => m.content).join(' ')}`.toLowerCase();
            return searchText.includes(query.toLowerCase());
        });
    }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    window.chatInterface = new ChatInterface();
});

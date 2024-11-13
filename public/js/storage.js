class StorageManager {
    constructor() {
        this.STORAGE_KEY = 'claude_chat_history';
        this.MAX_HISTORY = 100;
    }

    saveConversation(conversation) {
        const conversations = this.getConversations();
        const existingIndex = conversations.findIndex(conv => conv.id === conversation.id);
        
        if (existingIndex !== -1) {
            conversations[existingIndex] = conversation;
        } else {
            conversations.unshift(conversation);
            if (conversations.length > this.MAX_HISTORY) {
                conversations.pop();
            }
        }
        
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(conversations));
    }

    getConversations() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Error loading conversations:', error);
            return [];
        }
    }

    getConversationById(id) {
        const conversation = this.getConversations().find(conv => conv.id === id);
        if (conversation) {
            // Преобразуем даты обратно в объекты Date
            conversation.lastUpdated = new Date(conversation.lastUpdated);
            conversation.messages = conversation.messages.map(msg => ({
                ...msg,
                timestamp: new Date(msg.timestamp)
            }));
        }
        return conversation;
    }

    deleteConversation(id) {
        const conversations = this.getConversations();
        const filtered = conversations.filter(conv => conv.id !== id);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
    }

    clearHistory() {
        localStorage.removeItem(this.STORAGE_KEY);
    }

    exportHistory() {
        return JSON.stringify(this.getConversations());
    }

    importHistory(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            if (Array.isArray(data)) {
                localStorage.setItem(this.STORAGE_KEY, jsonData);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error importing history:', error);
            return false;
        }
    }
}

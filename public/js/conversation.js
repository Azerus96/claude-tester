class Conversation {
    constructor() {
        this.id = Date.now().toString();
        this.messages = [];
        this.title = 'New Conversation';
        this.lastUpdated = new Date();
        this.tags = [];
    }

    addMessage(role, content) {
        const message = {
            role,
            content,
            timestamp: new Date(),
            id: Date.now().toString()
        };

        this.messages.push(message);
        this.lastUpdated = new Date();
        
        // Установка заголовка из первого сообщения ассистента
        if (!this.title || this.title === 'New Conversation') {
            if (role === 'assistant') {
                this.title = content
                    .split('\n')[0]
                    .substring(0, 50)
                    .trim() + (content.length > 50 ? '...' : '');
            }
        }

        return message;
    }

    getContext() {
        return this.messages.map(msg => ({
            role: msg.role,
            content: msg.content
        }));
    }

    addTag(tag) {
        if (!this.tags.includes(tag)) {
            this.tags.push(tag);
        }
    }

    removeTag(tag) {
        this.tags = this.tags.filter(t => t !== tag);
    }

    getLastMessage() {
        return this.messages[this.messages.length - 1];
    }

    updateMessage(messageId, newContent) {
        const message = this.messages.find(msg => msg.id === messageId);
        if (message) {
            message.content = newContent;
            message.edited = true;
            message.editTimestamp = new Date();
        }
    }
}

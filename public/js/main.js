class ClaudeAPI {
    constructor() {
        this.loadingElement = document.getElementById('loading');
        this.responseElement = document.getElementById('response');
        this.inputElement = document.getElementById('input');
    }

    async sendRequest() {
        const input = this.inputElement.value;
        
        if (!input.trim()) {
            this.showError('Please enter a prompt');
            return;
        }

        try {
            this.showLoading();
            this.clearResponse();

            const response = await puter.ai.chat(input, {
                model: 'claude-3-5-sonnet',
                stream: true
            });

            await this.handleStream(response);
        } catch (error) {
            this.showError(error.message);
        } finally {
            this.hideLoading();
        }
    }

    async handleStream(response) {
        for await (const part of response) {
            if (part?.text) {
                this.appendResponse(part.text);
            }
        }
    }

    showLoading() {
        this.loadingElement.style.display = 'block';
    }

    hideLoading() {
        this.loadingElement.style.display = 'none';
    }

    clearResponse() {
        this.responseElement.textContent = '';
    }

    appendResponse(text) {
        this.responseElement.textContent += text;
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error';
        errorDiv.textContent = message;
        this.responseElement.prepend(errorDiv);
    }
}

// Initialize
const claudeAPI = new ClaudeAPI();

// Event Listeners
document.getElementById('sendButton').addEventListener('click', () => {
    claudeAPI.sendRequest();
});

// Handle Enter key
document.getElementById('input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        claudeAPI.sendRequest();
    }
});

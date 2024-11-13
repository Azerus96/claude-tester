class GitHubAnalyzer {
    constructor() {
        this.accessToken = localStorage.getItem('github_token');
        this.currentRepo = null;
    }

    async initialize() {
        if (!this.accessToken) {
            await this.requestGitHubToken();
        }
    }

    createGitHubPanel() {
        const panel = document.createElement('div');
        panel.className = 'github-panel';
        panel.innerHTML = `
            <div class="github-header">
                <h3>GitHub Repository Analysis</h3>
                <button id="configureGithub" class="github-config-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24">
                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                    </svg>
                    Configure
                </button>
            </div>
            <div class="github-content">
                <div class="repo-input">
                    <input type="text" id="repoUrl" placeholder="Enter repository URL" />
                    <button id="analyzeRepo">Analyze</button>
                </div>
                <div id="analysisResults" class="analysis-results"></div>
            </div>
        `;
        return panel;
    }

    async requestGitHubToken() {
        const token = prompt('Please enter your GitHub Personal Access Token\nYou can create one at: https://github.com/settings/tokens');
        if (token) {
            this.accessToken = token;
            localStorage.setItem('github_token', token);
        }
    }

    async analyzeRepository(repoUrl) {
        try {
            const repoInfo = this.parseRepoUrl(repoUrl);
            if (!repoInfo) throw new Error('Invalid repository URL');

            const results = document.getElementById('analysisResults');
            results.innerHTML = '<div class="loading">Analyzing repository...</div>';

            // Получаем содержимое репозитория
            const repoContent = await this.getRepositoryContent(repoInfo);
            const files = await this.getAllFiles(repoInfo, '');
            const packageFiles = this.findPackageFiles(files);
            
            // Анализируем структуру проекта
            const analysis = await this.analyzeProjectStructure(repoInfo, files, packageFiles);
            
            // Формируем сообщение для Claude
            const message = this.createAnalysisMessage(repoInfo, analysis, packageFiles);
            
            // Отправляем запрос в Claude
            const response = await window.chatInterface.sendCustomMessage(message);
            
            // Отображаем результаты
            this.displayAnalysisResults(response, analysis);

        } catch (error) {
            this.showError(`Analysis failed: ${error.message}`);
        }
    }

    parseRepoUrl(url) {
        const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
        return match ? { owner: match[1], repo: match[2] } : null;
    }

    async getRepositoryContent(repoInfo) {
        const response = await fetch(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/contents`, {
            headers: {
                'Authorization': `token ${this.accessToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        return await response.json();
    }

    async getAllFiles(repoInfo, path = '') {
        const files = [];
        const queue = [{ path }];

        while (queue.length > 0) {
            const current = queue.shift();
            const response = await fetch(
                `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/contents/${current.path}`,
                {
                    headers: {
                        'Authorization': `token ${this.accessToken}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );

            const contents = await response.json();
            
            for (const item of Array.isArray(contents) ? contents : [contents]) {
                if (item.type === 'file') {
                    files.push({
                        name: item.name,
                        path: item.path,
                        url: item.download_url
                    });
                } else if (item.type === 'dir') {
                    queue.push({ path: item.path });
                }
            }
        }

        return files;
    }

    findPackageFiles(files) {
        return {
            packageJson: files.find(f => f.name === 'package.json'),
            requirements: files.find(f => f.name === 'requirements.txt'),
            composerJson: files.find(f => f.name === 'composer.json'),
            gemfile: files.find(f => f.name === 'Gemfile')
        };
    }

    async analyzeProjectStructure(repoInfo, files, packageFiles) {
        const analysis = {
            totalFiles: files.length,
            fileTypes: {},
            dependencies: {},
            potentialIssues: []
        };

        // Анализ типов файлов
        files.forEach(file => {
            const ext = file.name.split('.').pop().toLowerCase();
            analysis.fileTypes[ext] = (analysis.fileTypes[ext] || 0) + 1;
        });

        // Анализ зависимостей
        if (packageFiles.packageJson) {
            const packageJson = await this.fetchFileContent(packageFiles.packageJson.url);
            analysis.dependencies.npm = JSON.parse(packageJson);
        }

        if (packageFiles.requirements) {
            const requirements = await this.fetchFileContent(packageFiles.requirements.url);
            analysis.dependencies.python = requirements.split('\n')
                .filter(line => line.trim() && !line.startsWith('#'))
                .map(line => line.trim());
        }

        // Проверка на тип
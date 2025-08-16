class JSONFormatter {
    constructor() {
        this.initializeElements();
        this.bindEvents();
        this.examples = this.getExamples();
        this.errors = [];
        this.currentLineCount = 0;
    }

    initializeElements() {
        this.jsonEditor = document.getElementById('jsonEditor');
        this.lineNumbers = document.getElementById('lineNumbers');
        this.formatBtn = document.getElementById('formatBtn');
        this.copyBtn = document.getElementById('copyBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.exampleBtns = document.querySelectorAll('.example-btn');
    }

    bindEvents() {
        this.formatBtn.addEventListener('click', () => this.formatJSON());
        this.copyBtn.addEventListener('click', () => this.copyToClipboard());
        this.clearBtn.addEventListener('click', () => this.clearCode());
        
        this.exampleBtns.forEach(btn => {
            btn.addEventListener('click', (e) => this.loadExample(e.target.dataset.example));
        });

        // Handle editor input
        this.jsonEditor.addEventListener('input', () => {
            this.updateLineNumbers();
        });

        this.jsonEditor.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                document.execCommand('insertText', false, '  ');
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case 'Enter':
                        e.preventDefault();
                        this.formatJSON();
                        break;
                    case 'k':
                        e.preventDefault();
                        this.clearCode();
                        break;
                    case 'c':
                        if (e.shiftKey) {
                            e.preventDefault();
                            this.copyToClipboard();
                        }
                        break;
                }
            }
        });
    }

    getEditorText() {
        return this.jsonEditor.textContent || this.jsonEditor.innerText;
    }

    setEditorText(text) {
        this.jsonEditor.textContent = text;
        this.updateLineNumbers();
    }

    updateLineNumbers() {
        const text = this.getEditorText();
        const lines = text.split('\n');
        const lineCount = Math.max(lines.length, 1);
        
        if (lineCount === this.currentLineCount) return;
        
        this.currentLineCount = lineCount;
        
        let lineNumbersHTML = '';
        for (let i = 1; i <= lineCount; i++) {
            lineNumbersHTML += `<div class="line-number" data-line="${i}">${i}</div>`;
        }
        
        this.lineNumbers.innerHTML = lineNumbersHTML;
    }

    highlightErrorLines(errorLines) {
        // Clear previous highlights
        const lineElements = this.lineNumbers.querySelectorAll('.line-number');
        lineElements.forEach(el => el.classList.remove('error'));
        
        // Highlight error lines
        errorLines.forEach(lineNum => {
            const lineElement = this.lineNumbers.querySelector(`[data-line="${lineNum}"]`);
            if (lineElement) {
                lineElement.classList.add('error');
            }
        });
    }

    formatJSON() {
        const code = this.getEditorText().trim();
        if (!code) {
            this.showNotification('Введите JSON для форматирования', 'warning');
            return;
        }

        try {
            // Try to parse JSON first
            const parsed = JSON.parse(code);
            const formatted = JSON.stringify(parsed, null, 2);
            
            this.jsonEditor.innerHTML = `<code class="language-json">${this.escapeHtml(formatted)}</code>`;
            Prism.highlightElement(this.jsonEditor.querySelector('code'));
            
            // Clear error highlights
            this.highlightErrorLines([]);
            this.showNotification('JSON успешно отформатирован!', 'success');
            
        } catch (error) {
            // If JSON is invalid, format structure anyway and show errors
            this.formatStructureWithErrors(code, error);
        }
    }

    formatStructureWithErrors(code, error) {
        this.errors = [];
        
        // Basic structure formatting without changing content
        let formattedCode = this.formatStructureOnly(code);
        
        // Detect error lines
        const errorLines = this.detectErrorLines(code);
        const lines = formattedCode.split('\n');
        
        // Highlight error lines
        const highlightedLines = lines.map((line, index) => {
            if (errorLines.includes(index + 1)) {
                return `<span class="json-error-line">${this.escapeHtml(line)}</span>`;
            }
            return this.escapeHtml(line);
        });
        
        formattedCode = highlightedLines.join('\n');
        
        this.jsonEditor.innerHTML = `<code class="language-json">${formattedCode}</code>`;
        Prism.highlightElement(this.jsonEditor.querySelector('code'));
        
        // Add error to list
        this.errors.push({
            line: 1,
            message: error.message,
            type: 'error'
        });
        
        // Show error highlights
        if (errorLines.length > 0) {
            this.highlightErrorLines(errorLines);
        }
        
        this.showNotification('JSON содержит ошибки, но структура отформатирована', 'warning');
    }

    formatStructureOnly(code) {
        // Only format structure (indentation) without changing content
        const lines = code.split('\n');
        let result = '';
        let indentLevel = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();
            
            if (!trimmedLine) {
                result += '\n';
                continue;
            }
            
            // Adjust indent level based on brackets
            if (trimmedLine.endsWith('{') || trimmedLine.endsWith('[')) {
                result += '  '.repeat(indentLevel) + trimmedLine + '\n';
                indentLevel++;
            } else if (trimmedLine.startsWith('}') || trimmedLine.startsWith(']')) {
                indentLevel = Math.max(0, indentLevel - 1);
                result += '  '.repeat(indentLevel) + trimmedLine + '\n';
            } else {
                result += '  '.repeat(indentLevel) + trimmedLine + '\n';
            }
        }
        
        return result.trim();
    }

    detectErrorLines(code) {
        const errorLines = [];
        const lines = code.split('\n');
        
        // Track bracket balance
        let braceBalance = 0;
        let bracketBalance = 0;
        let inString = false;
        let escapeNext = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();
            let lineHasError = false;
            
            // Check for unclosed quotes in this line
            for (let j = 0; j < line.length; j++) {
                const char = line[j];
                
                if (escapeNext) {
                    escapeNext = false;
                    continue;
                }
                
                if (char === '\\') {
                    escapeNext = true;
                    continue;
                }
                
                if (char === '"') {
                    inString = !inString;
                }
            }
            
            // If we're still in a string at the end of the line, mark as error
            if (inString) {
                lineHasError = true;
            }
            
            // Check for bracket balance
            const openBraces = (line.match(/\{/g) || []).length;
            const closeBraces = (line.match(/\}/g) || []).length;
            const openBrackets = (line.match(/\[/g) || []).length;
            const closeBrackets = (line.match(/\]/g) || []).length;
            
            braceBalance += openBraces - closeBraces;
            bracketBalance += openBrackets - closeBrackets;
            
            // Check for specific syntax errors in this line
            if (trimmedLine.includes('"') && !trimmedLine.includes(':') && 
                !trimmedLine.includes('{') && !trimmedLine.includes('}') && 
                !trimmedLine.includes('[') && !trimmedLine.includes(']') &&
                !trimmedLine.endsWith(',') && !trimmedLine.endsWith('{') && 
                !trimmedLine.endsWith('}') && !trimmedLine.endsWith('[') && 
                !trimmedLine.endsWith(']')) {
                lineHasError = true;
            }
            
            // Check for invalid boolean values
            if (trimmedLine.includes('tr') || trimmedLine.includes('fa') || 
                trimmedLine.includes('nu') || trimmedLine.includes('un')) {
                const valueMatch = trimmedLine.match(/:\s*(tr|fa|nu|un)\b/);
                if (valueMatch) {
                    lineHasError = true;
                }
            }
            
            // Check for trailing commas before closing brackets
            if (trimmedLine.endsWith(',') && 
                (lines[i + 1]?.trim().startsWith('}') || lines[i + 1]?.trim().startsWith(']'))) {
                lineHasError = true;
            }
            
            // Check for missing commas between elements
            if (trimmedLine && !trimmedLine.endsWith(',') && !trimmedLine.endsWith('{') && 
                !trimmedLine.endsWith('}') && !trimmedLine.endsWith('[') && 
                !trimmedLine.endsWith(']') && lines[i + 1]?.trim() && 
                !lines[i + 1].trim().startsWith('}') && !lines[i + 1].trim().startsWith(']')) {
                const nextLine = lines[i + 1].trim();
                if (nextLine.startsWith('"') || /^\d/.test(nextLine) || 
                    nextLine.startsWith('true') || nextLine.startsWith('false') || 
                    nextLine.startsWith('null')) {
                    lineHasError = true;
                }
            }
            
            if (lineHasError) {
                errorLines.push(i + 1);
            }
        }
        
        // If there are unbalanced brackets, mark the last line as error
        if (braceBalance !== 0 || bracketBalance !== 0) {
            if (!errorLines.includes(lines.length)) {
                errorLines.push(lines.length);
            }
        }
        
        return errorLines;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    copyToClipboard() {
        const code = this.getEditorText().trim();
        if (!code) {
            this.showNotification('Нет кода для копирования', 'warning');
            return;
        }

        navigator.clipboard.writeText(code).then(() => {
            this.showNotification('JSON скопирован в буфер обмена!', 'success');
        }).catch(() => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = code;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showNotification('JSON скопирован в буфер обмена!', 'success');
        });
    }

    clearCode() {
        this.jsonEditor.innerHTML = '<code class="language-json"></code>';
        this.highlightErrorLines([]);
        this.updateLineNumbers();
        this.showNotification('Код очищен', 'success');
    }

    loadExample(type) {
        const example = this.examples[type];
        if (example) {
            this.jsonEditor.innerHTML = `<code class="language-json">${this.escapeHtml(example)}</code>`;
            this.updateLineNumbers();
            this.formatJSON();
            this.showNotification(`Загружен пример: ${type}`, 'success');
        }
    }

    getExamples() {
        return {
            simple: `{
  "name": "John Doe",
  "age": 30,
  "email": "john@example.com",
  "active": true
}`,
            nested: `{
  "user": {
    "id": 1,
    "profile": {
      "firstName": "John",
      "lastName": "Doe",
      "avatar": "https://example.com/avatar.jpg"
    },
    "settings": {
      "theme": "dark",
      "notifications": true,
      "language": "ru"
    }
  },
  "metadata": {
    "created": "2024-01-15T10:30:00Z",
    "updated": "2024-01-16T14:20:00Z"
  }
}`,
            array: `{
  "products": [
    {
      "id": 1,
      "name": "Laptop",
      "price": 999.99,
      "tags": ["electronics", "computer", "portable"]
    },
    {
      "id": 2,
      "name": "Mouse",
      "price": 29.99,
      "tags": ["electronics", "accessory"]
    },
    {
      "id": 3,
      "name": "Keyboard",
      "price": 89.99,
      "tags": ["electronics", "accessory", "input"]
    }
  ],
  "total": 3,
  "categories": ["electronics", "accessories"]
}`,
            complex: `{
  "api": {
    "version": "1.0.0",
    "endpoints": {
      "/users": {
        "GET": {
          "description": "Get all users",
          "parameters": {
            "page": {"type": "integer", "default": 1},
            "limit": {"type": "integer", "default": 10}
          },
          "responses": {
            "200": {"description": "Success"},
            "400": {"description": "Bad request"}
          }
        },
        "POST": {
          "description": "Create new user",
          "body": {
            "name": {"type": "string", "required": true},
            "email": {"type": "string", "required": true}
          }
        }
      }
    }
  },
  "config": {
    "database": {
      "host": "localhost",
      "port": 5432,
      "name": "myapp",
      "ssl": true
    },
    "cache": {
      "enabled": true,
      "ttl": 3600,
      "redis": {
        "host": "localhost",
        "port": 6379
      }
    }
  }
}`
        };
    }

    showNotification(message, type = 'success') {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => notification.remove());

        // Create new notification
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Show notification
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Hide notification after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Initialize the formatter when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new JSONFormatter();
});

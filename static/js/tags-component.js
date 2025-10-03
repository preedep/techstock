// Professional Tags Dropdown Component
class TagsDropdown {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        this.options = {
            placeholder: 'เลือกหรือเพิ่ม tags...',
            maxTags: 10,
            allowCustom: true,
            searchable: true,
            apiEndpoint: '/api/v1/tags',
            ...options
        };
        
        this.tags = new Set();
        this.availableTags = new Map(); // key -> {key, values: Set()}
        this.selectedTags = new Map(); // key -> value
        this.isOpen = false;
        this.searchTerm = '';
        
        this.init();
        this.loadAvailableTags();
    }

    init() {
        this.render();
        this.attachEvents();
    }

    render() {
        this.container.innerHTML = `
            <div class="tags-dropdown" data-tags-dropdown>
                <div class="tags-input-container">
                    <div class="selected-tags" data-selected-tags></div>
                    <input type="text" 
                           class="tags-input" 
                           data-tags-input
                           placeholder="${this.options.placeholder}"
                           autocomplete="off">
                    <button type="button" class="tags-dropdown-toggle" data-dropdown-toggle>
                        <i class="fas fa-chevron-down"></i>
                    </button>
                </div>
                <div class="tags-dropdown-menu" data-dropdown-menu style="display: none;">
                    <div class="tags-search-section">
                        <input type="text" 
                               class="tags-search" 
                               data-tags-search
                               placeholder="ค้นหา tags..."
                               autocomplete="off">
                    </div>
                    <div class="tags-categories" data-tags-categories>
                        <div class="tags-loading">
                            <i class="fas fa-spinner fa-spin"></i> กำลังโหลด...
                        </div>
                    </div>
                    <div class="tags-custom-section">
                        <div class="tags-custom-input">
                            <input type="text" 
                                   class="custom-key-input" 
                                   data-custom-key
                                   placeholder="Key">
                            <span class="separator">:</span>
                            <input type="text" 
                                   class="custom-value-input" 
                                   data-custom-value
                                   placeholder="Value">
                            <button type="button" class="btn-add-custom" data-add-custom>
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.elements = {
            dropdown: this.container.querySelector('[data-tags-dropdown]'),
            input: this.container.querySelector('[data-tags-input]'),
            selectedTags: this.container.querySelector('[data-selected-tags]'),
            toggle: this.container.querySelector('[data-dropdown-toggle]'),
            menu: this.container.querySelector('[data-dropdown-menu]'),
            search: this.container.querySelector('[data-tags-search]'),
            categories: this.container.querySelector('[data-tags-categories]'),
            customKey: this.container.querySelector('[data-custom-key]'),
            customValue: this.container.querySelector('[data-custom-value]'),
            addCustom: this.container.querySelector('[data-add-custom]')
        };
    }

    attachEvents() {
        // Toggle dropdown
        this.elements.toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown();
        });

        // Input focus
        this.elements.input.addEventListener('focus', () => {
            this.openDropdown();
        });

        // Search functionality
        this.elements.search.addEventListener('input', (e) => {
            this.searchTerm = e.target.value.toLowerCase();
            this.filterTags();
        });

        // Custom tag addition
        this.elements.addCustom.addEventListener('click', () => {
            this.addCustomTag();
        });

        // Enter key for custom tags
        [this.elements.customKey, this.elements.customValue].forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.addCustomTag();
                }
            });
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.container.contains(e.target)) {
                this.closeDropdown();
            }
        });

        // Keyboard navigation
        this.elements.input.addEventListener('keydown', (e) => {
            this.handleKeyNavigation(e);
        });
    }

    async loadAvailableTags() {
        try {
            console.log('Loading tags from API...');
            const response = await fetch('/api/v1/tags');
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('Tags API response:', data);
            
            if (data.success) {
                const tagsData = data.data;
                
                // Convert to internal format
                this.availableTags.clear();
                
                // Process regular tags
                Object.entries(tagsData.tags).forEach(([key, values]) => {
                    this.availableTags.set(key, {
                        key,
                        values: new Set(values),
                        usage: values.length
                    });
                });
                
                // Add popular tags for better UX
                if (tagsData.popular_tags) {
                    tagsData.popular_tags.forEach(tag => {
                        if (!this.availableTags.has(tag.key)) {
                            this.availableTags.set(tag.key, {
                                key: tag.key,
                                values: new Set(),
                                usage: 0
                            });
                        }
                        this.availableTags.get(tag.key).values.add(tag.value);
                        this.availableTags.get(tag.key).usage += tag.count;
                    });
                }

                this.renderCategories();
            } else {
                throw new Error(data.message || 'Failed to load tags');
            }
        } catch (error) {
            console.error('Failed to load tags:', error);
            this.elements.categories.innerHTML = `
                <div class="tags-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    ไม่สามารถโหลด tags ได้: ${error.message}
                </div>
            `;
        }
    }

    renderCategories() {
        const categoriesHtml = Array.from(this.availableTags.entries())
            .sort(([,a], [,b]) => b.usage - a.usage) // Sort by usage
            .map(([key, data]) => {
                const valuesHtml = Array.from(data.values)
                    .map(value => `
                        <div class="tag-option ${this.selectedTags.has(key) && this.selectedTags.get(key) === value ? 'selected' : ''}" 
                             data-key="${key}" 
                             data-value="${value}">
                            <span class="tag-key">${key}</span>:
                            <span class="tag-value">${value}</span>
                        </div>
                    `).join('');

                return `
                    <div class="tag-category">
                        <div class="tag-category-header">
                            <span class="category-name">${key}</span>
                            <span class="category-count">${data.values.size}</span>
                        </div>
                        <div class="tag-category-options">
                            ${valuesHtml}
                        </div>
                    </div>
                `;
            }).join('');

        this.elements.categories.innerHTML = categoriesHtml;

        // Attach click events to tag options
        this.elements.categories.querySelectorAll('.tag-option').forEach(option => {
            option.addEventListener('click', () => {
                const key = option.dataset.key;
                const value = option.dataset.value;
                this.toggleTag(key, value);
            });
        });
    }

    filterTags() {
        const categories = this.elements.categories.querySelectorAll('.tag-category');
        
        categories.forEach(category => {
            const options = category.querySelectorAll('.tag-option');
            let visibleOptions = 0;

            options.forEach(option => {
                const text = option.textContent.toLowerCase();
                const isVisible = text.includes(this.searchTerm);
                option.style.display = isVisible ? 'flex' : 'none';
                if (isVisible) visibleOptions++;
            });

            // Hide category if no visible options
            category.style.display = visibleOptions > 0 ? 'block' : 'none';
        });
    }

    toggleTag(key, value) {
        if (this.selectedTags.has(key) && this.selectedTags.get(key) === value) {
            this.removeTag(key);
        } else {
            this.addTag(key, value);
        }
    }

    addTag(key, value) {
        if (this.selectedTags.size >= this.options.maxTags) {
            this.showMessage(`สามารถเลือกได้สูงสุด ${this.options.maxTags} tags`, 'warning');
            return;
        }

        this.selectedTags.set(key, value);
        this.renderSelectedTags();
        this.renderCategories(); // Update selection state
        this.triggerChange();
    }

    removeTag(key) {
        this.selectedTags.delete(key);
        this.renderSelectedTags();
        this.renderCategories(); // Update selection state
        this.triggerChange();
    }

    addCustomTag() {
        const key = this.elements.customKey.value.trim();
        const value = this.elements.customValue.value.trim();

        if (!key || !value) {
            this.showMessage('กรุณากรอก Key และ Value', 'error');
            return;
        }

        // Add to available tags if not exists
        if (!this.availableTags.has(key)) {
            this.availableTags.set(key, {
                key,
                values: new Set(),
                usage: 0
            });
        }
        
        this.availableTags.get(key).values.add(value);
        this.addTag(key, value);

        // Clear inputs
        this.elements.customKey.value = '';
        this.elements.customValue.value = '';
        
        this.renderCategories();
    }

    renderSelectedTags() {
        const tagsHtml = Array.from(this.selectedTags.entries())
            .map(([key, value]) => `
                <div class="selected-tag" data-key="${key}">
                    <span class="selected-tag-content">
                        <span class="selected-tag-key">${key}</span>:
                        <span class="selected-tag-value">${value}</span>
                    </span>
                    <button type="button" class="remove-tag" data-remove-key="${key}">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `).join('');

        this.elements.selectedTags.innerHTML = tagsHtml;

        // Attach remove events
        this.elements.selectedTags.querySelectorAll('.remove-tag').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const key = btn.dataset.removeKey;
                this.removeTag(key);
            });
        });
    }

    toggleDropdown() {
        if (this.isOpen) {
            this.closeDropdown();
        } else {
            this.openDropdown();
        }
    }

    openDropdown() {
        this.isOpen = true;
        this.elements.menu.style.display = 'block';
        this.elements.dropdown.classList.add('open');
        this.elements.search.focus();
    }

    closeDropdown() {
        this.isOpen = false;
        this.elements.menu.style.display = 'none';
        this.elements.dropdown.classList.remove('open');
        this.searchTerm = '';
        this.elements.search.value = '';
        this.filterTags();
    }

    handleKeyNavigation(e) {
        // Handle keyboard navigation here
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (!this.isOpen) {
                    this.openDropdown();
                }
                break;
            case 'Escape':
                this.closeDropdown();
                break;
        }
    }

    showMessage(message, type = 'info') {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = `tag-message tag-message-${type}`;
        toast.innerHTML = `
            <i class="fas fa-${type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
            ${message}
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    triggerChange() {
        const event = new CustomEvent('tagschange', {
            detail: {
                tags: Object.fromEntries(this.selectedTags),
                tagsArray: Array.from(this.selectedTags.entries())
            }
        });
        this.container.dispatchEvent(event);
    }

    // Public methods
    getValue() {
        return Object.fromEntries(this.selectedTags);
    }

    setValue(tags) {
        this.selectedTags.clear();
        if (tags && typeof tags === 'object') {
            Object.entries(tags).forEach(([key, value]) => {
                this.selectedTags.set(key, value);
            });
        }
        this.renderSelectedTags();
        this.renderCategories();
    }

    clear() {
        this.selectedTags.clear();
        this.renderSelectedTags();
        this.renderCategories();
        this.triggerChange();
    }

    getTagsString() {
        return Array.from(this.selectedTags.entries())
            .map(([key, value]) => `${key}:${value}`)
            .join(',');
    }

    setTagsString(tagsString) {
        this.selectedTags.clear();
        
        if (tagsString && tagsString.trim()) {
            tagsString.split(',').forEach(tagPair => {
                const [key, value] = tagPair.trim().split(':');
                if (key && value) {
                    this.selectedTags.set(key.trim(), value.trim());
                }
            });
        }
        
        this.renderSelectedTags();
        this.renderCategories();
    }
}

// Export for use in main application
window.TagsDropdown = TagsDropdown;

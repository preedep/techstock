/**
 * Searchable Dropdown Component
 * A reusable component for creating searchable dropdown lists
 */
class SearchableDropdown {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        
        if (!this.container) {
            console.error('SearchableDropdown: Container not found!', container);
            return;
        }

        this.options = {
            placeholder: options.placeholder || 'Search...',
            emptyMessage: options.emptyMessage || 'No items found',
            disabled: options.disabled || false,
            allowClear: options.allowClear !== false,
            ...options
        };

        this.items = [];
        this.filteredItems = [];
        this.selectedItem = null;
        this.isOpen = false;
        this.searchTerm = '';

        this.init();
    }

    init() {
        this.render();
        this.bindEvents();
    }

    render() {
        this.container.innerHTML = `
            <div class="searchable-dropdown ${this.options.disabled ? 'disabled' : ''}">
                <div class="dropdown-input-container" data-toggle>
                    <input type="text" 
                           class="dropdown-input" 
                           placeholder="${this.options.placeholder}"
                           ${this.options.disabled ? 'disabled' : ''}
                           readonly>
                    <div class="dropdown-icons">
                        <i class="fas fa-times clear-icon" data-clear style="display: none;"></i>
                        <i class="fas fa-chevron-down toggle-icon" data-toggle-icon></i>
                    </div>
                </div>
                <div class="dropdown-menu" data-menu style="display: none;">
                    <div class="dropdown-search">
                        <input type="text" 
                               class="search-input" 
                               placeholder="Search..."
                               data-search>
                    </div>
                    <div class="dropdown-items" data-items></div>
                </div>
            </div>
        `;

        this.elements = {
            dropdown: this.container.querySelector('.searchable-dropdown'),
            inputContainer: this.container.querySelector('.dropdown-input-container'),
            input: this.container.querySelector('.dropdown-input'),
            clearIcon: this.container.querySelector('.clear-icon'),
            toggleIcon: this.container.querySelector('.toggle-icon'),
            menu: this.container.querySelector('.dropdown-menu'),
            searchInput: this.container.querySelector('.search-input'),
            itemsContainer: this.container.querySelector('.dropdown-items')
        };
    }

    bindEvents() {
        // Toggle dropdown
        this.elements.inputContainer.addEventListener('click', (e) => {
            if (this.options.disabled) return;
            e.stopPropagation();
            this.toggle();
        });

        // Clear selection
        this.elements.clearIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            this.clear();
        });

        // Search functionality
        this.elements.searchInput.addEventListener('input', (e) => {
            this.searchTerm = e.target.value.toLowerCase();
            this.filterItems();
            this.renderItems();
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!this.container.contains(e.target)) {
                this.close();
            }
        });

        // Keyboard navigation
        this.elements.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.close();
            }
        });
    }

    setItems(items) {
        this.items = items || [];
        this.filterItems();
        this.renderItems();
    }

    filterItems() {
        if (!this.searchTerm) {
            this.filteredItems = [...this.items];
        } else {
            this.filteredItems = this.items.filter(item => 
                item.name.toLowerCase().includes(this.searchTerm) ||
                (item.description && item.description.toLowerCase().includes(this.searchTerm))
            );
        }
    }

    renderItems() {
        if (this.filteredItems.length === 0) {
            this.elements.itemsContainer.innerHTML = `
                <div class="dropdown-empty">
                    <i class="fas fa-search"></i>
                    <span>${this.options.emptyMessage}</span>
                </div>
            `;
            return;
        }

        this.elements.itemsContainer.innerHTML = this.filteredItems.map(item => `
            <div class="dropdown-item ${this.selectedItem && this.selectedItem.id === item.id ? 'selected' : ''}" 
                 data-value="${item.id}">
                <div class="item-content">
                    <div class="item-name">${item.name}</div>
                    ${item.description ? `<div class="item-description">${item.description}</div>` : ''}
                </div>
            </div>
        `).join('');

        // Bind item click events
        this.elements.itemsContainer.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const value = e.currentTarget.dataset.value;
                const selectedItem = this.filteredItems.find(item => item.id == value);
                this.selectItem(selectedItem);
            });
        });
    }

    selectItem(item) {
        this.selectedItem = item;
        this.elements.input.value = item ? item.name : '';
        this.elements.clearIcon.style.display = item ? 'block' : 'none';
        this.close();
        this.dispatchChange();
    }

    clear() {
        this.selectedItem = null;
        this.elements.input.value = '';
        this.elements.clearIcon.style.display = 'none';
        this.dispatchChange();
    }

    getValue() {
        return this.selectedItem ? this.selectedItem.id : null;
    }

    setValue(value) {
        const item = this.items.find(item => item.id == value);
        this.selectItem(item || null);
    }

    getText() {
        return this.selectedItem ? this.selectedItem.name : '';
    }

    open() {
        if (this.options.disabled) return;
        
        this.isOpen = true;
        this.elements.menu.style.display = 'block';
        this.elements.toggleIcon.style.transform = 'rotate(180deg)';
        this.elements.dropdown.classList.add('open');
        
        // Focus search input
        setTimeout(() => {
            this.elements.searchInput.focus();
        }, 100);
    }

    close() {
        this.isOpen = false;
        this.elements.menu.style.display = 'none';
        this.elements.toggleIcon.style.transform = 'rotate(0deg)';
        this.elements.dropdown.classList.remove('open');
        
        // Reset search
        this.elements.searchInput.value = '';
        this.searchTerm = '';
        this.filterItems();
        this.renderItems();
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    setDisabled(disabled) {
        this.options.disabled = disabled;
        this.elements.input.disabled = disabled;
        this.elements.dropdown.classList.toggle('disabled', disabled);
        
        if (disabled) {
            this.close();
        }
    }

    dispatchChange() {
        const event = new CustomEvent('change', {
            detail: {
                value: this.getValue(),
                text: this.getText(),
                item: this.selectedItem
            }
        });
        this.container.dispatchEvent(event);
    }
}

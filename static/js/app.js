// TechStock Web Application
class TechStockApp {
    constructor() {
        this.currentPage = 1;
        this.pageSize = 20;
        this.sortField = null;
        this.sortDirection = null;
        this.filters = {};
        this.subscriptions = [];
        this.resources = [];
        this.currentTab = 'resources';
        
        // Initialize API client with loading management
        this.loadingManager = new LoadingManager();
        this.apiClient = new RetryableApiClient('', this.loadingManager, 3);
        
        // Initialize Tags Components
        this.searchTagsDropdown = null;
        this.modalTagsDropdown = null;
        
        this.init();
    }

    init() {
        // Setup loading manager
        this.loadingManager.setLoadingElement(document.getElementById('loading'));
        
        this.setupEventListeners();
        this.setupTagsComponents();
        this.loadSubscriptions();
        this.loadResources();
        this.setupColumnToggle();
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Search and filter
        document.getElementById('search-btn').addEventListener('click', () => {
            this.applyFilters();
        });

        document.getElementById('clear-btn').addEventListener('click', () => {
            this.clearFilters();
        });

        // Search on Enter key
        document.getElementById('search-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.applyFilters();
            }
        });

        document.getElementById('tags-search').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.applyFilters();
            }
        });

        // Add buttons
        document.getElementById('add-resource-btn').addEventListener('click', () => {
            this.openResourceModal();
        });

        document.getElementById('add-subscription-btn').addEventListener('click', () => {
            this.openSubscriptionModal();
        });

        // Column toggle
        document.getElementById('column-toggle-btn').addEventListener('click', () => {
            this.toggleColumnPanel();
        });

        // Pagination
        document.getElementById('prev-page').addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.loadResources();
            }
        });

        document.getElementById('next-page').addEventListener('click', () => {
            this.currentPage++;
            this.loadResources();
        });

        document.getElementById('page-size').addEventListener('change', (e) => {
            this.pageSize = parseInt(e.target.value);
            this.currentPage = 1;
            this.loadResources();
        });

        // Modal events
        this.setupModalEvents();

        // Table sorting
        this.setupTableSorting();

        // Column visibility
        this.setupColumnVisibility();
    }

    setupTagsComponents() {
        // Initialize search tags dropdown
        const searchContainer = document.getElementById('tags-dropdown-container');
        if (searchContainer) {
            this.searchTagsDropdown = new TagsDropdown(searchContainer, {
                placeholder: 'ค้นหาด้วย tags...',
                maxTags: 5,
                allowCustom: true
            });

            // Listen for changes
            searchContainer.addEventListener('tagschange', (e) => {
                this.filters.tags = this.searchTagsDropdown.getTagsString();
            });
        }

        // Initialize modal tags dropdown
        const modalContainer = document.getElementById('modal-tags-dropdown-container');
        if (modalContainer) {
            this.modalTagsDropdown = new TagsDropdown(modalContainer, {
                placeholder: 'เลือก tags สำหรับ resource...',
                maxTags: 15,
                allowCustom: true
            });
        }
    }

    setupModalEvents() {
        // Resource modal
        const resourceModal = document.getElementById('resource-modal');
        const subscriptionModal = document.getElementById('subscription-modal');

        // Close buttons
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', () => {
                resourceModal.style.display = 'none';
                subscriptionModal.style.display = 'none';
            });
        });

        // Cancel buttons
        document.getElementById('cancel-btn').addEventListener('click', () => {
            resourceModal.style.display = 'none';
        });

        document.getElementById('subscription-cancel-btn').addEventListener('click', () => {
            subscriptionModal.style.display = 'none';
        });

        // Form submissions
        document.getElementById('resource-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveResource();
        });

        document.getElementById('subscription-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSubscription();
        });

        // Click outside modal to close
        window.addEventListener('click', (e) => {
            if (e.target === resourceModal) {
                resourceModal.style.display = 'none';
            }
            if (e.target === subscriptionModal) {
                subscriptionModal.style.display = 'none';
            }
        });
    }

    setupTableSorting() {
        document.querySelectorAll('.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const field = th.dataset.sort;
                
                if (this.sortField === field) {
                    // Toggle direction
                    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    // New field
                    this.sortField = field;
                    this.sortDirection = 'asc';
                }

                // Update UI
                document.querySelectorAll('.sortable').forEach(header => {
                    header.classList.remove('sort-asc', 'sort-desc');
                });

                th.classList.add(`sort-${this.sortDirection}`);

                // Reload data
                this.currentPage = 1;
                this.loadResources();
            });
        });
    }

    setupColumnToggle() {
        const columnCheckboxes = document.querySelectorAll('.column-checkboxes input[type="checkbox"]');
        
        columnCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.toggleColumn(checkbox.dataset.column, checkbox.checked);
            });
        });
    }

    setupColumnVisibility() {
        // Initialize column visibility from localStorage
        const savedColumns = JSON.parse(localStorage.getItem('techstock-columns') || '{}');
        
        Object.keys(savedColumns).forEach(column => {
            const checkbox = document.querySelector(`input[data-column="${column}"]`);
            if (checkbox) {
                checkbox.checked = savedColumns[column];
                this.toggleColumn(column, savedColumns[column]);
            }
        });
    }

    toggleColumn(columnName, visible) {
        const table = document.getElementById('resources-table');
        const columnIndex = this.getColumnIndex(columnName);
        
        if (columnIndex === -1) return;

        // Toggle header
        const header = table.querySelector(`th:nth-child(${columnIndex + 1})`);
        if (header) {
            header.classList.toggle('hidden', !visible);
        }

        // Toggle cells
        const cells = table.querySelectorAll(`td:nth-child(${columnIndex + 1})`);
        cells.forEach(cell => {
            cell.classList.toggle('hidden', !visible);
        });

        // Save to localStorage
        const savedColumns = JSON.parse(localStorage.getItem('techstock-columns') || '{}');
        savedColumns[columnName] = visible;
        localStorage.setItem('techstock-columns', JSON.stringify(savedColumns));
    }

    getColumnIndex(columnName) {
        const columnMap = {
            'id': 0,
            'name': 1,
            'type': 2,
            'location': 3,
            'subscription': 4,
            'environment': 5,
            'vendor': 6,
            'tags': 7,
            'created': 8,
            'actions': 9
        };
        return columnMap[columnName] || -1;
    }

    toggleColumnPanel() {
        const panel = document.getElementById('column-panel');
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');

        this.currentTab = tabName;

        // Load data for the active tab
        if (tabName === 'subscriptions') {
            this.loadSubscriptions();
        }
    }

    async loadSubscriptions() {
        try {
            const data = await this.apiClient.getSubscriptions();
            
            if (data.success) {
                this.subscriptions = data.data.items || data.data;
                this.renderSubscriptions();
                this.populateSubscriptionSelect();
            } else {
                this.showToast('Error loading subscriptions: ' + (data.message || 'Unknown error'), 'error');
            }
        } catch (error) {
            console.error('Failed to load subscriptions:', error);
            this.showToast(error.getUserMessage(), 'error');
        }
    }

    async loadResources() {
        try {
            const params = {
                page: this.currentPage,
                size: this.pageSize
            };

            // Add filters
            if (this.filters.search) {
                params.search = this.filters.search;
            }
            if (this.filters.resource_type) {
                params.resource_type = this.filters.resource_type;
            }
            if (this.filters.location) {
                params.location = this.filters.location;
            }
            if (this.filters.environment) {
                params.environment = this.filters.environment;
            }
            if (this.filters.vendor) {
                params.vendor = this.filters.vendor;
            }
            if (this.filters.tags) {
                params.tags = this.filters.tags;
            }

            // Add sorting
            if (this.sortField) {
                params.sort_field = this.sortField;
                params.sort_direction = this.sortDirection;
            }

            const data = await this.apiClient.getResources(params);
            
            if (data.success) {
                this.resources = data.data.items;
                this.renderResources();
                this.updatePagination(data.data.pagination);
                this.updateResourceCount(data.data.pagination.total);
                this.populateFilterOptions();
            } else {
                this.showToast('Error loading resources: ' + (data.message || 'Unknown error'), 'error');
            }
        } catch (error) {
            console.error('Failed to load resources:', error);
            this.showToast(error.getUserMessage(), 'error');
        }
    }

    renderResources() {
        const tbody = document.getElementById('resources-tbody');
        tbody.innerHTML = '';

        this.resources.forEach(resource => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${resource.id}</td>
                <td>${resource.name}</td>
                <td>${resource.resource_type || ''}</td>
                <td>${resource.location || ''}</td>
                <td>${this.getSubscriptionName(resource.subscription_id)}</td>
                <td>${resource.environment || ''}</td>
                <td>${resource.vendor || ''}</td>
                <td>${this.renderTags(resource.tags)}</td>
                <td>${this.formatDate(resource.created_at)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-warning" onclick="app.editResource(${resource.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="app.deleteResource(${resource.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    renderSubscriptions() {
        const tbody = document.getElementById('subscriptions-tbody');
        tbody.innerHTML = '';

        this.subscriptions.forEach(subscription => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${subscription.id}</td>
                <td>${subscription.name}</td>
                <td>${subscription.tenant_id || ''}</td>
                <td>${this.formatDate(subscription.created_at)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-warning" onclick="app.editSubscription(${subscription.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="app.deleteSubscription(${subscription.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    renderTags(tags) {
        if (!tags || Object.keys(tags).length === 0) {
            return '<span class="text-muted">-</span>';
        }

        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'tags-container';

        Object.entries(tags).forEach(([key, value]) => {
            const tag = document.createElement('span');
            tag.className = 'tag';
            tag.innerHTML = `<span class="tag-key">${key}</span>:<span class="tag-value">${value}</span>`;
            tagsContainer.appendChild(tag);
        });

        return tagsContainer.outerHTML;
    }

    getSubscriptionName(subscriptionId) {
        const subscription = this.subscriptions.find(s => s.id === subscriptionId);
        return subscription ? subscription.name : `ID: ${subscriptionId}`;
    }

    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    updatePagination(pagination) {
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        const pageInfo = document.getElementById('page-info');

        prevBtn.disabled = pagination.page <= 1;
        nextBtn.disabled = pagination.page >= pagination.total_pages;
        
        pageInfo.textContent = `หน้า ${pagination.page} จาก ${pagination.total_pages}`;
    }

    updateResourceCount(total) {
        document.getElementById('resource-count').textContent = `${total} รายการ`;
    }

    populateFilterOptions() {
        // Populate filter dropdowns with unique values from current data
        const types = [...new Set(this.resources.map(r => r.resource_type).filter(Boolean))];
        const locations = [...new Set(this.resources.map(r => r.location).filter(Boolean))];
        const environments = [...new Set(this.resources.map(r => r.environment).filter(Boolean))];

        this.populateSelect('type-filter', types);
        this.populateSelect('location-filter', locations);
        this.populateSelect('environment-filter', environments);
    }

    populateSelect(selectId, options) {
        const select = document.getElementById(selectId);
        const currentValue = select.value;
        
        // Keep first option (All)
        const firstOption = select.firstElementChild;
        select.innerHTML = '';
        select.appendChild(firstOption);

        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option;
            optionElement.textContent = option;
            select.appendChild(optionElement);
        });

        select.value = currentValue;
    }

    populateSubscriptionSelect() {
        const select = document.getElementById('subscription-select');
        select.innerHTML = '<option value="">เลือก Subscription</option>';

        this.subscriptions.forEach(subscription => {
            const option = document.createElement('option');
            option.value = subscription.id;
            option.textContent = subscription.name;
            select.appendChild(option);
        });
    }

    applyFilters() {
        this.filters = {
            search: document.getElementById('search-input').value.trim(),
            resource_type: document.getElementById('type-filter').value,
            location: document.getElementById('location-filter').value,
            environment: document.getElementById('environment-filter').value,
            vendor: document.getElementById('vendor-filter').value
        };

        // Handle tags search
        const tagsSearch = document.getElementById('tags-search').value.trim();
        if (tagsSearch) {
            this.filters.tags = tagsSearch;
        }

        this.currentPage = 1;
        this.loadResources();
    }

    clearFilters() {
        document.getElementById('search-input').value = '';
        document.getElementById('type-filter').value = '';
        document.getElementById('location-filter').value = '';
        document.getElementById('environment-filter').value = '';
        document.getElementById('vendor-filter').value = '';

        // Clear tags dropdown
        if (this.searchTagsDropdown) {
            this.searchTagsDropdown.clear();
        }

        this.filters = {};
        this.currentPage = 1;
        this.loadResources();
    }

    openResourceModal(resource = null) {
        const modal = document.getElementById('resource-modal');
        const title = document.getElementById('modal-title');
        const form = document.getElementById('resource-form');

        if (resource) {
            title.textContent = 'แก้ไข Resource';
            this.populateResourceForm(resource);
        } else {
            title.textContent = 'เพิ่ม Resource';
            form.reset();
            document.getElementById('resource-id').value = '';
        }

        modal.style.display = 'block';
    }

    openSubscriptionModal(subscription = null) {
        const modal = document.getElementById('subscription-modal');
        const title = document.getElementById('subscription-modal-title');
        const form = document.getElementById('subscription-form');

        if (subscription) {
            title.textContent = 'แก้ไข Subscription';
            this.populateSubscriptionForm(subscription);
        } else {
            title.textContent = 'เพิ่ม Subscription';
            form.reset();
            document.getElementById('subscription-id').value = '';
        }

        modal.style.display = 'block';
    }

    populateResourceForm(resource) {
        document.getElementById('resource-id').value = resource.id;
        document.getElementById('resource-name').value = resource.name;
        document.getElementById('resource-type').value = resource.resource_type || '';
        document.getElementById('resource-kind').value = resource.kind || '';
        document.getElementById('resource-location').value = resource.location || '';
        document.getElementById('subscription-select').value = resource.subscription_id || '';
        document.getElementById('resource-group-id').value = resource.resource_group_id || '';
        document.getElementById('resource-environment').value = resource.environment || '';
        document.getElementById('resource-vendor').value = resource.vendor || '';
        document.getElementById('resource-provisioner').value = resource.provisioner || '';
        
        // Set tags using dropdown component
        if (this.modalTagsDropdown && resource.tags) {
            this.modalTagsDropdown.setValue(resource.tags);
        }
    }

    populateSubscriptionForm(subscription) {
        document.getElementById('subscription-id').value = subscription.id;
        document.getElementById('subscription-name').value = subscription.name;
        document.getElementById('subscription-tenant-id').value = subscription.tenant_id || '';
    }

    async saveResource() {
        try {
            const formData = this.getResourceFormData();
            const resourceId = document.getElementById('resource-id').value;
            
            let data;
            if (resourceId) {
                // Update
                data = await this.apiClient.updateResource(resourceId, formData);
            } else {
                // Create
                data = await this.apiClient.createResource(formData);
            }
            
            if (data.success) {
                this.showToast(data.message || 'Resource saved successfully', 'success');
                document.getElementById('resource-modal').style.display = 'none';
                this.loadResources();
            } else {
                this.showToast('Error saving resource: ' + (data.message || 'Unknown error'), 'error');
            }
        } catch (error) {
            console.error('Failed to save resource:', error);
            this.showToast(error.getUserMessage(), 'error');
        }
    }

    async saveSubscription() {
        try {
            const formData = this.getSubscriptionFormData();
            const subscriptionId = document.getElementById('subscription-id').value;
            
            let data;
            if (subscriptionId) {
                // Update
                data = await this.apiClient.updateSubscription(subscriptionId, formData);
            } else {
                // Create
                data = await this.apiClient.createSubscription(formData);
            }
            
            if (data.success) {
                this.showToast(data.message || 'Subscription saved successfully', 'success');
                document.getElementById('subscription-modal').style.display = 'none';
                this.loadSubscriptions();
                this.populateSubscriptionSelect();
            } else {
                this.showToast('Error saving subscription: ' + (data.message || 'Unknown error'), 'error');
            }
        } catch (error) {
            console.error('Failed to save subscription:', error);
            this.showToast(error.getUserMessage(), 'error');
        }
    }

    getResourceFormData() {
        // Get tags from dropdown component
        let tags = null;
        if (this.modalTagsDropdown) {
            const tagsValue = this.modalTagsDropdown.getValue();
            if (Object.keys(tagsValue).length > 0) {
                tags = tagsValue;
            }
        }

        return {
            name: document.getElementById('resource-name').value,
            resource_type: document.getElementById('resource-type').value,
            kind: document.getElementById('resource-kind').value || null,
            location: document.getElementById('resource-location').value,
            subscription_id: parseInt(document.getElementById('subscription-select').value),
            resource_group_id: document.getElementById('resource-group-id').value ? 
                parseInt(document.getElementById('resource-group-id').value) : null,
            environment: document.getElementById('resource-environment').value || null,
            vendor: document.getElementById('resource-vendor').value || null,
            provisioner: document.getElementById('resource-provisioner').value || null,
            tags: tags
        };
    }

    getSubscriptionFormData() {
        return {
            name: document.getElementById('subscription-name').value,
            tenant_id: document.getElementById('subscription-tenant-id').value || null
        };
    }

    async editResource(id) {
        const resource = this.resources.find(r => r.id === id);
        if (resource) {
            this.openResourceModal(resource);
        }
    }

    async editSubscription(id) {
        const subscription = this.subscriptions.find(s => s.id === id);
        if (subscription) {
            this.openSubscriptionModal(subscription);
        }
    }

    async deleteResource(id) {
        if (!confirm('คุณแน่ใจหรือไม่ที่จะลบ resource นี้?')) {
            return;
        }

        try {
            const data = await this.apiClient.deleteResource(id);
            this.showToast('Resource deleted successfully', 'success');
            this.loadResources();
        } catch (error) {
            console.error('Failed to delete resource:', error);
            this.showToast(error.getUserMessage(), 'error');
        }
    }

    async deleteSubscription(id) {
        if (!confirm('คุณแน่ใจหรือไม่ที่จะลบ subscription นี้?')) {
            return;
        }

        try {
            const data = await this.apiClient.deleteSubscription(id);
            this.showToast('Subscription deleted successfully', 'success');
            this.loadSubscriptions();
            this.populateSubscriptionSelect();
        } catch (error) {
            console.error('Failed to delete subscription:', error);
            this.showToast(error.getUserMessage(), 'error');
        }
    }


    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <i class="fas fa-${this.getToastIcon(type)}"></i>
                <span>${message}</span>
            </div>
        `;

        container.appendChild(toast);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);

        // Click to remove
        toast.addEventListener('click', () => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        });
    }

    getToastIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }
}

// Initialize the application
const app = new TechStockApp();

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
        
        // Force no-cache for all requests
        this.setupNoCacheHeaders();
        
        // Initialize Tags Components
        this.searchTagsDropdown = null;
        this.modalTagsDropdown = null;
        
        // Initialize Resource Groups
        this.resourceGroups = [];
        this.resourceGroupDropdown = null;
        
        // Loading states to prevent duplicate requests
        this.loadingStates = {
            resources: false,
            subscriptions: false,
            resourceGroups: false
        };
        
        // Debounce timer for filters
        this.filterDebounceTimer = null;
        
        // Cache for loaded data
        this.dataCache = {
            subscriptions: null,
            resourceGroups: null,
            lastResourcesQuery: null
        };
        
        // Resource Group name cache
        this.resourceGroupNameCache = new Map();
        
        // AbortController for request cancellation
        this.abortControllers = {
            resources: null,
            subscriptions: null,
            resourceGroups: null
        };
        
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.initializeApp();
            });
        } else {
            this.initializeApp();
        }
    }

    initializeApp() {
        console.log('Initializing TechStock App...');
        
        // Setup loading manager
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            this.loadingManager.setLoadingElement(loadingElement);
        } else {
            console.warn('Loading element not found');
        }
        
        this.setupEventListeners();
        this.setupTagsComponents();
        this.setupResourceGroupDropdown();
        this.loadSubscriptions();
        this.loadResourceTypes();
        this.loadResources();
        this.setupColumnToggle();
    }

    setupNoCacheHeaders() {
        // Override fetch to add no-cache headers
        const originalFetch = window.fetch;
        window.fetch = function(url, options = {}) {
            options.headers = {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
                ...(options.headers || {})
            };
            return originalFetch(url, options);
        };
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        // Tab switching
        const tabBtns = document.querySelectorAll('.tab-btn');
        console.log('Found tab buttons:', tabBtns.length);
        tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Search and filter
        const searchBtn = document.getElementById('search-btn');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                this.applyFilters();
            });
        } else {
            console.warn('Search button not found');
        }

        const clearBtn = document.getElementById('clear-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearFilters();
            });
        } else {
            console.warn('Clear button not found');
        }

        // Search on Enter key and input change
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.applyFilters();
                }
            });
            searchInput.addEventListener('input', () => {
                this.debouncedApplyFilters();
            });
        } else {
            console.warn('Search input not found');
        }

        const tagsSearch = document.getElementById('tags-search');
        if (tagsSearch) {
            tagsSearch.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.applyFilters();
                }
            });
        } else {
            console.warn('Tags search not found');
        }

        // Add buttons
        const addResourceBtn = document.getElementById('add-resource-btn');
        if (addResourceBtn) {
            addResourceBtn.addEventListener('click', () => {
                this.openResourceModal();
            });
        } else {
            console.warn('Add resource button not found');
        }

        const addSubscriptionBtn = document.getElementById('add-subscription-btn');
        if (addSubscriptionBtn) {
            addSubscriptionBtn.addEventListener('click', () => {
                this.openSubscriptionModal();
            });
        } else {
            console.warn('Add subscription button not found');
        }

        // Column toggle
        const columnToggleBtn = document.getElementById('column-toggle-btn');
        if (columnToggleBtn) {
            columnToggleBtn.addEventListener('click', () => {
                this.toggleColumnPanel();
            });
        } else {
            console.warn('Column toggle button not found');
        }

        // Pagination
        const prevPageBtn = document.getElementById('prev-page');
        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.loadResources();
                }
            });
        } else {
            console.warn('Previous page button not found');
        }

        const nextPageBtn = document.getElementById('next-page');
        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', () => {
                this.currentPage++;
                this.loadResources();
            });
        } else {
            console.warn('Next page button not found');
        }

        const pageSizeSelect = document.getElementById('page-size');
        if (pageSizeSelect) {
            pageSizeSelect.addEventListener('change', (e) => {
                this.pageSize = parseInt(e.target.value);
                this.currentPage = 1;
                this.loadResources();
            });
        } else {
            console.warn('Page size select not found');
        }

        // Filter change events
        const filterIds = ['type-filter', 'location-filter', 'environment-filter', 'vendor-filter'];
        filterIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', () => {
                    this.debouncedApplyFilters();
                });
            } else {
                console.warn(`Filter element not found: ${id}`);
            }
        });

        // Special handling for subscription filter - update resource groups when changed
        const subscriptionFilter = document.getElementById('subscription-filter');
        if (subscriptionFilter) {
            subscriptionFilter.addEventListener('change', async () => {
                await this.updateResourceGroupDropdown();
                this.debouncedApplyFilters();
            });
        } else {
            console.warn('Subscription filter not found');
        }

        // Modal events
        this.setupModalEvents();

        // Table sorting
        this.setupTableSorting();

        // Column visibility
        this.setupColumnVisibility();
    }

    setupTagsComponents() {
        console.log('Setting up tags components...');
        
        // Initialize search tags dropdown
        const searchContainer = document.getElementById('tags-dropdown-container');
        if (searchContainer) {
            console.log('Found search tags container, initializing...');
            this.searchTagsDropdown = new TagsDropdown(searchContainer, {
                placeholder: 'ค้นหาด้วย tags...',
                maxTags: 5,
                allowCustom: true
            });

            // Listen for changes
            searchContainer.addEventListener('tagschange', (e) => {
                console.log('Tags changed:', e.detail);
                this.filters.tags = this.searchTagsDropdown.getTagsString();
                // Auto-apply filters when tags change
                this.debouncedApplyFilters();
            });
        } else {
            console.error('Search tags container not found!');
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

    setupResourceGroupDropdown() {
        const container = document.getElementById('resource-group-dropdown-container');
        if (container) {
            this.resourceGroupDropdown = new SearchableDropdown(container, {
                placeholder: 'เลือก Resource Group...',
                emptyMessage: 'ไม่พบ Resource Group',
                disabled: true
            });

            // Listen for changes
            container.addEventListener('change', (e) => {
                console.log('Resource Group changed:', e.detail);
                this.debouncedApplyFilters();
            });
        } else {
            console.error('Resource group dropdown container not found!');
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
        if (this.loadingStates.subscriptions) {
            console.log('Subscriptions already loading, skipping...');
            return;
        }
        
        // Check cache first
        if (this.dataCache.subscriptions) {
            console.log('Using cached subscriptions');
            this.subscriptions = this.dataCache.subscriptions;
            this.renderSubscriptions();
            this.populateSubscriptionSelect();
            return;
        }
        
        this.loadingStates.subscriptions = true;
        
        try {
            const data = await this.apiClient.getSubscriptions();
            
            if (data.success) {
                this.subscriptions = data.data.items || data.data;
                this.dataCache.subscriptions = this.subscriptions; // Cache the data
                this.renderSubscriptions();
                this.populateSubscriptionSelect();
            } else {
                this.showToast('Error loading subscriptions: ' + (data.message || 'Unknown error'), 'error');
            }
        } catch (error) {
            console.error('Failed to load subscriptions:', error);
            this.showToast(error.getUserMessage(), 'error');
        } finally {
            this.loadingStates.subscriptions = false;
        }
    }

    async loadResourceGroups() {
        if (this.loadingStates.resourceGroups) {
            console.log('Resource groups already loading, skipping...');
            return;
        }
        
        // Check cache first
        if (this.dataCache.resourceGroups) {
            console.log('Using cached resource groups');
            this.resourceGroups = this.dataCache.resourceGroups;
            return;
        }
        
        this.loadingStates.resourceGroups = true;
        
        try {
            const data = await this.apiClient.getResourceGroups();
            
            if (data.success) {
                this.resourceGroups = data.data || [];
                this.dataCache.resourceGroups = this.resourceGroups; // Cache the data
                console.log('Loaded resource groups:', this.resourceGroups.length);
            } else {
                this.showToast('Error loading resource groups: ' + (data.message || 'Unknown error'), 'error');
            }
        } catch (error) {
            console.error('Failed to load resource groups:', error);
            this.showToast(error.getUserMessage(), 'error');
        } finally {
            this.loadingStates.resourceGroups = false;
        }
    }

    async loadResourceTypes() {
        try {
            console.log('Loading resource types...');
            const data = await this.apiClient.getResourceTypes();
            
            if (data.success) {
                const resourceTypes = data.data || [];
                console.log('Loaded resource types:', resourceTypes.length);
                this.populateResourceTypesSelect(resourceTypes);
            } else {
                console.error('Failed to load resource types:', data.message);
                this.showToast('Error loading resource types: ' + (data.message || 'Unknown error'), 'error');
            }
        } catch (error) {
            console.error('Failed to load resource types:', error);
            this.showToast('Failed to load resource types', 'error');
        }
    }

    async loadResources() {
        // Prevent duplicate requests
        if (this.loadingStates.resources) {
            console.log('Resources already loading, skipping...');
            return;
        }
        
        // Cancel previous request if exists
        if (this.abortControllers.resources) {
            this.abortControllers.resources.abort();
        }
        
        this.loadingStates.resources = true;
        this.abortControllers.resources = new AbortController();
        
        // Show table loading state
        this.showTableLoading();
        
        try {
            console.log('Loading resources with filters:', this.filters);
            
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
            if (this.filters.subscription_id) {
                params.subscription_id = this.filters.subscription_id;
            }
            if (this.filters.resource_group_id) {
                params.resource_group_id = this.filters.resource_group_id;
            }
            if (this.filters.tags) {
                params.tags = this.filters.tags;
            }

            // Add sorting
            if (this.sortField) {
                params.sort_field = this.sortField;
                params.sort_direction = this.sortDirection;
            }

            const data = await this.apiClient.getResources(params, { 
                signal: this.abortControllers.resources.signal 
            });
            console.log('Resources API response:', data);
            
            if (data.success) {
                // Fix: check actual data structure
                console.log('Full API response structure:', Object.keys(data));
                
                if (data.data && Array.isArray(data.data)) {
                    // Case 1: data.data is array
                    this.resources = data.data;
                    console.log('Loaded resources (case 1):', this.resources.length);
                } else if (data.data && data.data.items) {
                    // Case 2: data.data.items is array  
                    this.resources = data.data.items;
                    console.log('Loaded resources (case 2):', this.resources.length);
                } else {
                    // Case 3: fallback
                    this.resources = [];
                    console.log('No resources found in response');
                }
                
                await this.renderResources();
                
                // Handle pagination
                const pagination = data.pagination || data.data?.pagination || { total: 0 };
                this.updatePagination(pagination);
                this.updateResourceCount(pagination.total || this.resources.length);
                
                // Only populate filter options if this is the first load or filters changed
                if (!this.dataCache.lastResourcesQuery || 
                    JSON.stringify(this.filters) !== this.dataCache.lastResourcesQuery) {
                    this.populateFilterOptions();
                    this.dataCache.lastResourcesQuery = JSON.stringify(this.filters);
                }
            } else {
                console.error('API error:', data.message);
                this.showToast('Error loading resources: ' + (data.message || 'Unknown error'), 'error');
            }
        } catch (error) {
            // Don't show error for aborted requests
            if (error.name === 'AbortError') {
                console.log('Resources request was cancelled');
                return;
            }
            console.error('Failed to load resources:', error);
            this.showToast(error.getUserMessage ? error.getUserMessage() : error.message, 'error');
        } finally {
            this.loadingStates.resources = false;
            this.abortControllers.resources = null;
            this.hideTableLoading();
        }
    }

    async renderResources() {
        console.log('Rendering resources:', this.resources.length);
        const tbody = document.getElementById('resources-tbody');
        
        if (!tbody) {
            console.error('Resources table body not found!');
            return;
        }
        
        tbody.innerHTML = '';

        if (this.resources.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11" class="text-center">ไม่พบข้อมูล</td></tr>';
            return;
        }

        // Process resources in batches to avoid blocking UI
        const batchSize = 10;
        for (let i = 0; i < this.resources.length; i += batchSize) {
            const batch = this.resources.slice(i, i + batchSize);
            
            // Process batch asynchronously
            const rows = await Promise.all(batch.map(async (resource) => {
                const resourceGroupName = await this.getResourceGroupName(resource.resource_group_id);
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${resource.id}</td>
                    <td>${resource.name}</td>
                    <td>${resource.resource_type || ''}</td>
                    <td>${resource.location || ''}</td>
                    <td>${this.getSubscriptionName(resource.subscription_id)}</td>
                    <td>${resourceGroupName}</td>
                    <td>${resource.environment || ''}</td>
                    <td>${resource.vendor || ''}</td>
                    <td>${this.renderTags(resource.tags_json)}</td>
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
                return row;
            }));
            
            // Append batch to table
            rows.forEach(row => tbody.appendChild(row));
            
            // Allow UI to update between batches
            if (i + batchSize < this.resources.length) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
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
        if (!tags) {
            return '<span class="text-muted">-</span>';
        }

        // Handle JSON object from database
        let tagsObj = tags;
        if (typeof tags === 'string') {
            try {
                tagsObj = JSON.parse(tags);
            } catch (e) {
                return '<span class="text-muted">-</span>';
            }
        }

        if (!tagsObj || Object.keys(tagsObj).length === 0) {
            return '<span class="text-muted">-</span>';
        }

        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'tags-container';

        // Show only first 3 tags to avoid clutter
        const entries = Object.entries(tagsObj).slice(0, 3);
        entries.forEach(([key, value]) => {
            const tag = document.createElement('span');
            tag.className = 'tag';
            tag.innerHTML = `<span class="tag-key">${key}</span>:<span class="tag-value">${value}</span>`;
            tagsContainer.appendChild(tag);
        });

        // Show count if more tags exist
        const totalTags = Object.keys(tagsObj).length;
        if (totalTags > 3) {
            const moreTag = document.createElement('span');
            moreTag.className = 'tag tag-more';
            moreTag.textContent = `+${totalTags - 3} more`;
            tagsContainer.appendChild(moreTag);
        }

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
        if (!this.resources || this.resources.length === 0) {
            console.log('No resources to populate filter options');
            return;
        }

        // Populate filter dropdowns with unique values from current data (except types)
        const locations = [...new Set(this.resources.map(r => r.location).filter(Boolean))];
        const environments = [...new Set(this.resources.map(r => r.environment).filter(Boolean))];
        const vendors = [...new Set(this.resources.map(r => r.vendor).filter(Boolean))];

        console.log('Populating filter options:', { 
            locations: locations.length, 
            environments: environments.length, 
            vendors: vendors.length 
        });
        console.log('Sample resource:', this.resources[0]);

        // Note: type-filter is populated from API in loadResourceTypes()
        this.populateSelect('location-filter', locations);
        this.populateSelect('environment-filter', environments);
        this.populateSelect('vendor-filter', vendors);
        this.populateSubscriptionSelect();
        this.updateResourceGroupDropdown();
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

    populateSubscriptionSelect() {
        const select = document.getElementById('subscription-filter');
        if (!select) {
            console.warn('Subscription filter select not found');
            return;
        }

        const currentValue = select.value;
        
        // Keep first option (All)
        const firstOption = select.firstElementChild;
        select.innerHTML = '';
        select.appendChild(firstOption);

        // Add subscription options
        this.subscriptions.forEach(subscription => {
            const option = document.createElement('option');
            option.value = subscription.id;
            option.textContent = subscription.name;
            select.appendChild(option);
        });

        // Restore previous selection
        if (currentValue) {
            select.value = currentValue;
        }
    }

    populateResourceTypesSelect(resourceTypes) {
        const select = document.getElementById('type-filter');
        if (!select) {
            console.warn('Type filter select not found');
            return;
        }

        const currentValue = select.value;
        
        // Keep first option (All)
        const firstOption = select.firstElementChild;
        select.innerHTML = '';
        select.appendChild(firstOption);

        // Add resource type options
        resourceTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            select.appendChild(option);
        });

        // Restore previous selection
        if (currentValue) {
            select.value = currentValue;
        }
    }

    async updateResourceGroupDropdown() {
        if (!this.resourceGroupDropdown) {
            return;
        }

        const subscriptionFilter = document.getElementById('subscription-filter');
        const selectedSubscriptionId = subscriptionFilter ? parseInt(subscriptionFilter.value) : null;

        // Clear and disable if no subscription selected
        if (!selectedSubscriptionId) {
            this.resourceGroupDropdown.setItems([]);
            this.resourceGroupDropdown.setDisabled(true);
            this.resourceGroupDropdown.clear();
            return;
        }

        // Enable dropdown
        this.resourceGroupDropdown.setDisabled(false);

        try {
            // Load resource groups for selected subscription
            console.log('Loading resource groups for subscription:', selectedSubscriptionId);
            const data = await this.apiClient.getResourceGroupsBySubscription(selectedSubscriptionId);
            
            if (data.success) {
                const resourceGroups = data.data || [];
                console.log('Loaded resource groups for subscription:', resourceGroups.length);
                
                // Update cache with new resource group names
                resourceGroups.forEach(rg => {
                    this.resourceGroupNameCache.set(rg.id, rg.name);
                });
                
                // Update dropdown items
                this.resourceGroupDropdown.setItems(resourceGroups);
            } else {
                console.error('Failed to load resource groups:', data.message);
                this.resourceGroupDropdown.setItems([]);
                this.showToast('Error loading resource groups: ' + (data.message || 'Unknown error'), 'error');
            }
        } catch (error) {
            console.error('Failed to load resource groups:', error);
            this.resourceGroupDropdown.setItems([]);
            this.showToast('Failed to load resource groups', 'error');
        }
    }

    async getResourceGroupName(resourceGroupId) {
        if (!resourceGroupId) return '';
        
        // Check cache first
        if (this.resourceGroupNameCache.has(resourceGroupId)) {
            return this.resourceGroupNameCache.get(resourceGroupId);
        }
        
        // Try to get from current dropdown items
        if (this.resourceGroupDropdown) {
            const items = this.resourceGroupDropdown.items || [];
            const resourceGroup = items.find(rg => rg.id === resourceGroupId);
            if (resourceGroup) {
                this.resourceGroupNameCache.set(resourceGroupId, resourceGroup.name);
                return resourceGroup.name;
            }
        }
        
        // Fallback: try to fetch from API
        try {
            const data = await this.apiClient.getResourceGroup(resourceGroupId);
            if (data.success && data.data) {
                this.resourceGroupNameCache.set(resourceGroupId, data.data.name);
                return data.data.name;
            }
        } catch (error) {
            console.warn('Failed to fetch resource group name:', error);
        }
        
        const fallbackName = `Resource Group ${resourceGroupId}`;
        this.resourceGroupNameCache.set(resourceGroupId, fallbackName);
        return fallbackName;
    }

    debouncedApplyFilters() {
        // Clear existing timer
        if (this.filterDebounceTimer) {
            clearTimeout(this.filterDebounceTimer);
        }
        
        // Set new timer
        this.filterDebounceTimer = setTimeout(() => {
            this.applyFilters();
        }, 300); // 300ms debounce
    }

    applyFilters() {
        console.log('Applying filters...');
        
        this.filters = {
            search: document.getElementById('search-input').value.trim(),
            resource_type: document.getElementById('type-filter').value,
            location: document.getElementById('location-filter').value,
            environment: document.getElementById('environment-filter').value,
            vendor: document.getElementById('vendor-filter').value,
            subscription_id: document.getElementById('subscription-filter').value,
            resource_group_id: this.resourceGroupDropdown ? this.resourceGroupDropdown.getValue() : null
        };

        // Handle tags from dropdown component
        if (this.searchTagsDropdown) {
            const tagsString = this.searchTagsDropdown.getTagsString();
            if (tagsString) {
                this.filters.tags = tagsString;
            }
        }

        console.log('Applied filters:', this.filters);

        this.currentPage = 1;
        this.loadResources();
    }

    clearFilters() {
        document.getElementById('search-input').value = '';
        document.getElementById('type-filter').value = '';
        document.getElementById('location-filter').value = '';
        document.getElementById('environment-filter').value = '';
        document.getElementById('vendor-filter').value = '';
        document.getElementById('subscription-filter').value = '';
        
        // Clear resource group dropdown
        if (this.resourceGroupDropdown) {
            this.resourceGroupDropdown.clear();
            this.resourceGroupDropdown.setDisabled(true);
        }

        // Clear tags dropdown
        if (this.searchTagsDropdown) {
            this.searchTagsDropdown.clear();
        }

        this.filters = {};
        this.currentPage = 1;
        this.loadResources();
    }

    showTableLoading() {
        const tableContainer = document.querySelector('.table-container');
        if (tableContainer && !tableContainer.querySelector('.table-loading')) {
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'table-loading';
            loadingDiv.innerHTML = '<div class="spinner"></div>';
            tableContainer.style.position = 'relative';
            tableContainer.appendChild(loadingDiv);
        }
    }

    hideTableLoading() {
        const loadingDiv = document.querySelector('.table-loading');
        if (loadingDiv) {
            loadingDiv.remove();
        }
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

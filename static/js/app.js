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
        
        // Store current filter values for cross-tab sync
        this.currentFilters = {
            location: '',
            type: '',
            environment: '',
            vendor: '',
            subscription: ''
        };
        
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
            resourceGroups: false,
            resourceTypes: false
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
            document.addEventListener('DOMContentLoaded', async () => {
                await this.initializeApp();
            });
        } else {
            // Use setTimeout to make this async without blocking constructor
            setTimeout(async () => {
                await this.initializeApp();
            }, 0);
        }
    }

    async initializeApp() {
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
        await this.setupDashboard();
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
                console.log('🔍 Search triggered by Search button click');
                this.applyFilters();
            });
            console.log('✅ Search button configured');
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

        // Search on Enter key only (removed auto-search on input change)
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    console.log('🔍 Search triggered by Enter key');
                    this.applyFilters();
                }
            });
            // Removed input event listener - no more auto-search on typing
            console.log('✅ Search input configured for Enter key only');
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

        // Filter change events - only update state, don't trigger search
        const filterIds = ['type-filter', 'location-filter', 'environment-filter', 'vendor-filter'];
        filterIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', (e) => {
                    console.log(`📝 Filter updated (not applied yet): ${id} = "${e.target.value}"`);
                    // Only update internal state, don't trigger search
                    this.updateCurrentFilters();
                });
            } else {
                console.warn(`Filter element not found: ${id}`);
            }
        });

        // Special handling for subscription filter - update resource groups when changed
        const subscriptionFilter = document.getElementById('subscription-filter');
        if (subscriptionFilter) {
            subscriptionFilter.addEventListener('change', async () => {
                console.log('📝 Subscription filter updated (not applied yet):', subscriptionFilter.value);
                // Update resource groups but don't trigger search
                await this.updateResourceGroupDropdown();
                this.updateCurrentFilters();
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
                console.log('📝 Tags updated (not applied yet):', e.detail);
                // Only update internal state, don't trigger search
                this.updateCurrentFilters();
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
        } else if (tabName === 'dashboard') {
            // Populate filters first, then load data
            console.log('Switching to dashboard tab');
            console.log('Resources available:', this.resources?.length || 0);
            console.log('Subscriptions available:', this.subscriptions?.length || 0);
            
            // Clear filters first to show all data
            this.dashboardFilters = {
                timeRange: 'all',
                subscription: '',
                resourceGroup: '',
                location: '',
                environment: '',
                search: ''
            };
            
            // Clear any existing dashboard resources to force fresh load
            this.dashboardResources = null;
            console.log('Cleared existing dashboard resources - will load fresh from API');
            
            this.populateDashboardFilters().then(() => {
                this.loadDashboardData();
            });
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
        if (this.loadingStates.resourceTypes) {
            console.log('Resource types already loading, skipping...');
            return;
        }
        
        this.loadingStates.resourceTypes = true;
        
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
        } finally {
            this.loadingStates.resourceTypes = false;
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
            console.log('📡 Loading resources with filters:', this.filters);
            
            const params = {
                page: this.currentPage,
                size: this.pageSize
            };

            // Add filters with detailed logging
            if (this.filters.search) {
                params.search = this.filters.search;
                console.log('✅ Added search filter:', this.filters.search);
            }
            if (this.filters.resource_type) {
                params.resource_type = this.filters.resource_type;
                console.log('✅ Added resource_type filter:', this.filters.resource_type);
            }
            if (this.filters.location) {
                params.location = this.filters.location;
                console.log('✅ Added location filter:', this.filters.location);
            }
            if (this.filters.environment) {
                params.environment = this.filters.environment;
                console.log('✅ Added environment filter:', this.filters.environment);
            }
            if (this.filters.vendor) {
                params.vendor = this.filters.vendor;
                console.log('✅ Added vendor filter:', this.filters.vendor);
            }
            if (this.filters.subscription_id) {
                params.subscription_id = this.filters.subscription_id;
                console.log('✅ Added subscription_id filter:', this.filters.subscription_id);
            }
            if (this.filters.resource_group_id) {
                params.resource_group_id = this.filters.resource_group_id;
                console.log('✅ Added resource_group_id filter:', this.filters.resource_group_id);
            }
            if (this.filters.tags) {
                params.tags = this.filters.tags;
                console.log('✅ Added tags filter:', this.filters.tags);
            }

            // Add sorting
            if (this.sortField) {
                params.sort_field = this.sortField;
                params.sort_direction = this.sortDirection;
            }

            console.log('🌐 Final API parameters:', params);

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
                
                // Only populate filter options on first load (not on filter changes)
                if (!this.dataCache.lastResourcesQuery) {
                    await this.populateFilterOptions();
                    this.dataCache.lastResourcesQuery = 'initialized';
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
        
        // Clear table once
        tbody.innerHTML = '';

        if (this.resources.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11" class="text-center">ไม่พบข้อมูล</td></tr>';
            return;
        }

        // Create document fragment to avoid multiple DOM updates
        const fragment = document.createDocumentFragment();
        
        // Pre-load all resource group names to avoid multiple async calls
        const resourceGroupIds = [...new Set(this.resources.map(r => r.resource_group_id).filter(Boolean))];
        const resourceGroupPromises = resourceGroupIds.map(id => this.getResourceGroupName(id));
        const resourceGroupNames = await Promise.all(resourceGroupPromises);
        
        // Create lookup map
        const resourceGroupLookup = {};
        resourceGroupIds.forEach((id, index) => {
            resourceGroupLookup[id] = resourceGroupNames[index];
        });

        // Render all rows synchronously now
        this.resources.forEach(resource => {
            const row = document.createElement('tr');
            const resourceGroupName = resourceGroupLookup[resource.resource_group_id] || '';
            
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
            fragment.appendChild(row);
        });
        
        // Single DOM update
        tbody.appendChild(fragment);
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

    async populateFilterOptions() {
        if (!this.resources || this.resources.length === 0) {
            console.log('No resources to populate filter options');
            return;
        }

        // Populate filter dropdowns using API to get ALL data (not just current page)
        await this.populateResourceFiltersFromAPI();
        this.populateSubscriptionSelect();
        this.updateResourceGroupDropdown();
    }

    async populateResourceFiltersFromAPI() {
        console.log('🔄 Populating resource filters from API...');
        
        try {
            // Get ALL resources to populate filters (not just current page)
            const response = await this.apiClient.get('/api/v1/resources', {
                size: 10000 // Large number to get all resources
            });
            
            const allResources = response.data || [];
            console.log('📊 Got all resources for filters:', allResources.length);
            
            // Get unique values
            const locations = [...new Set(allResources.map(r => r.location).filter(Boolean))];
            const environments = [...new Set(allResources.map(r => r.environment).filter(Boolean))];
            const vendors = [...new Set(allResources.map(r => r.vendor).filter(Boolean))];
            
            console.log('📍 Filter options found:', { 
                locations: locations.length, 
                environments: environments.length, 
                vendors: vendors.length 
            });
            console.log('📍 All locations:', locations);
            
            // Populate dropdowns
            this.populateSelect('location-filter', locations);
            this.populateSelect('environment-filter', environments);
            this.populateSelect('vendor-filter', vendors);
            
            console.log('✅ Resource filters populated successfully');
            
        } catch (error) {
            console.error('❌ Failed to populate resource filters from API:', error);
            
            // Fallback to using this.resources if available
            if (this.resources && this.resources.length > 0) {
                console.log('🔄 Falling back to this.resources for filter options');
                const locations = [...new Set(this.resources.map(r => r.location).filter(Boolean))];
                const environments = [...new Set(this.resources.map(r => r.environment).filter(Boolean))];
                const vendors = [...new Set(this.resources.map(r => r.vendor).filter(Boolean))];
                
                this.populateSelect('location-filter', locations);
                this.populateSelect('environment-filter', environments);
                this.populateSelect('vendor-filter', vendors);
                
                console.log('⚠️ Used fallback data for filters');
            }
        }
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
        }, 500); // 500ms debounce to reduce flickering
    }

    applyFilters() {
        console.log('🚀 APPLYING FILTERS...');
        
        // Read current filter values from DOM
        const filterValues = {
            search: document.getElementById('search-input')?.value.trim() || '',
            resource_type: document.getElementById('type-filter')?.value || '',
            location: document.getElementById('location-filter')?.value || '',
            environment: document.getElementById('environment-filter')?.value || '',
            vendor: document.getElementById('vendor-filter')?.value || '',
            subscription_id: document.getElementById('subscription-filter')?.value || '',
            resource_group_id: this.resourceGroupDropdown ? this.resourceGroupDropdown.getValue() : null
        };

        // Handle tags from dropdown component
        if (this.searchTagsDropdown) {
            const tagsString = this.searchTagsDropdown.getTagsString();
            if (tagsString) {
                filterValues.tags = tagsString;
            }
        }

        // Update internal filters
        this.filters = filterValues;

        console.log('📊 Filter values read from DOM:', filterValues);
        console.log('🔍 Active filters (non-empty):', Object.entries(this.filters).filter(([key, value]) => value && value !== ''));

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

    // ========== Dashboard Methods ==========
    async setupDashboard() {
        this.charts = {
            resourceTypes: null,
            locations: null,
            environments: null
        };
        
        this.dashboardFilters = {
            timeRange: 'all',
            subscription: '',      // Empty = All Subscriptions
            resourceGroup: '',     // Empty = All Resource Groups  
            location: '',          // Empty = All Locations
            environment: '',       // Empty = All Environments
            search: ''             // Empty = No search filter
        };
        
        console.log('🏁 Dashboard filters initialized:', this.dashboardFilters);
        
        await this.setupDashboardEventListeners();
    }

    async setupDashboardEventListeners() {
        // Dashboard controls
        const refreshBtn = document.getElementById('refresh-dashboard');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadDashboardData());
        }

        const exportBtn = document.getElementById('export-dashboard');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportDashboard());
        }

        const debugBtn = document.getElementById('debug-resources');
        if (debugBtn) {
            debugBtn.addEventListener('click', () => this.debugResources());
        }

        // Dashboard filters
        const applyFiltersBtn = document.getElementById('apply-dashboard-filters');
        if (applyFiltersBtn) {
            applyFiltersBtn.addEventListener('click', () => this.applyDashboardFilters());
        }

        const clearFiltersBtn = document.getElementById('clear-dashboard-filters');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', async () => await this.clearDashboardFilters());
        }

        // Setup simplified filter listeners (no auto-API calls)
        this.setupDashboardFilterListeners();

        // Widget controls
        document.addEventListener('click', (e) => {
            if (e.target.closest('.widget-btn')) {
                const btn = e.target.closest('.widget-btn');
                const action = btn.dataset.action;
                const widget = btn.closest('.widget-container');
                
                this.handleWidgetAction(widget, action);
            }
        });

        // Populate dashboard filter dropdowns
        await this.populateDashboardFilters();
    }

    setupDashboardFilterListeners(retryCount = 0) {
        const maxRetries = 5;
        const retryDelay = 500; // 500ms
        
        console.log(`🔄 Setting up dashboard filter listeners (attempt ${retryCount + 1}/${maxRetries + 1})`);
        
        const subscriptionSelect = document.getElementById('dashboard-subscription');
        if (subscriptionSelect) {
            console.log('✅ Dashboard subscription dropdown found - adding simple change listener');
            subscriptionSelect.addEventListener('change', async (e) => {
                console.log('📝 Subscription filter updated (not applied yet):', e.target.value);
                // Only update internal state, don't call API yet
                await this.updateSubscriptionFilterState(e.target.value);
            });
            
            // Setup other filter listeners
            this.setupOtherFilterListeners();
            return; // Success, exit
        } else {
            console.warn(`⚠️ Dashboard subscription dropdown NOT FOUND (attempt ${retryCount + 1})`);
            
            if (retryCount < maxRetries) {
                console.log(`🔄 Retrying in ${retryDelay}ms...`);
                setTimeout(() => {
                    this.setupDashboardFilterListeners(retryCount + 1);
                }, retryDelay);
            } else {
                console.error('❌ Failed to find dashboard subscription dropdown after all retries!');
                console.error('Available select elements:');
                document.querySelectorAll('select').forEach((select, index) => {
                    console.error(`  Select ${index}: id="${select.id}" class="${select.className}"`);
                });
            }
        }
    }

    setupOtherFilterListeners() {
        // Resource Group filter - only update state
        const resourceGroupSelect = document.getElementById('dashboard-resource-group');
        if (resourceGroupSelect) {
            resourceGroupSelect.addEventListener('change', (e) => {
                console.log('📝 Resource Group filter updated (not applied yet):', e.target.value);
                this.dashboardFilters.resourceGroup = e.target.value;
            });
        }

        // Location filter - only update state  
        const locationSelect = document.getElementById('dashboard-location');
        if (locationSelect) {
            locationSelect.addEventListener('change', (e) => {
                console.log('📝 Location filter updated (not applied yet):', e.target.value);
                this.dashboardFilters.location = e.target.value;
            });
        }

        // Environment filter - only update state
        const environmentSelect = document.getElementById('dashboard-environment');
        if (environmentSelect) {
            environmentSelect.addEventListener('change', (e) => {
                console.log('📝 Environment filter updated (not applied yet):', e.target.value);
                this.dashboardFilters.environment = e.target.value;
            });
        }

        // Search filter - only update state (with debounce)
        const searchInput = document.getElementById('dashboard-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                console.log('📝 Search filter updated (not applied yet):', e.target.value);
                this.dashboardFilters.search = e.target.value;
            });
        }

        // Time range filter - only update state
        const timeRangeSelect = document.getElementById('dashboard-timerange');
        if (timeRangeSelect) {
            timeRangeSelect.addEventListener('change', (e) => {
                console.log('📝 Time range filter updated (not applied yet):', e.target.value);
                this.dashboardFilters.timeRange = e.target.value;
            });
        }
    }

    async populateDashboardFilters() {
        // Populate subscription dropdown
        const subscriptionSelect = document.getElementById('dashboard-subscription');
        if (subscriptionSelect && this.subscriptions) {
            subscriptionSelect.innerHTML = '<option value="">All Subscriptions</option>';
            this.subscriptions.forEach(sub => {
                const option = document.createElement('option');
                option.value = sub.id;
                option.textContent = sub.name;
                subscriptionSelect.appendChild(option);
            });
        }

        // Populate resource group dropdown (initially empty)
        this.populateResourceGroupFilter('');

        // Populate location dropdown from resources
        await this.populateLocationFilter();

        // Populate environment dropdown from resources
        await this.populateEnvironmentFilter();
    }

    async updateSubscriptionFilterState(subscriptionId) {
        console.log('📝 Updating subscription filter state to:', subscriptionId);
        
        // Update internal state only
        this.dashboardFilters.subscription = subscriptionId;
        this.dashboardFilters.resourceGroup = ''; // Reset dependent filters
        this.dashboardFilters.environment = ''; // Reset dependent filters
        
        // Update UI dropdowns (but don't trigger API calls)
        const resourceGroupSelect = document.getElementById('dashboard-resource-group');
        const environmentSelect = document.getElementById('dashboard-environment');
        
        if (resourceGroupSelect) resourceGroupSelect.value = '';
        if (environmentSelect) environmentSelect.value = '';
        
        // Populate dependent dropdowns for better UX
        this.populateResourceGroupFilter(subscriptionId);
        await this.populateLocationFilter(subscriptionId);
        await this.populateEnvironmentFilter(subscriptionId);
        
        console.log('📝 Filter state updated (waiting for Apply button)');
    }

    // Old filter change functions removed - now using Apply Filter button workflow

    async populateResourceGroupFilter(subscriptionId) {
        const resourceGroupSelect = document.getElementById('dashboard-resource-group');
        if (!resourceGroupSelect) return;

        resourceGroupSelect.innerHTML = '<option value="">All Resource Groups</option>';
        
        if (!subscriptionId) {
            // Show all resource groups if no subscription selected
            if (this.resourceGroups) {
                this.resourceGroups.forEach(rg => {
                    const option = document.createElement('option');
                    option.value = rg.id;
                    option.textContent = rg.name;
                    resourceGroupSelect.appendChild(option);
                });
            }
            return;
        }

        try {
            // Load resource groups for specific subscription
            const data = await this.apiClient.getResourceGroupsBySubscription(subscriptionId);
            if (data.success && data.data) {
                data.data.forEach(rg => {
                    const option = document.createElement('option');
                    option.value = rg.id;
                    option.textContent = rg.name;
                    resourceGroupSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Failed to load resource groups for subscription:', error);
        }
    }

    async populateLocationFilter(subscriptionId = '', resourceGroupId = '') {
        const locationSelect = document.getElementById('dashboard-location');
        if (!locationSelect) {
            console.warn('⚠️ Location select element not found');
            return;
        }

        console.log('🔄 Populating location filter with subscriptionId:', subscriptionId, 'resourceGroupId:', resourceGroupId);
        
        try {
            // Use API to get locations instead of relying on this.resources
            let apiUrl = '/api/v1/resources?size=10000'; // Get large number to ensure all locations
            
            if (subscriptionId) {
                apiUrl += `&subscription_id=${subscriptionId}`;
            }
            if (resourceGroupId) {
                apiUrl += `&resource_group_id=${resourceGroupId}`;
            }
            
            console.log('📡 Fetching locations from API:', apiUrl);
            const response = await this.apiClient.get('/api/v1/resources', {
                size: 10000,
                ...(subscriptionId && { subscription_id: subscriptionId }),
                ...(resourceGroupId && { resource_group_id: resourceGroupId })
            });
            
            const resources = response.data || [];
            console.log('📊 Got resources for location filter:', resources.length);
            
            // Get unique locations from API response
            const locations = [...new Set(resources.map(r => r.location).filter(Boolean))];
            console.log('📍 Unique locations found:', locations);
            
            locationSelect.innerHTML = '<option value="">All Locations</option>';
            locations.forEach(loc => {
                const option = document.createElement('option');
                option.value = loc;
                option.textContent = loc;
                locationSelect.appendChild(option);
            });
            
            console.log('✅ Location filter populated with', locations.length, 'locations');
            
        } catch (error) {
            console.error('❌ Failed to populate location filter:', error);
            // Fallback to using this.resources if available
            if (this.resources) {
                console.log('🔄 Falling back to this.resources');
                let filteredResources = this.resources;
                
                if (subscriptionId) {
                    filteredResources = filteredResources.filter(r => r.subscription_id == subscriptionId);
                }
                if (resourceGroupId) {
                    filteredResources = filteredResources.filter(r => r.resource_group_id == resourceGroupId);
                }

                const locations = [...new Set(filteredResources.map(r => r.location).filter(Boolean))];
                
                locationSelect.innerHTML = '<option value="">All Locations</option>';
                locations.forEach(loc => {
                    const option = document.createElement('option');
                    option.value = loc;
                    option.textContent = loc;
                    locationSelect.appendChild(option);
                });
            }
        }
    }

    async populateEnvironmentFilter(subscriptionId = '', resourceGroupId = '') {
        const environmentSelect = document.getElementById('dashboard-environment');
        if (!environmentSelect) {
            console.warn('⚠️ Environment select element not found');
            return;
        }

        console.log('🔄 Populating environment filter with subscriptionId:', subscriptionId, 'resourceGroupId:', resourceGroupId);
        
        try {
            // Use API to get environments instead of relying on this.resources
            const response = await this.apiClient.get('/api/v1/resources', {
                size: 10000,
                ...(subscriptionId && { subscription_id: subscriptionId }),
                ...(resourceGroupId && { resource_group_id: resourceGroupId })
            });
            
            const resources = response.data || [];
            console.log('📊 Got resources for environment filter:', resources.length);
            
            // Get unique environments from API response
            const environments = [...new Set(resources.map(r => r.environment).filter(Boolean))];
            console.log('🌍 Unique environments found:', environments);
            
            environmentSelect.innerHTML = '<option value="">All Environments</option>';
            environments.forEach(env => {
                const option = document.createElement('option');
                option.value = env;
                option.textContent = env;
                environmentSelect.appendChild(option);
            });
            
            console.log('✅ Environment filter populated with', environments.length, 'environments');
            
        } catch (error) {
            console.error('❌ Failed to populate environment filter:', error);
            // Fallback to using this.resources if available
            if (this.resources) {
                console.log('🔄 Falling back to this.resources for environments');
                let filteredResources = this.resources;
                
                if (subscriptionId) {
                    filteredResources = filteredResources.filter(r => r.subscription_id == subscriptionId);
                }
                if (resourceGroupId) {
                    filteredResources = filteredResources.filter(r => r.resource_group_id == resourceGroupId);
                }

                const environments = [...new Set(filteredResources.map(r => r.environment).filter(Boolean))];
                
                environmentSelect.innerHTML = '<option value="">All Environments</option>';
                environments.forEach(env => {
                    const option = document.createElement('option');
                    option.value = env;
                    option.textContent = env;
                    environmentSelect.appendChild(option);
                });
            }
        }
    }

    handleWidgetAction(widget, action) {
        const widgetType = widget.dataset.widget;
        
        switch (action) {
            case 'expand':
                this.toggleWidgetExpansion(widget);
                break;
            case 'refresh':
                this.refreshWidget(widgetType);
                break;
            case 'settings':
                this.showWidgetSettings(widgetType);
                break;
        }
    }

    toggleWidgetExpansion(widget) {
        const isExpanded = widget.classList.contains('expanded');
        
        // Collapse all other widgets first
        document.querySelectorAll('.widget-container.expanded').forEach(w => {
            if (w !== widget) {
                w.classList.remove('expanded');
                const expandBtn = w.querySelector('[data-action="expand"] i');
                if (expandBtn) {
                    expandBtn.className = 'fas fa-expand';
                }
            }
        });
        
        // Toggle current widget
        widget.classList.toggle('expanded');
        const expandBtn = widget.querySelector('[data-action="expand"] i');
        if (expandBtn) {
            expandBtn.className = isExpanded ? 'fas fa-expand' : 'fas fa-compress';
        }
        
        // Refresh chart if expanded
        if (!isExpanded) {
            const widgetType = widget.dataset.widget;
            setTimeout(() => this.refreshWidget(widgetType), 300);
        }
    }

    refreshWidget(widgetType) {
        console.log(`Refreshing widget: ${widgetType}`);
        // Add specific refresh logic for each widget type
        this.loadDashboardData();
    }

    showWidgetSettings(widgetType) {
        console.log(`Showing settings for widget: ${widgetType}`);
        // Add widget-specific settings modal
        this.showToast(`Settings for ${widgetType} widget`, 'info');
    }

    applyDashboardFilters() {
        console.log('🚀 APPLYING DASHBOARD FILTERS...');
        
        // Read current values from UI (in case user changed without triggering events)
        const currentFilters = {
            timeRange: document.getElementById('dashboard-timerange')?.value || 'all',
            subscription: document.getElementById('dashboard-subscription')?.value || '',
            resourceGroup: document.getElementById('dashboard-resource-group')?.value || '',
            location: document.getElementById('dashboard-location')?.value || '',
            environment: document.getElementById('dashboard-environment')?.value || '',
            search: document.getElementById('dashboard-search')?.value || ''
        };
        
        // Update internal state with current UI values
        this.dashboardFilters = currentFilters;
        
        console.log('📊 Final filters to apply:', JSON.stringify(this.dashboardFilters, null, 2));
        
        // Debug: Check which filters have values
        Object.keys(this.dashboardFilters).forEach(key => {
            const value = this.dashboardFilters[key];
            if (value && value !== '' && value !== 'all') {
                console.log(`✅ Active filter: ${key} = "${value}"`);
            } else {
                console.log(`⚪ Empty filter: ${key} = "${value}"`);
            }
        });
        
        // Show loading state
        this.showToast('Applying filters...', 'info');
        
        // Apply filters and refresh dashboard - THIS IS THE ONLY API CALL
        this.loadDashboardData()
            .then(() => {
                this.showToast('Filters applied successfully! 🎯', 'success');
            })
            .catch((error) => {
                console.error('Failed to apply filters:', error);
                this.showToast('Failed to apply filters. Please try again.', 'error');
            });
    }

    exportDashboard() {
        console.log('Exporting dashboard...');
        this.showToast('Dashboard export feature coming soon!', 'info');
    }

    debugResources() {
        console.log('=== DEBUG RESOURCES ===');
        console.log('Main resources loaded:', this.resources?.length || 0);
        console.log('Dashboard resources loaded:', this.dashboardResources?.length || 0);
        console.log('Current filters:', this.dashboardFilters);
        
        if (this.resources && this.resources.length > 0) {
            // Show sample resources
            console.log('Sample resources (first 5):');
            this.resources.slice(0, 5).forEach((resource, index) => {
                console.log(`${index + 1}.`, {
                    name: resource.name,
                    type: resource.resource_type,
                    location: resource.location,
                    environment: resource.environment,
                    subscription_id: resource.subscription_id,
                    resource_group_id: resource.resource_group_id
                });
            });
            
            // Show unique resource types from main resources
            const uniqueTypes = [...new Set(this.resources.map(r => r.resource_type))];
            console.log('Main resources - unique types:', uniqueTypes);
            
            // Show unique resource types from dashboard resources
            if (this.dashboardResources && this.dashboardResources.length > 0) {
                const dashboardUniqueTypes = [...new Set(this.dashboardResources.map(r => r.resource_type))];
                console.log('Dashboard resources - unique types:', dashboardUniqueTypes);
                console.log('Dashboard resources sample (first 5):');
                this.dashboardResources.slice(0, 5).forEach((resource, index) => {
                    console.log(`Dashboard ${index + 1}.`, {
                        name: resource.name,
                        type: resource.resource_type,
                        location: resource.location,
                        environment: resource.environment
                    });
                });
            }
            
            // Show filtered resources
            const filtered = this.getFilteredResources();
            console.log('Filtered resources count:', filtered.length);
            
            if (filtered.length > 0) {
                const typeStats = {};
                filtered.forEach(r => {
                    const type = r.resource_type || 'Unknown';
                    typeStats[type] = (typeStats[type] || 0) + 1;
                });
                console.log('Type distribution in filtered data:', typeStats);
            }
        } else {
            console.log('No resources loaded!');
        }
        
        this.showToast('Debug info logged to console (F12)', 'info');
    }

    // Manual test function - call from console
    async testDashboardAPI() {
        console.log('=== MANUAL DASHBOARD API TEST ===');
        try {
            const result = await this.loadResourcesForDashboard();
            console.log('Test result:', result?.length || 0, 'resources');
            return result;
        } catch (error) {
            console.error('Test failed:', error);
            return null;
        }
    }

    // Manual clear and reload - call from console
    async forceReloadDashboard() {
        console.log('=== FORCE RELOAD DASHBOARD ===');
        
        // Clear all filters
        this.dashboardFilters = {
            timeRange: 'all',
            subscription: '',
            resourceGroup: '',
            location: '',
            environment: '',
            search: ''
        };
        
        // Clear existing dashboard resources to force fresh API call
        this.dashboardResources = null;
        console.log('Cleared dashboard resources - forcing fresh API call');
        
        // Reset UI
        document.getElementById('dashboard-subscription').value = '';
        document.getElementById('dashboard-resource-group').value = '';
        document.getElementById('dashboard-environment').value = '';
        document.getElementById('dashboard-search').value = '';
        
        // Force reload
        await this.loadDashboardData();
        console.log('Dashboard force reloaded with fresh API data');
    }

    // Test dashboard API with specific filters - call from console
    async testDashboardWithFilters(subscriptionId = null, resourceGroupId = null, location = null, environment = null) {
        console.log('=== TESTING DASHBOARD WITH FILTERS ===');
        console.log('Test filters:', { subscriptionId, resourceGroupId, location, environment });
        
        // Set test filters
        this.dashboardFilters = {
            timeRange: 'all',
            subscription: subscriptionId ? subscriptionId.toString() : '',
            resourceGroup: resourceGroupId ? resourceGroupId.toString() : '',
            location: location || '',
            environment: environment || '',
            search: ''
        };
        
        console.log('Set dashboard filters to:', this.dashboardFilters);
        
        try {
            // Call the API directly
            const summary = await this.loadDashboardSummary();
            console.log('✅ Test successful! Summary:', summary);
            
            // Update the dashboard
            this.updateDashboardWithSummary(summary);
            
            return summary;
        } catch (error) {
            console.error('❌ Test failed:', error);
            return null;
        }
    }

    // Quick test function for Apply Filter workflow
    async testApplyFilterWorkflow() {
        console.log('=== TESTING APPLY FILTER WORKFLOW ===');
        
        // Set a subscription in the dropdown
        const subscriptionSelect = document.getElementById('dashboard-subscription');
        if (subscriptionSelect && subscriptionSelect.options.length > 1) {
            // Select the first non-empty option
            subscriptionSelect.value = subscriptionSelect.options[1].value;
            console.log('✅ Set subscription to:', subscriptionSelect.value);
            
            // Trigger the apply filters
            this.applyDashboardFilters();
            
            return true;
        } else {
            console.error('❌ No subscription dropdown or no options available');
            return false;
        }
    }

    syncFiltersFromResourcesTab() {
        console.log('=== SYNCING FILTERS FROM RESOURCES TAB ===');
        
        // Use stored filter values instead of DOM elements (since Resources tab might be hidden)
        const locationFilter = this.currentFilters?.location || '';
        const typeFilter = this.currentFilters?.type || '';
        const environmentFilter = this.currentFilters?.environment || '';
        const vendorFilter = this.currentFilters?.vendor || '';
        const subscriptionFilter = this.currentFilters?.subscription || '';
        
        console.log('Current stored filters:', this.currentFilters);
        console.log('Resources tab filters:', {
            location: locationFilter,
            type: typeFilter,
            environment: environmentFilter,
            vendor: vendorFilter,
            subscription: subscriptionFilter
        });
        
        // Map subscription name to ID for API
        let subscriptionId = '';
        if (subscriptionFilter && subscriptionFilter !== '') {
            // Find subscription ID by name
            const subscription = this.subscriptions?.find(s => s.name === subscriptionFilter);
            subscriptionId = subscription ? subscription.id.toString() : '';
            console.log('Subscription mapping:', subscriptionFilter, '→', subscriptionId);
        }
        
        // Update dashboard filters
        this.dashboardFilters = {
            timeRange: 'all',
            subscription: subscriptionId,
            resourceGroup: '',
            location: locationFilter,
            environment: environmentFilter,
            search: ''
        };
        
        console.log('Dashboard filters updated:', this.dashboardFilters);
    }

    updateCurrentFilters() {
        // Update stored filter values from DOM elements
        const locationEl = document.getElementById('location-filter');
        const typeEl = document.getElementById('type-filter');
        const environmentEl = document.getElementById('environment-filter');
        const vendorEl = document.getElementById('vendor-filter');
        const subscriptionEl = document.getElementById('subscription-filter');
        
        this.currentFilters = {
            location: locationEl?.value || '',
            type: typeEl?.value || '',
            environment: environmentEl?.value || '',
            vendor: vendorEl?.value || '',
            subscription: subscriptionEl?.value || ''
        };
        
        console.log('Filter elements debug:');
        console.log('- Location element:', locationEl, 'value:', locationEl?.value);
        console.log('- Subscription element:', subscriptionEl, 'value:', subscriptionEl?.value);
        console.log('Current filters updated:', this.currentFilters);
    }

    // Manual test function - call from console
    async testDashboardFilters() {
        console.log('=== MANUAL DASHBOARD FILTER TEST ===');
        
        // Force update current filters
        this.updateCurrentFilters();
        console.log('1. Current filters:', this.currentFilters);
        
        // Force sync to dashboard
        this.syncFiltersFromResourcesTab();
        console.log('2. Dashboard filters:', this.dashboardFilters);
        
        // Test API call directly
        const filters = {};
        if (this.dashboardFilters.subscription && this.dashboardFilters.subscription !== '') {
            filters.subscription_id = parseInt(this.dashboardFilters.subscription);
        }
        if (this.dashboardFilters.location && this.dashboardFilters.location !== '') {
            filters.location = this.dashboardFilters.location;
        }
        
        console.log('3. API filters to send:', filters);
        
        try {
            const result = await this.apiClient.getDashboardSummary(filters);
            console.log('4. API result:', result);
            return result;
        } catch (error) {
            console.error('5. API error:', error);
            return null;
        }
    }

    updateDashboardWithSummary(summary) {
        console.log('=== UPDATING DASHBOARD WITH SUMMARY ===');
        console.log('Summary data:', summary);
        
        // Update stats cards
        document.getElementById('total-resources').textContent = summary.total_resources || 0;
        document.getElementById('total-types').textContent = summary.resource_types?.length || 0;
        document.getElementById('total-locations').textContent = summary.total_locations || 0;
        document.getElementById('total-subscriptions').textContent = summary.total_subscriptions || 0;
        
        // Update health indicators
        if (summary.health_summary) {
            document.getElementById('healthy-resources').textContent = summary.health_summary.healthy || 0;
            document.getElementById('warning-resources').textContent = summary.health_summary.warning || 0;
            document.getElementById('critical-resources').textContent = summary.health_summary.critical || 0;
        }
        
        // Update cost analysis
        if (summary.cost_summary) {
            document.getElementById('monthly-cost').textContent = `$${summary.cost_summary.estimated_monthly_cost?.toFixed(2) || '0.00'}`;
            document.getElementById('top-cost-driver').textContent = summary.cost_summary.top_cost_driver || 'N/A';
        }
        
        // Render charts with summary data
        this.renderChartsFromSummary(summary);
    }

    renderChartsFromSummary(summary) {
        console.log('=== RENDERING CHARTS FROM SUMMARY ===');
        console.log('Summary for charts:', summary);
        
        // Render resource types chart
        if (summary.resource_types && summary.resource_types.length > 0) {
            console.log('Rendering resource types chart with', summary.resource_types.length, 'types');
            this.renderResourceTypesChartFromSummary(summary.resource_types);
            this.renderTopTypesListFromSummary(summary.resource_types);
        }
        
        // Render locations chart
        if (summary.locations && summary.locations.length > 0) {
            console.log('Rendering locations chart with', summary.locations.length, 'locations');
            this.renderLocationsChartFromSummary(summary.locations);
        }
        
        // Render environments chart
        if (summary.environments && summary.environments.length > 0) {
            console.log('Rendering environments chart with', summary.environments.length, 'environments');
            this.renderEnvironmentsChartFromSummary(summary.environments);
        }
    }

    renderResourceTypesChartFromSummary(resourceTypes) {
        const ctx = document.getElementById('resource-types-chart');
        if (!ctx) return;

        // Destroy existing chart
        if (this.charts.resourceTypes) {
            this.charts.resourceTypes.destroy();
        }

        console.log('Rendering resource types chart from summary:', resourceTypes.length, 'types');

        // Get top 15 types for pie chart
        const top15 = resourceTypes.slice(0, 15);
        const others = resourceTypes.slice(15).reduce((sum, item) => sum + item.count, 0);
        
        if (others > 0) {
            top15.push({ resource_type: 'Others', count: others });
        }

        const colors = [
            '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
            '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6B7280', 
            '#9CA3AF', '#F472B6', '#A78BFA', '#34D399', '#FBBF24',
            '#FB7185'
        ];

        this.charts.resourceTypes = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: top15.map(item => this.truncateText(item.resource_type, 25)),
                datasets: [{
                    data: top15.map(item => item.count),
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    renderTopTypesListFromSummary(resourceTypes) {
        const container = document.getElementById('top-types-list');
        if (!container) return;

        const total = resourceTypes.reduce((sum, item) => sum + item.count, 0);
        
        // Store all types for expand/collapse functionality
        this.allResourceTypes = resourceTypes;
        this.isTypesExpanded = this.isTypesExpanded || false;
        
        const displayTypes = this.isTypesExpanded ? resourceTypes : resourceTypes.slice(0, 10);
        const hasMore = resourceTypes.length > 10;

        let html = displayTypes.map(item => {
            const percentage = item.percentage || ((item.count / total) * 100);
            return `
                <div class="top-item">
                    <div class="top-item-name" title="${item.resource_type}">${this.truncateText(item.resource_type, 30)}</div>
                    <div class="top-item-stats">
                        <div class="top-item-count">${item.count.toLocaleString()}</div>
                        <div class="top-item-percentage">${percentage.toFixed(1)}%</div>
                        <div class="top-item-bar">
                            <div class="top-item-bar-fill" style="width: ${Math.min(percentage, 100)}%"></div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Add expand/collapse button if there are more items
        if (hasMore) {
            const remainingCount = resourceTypes.length - (this.isTypesExpanded ? 0 : 10);
            const buttonText = this.isTypesExpanded 
                ? 'Show Less' 
                : `Show All (${remainingCount} more)`;
            
            html += `
                <div class="expand-button-container">
                    <button class="expand-button" onclick="app.toggleTypesExpansion()">
                        <span class="expand-icon">${this.isTypesExpanded ? '▲' : '▼'}</span>
                        ${buttonText}
                    </button>
                </div>
            `;
        }

        container.innerHTML = html;
    }

    toggleTypesExpansion() {
        console.log('Toggling types expansion...');
        this.isTypesExpanded = !this.isTypesExpanded;
        
        // Re-render the list with new expansion state
        if (this.allResourceTypes) {
            this.renderTopTypesListFromSummary(this.allResourceTypes);
        }
    }

    renderLocationsChartFromSummary(locations) {
        // Similar implementation for locations chart
        console.log('Rendering locations chart from summary');
    }

    renderEnvironmentsChartFromSummary(environments) {
        // Similar implementation for environments chart  
        console.log('Rendering environments chart from summary');
    }

    // Check data sources - call from console
    checkDataSources() {
        console.log('=== DATA SOURCES CHECK ===');
        console.log('this.resources:', this.resources?.length || 0);
        console.log('this.dashboardResources:', this.dashboardResources?.length || 0);
        
        if (this.resources && this.resources.length > 0) {
            const mainTypes = [...new Set(this.resources.map(r => r.resource_type))];
            console.log('Main resources types:', mainTypes);
        }
        
        if (this.dashboardResources && this.dashboardResources.length > 0) {
            const dashboardTypes = [...new Set(this.dashboardResources.map(r => r.resource_type))];
            console.log('Dashboard resources types:', dashboardTypes);
            console.log('Dashboard types count:', dashboardTypes.length);
            
            // Compare with expected database numbers
            console.log('Expected from database: 62,289 resources, 80+ types');
            if (this.dashboardResources.length < 60000) {
                console.warn('⚠️  Dashboard has fewer resources than database');
            }
            if (dashboardTypes.length < 50) {
                console.warn('⚠️  Dashboard has fewer types than database');
            }
        }
        
        // Check if they're the same
        const same = this.resources === this.dashboardResources;
        console.log('Same object reference:', same);
        
        if (same) {
            console.warn('⚠️  WARNING: Dashboard is using same data as main resources!');
            console.warn('Dashboard should have independent API data');
        } else {
            console.log('✅ Dashboard has independent data source');
        }
    }

    // Test API directly - call from console
    async testAPIDirectly() {
        console.log('=== TESTING API DIRECTLY ===');
        try {
            const params = { page: 1, per_page: 100000 };
            console.log('Calling API with params:', params);
            
            const data = await this.apiClient.getResources(params);
            console.log('Raw API response:', data);
            
            if (data.success) {
                const resources = Array.isArray(data.data) ? data.data : 
                                (data.data?.resources || data.data?.data || []);
                
                console.log('Resources count:', resources.length);
                console.log('Expected: 62,289');
                
                const types = [...new Set(resources.map(r => r.resource_type))];
                console.log('Types count:', types.length);
                console.log('Expected: 80+');
                
                return { count: resources.length, types: types.length, data: resources };
            } else {
                console.error('API failed:', data.message);
                return null;
            }
        } catch (error) {
            console.error('API test failed:', error);
            return null;
        }
    }

    async loadDashboardSummary() {
        try {
            console.log('=== LOADING DASHBOARD SUMMARY ===');
            console.log('Calling Dashboard Summary API...');
            
            // Build filters from current dashboard filters
            const filters = {};
            
            console.log('Raw dashboard filters:', this.dashboardFilters);
            
            if (this.dashboardFilters.subscription && this.dashboardFilters.subscription !== '') {
                const subId = parseInt(this.dashboardFilters.subscription);
                if (!isNaN(subId)) {
                    filters.subscription_id = subId;
                    console.log('✅ Added subscription filter:', subId);
                } else {
                    console.warn('❌ Invalid subscription ID:', this.dashboardFilters.subscription);
                }
            }
            
            if (this.dashboardFilters.resourceGroup && this.dashboardFilters.resourceGroup !== '') {
                const rgId = parseInt(this.dashboardFilters.resourceGroup);
                if (!isNaN(rgId)) {
                    filters.resource_group_id = rgId;
                    console.log('✅ Added resource group filter:', rgId);
                } else {
                    console.warn('❌ Invalid resource group ID:', this.dashboardFilters.resourceGroup);
                }
            }
            
            if (this.dashboardFilters.location && this.dashboardFilters.location !== '') {
                filters.location = this.dashboardFilters.location;
                console.log('✅ Added location filter:', this.dashboardFilters.location);
            }
            
            if (this.dashboardFilters.environment && this.dashboardFilters.environment !== '') {
                filters.environment = this.dashboardFilters.environment;
                console.log('✅ Added environment filter:', this.dashboardFilters.environment);
            }
            
            if (this.dashboardFilters.timeRange && this.dashboardFilters.timeRange !== 'all') {
                filters.time_range = this.dashboardFilters.timeRange;
                console.log('✅ Added time range filter:', this.dashboardFilters.timeRange);
            }
            
            console.log('Dashboard API filters:', filters);
            console.log('Number of filters:', Object.keys(filters).length);
            console.log('Making API call to getDashboardSummary...');
            console.log('API endpoint: /api/v1/dashboard/summary');
            
            // Debug: Show exact API URL that will be called
            const queryParams = new URLSearchParams();
            Object.keys(filters).forEach(key => {
                if (filters[key] !== undefined && filters[key] !== null) {
                    queryParams.append(key, filters[key].toString());
                    console.log(`Adding query param: ${key} = ${filters[key]}`);
                }
            });
            const queryString = queryParams.toString();
            const apiUrl = `/api/v1/dashboard/summary${queryString ? '?' + queryString : ''}`;
            console.log('Full API URL:', apiUrl);
            console.log('Query string:', queryString);
            
            console.log('🚀 About to call API with filters:', filters);
            const data = await this.apiClient.getDashboardSummary(filters);
            console.log('📥 API Response received:', data);
            console.log('📊 Response data structure:', JSON.stringify(data, null, 2));
            
            if (data.success) {
                const summary = data.data;
                
                console.log('Dashboard Summary received:', summary);
                console.log('Total resources:', summary.total_resources);
                console.log('Total resource types:', summary.resource_types?.length || 0);
                
                // Store dashboard summary
                this.dashboardSummary = summary;
                console.log('Dashboard summary stored successfully');
                
                return summary;
            } else {
                console.error('Failed to load resources for dashboard:', data.message);
                throw new Error(data.message || 'Failed to load resources');
            }
        } catch (error) {
            console.error('=== ERROR LOADING DASHBOARD RESOURCES ===');
            console.error('Error details:', error);
            
            // NO FALLBACK - Dashboard must have its own fresh data
            console.error('Dashboard API failed - no fallback used');
            this.dashboardResources = [];
            this.showToast('Failed to load dashboard data from API. Please check connection and try again.', 'error');
            throw error;
        }
    }

    async clearDashboardFilters() {
        console.log('Clearing all dashboard filters...');
        
        // Reset filter values
        this.dashboardFilters = {
            timeRange: 'all',
            subscription: '',
            resourceGroup: '',
            location: '',
            environment: '',
            search: ''
        };
        
        // Reset UI elements
        document.getElementById('dashboard-timerange').value = 'all';
        document.getElementById('dashboard-subscription').value = '';
        document.getElementById('dashboard-resource-group').value = '';
        document.getElementById('dashboard-environment').value = '';
        document.getElementById('dashboard-search').value = '';
        
        // Repopulate dropdowns with all options
        await this.populateDashboardFilters();
        
        // Reload dashboard with no filters
        this.loadDashboardData();
        
        this.showToast('Filters cleared', 'success');
    }

    async loadDashboardData() {
        try {
            console.log('=== LOADING DASHBOARD DATA ===');
            console.log('Available resources in memory:', this.resources?.length || 0);
            
            // Sync filters from Resources tab before loading
            this.syncFiltersFromResourcesTab();
            console.log('Current filters:', this.dashboardFilters);
            
            // Load dashboard summary from API
            console.log('Loading dashboard summary from API...');
            const dashboardSummary = await this.loadDashboardSummary();
            
            if (!dashboardSummary) {
                console.error('No dashboard summary loaded!');
                this.showEmptyDashboard();
                return;
            }
            
            console.log('Successfully loaded dashboard summary');
            
            // Update dashboard with summary data
            this.updateDashboardWithSummary(dashboardSummary);
            
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
            this.showToast('Failed to load dashboard data', 'error');
        }
    }

    getFilteredResources() {
        // ONLY use dashboard resources - never fall back to main resources
        if (!this.dashboardResources || this.dashboardResources.length === 0) {
            console.warn('No dashboardResources available for filtering!');
            console.warn('this.dashboardResources:', this.dashboardResources?.length || 0);
            console.warn('this.resources:', this.resources?.length || 0);
            return [];
        }

        const sourceResources = this.dashboardResources;

        let filtered = [...sourceResources];
        console.log('=== FILTERING RESOURCES ===');
        console.log('Starting with resources:', filtered.length);
        console.log('Dashboard filters:', this.dashboardFilters);

        // Debug: Show sample resources before filtering
        if (filtered.length > 0) {
            console.log('Sample resources before filtering:');
            filtered.slice(0, 3).forEach((resource, index) => {
                console.log(`Before filter ${index + 1}:`, {
                    name: resource.name,
                    resource_type: resource.resource_type,
                    subscription_id: resource.subscription_id,
                    resource_group_id: resource.resource_group_id
                });
            });
        }

        // Apply subscription filter
        if (this.dashboardFilters.subscription && this.dashboardFilters.subscription !== '') {
            const beforeCount = filtered.length;
            console.log(`Applying subscription filter: ${this.dashboardFilters.subscription}`);
            
            // Debug: Show what subscription IDs exist
            const existingSubIds = [...new Set(filtered.map(r => r.subscription_id))];
            console.log('Existing subscription IDs in data:', existingSubIds);
            
            filtered = filtered.filter(r => r.subscription_id == this.dashboardFilters.subscription);
            console.log(`Subscription filter: ${beforeCount} -> ${filtered.length}`);
            
            // If no results, show why
            if (filtered.length === 0) {
                console.warn('No resources match subscription filter!');
                console.warn('Filter value:', this.dashboardFilters.subscription);
                console.warn('Available subscription IDs:', existingSubIds);
            }
        }

        // Apply resource group filter
        if (this.dashboardFilters.resourceGroup && this.dashboardFilters.resourceGroup !== '') {
            const beforeCount = filtered.length;
            filtered = filtered.filter(r => r.resource_group_id == this.dashboardFilters.resourceGroup);
            console.log(`Resource Group filter: ${beforeCount} -> ${filtered.length}`);
        }

        // Apply environment filter
        if (this.dashboardFilters.environment && this.dashboardFilters.environment !== '') {
            const beforeCount = filtered.length;
            filtered = filtered.filter(r => r.environment === this.dashboardFilters.environment);
            console.log(`Environment filter: ${beforeCount} -> ${filtered.length}`);
        }

        // Apply search filter
        if (this.dashboardFilters.search && this.dashboardFilters.search.trim() !== '') {
            const beforeCount = filtered.length;
            const searchTerm = this.dashboardFilters.search.toLowerCase();
            filtered = filtered.filter(r => 
                (r.name && r.name.toLowerCase().includes(searchTerm)) ||
                (r.resource_type && r.resource_type.toLowerCase().includes(searchTerm)) ||
                (r.location && r.location.toLowerCase().includes(searchTerm))
            );
            console.log(`Search filter: ${beforeCount} -> ${filtered.length}`);
        }

        console.log(`Final filtered: ${filtered.length} resources from ${sourceResources.length} total`);
        
        // Debug: Show final filtered resources and their types
        if (filtered.length > 0) {
            console.log('Sample filtered resources:');
            filtered.slice(0, 5).forEach((resource, index) => {
                console.log(`Filtered ${index + 1}:`, {
                    name: resource.name,
                    resource_type: resource.resource_type,
                    location: resource.location
                });
            });
            
            // Show unique types in filtered results
            const filteredTypes = [...new Set(filtered.map(r => r.resource_type))];
            console.log('Unique types in filtered results:', filteredTypes);
        } else {
            console.warn('No resources after filtering!');
        }
        
        return filtered;
    }

    generateDashboardStats(resources) {
        // Generate statistics from filtered resources
        const byType = {};
        const byLocation = {};
        const byEnvironment = {};

        console.log('=== GENERATING DASHBOARD STATS ===');
        console.log('Generating stats for resources:', resources.length);
        
        // Debug: Show first few resources to understand data structure
        if (resources.length > 0) {
            console.log('Sample resources for stats generation:');
            resources.slice(0, 3).forEach((resource, index) => {
                console.log(`Sample ${index + 1}:`, {
                    name: resource.name,
                    resource_type: resource.resource_type,
                    location: resource.location,
                    environment: resource.environment
                });
            });
        }
        
        // Debug: Show unique resource types
        const uniqueTypes = new Set();
        
        resources.forEach(resource => {
            // Count by type - use more detailed type information
            let type = resource.resource_type || 'Unknown';
            
            // If type is too generic, try to get more specific info from name or kind
            if (type === 'Unknown' && resource.name) {
                // Try to infer type from resource name patterns
                const name = resource.name.toLowerCase();
                if (name.includes('vm') || name.includes('virtual')) type = 'Virtual Machine';
                else if (name.includes('disk')) type = 'Disk';
                else if (name.includes('network')) type = 'Network Interface';
                else if (name.includes('storage')) type = 'Storage Account';
                else if (name.includes('keyvault') || name.includes('key-vault')) type = 'Key Vault';
                else if (name.includes('app') && name.includes('service')) type = 'App Service';
                else if (name.includes('sql')) type = 'SQL Database';
                else if (name.includes('cosmos')) type = 'Cosmos DB';
                else if (name.includes('function')) type = 'Function App';
                else if (name.includes('logic')) type = 'Logic App';
            }
            
            uniqueTypes.add(type);
            byType[type] = (byType[type] || 0) + 1;

            // Count by location
            const location = resource.location || 'Unknown';
            byLocation[location] = (byLocation[location] || 0) + 1;

            // Count by environment
            const environment = resource.environment || 'Unknown';
            byEnvironment[environment] = (byEnvironment[environment] || 0) + 1;
        });

        console.log('Unique resource types found:', Array.from(uniqueTypes));
        console.log('Resource type counts:', byType);
        console.log('Total types processed:', Object.keys(byType).length);

        // Convert to arrays and sort by count
        const by_type = Object.entries(byType).sort((a, b) => b[1] - a[1]);
        const by_location = Object.entries(byLocation).sort((a, b) => b[1] - a[1]);
        const by_environment = Object.entries(byEnvironment).sort((a, b) => b[1] - a[1]);

        return {
            by_type,
            by_location,
            by_environment,
            total_resources: resources.length
        };
    }

    updateHealthIndicators(resources) {
        // Mock health data - in real implementation, this would come from monitoring APIs
        const healthy = Math.floor(resources.length * 0.85);
        const warning = Math.floor(resources.length * 0.12);
        const critical = resources.length - healthy - warning;

        document.getElementById('healthy-resources').textContent = healthy;
        document.getElementById('warning-resources').textContent = warning;
        document.getElementById('critical-resources').textContent = critical;
    }

    updateCostAnalysis(resources) {
        // Mock cost data - in real implementation, this would come from billing APIs
        const estimatedCost = resources.length * 12.50; // $12.50 per resource average
        const topCostDriver = resources.length > 0 ? 
            (resources.find(r => r.resource_type?.includes('Virtual')) ? 'Virtual Machines' : 'Storage Accounts') : 
            'N/A';

        document.getElementById('monthly-cost').textContent = `$${estimatedCost.toFixed(2)}`;
        document.getElementById('top-cost-driver').textContent = topCostDriver;
    }

    showEmptyDashboard() {
        console.log('Showing empty dashboard state');
        
        // Update stats to show 0
        document.getElementById('total-resources').textContent = '0';
        document.getElementById('total-types').textContent = '0';
        document.getElementById('total-locations').textContent = '0';
        document.getElementById('total-subscriptions').textContent = this.subscriptions?.length || '0';
        
        // Update health indicators
        document.getElementById('healthy-resources').textContent = '0';
        document.getElementById('warning-resources').textContent = '0';
        document.getElementById('critical-resources').textContent = '0';
        
        // Update cost analysis
        document.getElementById('monthly-cost').textContent = '$0.00';
        document.getElementById('top-cost-driver').textContent = 'N/A';
        
        // Clear charts
        Object.values(this.charts).forEach(chart => {
            if (chart) {
                chart.destroy();
            }
        });
        
        // Show message in top types list
        const topTypesList = document.getElementById('top-types-list');
        if (topTypesList) {
            topTypesList.innerHTML = '<div style="text-align: center; padding: 2rem; color: #6B7280;">No resources found. Try clearing filters or loading data from the Resources tab first.</div>';
        }
        
        this.showToast('No resources found. Please load data from the Resources tab first.', 'info');
    }

    updateDashboardStats(data) {
        // Update stat cards
        document.getElementById('total-resources').textContent = 
            data.by_type.reduce((sum, item) => sum + item[1], 0);
        document.getElementById('total-types').textContent = data.by_type.length;
        document.getElementById('total-locations').textContent = data.by_location.length;
        document.getElementById('total-subscriptions').textContent = this.subscriptions.length;
    }

    renderCharts(data) {
        console.log('=== RENDERING CHARTS ===');
        console.log('Chart data received:', data);
        console.log('Types for chart:', data.by_type?.length || 0);
        console.log('First 10 types:', data.by_type?.slice(0, 10));
        
        this.renderResourceTypesChart(data.by_type);
        this.renderTopTypesList(data.by_type);
        this.renderLocationsChart(data.by_location);
        this.renderEnvironmentsChart(data.by_environment);
    }

    renderResourceTypesChart(typeData) {
        const ctx = document.getElementById('resource-types-chart');
        if (!ctx) return;

        // Destroy existing chart
        if (this.charts.resourceTypes) {
            this.charts.resourceTypes.destroy();
        }

        console.log('=== RENDERING RESOURCE TYPES CHART ===');
        console.log('Input typeData:', typeData);
        console.log('Input typeData length:', typeData?.length || 0);
        
        if (!typeData || typeData.length === 0) {
            console.warn('No typeData provided to chart!');
            return;
        }

        // Get top 15 types for pie chart (show more variety)
        const top15 = typeData.slice(0, 15);
        console.log('Top 15 types for chart:', top15);
        const others = typeData.slice(15).reduce((sum, item) => sum + item[1], 0);
        
        if (others > 0) {
            top15.push(['Others', others]);
        }

        const colors = [
            '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
            '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6B7280', 
            '#9CA3AF', '#F472B6', '#A78BFA', '#34D399', '#FBBF24',
            '#FB7185'
        ];

        this.charts.resourceTypes = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: top15.map(item => this.truncateText(item[0], 25)),
                datasets: [{
                    data: top15.map(item => item[1]),
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.raw / total) * 100).toFixed(1);
                                return `${context.label}: ${context.raw} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    renderTopTypesList(typeData) {
        const container = document.getElementById('top-types-list');
        if (!container) return;

        const total = typeData.reduce((sum, item) => sum + item[1], 0);
        
        // Convert to same format as summary data
        const resourceTypes = typeData.map(([type, count]) => ({
            resource_type: type,
            count: count,
            percentage: ((count / total) * 100)
        }));
        
        // Use the same expand logic as summary
        this.renderTopTypesListFromSummary(resourceTypes);
    }

    renderLocationsChart(locationData) {
        const ctx = document.getElementById('locations-chart');
        if (!ctx) return;

        if (this.charts.locations) {
            this.charts.locations.destroy();
        }

        const top8 = locationData.slice(0, 8);

        this.charts.locations = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: top8.map(item => item[0]),
                datasets: [{
                    data: top8.map(item => item[1]),
                    backgroundColor: [
                        '#3B82F6', '#EF4444', '#10B981', '#F59E0B',
                        '#8B5CF6', '#06B6D4', '#F97316', '#84CC16'
                    ],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            usePointStyle: true
                        }
                    }
                }
            }
        });
    }

    renderEnvironmentsChart(envData) {
        const ctx = document.getElementById('environments-chart');
        if (!ctx) return;

        if (this.charts.environments) {
            this.charts.environments.destroy();
        }

        this.charts.environments = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: envData.map(item => item[0]),
                datasets: [{
                    label: 'Resources',
                    data: envData.map(item => item[1]),
                    backgroundColor: '#3B82F6',
                    borderColor: '#2563EB',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
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

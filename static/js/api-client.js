// API Client for TechStock Application
class ApiClient {
    constructor(baseUrl = '') {
        this.baseUrl = baseUrl;
        this.defaultHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
    }

    // Generic request method
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            headers: { ...this.defaultHeaders, ...options.headers },
            ...options
        };

        try {
            const response = await fetch(url, config);
            
            // Handle different response types
            if (response.status === 204) {
                return { success: true, data: null };
            }

            const contentType = response.headers.get('content-type');
            let data;
            
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                data = await response.text();
            }

            if (!response.ok) {
                throw new ApiError(
                    data.message || `HTTP ${response.status}: ${response.statusText}`,
                    response.status,
                    data
                );
            }

            return data;
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            
            // Network or other errors
            throw new ApiError(
                `Network error: ${error.message}`,
                0,
                { originalError: error }
            );
        }
    }

    // GET request
    async get(endpoint, params = {}, options = {}) {
        console.log('🌐 ApiClient.get called with:', { endpoint, params });
        
        // Filter out undefined/null values
        const cleanParams = {};
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
                cleanParams[key] = params[key];
            }
        });
        
        console.log('🧹 Cleaned params:', cleanParams);
        
        const queryString = new URLSearchParams(cleanParams).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        
        console.log('🔗 Final URL:', url);
        console.log('📝 Query string:', queryString);
        
        return this.request(url, {
            method: 'GET',
            ...options
        });
    }

    // POST request
    async post(endpoint, data = null) {
        return this.request(endpoint, {
            method: 'POST',
            body: data ? JSON.stringify(data) : null
        });
    }

    // PUT request
    async put(endpoint, data = null) {
        return this.request(endpoint, {
            method: 'PUT',
            body: data ? JSON.stringify(data) : null
        });
    }

    // DELETE request
    async delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE'
        });
    }

    // Health check
    async healthCheck() {
        return this.get('/health');
    }

    // Statistics
    async getStats() {
        return this.get('/stats');
    }

    // Resources API
    async getResources(params = {}) {
        return this.get('/api/v1/resources', params);
    }

    async getResource(id) {
        return this.get(`/api/v1/resources/${id}`);
    }

    async createResource(resourceData) {
        return this.post('/api/v1/resources', resourceData);
    }

    async updateResource(id, resourceData) {
        return this.put(`/api/v1/resources/${id}`, resourceData);
    }

    async deleteResource(id) {
        return this.delete(`/api/v1/resources/${id}`);
    }

    async getResourceStats() {
        return this.get('/api/v1/resources/stats');
    }

    async getResourcesBySubscription(subscriptionId) {
        return this.get(`/api/v1/subscriptions/${subscriptionId}/resources`);
    }

    // Dashboard API
    async getDashboardSummary(filters = {}) {
        return this.get('/api/v1/dashboard/summary', filters);
    }

    // Subscriptions API
    async getSubscriptions(params = {}) {
        return this.get('/api/v1/subscriptions', params);
    }

    async getSubscription(id) {
        return this.get(`/api/v1/subscriptions/${id}`);
    }

    async createSubscription(subscriptionData) {
        return this.post('/api/v1/subscriptions', subscriptionData);
    }

    async updateSubscription(id, subscriptionData) {
        return this.put(`/api/v1/subscriptions/${id}`, subscriptionData);
    }

    async deleteSubscription(id) {
        return this.delete(`/api/v1/subscriptions/${id}`);
    }

    // Tags API
    async getTags() {
        return this.get('/api/v1/tags');
    }

    async getTagSuggestions(query) {
        return this.get('/api/v1/tags/suggestions', { q: query });
    }

    // Resource Groups API
    async getResourceGroups() {
        return this.get('/api/v1/resource-groups');
    }

    async getResourceGroup(id) {
        return this.get(`/api/v1/resource-groups/${id}`);
    }

    async getResourceGroupsBySubscription(subscriptionId) {
        return this.get(`/api/v1/subscriptions/${subscriptionId}/resource-groups`);
    }

    // Resource Types API
    async getResourceTypes() {
        return this.get('/api/v1/resource-types');
    }

    // Resource Statistics API
    async getResourceStatistics() {
        return this.get('/api/v1/resources/stats');
    }
}

// Custom API Error class
class ApiError extends Error {
    constructor(message, status = 0, data = null) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
    }

    // Check if error is a specific HTTP status
    isStatus(status) {
        return this.status === status;
    }

    // Check if error is a client error (4xx)
    isClientError() {
        return this.status >= 400 && this.status < 500;
    }

    // Check if error is a server error (5xx)
    isServerError() {
        return this.status >= 500 && this.status < 600;
    }

    // Check if error is a network error
    isNetworkError() {
        return this.status === 0;
    }

    // Get user-friendly error message
    getUserMessage() {
        if (this.isNetworkError()) {
            return 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต';
        }

        if (this.isStatus(404)) {
            return 'ไม่พบข้อมูลที่ต้องการ';
        }

        if (this.isStatus(400)) {
            return 'ข้อมูลที่ส่งไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง';
        }

        if (this.isStatus(401)) {
            return 'ไม่มีสิทธิ์เข้าถึง กรุณาเข้าสู่ระบบใหม่';
        }

        if (this.isStatus(403)) {
            return 'ไม่มีสิทธิ์ในการดำเนินการนี้';
        }

        if (this.isStatus(409)) {
            return 'ข้อมูลซ้ำกับที่มีอยู่แล้ว';
        }

        if (this.isServerError()) {
            return 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง';
        }

        return this.message || 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
    }
}

// Request interceptor for loading states
class LoadingManager {
    constructor() {
        this.activeRequests = new Set();
        this.loadingElement = null;
    }

    setLoadingElement(element) {
        this.loadingElement = element;
    }

    startLoading(requestId = null) {
        const id = requestId || Date.now().toString();
        this.activeRequests.add(id);
        this.updateLoadingState();
        return id;
    }

    stopLoading(requestId) {
        this.activeRequests.delete(requestId);
        this.updateLoadingState();
    }

    updateLoadingState() {
        if (this.loadingElement) {
            this.loadingElement.style.display = this.activeRequests.size > 0 ? 'flex' : 'none';
        }
    }

    isLoading() {
        return this.activeRequests.size > 0;
    }
}

// Enhanced API Client with loading management
class EnhancedApiClient extends ApiClient {
    constructor(baseUrl = '', loadingManager = null) {
        super(baseUrl);
        this.loadingManager = loadingManager || new LoadingManager();
    }

    async request(endpoint, options = {}) {
        const requestId = this.loadingManager.startLoading();
        
        try {
            const result = await super.request(endpoint, options);
            this.loadingManager.stopLoading(requestId);
            return result;
        } catch (error) {
            this.loadingManager.stopLoading(requestId);
            throw error;
        }
    }
}

// Retry mechanism for failed requests
class RetryableApiClient extends EnhancedApiClient {
    constructor(baseUrl = '', loadingManager = null, maxRetries = 3) {
        super(baseUrl, loadingManager);
        this.maxRetries = maxRetries;
    }

    async requestWithRetry(endpoint, options = {}, retryCount = 0) {
        try {
            return await super.request(endpoint, options);
        } catch (error) {
            if (retryCount < this.maxRetries && this.shouldRetry(error)) {
                console.warn(`Request failed, retrying (${retryCount + 1}/${this.maxRetries}):`, error.message);
                
                // Exponential backoff
                const delay = Math.pow(2, retryCount) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
                
                return this.requestWithRetry(endpoint, options, retryCount + 1);
            }
            throw error;
        }
    }

    shouldRetry(error) {
        // Retry on network errors or server errors (5xx)
        return error.isNetworkError() || error.isServerError();
    }

    async request(endpoint, options = {}) {
        return this.requestWithRetry(endpoint, options);
    }
}

// Export classes for use in main application
window.ApiClient = ApiClient;
window.ApiError = ApiError;
window.LoadingManager = LoadingManager;
window.EnhancedApiClient = EnhancedApiClient;
window.RetryableApiClient = RetryableApiClient;

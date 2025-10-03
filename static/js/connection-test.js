// Connection Test for TechStock API
class ConnectionTest {
    constructor(baseUrl = '') {
        this.baseUrl = baseUrl;
        this.results = [];
    }

    async testEndpoint(name, endpoint, method = 'GET', data = null) {
        const startTime = Date.now();
        
        try {
            const options = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            };

            if (data && method !== 'GET') {
                options.body = JSON.stringify(data);
            }

            const response = await fetch(`${this.baseUrl}${endpoint}`, options);
            const endTime = Date.now();
            const duration = endTime - startTime;

            let responseData;
            const contentType = response.headers.get('content-type');
            
            if (contentType && contentType.includes('application/json')) {
                responseData = await response.json();
            } else {
                responseData = await response.text();
            }

            const result = {
                name,
                endpoint,
                method,
                status: response.status,
                success: response.ok,
                duration,
                data: responseData,
                error: null
            };

            this.results.push(result);
            return result;

        } catch (error) {
            const endTime = Date.now();
            const duration = endTime - startTime;

            const result = {
                name,
                endpoint,
                method,
                status: 0,
                success: false,
                duration,
                data: null,
                error: error.message
            };

            this.results.push(result);
            return result;
        }
    }

    async runAllTests() {
        console.log('🚀 Starting TechStock API Connection Tests...');
        
        // Test basic connectivity
        await this.testEndpoint('Health Check', '/health');
        await this.testEndpoint('Statistics', '/stats');
        
        // Test Resources API
        await this.testEndpoint('List Resources', '/api/v1/resources');
        await this.testEndpoint('List Resources with Pagination', '/api/v1/resources?page=1&size=5');
        await this.testEndpoint('Resource Statistics', '/api/v1/resources/stats');
        
        // Test Subscriptions API
        await this.testEndpoint('List Subscriptions', '/api/v1/subscriptions');
        
        // Test static files
        await this.testEndpoint('Static CSS', '/css/styles.css');
        await this.testEndpoint('Static JS', '/js/app.js');
        
        return this.results;
    }

    displayResults() {
        console.log('\n📊 Test Results Summary:');
        console.log('=' .repeat(60));
        
        let passed = 0;
        let failed = 0;
        
        this.results.forEach(result => {
            const status = result.success ? '✅ PASS' : '❌ FAIL';
            const duration = `${result.duration}ms`;
            const statusCode = result.status || 'Network Error';
            
            console.log(`${status} ${result.name}`);
            console.log(`   ${result.method} ${result.endpoint}`);
            console.log(`   Status: ${statusCode} | Duration: ${duration}`);
            
            if (result.error) {
                console.log(`   Error: ${result.error}`);
            } else if (result.data && typeof result.data === 'object') {
                console.log(`   Response: ${JSON.stringify(result.data).substring(0, 100)}...`);
            }
            
            console.log('');
            
            if (result.success) {
                passed++;
            } else {
                failed++;
            }
        });
        
        console.log(`📈 Summary: ${passed} passed, ${failed} failed`);
        
        if (failed === 0) {
            console.log('🎉 All tests passed! API is working correctly.');
        } else {
            console.log('⚠️  Some tests failed. Check the errors above.');
        }
        
        return { passed, failed, total: this.results.length };
    }

    generateReport() {
        const summary = this.displayResults();
        
        const report = {
            timestamp: new Date().toISOString(),
            summary,
            results: this.results,
            recommendations: this.getRecommendations()
        };
        
        return report;
    }

    getRecommendations() {
        const recommendations = [];
        
        // Check for slow responses
        const slowTests = this.results.filter(r => r.duration > 1000);
        if (slowTests.length > 0) {
            recommendations.push('Some API calls are slow (>1s). Consider optimizing database queries or adding caching.');
        }
        
        // Check for failed health checks
        const healthCheck = this.results.find(r => r.name === 'Health Check');
        if (healthCheck && !healthCheck.success) {
            recommendations.push('Health check failed. Server may not be running or database connection issues.');
        }
        
        // Check for failed static files
        const staticFiles = this.results.filter(r => r.endpoint.includes('/css/') || r.endpoint.includes('/js/'));
        const failedStatic = staticFiles.filter(r => !r.success);
        if (failedStatic.length > 0) {
            recommendations.push('Static files not loading properly. Check file paths and server configuration.');
        }
        
        // Check for API errors
        const apiTests = this.results.filter(r => r.endpoint.includes('/api/'));
        const failedApi = apiTests.filter(r => !r.success);
        if (failedApi.length > 0) {
            recommendations.push('API endpoints failing. Check server logs and database connectivity.');
        }
        
        if (recommendations.length === 0) {
            recommendations.push('All systems are working well! 🎉');
        }
        
        return recommendations;
    }
}

// Auto-run tests when page loads
document.addEventListener('DOMContentLoaded', async () => {
    // Wait a bit for the page to fully load
    setTimeout(async () => {
        const tester = new ConnectionTest();
        
        console.log('🔧 TechStock API Connection Test');
        console.log('Testing connection to:', window.location.origin);
        
        try {
            await tester.runAllTests();
            const report = tester.generateReport();
            
            // Store results for debugging
            window.connectionTestResults = report;
            
            console.log('\n💾 Full report stored in window.connectionTestResults');
            
        } catch (error) {
            console.error('❌ Connection test failed:', error);
        }
    }, 1000);
});

// Export for manual testing
window.ConnectionTest = ConnectionTest;

// Global fetch interceptor to automatically attach Authorization headers
// to all outgoing API requests that match the API URL.

if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  
  window.fetch = async (...args) => {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] instanceof Request ? args[0].url : '');
    
    // Only intercept requests to our API
    const isApi = url.includes(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') || url.includes('/api/');
    
    if (isApi) {
      const token = localStorage.getItem('pos_token');
      if (token) {
        const options = args[1] || {};
        
        // Convert headers to Headers object to easily check and set
        const headers = new Headers(options.headers || {});
        
        if (!headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${token}`);
        }
        
        options.headers = headers;
        args[1] = options;
      }
    }
    
    return originalFetch(...args);
  };
}

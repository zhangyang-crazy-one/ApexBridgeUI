// PLUGIN-047 to PLUGIN-052: NetworkAPI implementation
// HTTP requests with domain whitelist, rate limiting, caching, and audit logging

use super::{PluginError, PluginResult, PluginId};
use super::permission_manager::{PermissionManager, PermissionType};
use super::audit_logger::AuditLogger;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use std::time::{Duration, Instant};
use lru::LruCache;
use std::num::NonZeroUsize;

/// HTTP method types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum HttpMethod {
    Get,
    Post,
    Put,
    Delete,
    Patch,
    Head,
    Options,
}

impl HttpMethod {
    pub fn as_str(&self) -> &'static str {
        match self {
            HttpMethod::Get => "GET",
            HttpMethod::Post => "POST",
            HttpMethod::Put => "PUT",
            HttpMethod::Delete => "DELETE",
            HttpMethod::Patch => "PATCH",
            HttpMethod::Head => "HEAD",
            HttpMethod::Options => "OPTIONS",
        }
    }
}

/// HTTP request structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpRequest {
    pub url: String,
    pub method: HttpMethod,
    pub headers: HashMap<String, String>,
    pub body: Option<String>,
    pub timeout_secs: Option<u64>,
}

/// HTTP response structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpResponse {
    pub status: u16,
    pub headers: HashMap<String, String>,
    pub body: String,
}

/// Cache entry with TTL
#[derive(Debug, Clone)]
struct CacheEntry {
    response: HttpResponse,
    expires_at: Instant,
}

/// Token bucket for rate limiting
struct TokenBucket {
    tokens: f64,
    capacity: f64,
    refill_rate: f64, // tokens per second
    last_refill: Instant,
}

impl TokenBucket {
    fn new(capacity: f64, refill_rate: f64) -> Self {
        Self {
            tokens: capacity,
            capacity,
            refill_rate,
            last_refill: Instant::now(),
        }
    }

    fn try_consume(&mut self, tokens: f64) -> bool {
        self.refill();
        if self.tokens >= tokens {
            self.tokens -= tokens;
            true
        } else {
            false
        }
    }

    fn refill(&mut self) {
        let now = Instant::now();
        let elapsed = now.duration_since(self.last_refill).as_secs_f64();
        self.tokens = (self.tokens + elapsed * self.refill_rate).min(self.capacity);
        self.last_refill = now;
    }
}

/// PLUGIN-047 to PLUGIN-052: NetworkProxy
/// Manages HTTP requests with domain whitelist, rate limiting, and caching
pub struct NetworkProxy {
    permission_manager: Arc<Mutex<PermissionManager>>,
    audit_logger: Arc<Mutex<AuditLogger>>,
    // Rate limiters per plugin (100 req/min default)
    rate_limiters: Arc<Mutex<HashMap<PluginId, TokenBucket>>>,
    // Response cache with LRU eviction
    cache: Arc<Mutex<LruCache<String, CacheEntry>>>,
    // Default cache TTL in seconds
    default_cache_ttl: u64,
    // Default timeout in seconds
    default_timeout: u64,
    // Maximum timeout in seconds
    max_timeout: u64,
}

impl NetworkProxy {
    pub fn new(
        permission_manager: Arc<Mutex<PermissionManager>>,
        audit_logger: Arc<Mutex<AuditLogger>>,
    ) -> Self {
        Self {
            permission_manager,
            audit_logger,
            rate_limiters: Arc::new(Mutex::new(HashMap::new())),
            // LRU cache with 1000 entries max
            cache: Arc::new(Mutex::new(LruCache::new(NonZeroUsize::new(1000).unwrap()))),
            default_cache_ttl: 300, // 5 minutes
            default_timeout: 30,    // 30 seconds
            max_timeout: 300,       // 5 minutes max
        }
    }

    /// PLUGIN-049: Check rate limit using token bucket algorithm
    pub fn check_rate_limit(&self, plugin_id: &str) -> bool {
        let mut limiters = self.rate_limiters.lock().unwrap();
        let limiter = limiters
            .entry(plugin_id.to_string())
            .or_insert_with(|| TokenBucket::new(100.0, 100.0 / 60.0)); // 100 req/min

        limiter.try_consume(1.0)
    }

    /// Get reference to permission manager (for testing)
    pub fn permission_manager(&self) -> &Arc<Mutex<PermissionManager>> {
        &self.permission_manager
    }

    /// Get reference to audit logger (for testing)
    pub fn audit_logger(&self) -> &Arc<Mutex<AuditLogger>> {
        &self.audit_logger
    }

    /// PLUGIN-048: Validate domain against whitelist
    fn validate_domain(&self, plugin_id: &str, url: &str) -> PluginResult<()> {
        let parsed_url = url::Url::parse(url).map_err(|e| {
            PluginError::PermissionDenied(format!("Invalid URL: {}", e))
        })?;

        let domain = parsed_url.host_str().ok_or_else(|| {
            PluginError::PermissionDenied("URL has no host".to_string())
        })?;

        let pm = self.permission_manager.lock().unwrap();
        if !pm.validate_network_permission(plugin_id, domain) {
            return Err(PluginError::PermissionDenied(
                format!("No network permission for domain: {}", domain)
            ));
        }

        Ok(())
    }

    /// PLUGIN-050: Generate cache key from URL and headers
    fn cache_key(req: &HttpRequest) -> String {
        // Include method, URL, and relevant headers in cache key
        let mut key = format!("{}:{}", req.method.as_str(), req.url);

        // Add Authorization header if present (different auth = different cache)
        if let Some(auth) = req.headers.get("Authorization") {
            key.push_str(&format!(":auth:{}", auth));
        }

        key
    }

    /// PLUGIN-050: Get cached response if valid
    fn get_cached(&self, req: &HttpRequest) -> Option<HttpResponse> {
        let key = Self::cache_key(req);
        let mut cache = self.cache.lock().unwrap();

        if let Some(entry) = cache.get(&key) {
            if Instant::now() < entry.expires_at {
                return Some(entry.response.clone());
            } else {
                // Expired, remove from cache
                cache.pop(&key);
            }
        }

        None
    }

    /// PLUGIN-050: Store response in cache with TTL
    fn cache_response(&self, req: &HttpRequest, response: &HttpResponse, ttl_secs: u64) {
        let key = Self::cache_key(req);
        let entry = CacheEntry {
            response: response.clone(),
            expires_at: Instant::now() + Duration::from_secs(ttl_secs),
        };

        let mut cache = self.cache.lock().unwrap();
        cache.put(key, entry);
    }

    /// PLUGIN-052: Log request/response to audit logger
    fn log_request(&self, plugin_id: &str, req: &HttpRequest, success: bool, error: Option<&str>) {
        let mut logger = self.audit_logger.lock().unwrap();
        logger.log_permission_check(
            plugin_id,
            &PermissionType::NetworkRequest,
            &req.url,
            &format!("{} request", req.method.as_str()),
            success,
            error,
        );
    }

    /// PLUGIN-047: Execute HTTP request with all validations
    pub fn request(&self, plugin_id: &str, req: HttpRequest) -> PluginResult<HttpResponse> {
        // Step 1: Validate domain permission (PLUGIN-048)
        self.validate_domain(plugin_id, &req.url)?;

        // Step 2: Check rate limit (PLUGIN-049)
        if !self.check_rate_limit(plugin_id) {
            self.log_request(plugin_id, &req, false, Some("Rate limit exceeded"));
            return Err(PluginError::PermissionDenied(
                "Rate limit exceeded (100 req/min)".to_string()
            ));
        }

        // Step 3: Check cache (PLUGIN-050)
        if req.method.as_str() == "GET" {
            if let Some(cached) = self.get_cached(&req) {
                self.log_request(plugin_id, &req, true, None);
                return Ok(cached);
            }
        }

        // Step 4: Execute HTTP request with timeout (PLUGIN-051)
        let timeout = req.timeout_secs
            .unwrap_or(self.default_timeout)
            .min(self.max_timeout);

        let client = reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(timeout))
            .build()
            .map_err(|e| PluginError::PermissionDenied(format!("HTTP client error: {}", e)))?;

        let mut http_req = match req.method {
            HttpMethod::Get => client.get(&req.url),
            HttpMethod::Post => client.post(&req.url),
            HttpMethod::Put => client.put(&req.url),
            HttpMethod::Delete => client.delete(&req.url),
            HttpMethod::Patch => client.patch(&req.url),
            HttpMethod::Head => client.head(&req.url),
            HttpMethod::Options => {
                return Err(PluginError::PermissionDenied("OPTIONS method not supported".to_string()));
            }
        };

        // Add headers
        for (key, value) in &req.headers {
            http_req = http_req.header(key, value);
        }

        // Add body for POST/PUT/PATCH
        if let Some(body) = &req.body {
            http_req = http_req.body(body.clone());
        }

        // Execute request
        let http_res = http_req.send().map_err(|e| {
            self.log_request(plugin_id, &req, false, Some(&e.to_string()));
            PluginError::PermissionDenied(format!("HTTP request failed: {}", e))
        })?;

        // Build response
        let status = http_res.status().as_u16();
        let headers: HashMap<String, String> = http_res
            .headers()
            .iter()
            .map(|(k, v)| (k.as_str().to_string(), v.to_str().unwrap_or("").to_string()))
            .collect();

        let body = http_res.text().map_err(|e| {
            PluginError::PermissionDenied(format!("Failed to read response body: {}", e))
        })?;

        let response = HttpResponse {
            status,
            headers,
            body,
        };

        // Step 5: Cache GET responses (PLUGIN-050)
        if req.method.as_str() == "GET" && status == 200 {
            self.cache_response(&req, &response, self.default_cache_ttl);
        }

        // Step 6: Log success (PLUGIN-052)
        self.log_request(plugin_id, &req, true, None);

        Ok(response)
    }

    /// Get method for convenience
    pub fn get(&self, plugin_id: &str, url: &str) -> PluginResult<HttpResponse> {
        self.request(plugin_id, HttpRequest {
            url: url.to_string(),
            method: HttpMethod::Get,
            headers: HashMap::new(),
            body: None,
            timeout_secs: None,
        })
    }

    /// POST method for convenience
    pub fn post(&self, plugin_id: &str, url: &str, body: String, headers: HashMap<String, String>) -> PluginResult<HttpResponse> {
        self.request(plugin_id, HttpRequest {
            url: url.to_string(),
            method: HttpMethod::Post,
            headers,
            body: Some(body),
            timeout_secs: None,
        })
    }

    /// PUT method for convenience
    pub fn put(&self, plugin_id: &str, url: &str, body: String, headers: HashMap<String, String>) -> PluginResult<HttpResponse> {
        self.request(plugin_id, HttpRequest {
            url: url.to_string(),
            method: HttpMethod::Put,
            headers,
            body: Some(body),
            timeout_secs: None,
        })
    }

    /// DELETE method for convenience
    pub fn delete(&self, plugin_id: &str, url: &str) -> PluginResult<HttpResponse> {
        self.request(plugin_id, HttpRequest {
            url: url.to_string(),
            method: HttpMethod::Delete,
            headers: HashMap::new(),
            body: None,
            timeout_secs: None,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    fn create_test_network_proxy() -> NetworkProxy {
        let temp_dir = std::env::temp_dir().join(format!("vcp_net_test_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp_dir).unwrap();

        let pm = Arc::new(Mutex::new(PermissionManager::new(temp_dir.clone())));
        let logger = Arc::new(Mutex::new(AuditLogger::new(temp_dir)));

        NetworkProxy::new(pm, logger)
    }

    #[test]
    fn test_rate_limit_token_bucket() {
        let proxy = create_test_network_proxy();
        let plugin_id = "test-plugin";

        // Should allow 100 requests initially
        let mut allowed = 0;
        for _ in 0..150 {
            if proxy.check_rate_limit(plugin_id) {
                allowed += 1;
            }
        }

        assert!(allowed >= 95 && allowed <= 105, "Expected ~100 allowed requests, got {}", allowed);
    }

    #[test]
    fn test_cache_key_generation() {
        let req1 = HttpRequest {
            url: "https://api.example.com/data".to_string(),
            method: HttpMethod::Get,
            headers: HashMap::new(),
            body: None,
            timeout_secs: None,
        };

        let key1 = NetworkProxy::cache_key(&req1);
        assert_eq!(key1, "GET:https://api.example.com/data");

        let mut headers = HashMap::new();
        headers.insert("Authorization".to_string(), "Bearer token123".to_string());
        let req2 = HttpRequest {
            url: "https://api.example.com/data".to_string(),
            method: HttpMethod::Get,
            headers,
            body: None,
            timeout_secs: None,
        };

        let key2 = NetworkProxy::cache_key(&req2);
        assert!(key2.contains("auth:Bearer token123"));
        assert_ne!(key1, key2);
    }
}

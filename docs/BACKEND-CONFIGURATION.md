# Backend Configuration Guide

**Date**: 2025-11-05
**Purpose**: Configure VCPChat Tauri application to connect to running VCPToolBox backend

---

## Backend Connection Settings

The VCPChat application requires proper configuration to connect to the VCPToolBox backend server.

### Default Configuration

The application is pre-configured with the following defaults:

```typescript
// src/core/models/settings.ts - getDefaultSettings()
{
  backend_url: 'http://localhost:6005/v1/chat/completions',
  api_key: '',  // Must be configured by user
  websocket_url: '',  // Optional
  websocket_key: ''   // Optional
}
```

### VCPToolBox Backend Configuration

Based on `VCPToolBox/config.env`:

- **Server Port**: `6005`
- **API Key (Bearer Token)**: `VCP_ZhipuAI_Access_Key_2025`
- **WebSocket Key**: `VCP_WebSocket_Key_2025`
- **Image Service Key**: `VCP_Images_Key_2025`
- **File Service Key**: `VCP_Files_Key_2025`

### Configuration Methods

#### Method 1: Settings UI (Recommended)

1. Launch VCPChat application
2. Navigate to Settings (Ctrl+,)
3. Go to "Backend" tab
4. Enter configuration:
   - **Backend URL**: `http://localhost:6005/v1/chat/completions`
   - **API Key**: `VCP_ZhipuAI_Access_Key_2025`
   - **WebSocket URL** (optional): `ws://localhost:6005`
   - **WebSocket Key** (optional): `VCP_WebSocket_Key_2025`
5. Click "Test Connection" to verify
6. Click "Save" to persist

#### Method 2: Manual localStorage (For Testing)

```javascript
// In browser console or test setup
localStorage.setItem('vcpchat-settings', JSON.stringify({
  backend_url: 'http://localhost:6005/v1/chat/completions',
  api_key: 'VCP_ZhipuAI_Access_Key_2025',
  websocket_url: 'ws://localhost:6005',
  websocket_key: 'VCP_WebSocket_Key_2025',
  user_name: 'User',
  user_avatar: 'assets/avatars/default-user.png',
  theme: 'claude-light',
  language: 'zh-CN',
  // ... other settings ...
}));
```

#### Method 3: Tauri Settings File (For Testing)

The SettingsManager stores settings in:
- **Tauri Backend**: `AppData\com.vcp.chat\settings.json`
- **localStorage Fallback**: Browser localStorage with key `vcpchat-settings`

---

## Connection Verification

### Test Connection Programmatically

```typescript
import { APIClient } from '@core/services/apiClient';

const client = new APIClient({
  baseURL: 'http://localhost:6005/v1/chat/completions',
  apiKey: 'VCP_ZhipuAI_Access_Key_2025',
  timeout: 30000
});

// Test connection
const connected = await client.testConnection();
console.log('Connected:', connected);
console.log('Status:', client.getConnectionStatus());
```

### Expected Responses

#### Successful Connection
```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "gpt-3.5-turbo",
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "..."
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 5,
    "completion_tokens": 7,
    "total_tokens": 12
  }
}
```

#### 401 Unauthorized (Invalid API Key)
```json
{
  "error": {
    "message": "Invalid API key",
    "type": "invalid_request_error",
    "code": "invalid_api_key"
  }
}
```

#### Network Error (Backend Not Running)
```
Error: Network error: Unable to connect to VCPToolBox
```

---

## Retry Logic

The APIClient implements automatic retry with exponential backoff:

- **Max Attempts**: 5
- **Initial Delay**: 1 second
- **Backoff Multiplier**: 2 (1s, 2s, 4s, 8s, 16s)
- **Max Delay**: 16 seconds

### Retryable Errors
- Network errors (TypeError, NetworkError, AbortError)
- HTTP 5xx server errors
- HTTP 408 Request Timeout
- HTTP 429 Rate Limit

### Non-Retryable Errors
- HTTP 400 Bad Request
- HTTP 401 Unauthorized (invalid API key)
- HTTP 403 Forbidden
- HTTP 404 Not Found

---

## Testing Configuration

### Integration Tests

The backend connection integration tests require a running VCPToolBox backend:

```bash
# 1. Start VCPToolBox backend
cd VCPToolBox
node server.js

# 2. In another terminal, run tests
cd VCP-CHAT-Rebuild
npm test -- src/tests/integration/backend-connection.test.ts
```

### Test Environment Variables

For automated testing, set the API key in test setup:

```typescript
// vitest.config.ts or test setup
process.env.VCP_API_KEY = 'VCP_ZhipuAI_Access_Key_2025';
```

---

## Troubleshooting

### Issue: "401 Unauthorized" Error

**Cause**: Incorrect or missing API key

**Solution**:
1. Verify API key matches VCPToolBox config (`Key=VCP_ZhipuAI_Access_Key_2025`)
2. Check for leading/trailing whitespace in key
3. Ensure Bearer token format: `Authorization: Bearer VCP_ZhipuAI_Access_Key_2025`

### Issue: "Network Error: Unable to connect"

**Cause**: Backend not running or incorrect URL

**Solution**:
1. Verify VCPToolBox is running: `http://localhost:6005`
2. Check port is not in use by another service
3. Test endpoint manually: `curl http://localhost:6005`

### Issue: "Request Timeout"

**Cause**: Backend taking too long to respond

**Solution**:
1. Check VCPToolBox logs for errors
2. Increase timeout in APIClient config (default: 120s)
3. Verify upstream AI API (Zhipu) is responding

### Issue: Connection Status Stuck on "connecting"

**Cause**: Event bus not initialized or connection not completing

**Solution**:
1. Check browser console for errors
2. Verify WebSocket connection (if enabled)
3. Test with testConnection() method

---

## Security Notes

1. **API Key Storage**: Never commit API keys to version control
2. **Environment Variables**: Use `.env` files for local development
3. **Production**: Store keys in secure secrets management
4. **Key Rotation**: Update API keys regularly in VCPToolBox config

---

## References

- **VCPToolBox Config**: `VCPToolBox/config.env`
- **Settings Model**: `src/core/models/settings.ts`
- **API Client**: `src/core/services/apiClient.ts`
- **Settings Manager**: `src/core/managers/settingsManager.ts`
- **Integration Tests**: `src/tests/integration/backend-connection.test.ts`

---

**Last Updated**: 2025-11-05
**Maintained By**: VCPChat Development Team

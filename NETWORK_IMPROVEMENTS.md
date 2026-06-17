# Network Download Improvements

## Overview
The OriLauncher has been enhanced with improved network download functionality to handle connectivity issues, timeouts, and proxy configurations.

## Key Improvements

### 1. Enhanced Error Handling
- Better detection and handling of network errors (ETIMEDOUT, ENETUNREACH, ECONNREFUSED)
- User-friendly error messages instead of technical error codes
- Proper cleanup of partial downloads on failure

### 2. Retry Mechanism with Exponential Backoff
- Automatic retry of failed downloads (up to 3 attempts by default)
- Exponential backoff strategy to avoid overwhelming servers
- Configurable retry count

### 3. Proxy Support
- Automatic detection of system proxy settings via environment variables
- Support for both HTTP and HTTPS proxies
- Environment variables supported:
  - `HTTP_PROXY` or `http_proxy`
  - `HTTPS_PROXY` or `https_proxy`

### 4. Improved Timeout Handling
- Increased timeout from 30 seconds to 60 seconds
- Better timeout error messages
- Support for both IPv4 and IPv6 connections

## Configuration

### Setting Proxy (if needed)
You can configure proxy settings using environment variables:

**Windows:**
```cmd
set HTTP_PROXY=http://proxy.example.com:8080
set HTTPS_PROXY=http://proxy.example.com:8080
```

**Linux/Mac:**
```bash
export HTTP_PROXY=http://proxy.example.com:8080
export HTTPS_PROXY=http://proxy.example.com:8080
```

### Troubleshooting Download Issues

If you continue to experience download issues:

1. **Check Internet Connection**: Ensure you have a stable internet connection
2. **Check Firewall/Antivirus**: Some security software may block downloads
3. **Try Different Network**: Test on a different network to isolate the issue
4. **Check Proxy Settings**: If behind a corporate network, ensure proxy is configured
5. **Check DNS**: Try using a different DNS server (like 8.8.8.8 or 1.1.1.1)

### Common Error Messages and Solutions

- **"Connection timed out"**: Server is slow or unreachable. Try again later.
- **"Network unreachable"**: Check your internet connection and proxy settings.
- **"Connection refused"**: Download server may be temporarily unavailable.
- **"Download timed out"**: Server is taking too long to respond.

## Technical Details

The download function now includes:
- Keep-alive connections for better performance
- Proper handling of redirects (up to 5 redirects)
- Progress reporting during downloads
- Cancellation support for user-initiated stops
- Automatic cleanup of failed downloads

## Testing

To test the download functionality, you can use the included test script:

```javascript
import { testDownload } from './src/electron/test-download.js';
testDownload();
```

This will test various scenarios including successful downloads, timeouts, and network failures.
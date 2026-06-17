// @ts-nocheck
// Test script for the enhanced download functionality
// This can be used to test the download improvements

import { ipcMain } from 'electron';
import fs from 'fs/promises';
import path from 'path';

// Mock event object for testing
const mockEvent = {
    sender: {
        send: (channel, data) => {
            console.log(`[MOCK] ${channel}:`, data);
        }
    }
};

// Test function to simulate the download
async function testDownload() {
    console.log('Testing enhanced download functionality...');
    
    // Test URLs (you can replace with actual mod download URLs)
    const testUrls = [
        'https://httpbin.org/status/200', // Should work
        'https://httpbin.org/delay/10', // Should timeout
        'https://invalid-domain-that-does-not-exist.com/file.jar', // Should fail
    ];
    
    for (const url of testUrls) {
        console.log(`\n--- Testing URL: ${url} ---`);
        
        try {
            // Simulate the download-mod-file IPC call
            const result = await ipcMain.handle('download-mod-file', mockEvent, {
                url,
                filePath: path.join(process.cwd(), 'test-download.tmp'),
                instanceId: 'test-instance'
            });
            
            console.log('Result:', result);
            
            // Clean up test file
            try {
                await fs.unlink(path.join(process.cwd(), 'test-download.tmp'));
            } catch (e) {
                // File might not exist if download failed
            }
            
        } catch (error) {
            console.error('Test failed:', error);
        }
    }
}

// Export for use in main process
export { testDownload };
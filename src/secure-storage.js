// secure-storage.js
class SecureStorageService {
    // Use a more robust key derivation
    static async deriveKey(salt) {
      const encoder = new TextEncoder();
      const baseKey = encoder.encode('compar:IA-local-key' + salt);
      
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        baseKey,
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
      );
      
      return await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: encoder.encode('comparIA'),
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
    }
  
    static async encryptData(data) {
      try {
        const encoder = new TextEncoder();
        const encodedData = encoder.encode(data);
        
        // Generate a random salt for each encryption
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await this.deriveKey(String.fromCharCode(...salt));
        
        const encryptedContent = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv: iv },
          key,
          encodedData
        );
        
        // Combine salt, IV, and encrypted data
        const result = new Uint8Array(salt.length + iv.length + encryptedContent.byteLength);
        result.set(salt, 0);
        result.set(iv, salt.length);
        result.set(new Uint8Array(encryptedContent), salt.length + iv.length);
        
        return btoa(String.fromCharCode(...result));
      } catch (error) {
        console.error('Encryption error:', error);
        throw new Error('Encryption failed');
      }
    }
  
    static async decryptData(encryptedString) {
      try {
        const decoder = new TextDecoder();
        const encrypted = Uint8Array.from(atob(encryptedString), c => c.charCodeAt(0));
        
        // Extract salt, IV, and data
        const salt = encrypted.slice(0, 16);
        const iv = encrypted.slice(16, 28);
        const data = encrypted.slice(28);
        
        const key = await this.deriveKey(String.fromCharCode(...salt));
        
        const decryptedContent = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: iv },
          key,
          data
        );
        
        return decoder.decode(decryptedContent);
      } catch (error) {
        console.error('Decryption error:', error);
        throw new Error('Decryption failed');
      }
    }
  
    static async storeApiKey(apiKey) {
      try {
        if (!apiKey || typeof apiKey !== 'string') {
          throw new Error('Invalid API key format');
        }
        
        const encryptedKey = await this.encryptData(apiKey);
        await chrome.storage.local.set({ 'encrypted_api_key': encryptedKey });
        return true;
      } catch (error) {
        console.error('Error storing API key:', error);
        throw error; // Propagate the actual error for better debugging
      }
    }
  
    static async getApiKey() {
      try {
        const result = await chrome.storage.local.get('encrypted_api_key');
        if (!result.encrypted_api_key) {
          return null;
        }
        return await this.decryptData(result.encrypted_api_key);
      } catch (error) {
        console.error('Error retrieving API key:', error);
        throw error; // Propagate the actual error for better debugging
      }
    }
  }
  
  export default SecureStorageService;
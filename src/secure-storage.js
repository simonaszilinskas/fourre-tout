// src/secure-storage.js
class SecureStorageService {
  static STORAGE_KEYS = {
    API_KEY: 'encrypted_api_key',
    SALT: 'key_salt',
    IV: 'key_iv',
    KEY_MATERIAL: 'key_material' // For storing the encrypted key material
  };

  static ENCRYPTION_CONFIG = {
    iterations: 100000,
    hash: 'SHA-256',
    keyLength: 256
  };

  // Generate a new encryption key
  static async generateMasterKey() {
    const key = await crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256
      },
      true, // extractable
      ['encrypt', 'decrypt']
    );
    
    // Export the key to store it
    const exportedKey = await crypto.subtle.exportKey('raw', key);
    return new Uint8Array(exportedKey);
  }

  // Initialize secure storage
  static async initialize() {
    try {
      // Check if we already have key material
      const stored = await chrome.storage.local.get(this.STORAGE_KEYS.KEY_MATERIAL);
      if (!stored[this.STORAGE_KEYS.KEY_MATERIAL]) {
        // Generate new key material
        const keyMaterial = await this.generateMasterKey();
        const salt = crypto.getRandomValues(new Uint8Array(32));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        
        // Encrypt the key material using the extension ID and installation time as factors
        const installTime = (await chrome.management.getSelf()).installType;
        const uniqueId = await this.generateUniqueId(installTime);
        
        const encryptedMaterial = await this.encryptKeyMaterial(keyMaterial, uniqueId, salt, iv);
        
        // Store encrypted key material and parameters
        await chrome.storage.local.set({
          [this.STORAGE_KEYS.KEY_MATERIAL]: Array.from(encryptedMaterial),
          [this.STORAGE_KEYS.SALT]: Array.from(salt),
          [this.STORAGE_KEYS.IV]: Array.from(iv)
        });
      }
      return true;
    } catch (error) {
      console.error('Failed to initialize secure storage:', error);
      throw new Error('Secure storage initialization failed');
    }
  }

  // Generate a unique ID based on extension and browser properties
  static async generateUniqueId(installTime) {
    const extensionInfo = await chrome.management.getSelf();
    const browserInfo = await chrome.runtime.getBrowserInfo();
    
    const uniqueString = `${extensionInfo.id}-${installTime}-${browserInfo.version}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(uniqueString);
    
    const hash = await crypto.subtle.digest('SHA-256', data);
    return new Uint8Array(hash);
  }

  // Encrypt the key material
  static async encryptKeyMaterial(keyMaterial, uniqueId, salt, iv) {
    const encoder = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
      'raw',
      uniqueId,
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: this.ENCRYPTION_CONFIG.iterations,
        hash: this.ENCRYPTION_CONFIG.hash
      },
      baseKey,
      { name: 'AES-GCM', length: this.ENCRYPTION_CONFIG.keyLength },
      false,
      ['encrypt']
    );

    const encryptedData = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      derivedKey,
      keyMaterial
    );

    return new Uint8Array(encryptedData);
  }

  // Get the master key
  static async getMasterKey() {
    try {
      const stored = await chrome.storage.local.get([
        this.STORAGE_KEYS.KEY_MATERIAL,
        this.STORAGE_KEYS.SALT,
        this.STORAGE_KEYS.IV
      ]);

      if (!stored[this.STORAGE_KEYS.KEY_MATERIAL]) {
        throw new Error('Key material not found');
      }

      const encryptedMaterial = new Uint8Array(stored[this.STORAGE_KEYS.KEY_MATERIAL]);
      const salt = new Uint8Array(stored[this.STORAGE_KEYS.SALT]);
      const iv = new Uint8Array(stored[this.STORAGE_KEYS.IV]);

      const installTime = (await chrome.management.getSelf()).installType;
      const uniqueId = await this.generateUniqueId(installTime);

      const baseKey = await crypto.subtle.importKey(
        'raw',
        uniqueId,
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
      );

      const derivedKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: this.ENCRYPTION_CONFIG.iterations,
          hash: this.ENCRYPTION_CONFIG.hash
        },
        baseKey,
        { name: 'AES-GCM', length: this.ENCRYPTION_CONFIG.keyLength },
        false,
        ['decrypt']
      );

      const decryptedMaterial = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        derivedKey,
        encryptedMaterial
      );

      return await crypto.subtle.importKey(
        'raw',
        decryptedMaterial,
        'AES-GCM',
        false,
        ['encrypt', 'decrypt']
      );
    } catch (error) {
      console.error('Failed to get master key:', error);
      throw new Error('Failed to access secure storage');
    }
  }

  // Store API key
  static async storeApiKey(apiKey) {
    try {
      if (!this.validateApiKey(apiKey)) {
        throw new Error('Invalid API key format');
      }

      await this.initialize();
      const masterKey = await this.getMasterKey();
      
      const encoder = new TextEncoder();
      const data = encoder.encode(apiKey);
      const iv = crypto.getRandomValues(new Uint8Array(12));

      const encryptedData = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        masterKey,
        data
      );

      const encryptedBuffer = new Uint8Array(encryptedData);
      const combined = new Uint8Array(iv.length + encryptedBuffer.length);
      combined.set(iv);
      combined.set(encryptedBuffer, iv.length);

      await chrome.storage.local.set({
        [this.STORAGE_KEYS.API_KEY]: Array.from(combined)
      });

      return true;
    } catch (error) {
      console.error('Failed to store API key:', error);
      throw new Error('Failed to store API key securely');
    }
  }

  // Get API key
  static async getApiKey() {
    try {
      const stored = await chrome.storage.local.get(this.STORAGE_KEYS.API_KEY);
      if (!stored[this.STORAGE_KEYS.API_KEY]) {
        return null;
      }

      const combined = new Uint8Array(stored[this.STORAGE_KEYS.API_KEY]);
      const iv = combined.slice(0, 12);
      const encryptedData = combined.slice(12);

      const masterKey = await this.getMasterKey();
      const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        masterKey,
        encryptedData
      );

      return new TextDecoder().decode(decryptedData);
    } catch (error) {
      console.error('Failed to retrieve API key:', error);
      throw new Error('Failed to retrieve API key');
    }
  }

  // Validate API key format
  static validateApiKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }

    // OpenAI API keys typically start with 'sk-' and are 51 characters long
    const openAiKeyRegex = /^sk-[A-Za-z0-9-]{48}$/;
    return openAiKeyRegex.test(apiKey);
  }

  // Clear all stored data
  static async clearStorage() {
    try {
      await chrome.storage.local.remove([
        this.STORAGE_KEYS.API_KEY,
        this.STORAGE_KEYS.KEY_MATERIAL,
        this.STORAGE_KEYS.SALT,
        this.STORAGE_KEYS.IV
      ]);
      return true;
    } catch (error) {
      console.error('Failed to clear storage:', error);
      throw new Error('Failed to clear secure storage');
    }
  }
}

export default SecureStorageService;
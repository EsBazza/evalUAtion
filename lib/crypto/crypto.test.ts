import { encrypt, decrypt } from './aes';
import { generateSubmissionHash } from './anonymity';
import crypto from 'crypto';

describe('Crypto Modules', () => {
  describe('AES Encryption', () => {
    it('should encrypt and decrypt correctly', () => {
      const payload = JSON.stringify({ scores: { q1: 4 }, comments: 'Great' });
      // 32-byte key for AES-256
      const key = crypto.randomBytes(32);
      
      const { ciphertext, iv, authTag } = encrypt(payload, key);
      
      const decrypted = decrypt(ciphertext, key, iv, authTag);
      expect(decrypted).toBe(payload);
    });

    it('should fail with wrong key', () => {
      const payload = 'secret data';
      const key1 = crypto.randomBytes(32);
      const key2 = crypto.randomBytes(32);
      
      const { ciphertext, iv, authTag } = encrypt(payload, key1);
      
      expect(() => decrypt(ciphertext, key2, iv, authTag)).toThrow();
    });
  });

  describe('HMAC Anonymity', () => {
    it('should generate same hash for same inputs', () => {
      const hash1 = generateSubmissionHash('student1', 'facultyA', 'period2026', 'pepper123');
      const hash2 = generateSubmissionHash('student1', 'facultyA', 'period2026', 'pepper123');
      
      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different inputs', () => {
      const hash1 = generateSubmissionHash('student1', 'facultyA', 'period2026', 'pepper123');
      const hash2 = generateSubmissionHash('student2', 'facultyA', 'period2026', 'pepper123');
      
      expect(hash1).not.toBe(hash2);
    });
  });
});

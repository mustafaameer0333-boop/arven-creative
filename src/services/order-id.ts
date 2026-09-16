import crypto from 'node:crypto';

export function createOrderId(prefix = 'ARV') {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(5).toString('hex').toUpperCase();
  return `${prefix}-${stamp}-${random}`;
}

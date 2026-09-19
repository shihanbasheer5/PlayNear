/**
 * Password & authentication validation rules
 */

export interface PasswordChecks {
  minLength: boolean; // Minimum 8 characters
  hasUpper: boolean;  // At least one uppercase letter (A-Z)
  hasLower: boolean;  // At least one lowercase letter (a-z)
  hasNumber: boolean; // At least one number (0-9)
}

export function validatePasswordRequirements(password: string): {
  isValid: boolean;
  checks: PasswordChecks;
  error?: string;
} {
  const checks: PasswordChecks = {
    minLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
  };

  const isValid = checks.minLength && checks.hasUpper && checks.hasLower && checks.hasNumber;

  if (!checks.minLength) {
    return { isValid: false, checks, error: "Password must be at least 8 characters long." };
  }
  if (!checks.hasUpper) {
    return { isValid: false, checks, error: "Password must include at least one uppercase letter (A-Z)." };
  }
  if (!checks.hasLower) {
    return { isValid: false, checks, error: "Password must include at least one lowercase letter (a-z)." };
  }
  if (!checks.hasNumber) {
    return { isValid: false, checks, error: "Password must include at least one number (0-9)." };
  }

  return { isValid: true, checks };
}

/**
 * Utility functions for normalizing and validating Kenyan phone numbers for M-Pesa & SMS
 */

export interface PhoneValidationResult {
    isValid: boolean;
    formatted: string; // E.g. '254712345678'
    display: string;   // E.g. '+254 712 345 678' or '0712 345 678'
    local: string;     // E.g. '0712345678'
    error?: string;
}

export function normalizeKenyanPhone(input: string | number | undefined | null): PhoneValidationResult {
    if (!input) {
        return {
            isValid: false,
            formatted: '',
            display: '',
            local: '',
            error: 'Phone number is required'
        };
    }

    // Convert to string and remove all non-digit characters
    let cleaned = String(input).replace(/[^0-9]/g, '');

    // Handle leading zeros or international country code
    if (cleaned.startsWith('0')) {
        cleaned = '254' + cleaned.slice(1);
    } else if (cleaned.startsWith('254')) {
        // Already starts with 254
    } else if (cleaned.length === 9 && (cleaned.startsWith('7') || cleaned.startsWith('1'))) {
        cleaned = '254' + cleaned;
    }

    // Validate Kenyan Safaricom / Airtel / Telkom format
    // Standard format: 254 7XX XXX XXX or 254 1XX XXX XXX (12 digits total)
    const kenyanRegex = /^254(7\d{8}|1\d{8})$/;

    if (!kenyanRegex.test(cleaned)) {
        return {
            isValid: false,
            formatted: cleaned,
            display: cleaned,
            local: cleaned.startsWith('254') ? '0' + cleaned.slice(3) : cleaned,
            error: 'Please enter a valid Kenyan phone number (e.g., 0712345678 or 0112345678)'
        };
    }

    const localNumber = '0' + cleaned.slice(3);
    const displayNumber = `+254 ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)} ${cleaned.slice(9)}`;

    return {
        isValid: true,
        formatted: cleaned,
        display: displayNumber,
        local: localNumber
    };
}

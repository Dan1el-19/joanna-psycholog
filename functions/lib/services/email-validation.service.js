"use strict";
/**
 * Email Validation Service
 * Validates email addresses and provides suggestions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailValidationService = void 0;
class EmailValidationService {
    /**
     * Validate email address
     */
    static validateEmail(email) {
        const errors = [];
        const suggestions = [];
        // Basic format validation
        if (!email || email.trim().length === 0) {
            errors.push('Email address is required');
            return {
                isValid: false,
                email: email.trim(),
                errors,
                suggestions
            };
        }
        const trimmedEmail = email.trim().toLowerCase();
        // Basic regex validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedEmail)) {
            errors.push('Invalid email format');
        }
        // More detailed validation
        const [localPart, domain] = trimmedEmail.split('@');
        if (!localPart) {
            errors.push('Email must have a local part before @');
        }
        else {
            // Validate local part
            if (localPart.length > 64) {
                errors.push('Local part cannot be longer than 64 characters');
            }
            if (localPart.startsWith('.') || localPart.endsWith('.')) {
                errors.push('Local part cannot start or end with a dot');
            }
            if (localPart.includes('..')) {
                errors.push('Local part cannot contain consecutive dots');
            }
            // Check for invalid characters
            const invalidChars = /[^a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]/;
            if (invalidChars.test(localPart)) {
                errors.push('Local part contains invalid characters');
            }
        }
        if (!domain) {
            errors.push('Email must have a domain part after @');
        }
        else {
            // Validate domain
            if (domain.length > 253) {
                errors.push('Domain cannot be longer than 253 characters');
            }
            if (!domain.includes('.')) {
                errors.push('Domain must contain at least one dot');
            }
            // Check for domain typos and suggest corrections
            if (this.DOMAIN_TYPOS[domain]) {
                suggestions.push(`Did you mean ${localPart}@${this.DOMAIN_TYPOS[domain]}?`);
            }
            // Check for similar domains
            const similarDomain = this.findSimilarDomain(domain);
            if (similarDomain && similarDomain !== domain) {
                suggestions.push(`Did you mean ${localPart}@${similarDomain}?`);
            }
            // Validate domain format
            const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
            if (!domainRegex.test(domain)) {
                errors.push('Invalid domain format');
            }
        }
        // Additional checks
        if (trimmedEmail.length > 254) {
            errors.push('Email address cannot be longer than 254 characters');
        }
        // Check for consecutive dots in the entire email
        if (trimmedEmail.includes('..')) {
            errors.push('Email cannot contain consecutive dots');
        }
        return {
            isValid: errors.length === 0,
            email: trimmedEmail,
            errors,
            suggestions: suggestions.length > 0 ? suggestions : undefined
        };
    }
    /**
     * Find similar domain using Levenshtein distance
     */
    static findSimilarDomain(domain) {
        let minDistance = Infinity;
        let similarDomain = null;
        for (const commonDomain of this.COMMON_DOMAINS) {
            const distance = this.calculateLevenshteinDistance(domain, commonDomain);
            // If distance is 1-2 characters, suggest it
            if (distance > 0 && distance <= 2 && distance < minDistance) {
                minDistance = distance;
                similarDomain = commonDomain;
            }
        }
        return similarDomain;
    }
    /**
     * Calculate Levenshtein distance between two strings
     */
    static calculateLevenshteinDistance(str1, str2) {
        const matrix = [];
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                }
                else {
                    matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1, // insertion
                    matrix[i - 1][j] + 1 // deletion
                    );
                }
            }
        }
        return matrix[str2.length][str1.length];
    }
    /**
     * Validate multiple email addresses
     */
    static validateEmails(emails) {
        return emails.map(email => this.validateEmail(email));
    }
    /**
     * Check if email domain is disposable/temporary
     */
    static isDisposableEmail(email) {
        var _a;
        const disposableDomains = [
            '10minutemail.com', 'tempmail.org', 'guerrillamail.com',
            'mailinator.com', 'throwaway.email', 'temp-mail.org',
            'getnada.com', 'mohmal.com', 'guerrillamailblock.com'
        ];
        const domain = (_a = email.split('@')[1]) === null || _a === void 0 ? void 0 : _a.toLowerCase();
        return disposableDomains.includes(domain);
    }
    /**
     * Normalize email address (lowercase, trim)
     */
    static normalizeEmail(email) {
        return email.trim().toLowerCase();
    }
}
exports.EmailValidationService = EmailValidationService;
// Common email domains for suggestions
EmailValidationService.COMMON_DOMAINS = [
    'gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com',
    'icloud.com', 'aol.com', 'live.com', 'msn.com',
    'wp.pl', 'onet.pl', 'interia.pl', 'gazeta.pl', 'o2.pl'
];
// Common typos in domains
EmailValidationService.DOMAIN_TYPOS = {
    'gmial.com': 'gmail.com',
    'gmai.com': 'gmail.com',
    'gmail.co': 'gmail.com',
    'gmil.com': 'gmail.com',
    'outlok.com': 'outlook.com',
    'hotmai.com': 'hotmail.com',
    'yahooo.com': 'yahoo.com',
    'wp.com': 'wp.pl',
    'onet.com': 'onet.pl'
};
//# sourceMappingURL=email-validation.service.js.map
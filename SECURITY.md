# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of Alicia Document Assistant seriously. If you have discovered a security vulnerability, please follow these steps:

1. **DO NOT** open a public issue
2. Email your findings to bert@telkom.be
3. Include the following information:
   - Type of issue (e.g., buffer overflow, SQL injection, XSS, etc.)
   - Full paths of source file(s) related to the issue
   - Location of the affected source code (tag/branch/commit or direct URL)
   - Step-by-step instructions to reproduce the issue
   - Proof-of-concept or exploit code (if possible)
   - Impact of the issue

## Response Timeline

- **Initial Response**: Within 48 hours
- **Issue Confirmation**: Within 7 days
- **Patch Release**: Within 30 days (depending on severity)

## Security Best Practices for Users

1. **Keep Dependencies Updated**: Regularly update all npm packages
2. **Use HTTPS**: Always serve the application over HTTPS in production
3. **Environment Variables**: Never commit sensitive data like API keys
4. **Content Security Policy**: Implement proper CSP headers
5. **Input Validation**: Always validate and sanitize user inputs

## Known Security Considerations

- The application connects to local AI services (LM Studio/Ollama)
- WebSocket connections should be secured in production
- File uploads should be restricted by size and type
- API endpoints should implement rate limiting

## Security Features

- Input sanitization for all user-generated content
- XSS protection through content escaping
- CORS configuration for API endpoints
- Secure session management
- Optional authentication system (coming soon)

## Acknowledgments

We appreciate responsible disclosure and will acknowledge security researchers who follow this policy.
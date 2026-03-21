## Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

We take the security of this project seriously. If you believe you have found a security vulnerability, please report it to us privately.

### How to Report

1. **Do not** create a public GitHub issue for the vulnerability
2. Send an email to [INSERT SECURITY CONTACT EMAIL] with details about the vulnerability
3. Include the following information:
   - Type of issue (e.g., information disclosure, injection, etc.)
   - Full path of source file(s) related to the issue
   - Location of the affected source code (tag/branch/commit or direct URL)
   - Any special configuration required to reproduce the issue
   - Step-by-step instructions to reproduce the issue
   - Proof-of-concept or exploit code (if possible)
   - Impact of the issue, including how an attacker might exploit it

### What to Expect

- You will receive acknowledgment of your report within 48 hours
- We will investigate and provide a detailed response within 5 business days
- We will keep you informed about the progress toward a fix
- Once the issue is resolved, we will credit you in the release notes (if you wish)

## Security Best Practices

When deploying this service, please follow these security guidelines:

### Environment Variables

- Always set `DISCORD_GITHUB_WEBHOOK_URL` as an environment variable in Vercel
- Never commit webhook URLs to the repository
- Consider using GitHub webhook secrets for additional security

### Webhook Secrets

For enhanced security, you can add a webhook secret in GitHub:

1. In your repository webhook settings, add a **Secret**
2. The service will automatically verify the signature
3. Add the same secret as `GITHUB_WEBHOOK_SECRET` environment variable

### Rate Limiting

The service is designed to handle normal GitHub webhook traffic. If you need to use it for high-volume repositories, consider:
- Implementing rate limiting at the Vercel level
- Monitoring usage through Vercel's observability tools

## Disclosure Policy

We follow the principle of responsible disclosure. Security vulnerabilities will be:

- Confirmed and analyzed within 5 business days
- Fixed in the next release (or sooner for critical issues)
- Disclosed publicly after the fix is released, with credit to the reporter

## Comments on this Policy

If you have suggestions on how this process could be improved, please submit an issue or contact us directly.

> [!NOTE]
> This service uses the Discord webhook API. Please review [Discord's Terms of Service](https://discord.com/terms) and [Developer Policy](https://discord.com/developers/docs/legal) regarding webhook usage.

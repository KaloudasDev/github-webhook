## GitHub to Discord Webhook Service

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black.svg)](https://vercel.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A universal webhook service that forwards GitHub events to Discord with beautiful, information-rich embeds.  
Deploy once, use across all your repositories, completely free, open-source, serverless, and scalable.

## Features

- **Universal Service** - One endpoint for all your GitHub repositories
- **Rich Discord Embeds** - Beautiful, well-formatted messages with all relevant information
- **Multiple Event Support** - Handles pushes, pull requests, issues, stars, forks, releases, and more
- **Zero Configuration** - Just add your Discord webhook URL and you're ready to go
- **Ready for Vercel** - Deploy instantly with Vercel's serverless platform

## Supported Events

| Event | Description |
|-------|-------------|
| **Push** | New commits pushed to a branch |
| **Pull Request** | PR opened, closed, merged, or reopened |
| **Issues** | Issue opened, closed, assigned, labeled |
| **Issue Comments** | New comments on issues |
| **Stars** | Repository starred or unstarred |
| **Forks** | Repository forked |
| **Releases** | Release published, created, edited, or deleted |
| **Branch/Tag Creation** | New branches or tags created |
| **Branch/Tag Deletion** | Branches or tags deleted |
| **Watching** | User started watching repository |
| **Collaborators** | New collaborator added |
| **Commit Comments** | Comments on commits |

## How It Works

1. GitHub sends a webhook event to your Vercel endpoint
2. The service processes the event and creates a formatted Discord embed
3. The embed is sent to your configured Discord channel

## Deployment

### 1. Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/KaloudasDev/github-webhook)

Or manually:

```bash
git clone https://github.com/KaloudasDev/github-webhook.git
cd github-webhook
vercel deploy
```

### 2. Configure Environment Variable

Add your Discord webhook URL to Vercel:

```env
DISCORD_GITHUB_WEBHOOK_URL=https://discord.com/api/webhooks/your-webhook-id/your-webhook-token
```

### 3. Create Discord Webhook

1. Go to your Discord server → Channel Settings → Integrations → Webhooks
2. Create a new webhook named "GitHub"
3. Copy the webhook URL

### 4. Configure GitHub Webhook

For each repository you want to monitor:

1. Go to your GitHub repository → Settings → Webhooks → Add webhook
2. **Payload URL**: `https://your-project.vercel.app/api/github-webhook`
3. **Content type**: `application/json`
4. **Events**: Select the events you want to receive (Push, Pull requests, Issues, etc.)

## Example Embeds

### Push Event
```
KaloudasDev/github-webhook
[abc1234] Update README — KaloudasDev

Files: 1
Additions: +5
Deletions: -2
GitHub
```

### Pull Request Event
```
KaloudasDev/github-webhook - Pull Request Opened
Add new feature

Branch: feature → main
Commits: 3
Changes: +156 / -23
GitHub
```

### Issue Event
```
KaloudasDev/github-webhook - Issue Opened
Bug: Login not working

Issue: #42
Comments: 2
GitHub
```

## API Reference

### Endpoint

```
POST /api/github-webhook
```

### Headers

- `X-GitHub-Event` - GitHub event type (push, pull_request, issues, etc.)
- `X-Hub-Signature-256` - Optional webhook secret for verification

### Response

- `200 OK` - Event processed successfully
- `405 Method Not Allowed` - Only POST requests are accepted
- `500 Internal Server Error` - Server error or misconfiguration

## Testing

You can test if your service is running:

```bash
curl https://your-project.vercel.app/api/github-webhook
```

Expected response:
```json
{
  "status": "ok",
  "message": "GitHub webhook service is running",
  "usage": "Send POST requests with GitHub webhook events",
  "endpoints": ["/api/github-webhook (POST only)"]
}
```

## Project Structure

```
github-webhook/
├── api/
│   └── github-webhook.js    # Main webhook handler
├── package.json              # Dependencies and metadata
├── vercel.json              # Vercel configuration
└── README.md                # This file
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DISCORD_GITHUB_WEBHOOK_URL` | Your Discord webhook URL | Yes |

## License

MIT © [KaloudasDev](https://github.com/KaloudasDev)

## Contributing

Contributions are welcome! Please ensure:
- Code follows existing patterns
- All events are handled properly
- Discord embeds remain clean and informative

> [!IMPORTANT]
> Make sure to set the `DISCORD_GITHUB_WEBHOOK_URL` environment variable in Vercel before using the service.

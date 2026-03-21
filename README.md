# GitHub to Discord Webhook Service

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black.svg)](https://vercel.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub Release](https://img.shields.io/github/v/release/KaloudasDev/github-webhook)](https://github.com/KaloudasDev/github-webhook/releases)
[![GitHub Stars](https://img.shields.io/github/stars/KaloudasDev/github-webhook)](https://github.com/KaloudasDev/github-webhook/stargazers)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/KaloudasDev/github-webhook/pulls)

A universal webhook service that forwards GitHub events to Discord with beautiful, information-rich embeds.  
Deploy once, use across all your repositories, completely free, open-source, serverless, and scalable.

## Features

- **Universal Service** - One endpoint for all your GitHub repositories
- **Rich Discord Embeds** - Beautiful, well-formatted messages with all relevant information
- **Accurate Commit Stats** - Shows real line additions/deletions using GitHub API (supports private repos)
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
2. The service processes the event and fetches accurate commit stats via GitHub API (if needed)
3. Creates a formatted Discord embed with all relevant information
4. The embed is sent to your configured Discord channel

## Deployment

### 1. Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/KaloudasDev/github-webhook)

Or manually:

```bash
git clone https://github.com/KaloudasDev/github-webhook.git
cd github-webhook
vercel deploy
```

### 2. Configure Environment Variables

Add these environment variables to your Vercel project:

| Variable | Description | Required |
|----------|-------------|----------|
| `DISCORD_GITHUB_WEBHOOK_URL` | Your Discord webhook URL | Yes |
| `GITHUB_TOKEN` | GitHub Personal Access Token (For Private Repos) | Optional* |

*\*Required only if you want accurate commit stats for private repositories. Public repos work without it.*

### 3. Create Discord Webhook

1. Go to your Discord server → Channel Settings → Integrations → Webhooks
2. Create a new webhook named "GitHub"
3. Copy the webhook URL

### 4. Create GitHub Personal Access Token (for private repos)

If you plan to use this service with private repositories, you need a GitHub token:

1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token (classic)
3. **Note**: `github-webhook-service`
4. **Expiration**: No expiration (or as preferred)
5. **Scopes**: Select `repo` (Full control of private repositories)
6. Generate and copy the token (e.g., `ghp_xxxxxxxxxxxx`)

> [!IMPORTANT]
> The token is required only for private repositories. Public repos work without it.

### 5. Configure GitHub Webhook

For each repository you want to monitor:

1. Go to your GitHub repository → Settings → Webhooks → Add webhook
2. **Payload URL**: `https://your-project.vercel.app/api/github-webhook`
3. **Content type**: `application/json`
4. **Secret**: Leave empty (optional)
5. **Events**: Select "Let me select individual events" and choose:
   - Push
   - Pull Requests
   - Issues (Optional)
   - Stars (Optional)
6. Click **Add webhook**

## Example Embeds

### Push Event
```
KaloudasDev/github-webhook
[abc1234] Update README — KaloudasDev

Files: 1
Additions: +5 Lines
Deletions: -2 Lines
GitHub
```

### Pull Request Event
```
KaloudasDev/github-webhook - Pull Request Opened
Add new feature

Branch: feature → main
Commits: 3
Changes: +156 / -23 Lines
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

To test with a real commit:

```bash
# Add a test line to any file
echo "// test" >> your-file.js
git add your-file.js
git commit -m "Test: Verify commit stats"
git push
```

Check your Discord channel for the embed with accurate stats.

## Project Structure

```
github-webhook/
├── api/
│   └── github-webhook.js    # Main webhook handler
├── package.json              # Dependencies and metadata
├── vercel.json              # Vercel configuration
└── README.md                # This file
```

## Environment Variables Summary

| Variable | Purpose | Required |
|----------|---------|----------|
| `DISCORD_GITHUB_WEBHOOK_URL` | Discord webhook destination | Yes |
| `GITHUB_TOKEN` | GitHub API token for private repo stats | For private repos only |

## Troubleshooting

### Commit stats show 0 lines
- Ensure `GITHUB_TOKEN` is set correctly in Vercel
- Verify token has `repo` scope
- For public repos, token is not required

### Webhook returns 404
- Verify the URL is `https://your-project.vercel.app/api/github-webhook`
- Check that the deployment was successful

### No Discord message received
- Verify `DISCORD_GITHUB_WEBHOOK_URL` is correct
- Check Vercel logs for errors

## License

MIT © [KaloudasDev](https://github.com/KaloudasDev)

## Contributing

Contributions are welcome! Please ensure:
- Code follows existing patterns
- All events are handled properly
- Discord embeds remain clean and informative

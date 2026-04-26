# GitHub to Discord Webhook Service

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black.svg?logo=vercel&logoColor=white)](https://vercel.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?logo=opensourceinitiative&logoColor=yellow)](https://opensource.org/licenses/MIT)
[![GitHub Release](https://img.shields.io/github/v/release/KaloudasDev/github-webhook?logo=github)](https://github.com/KaloudasDev/github-webhook/releases)
[![GitHub Stars](https://img.shields.io/github/stars/KaloudasDev/github-webhook?logo=github&color=gold)](https://github.com/KaloudasDev/github-webhook/stargazers)
[![Node.js](https://img.shields.io/badge/Node.js-18.x-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)

A universal webhook service that forwards GitHub events to Discord with beautiful, information-rich embeds.  
Supports Vercel deployment status tracking via commit status events with Pending → Success/Failed flow.

## Features

- **Universal Service** - One endpoint for all your GitHub repositories
- **Rich Discord Embeds** - Beautiful, well-formatted messages with all relevant information
- **Accurate Commit Stats** - Shows real line additions/deletions using GitHub API
- **Vercel Integration** - Automatically tracks deployment status
- **Zero Duplicate Notifications** - Smart event deduplication
- **Multiple Event Support** - Handles 30+ GitHub event types
- **No Configuration Needed** - Just add your Discord webhook URL

## Supported Events

| Event | Description |
|-------|-------------|
| **Push** | New commits pushed to a branch with file stats |
| **Pull Request** | PR opened, closed, merged, reopened, synchronized, labeled, etc. |
| **Issues** | Issue opened, closed, assigned, labeled, milestoned, etc. |
| **Issue Comments** | Comments on issues (created, edited, deleted) |
| **Stars** | Repository starred or unstarred |
| **Forks** | Repository forked |
| **Releases** | Release published, created, edited, or deleted |
| **Branch/Tag Creation** | New branches or tags created |
| **Branch/Tag Deletion** | Branches or tags deleted |
| **Watching** | User started watching repository |
| **Collaborators** | Collaborator added, removed, or permissions changed |
| **Commit Comments** | Comments on commits |
| **Discussions** | Discussions created, edited, answered, etc. |
| **Discussion Comments** | Comments on discussions |
| **Labels** | Labels created, edited, or deleted |
| **Milestones** | Milestones created, closed, opened, deleted |
| **Packages** | Packages published or updated |
| **Pages Build** | GitHub Pages build status |
| **Pull Request Reviews** | PR reviews (approved, changes requested, commented) |
| **Pull Request Review Comments** | Comments on PR reviews |
| **Repository** | Repository created, deleted, archived, made public/private |
| **Repository Rulesets** | Repository ruleset created, edited, deleted |
| **Secret Scanning Alerts** | Secret scanning alerts for security issues |
| **Team Add** | Team added to repository |
| **Wiki (Gollum)** | Wiki page updates |
| **Branch Protection Rules** | Branch protection rule created, edited, deleted |
| **Branch Protection Configuration** | Branch protections enabled/disabled |
| **Code Scanning Alerts** | Code scanning alert created, fixed, closed, reopened |
| **Dependabot Alerts** | Dependabot security alerts |
| **Deploy Keys** | Deploy keys created or deleted |
| **Security & Analysis** | Security features enabled/disabled |
| **Issue Dependencies** | Issue dependencies added or removed |
| **Repository Made Public** | Repository visibility changed to public |
| **Vercel Deployments** | Deployment PENDING → SUCCESS/FAILED (via commit status) |

## How It Works

1. GitHub sends a webhook event to your Vercel endpoint
2. The service processes the event with smart deduplication (prevents duplicate notifications)
3. For push events, fetches accurate commit stats via GitHub API
4. Creates a formatted Discord embed with all relevant information
5. For Vercel deployments, tracks status via `status` events

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
| `DISCORD_GITHUB_WEBHOOK_URL` | Your Discord webhook URL | **Yes** |
| `GITHUB_TOKEN` | GitHub Personal Access Token | **Recommended** |

> [!IMPORTANT]
> The `GITHUB_TOKEN` is **strongly recommended** for both public and private repositories to get accurate commit statistics (additions/deletions). Without it, commit stats may show 0 lines.

### 3. Create Discord Webhook

1. Go to your Discord server → Channel Settings → Integrations → Webhooks
2. Create a new webhook named "GitHub"
3. Copy the webhook URL
4. Add it as `DISCORD_GITHUB_WEBHOOK_URL` in Vercel

### 4. Create GitHub Personal Access Token

1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token (classic)
3. **Note**: `github-webhook-service`
4. **Expiration**: No expiration (or as preferred)
5. **Scopes**: Select `repo` (Full control of private repositories)
6. Generate and copy the token (e.g., `ghp_xxxxxxxxxxxx`)
7. Add it as `GITHUB_TOKEN` in Vercel

### 5. Configure GitHub Webhook

For each repository you want to monitor:

1. Go to your GitHub repository → Settings → Webhooks → Add webhook
2. **Payload URL**: `https://your-project.vercel.app/api/github-webhook`
3. **Content type**: `application/json`
4. **Secret**: Leave empty (optional)
5. **Events**: Select **"Send me everything"** (Recommended) or choose individual events:
   - Push
   - Pull requests
   - Issues
   - Issue comments
   - Stars
   - Forks
   - Releases
   - Discussions
   - And more...
6. Click **Add webhook**

## Testing

Test if your service is running:

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

Test with a real commit:

```bash
echo "// test" >> your-file.js
git add your-file.js
git commit -m "Test: Verify commit stats"
git push
```

Check your Discord channel for the embed with accurate stats.

## Environment Variables Summary

| Variable | Purpose | Required |
|----------|---------|----------|
| `DISCORD_GITHUB_WEBHOOK_URL` | Discord webhook destination | **Yes** |
| `GITHUB_TOKEN` | GitHub API token for accurate commit stats | **Recommended** |

## Troubleshooting

### Commit stats show 0 lines
- Ensure `GITHUB_TOKEN` is set correctly in Vercel
- Verify token has `repo` scope
- Token is needed for BOTH public and private repos for accurate stats

### Duplicate Vercel notifications
- The service only uses `status` events for Vercel (not `deployment` or `deployment_status`)
- This prevents duplicate notifications

### Webhook returns 404
- Verify the URL is `https://your-project.vercel.app/api/github-webhook`
- Check that the deployment was successful

### No Discord message received
- Verify `DISCORD_GITHUB_WEBHOOK_URL` is correct
- Check Vercel logs for errors

### Vercel deployment shows UNKNOWN
- Make sure you're using the latest code with the `status` event handler
- Vercel sends deployment status via `status` event with `context: 'Vercel'`

## Rate Limiting

The service implements smart caching:
- Prevents duplicate processing of the same webhook delivery (10 second window)
- Automatic cleanup of old cache entries

## License

MIT © [KaloudasDev](https://github.com/KaloudasDev)

## Contributing

Contributions are welcome! Please ensure:
- Code follows existing patterns
- All events are handled properly
- Discord embeds remain clean and informative
- No duplicate notifications for the same event

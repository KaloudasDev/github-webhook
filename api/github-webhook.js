module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  try {
    const event = req.headers['x-github-event'];
    const payload = req.body;
    const DISCORD_WEBHOOK_URL = process.env.DISCORD_GITHUB_WEBHOOK_URL;

    if (!DISCORD_WEBHOOK_URL) {
      console.error('DISCORD_GITHUB_WEBHOOK_URL not set');
      return res.status(500).send('Webhook not configured');
    }

    if (event === 'push') {
      const { repository, pusher, commits, ref, sender } = payload;
      const branch = ref.replace('refs/heads/', '');
      
      if (!commits || commits.length === 0) {
        return res.status(200).send('OK');
      }

      let totalAdditions = 0;
      let totalDeletions = 0;
      const files = new Set();
      
      commits.forEach(commit => {
        totalAdditions += commit.added?.length || 0;
        totalDeletions += commit.removed?.length || 0;
        [...(commit.added || []), ...(commit.modified || []), ...(commit.removed || [])].forEach(f => files.add(f));
      });
      
      const pusherUsername = pusher?.name || commits[0]?.author?.username || sender?.login || 'Unknown';
      const avatarUrl = sender?.avatar_url || `https://github.com/${pusherUsername}.png`;
      
      const commitMessages = commits.map(commit => {
        const shortHash = commit.id.slice(0, 7);
        const commitUrl = commit.url || `https://github.com/${repository.full_name}/commit/${commit.id}`;
        const message = commit.message.split('\n')[0];
        const author = commit.author?.username || commit.committer?.username || pusher?.name || sender?.login;
        return `[\`${shortHash}\`](${commitUrl}) ${message} — ${author}`;
      }).join('\n');
      
      const embed = {
        color: 0x516989,
        author: {
          name: pusherUsername,
          icon_url: avatarUrl,
          url: `https://github.com/${pusherUsername}`
        },
        title: `${repository.full_name}`,
        url: `https://github.com/${repository.full_name}/commits/${branch}`,
        description: commitMessages.length > 4096 ? commitMessages.slice(0, 4096) + '...' : commitMessages,
        fields: [
          { name: 'Files', value: `**${files.size}**`, inline: true },
          { name: 'Additions', value: `**+${totalAdditions}**`, inline: true },
          { name: 'Deletions', value: `**-${totalDeletions}**`, inline: true }
        ],
        footer: {
          text: `GitHub`,
          icon_url: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'
        },
        timestamp: new Date().toISOString()
      };

      await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] })
      });
    }
    
    else if (event === 'pull_request') {
      const { action, pull_request, repository } = payload;
      
      const relevantActions = ['opened', 'closed', 'reopened', 'ready_for_review'];
      if (!relevantActions.includes(action)) {
        return res.status(200).send('OK');
      }
      
      let color, title;
      if (action === 'opened') {
        color = 0x9c3712;
        title = 'Pull Request Opened';
      } else if (action === 'reopened') {
        color = 0x9c3712;
        title = 'Pull Request Reopened';
      } else if (action === 'ready_for_review') {
        color = 0x9c3712;
        title = 'Pull Request Ready for Review';
      } else if (action === 'closed') {
        color = pull_request.merged ? 0x6e5494 : 0xe74c3c;
        title = pull_request.merged ? 'Pull Request Merged' : 'Pull Request Closed';
      }
      
      const embed = {
        color: color,
        author: {
          name: pull_request.user.login,
          icon_url: pull_request.user.avatar_url,
          url: pull_request.user.html_url
        },
        title: `${repository.full_name} - ${title}`,
        url: pull_request.html_url,
        description: `**${pull_request.title}**\n\n${pull_request.body?.slice(0, 500) || '*No description provided*'}`,
        fields: [
          { name: 'Branch', value: `${pull_request.head.ref} → ${pull_request.base.ref}`, inline: true },
          { name: 'Commits', value: `${pull_request.commits}`, inline: true },
          { name: 'Changes', value: `+${pull_request.additions} / -${pull_request.deletions}`, inline: true }
        ],
        footer: {
          text: `GitHub`,
          icon_url: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'
        },
        timestamp: new Date().toISOString()
      };

      await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] })
      });
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error');
  }
};
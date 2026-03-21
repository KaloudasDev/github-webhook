module.exports = async (req, res) => {
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'ok',
      message: 'GitHub webhook service is running',
      usage: 'Send POST requests with GitHub webhook events',
      endpoints: ['/api/github-webhook (POST only)']
    });
  }

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
          { name: 'Additions', value: `**+${totalAdditions}** Lines`, inline: true },
          { name: 'Deletions', value: `**-${totalDeletions}** Lines`, inline: true }
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
          { name: 'Changes', value: `+${pull_request.additions} / -${pull_request.deletions} Lines`, inline: true }
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
    
    else if (event === 'issues') {
      const { action, issue, repository, sender } = payload;
      
      let color, title, description;
      if (action === 'opened') {
        color = 0x9c3712;
        title = 'Issue Opened';
        description = `**${issue.title}**\n\n${issue.body?.slice(0, 500) || '*No description provided*'}`;
      } else if (action === 'closed') {
        color = 0xe74c3c;
        title = 'Issue Closed';
        description = `**${issue.title}**`;
      } else if (action === 'reopened') {
        color = 0x9c3712;
        title = 'Issue Reopened';
        description = `**${issue.title}**`;
      } else if (action === 'assigned') {
        color = 0x9c3712;
        title = 'Issue Assigned';
        description = `**${issue.title}**\nAssigned to: ${issue.assignee?.login || 'Unknown'}`;
      } else if (action === 'unassigned') {
        color = 0x9c3712;
        title = 'Issue Unassigned';
        description = `**${issue.title}**\nUnassigned from: ${issue.assignee?.login || 'Unknown'}`;
      } else if (action === 'labeled') {
        color = 0x9c3712;
        title = 'Issue Labeled';
        description = `**${issue.title}**\nLabel: ${issue.label?.name || 'Unknown'}`;
      } else if (action === 'unlabeled') {
        color = 0x9c3712;
        title = 'Issue Unlabeled';
        description = `**${issue.title}**\nLabel: ${issue.label?.name || 'Unknown'}`;
      } else {
        return res.status(200).send('OK');
      }
      
      const embed = {
        color: color,
        author: {
          name: sender.login,
          icon_url: sender.avatar_url,
          url: sender.html_url
        },
        title: `${repository.full_name} - ${title}`,
        url: issue.html_url,
        description: description,
        fields: [
          { name: 'Issue', value: `#${issue.number}`, inline: true },
          { name: 'Comments', value: `${issue.comments}`, inline: true }
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
    
    else if (event === 'issue_comment') {
      const { action, issue, comment, repository, sender } = payload;
      
      if (action !== 'created') {
        return res.status(200).send('OK');
      }
      
      const embed = {
        color: 0x6D9EDC,
        author: {
          name: sender.login,
          icon_url: sender.avatar_url,
          url: sender.html_url
        },
        title: `${repository.full_name} - Issue Comment`,
        url: comment.html_url,
        description: `**${issue.title}**\n\n${comment.body?.slice(0, 500) || '*No comment content*'}`,
        fields: [
          { name: 'Issue', value: `#${issue.number}`, inline: true }
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
    
    else if (event === 'star') {
      const { action, repository, sender } = payload;
      
      const embed = {
        color: action === 'created' ? 0xf1c40f : 0x95a5a6,
        author: {
          name: sender.login,
          icon_url: sender.avatar_url,
          url: sender.html_url
        },
        title: action === 'created' ? 'Star Added' : 'Star Removed',
        url: repository.html_url,
        description: `${sender.login} ${action === 'created' ? 'starred' : 'unstarred'} ${repository.full_name}`,
        fields: [
          { name: 'Stars', value: `${repository.stargazers_count}`, inline: true }
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
    
    else if (event === 'fork') {
      const { repository, forkee, sender } = payload;
      
      const embed = {
        color: 0x9c3712,
        author: {
          name: sender.login,
          icon_url: sender.avatar_url,
          url: sender.html_url
        },
        title: 'Repository Forked',
        url: forkee.html_url,
        description: `${sender.login} forked ${repository.full_name}`,
        fields: [
          { name: 'Forks', value: `${repository.forks_count}`, inline: true }
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
    
    else if (event === 'release') {
      const { action, release, repository, sender } = payload;
      
      const relevantActions = ['published', 'created', 'edited', 'deleted'];
      if (!relevantActions.includes(action)) {
        return res.status(200).send('OK');
      }
      
      let color, title;
      if (action === 'published') {
        color = 0x9c3712;
        title = 'Release Published';
      } else if (action === 'created') {
        color = 0x9c3712;
        title = 'Release Created';
      } else if (action === 'edited') {
        color = 0x9c3712;
        title = 'Release Edited';
      } else {
        color = 0xe74c3c;
        title = 'Release Deleted';
      }
      
      const embed = {
        color: color,
        author: {
          name: sender.login,
          icon_url: sender.avatar_url,
          url: sender.html_url
        },
        title: `${repository.full_name} - ${title}`,
        url: release.html_url,
        description: `**${release.name || release.tag_name}**\n\n${release.body?.slice(0, 500) || '*No description*'}`,
        fields: [
          { name: 'Tag', value: release.tag_name, inline: true }
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
    
    else if (event === 'create') {
      const { ref_type, ref, repository, sender } = payload;
      
      const embed = {
        color: 0x9c3712,
        author: {
          name: sender.login,
          icon_url: sender.avatar_url,
          url: sender.html_url
        },
        title: `${ref_type === 'branch' ? 'Branch' : 'Tag'} Created`,
        url: repository.html_url,
        description: `${sender.login} created ${ref_type} \`${ref}\` in ${repository.full_name}`,
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
    
    else if (event === 'delete') {
      const { ref_type, ref, repository, sender } = payload;
      
      const embed = {
        color: 0xe74c3c,
        author: {
          name: sender.login,
          icon_url: sender.avatar_url,
          url: sender.html_url
        },
        title: `${ref_type === 'branch' ? 'Branch' : 'Tag'} Deleted`,
        url: repository.html_url,
        description: `${sender.login} deleted ${ref_type} \`${ref}\` from ${repository.full_name}`,
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
    
    else if (event === 'watch') {
      const { action, repository, sender } = payload;
      
      if (action !== 'started') {
        return res.status(200).send('OK');
      }
      
      const embed = {
        color: 0xf1c40f,
        author: {
          name: sender.login,
          icon_url: sender.avatar_url,
          url: sender.html_url
        },
        title: 'Watching Started',
        url: repository.html_url,
        description: `${sender.login} started watching ${repository.full_name}`,
        fields: [
          { name: 'Watchers', value: `${repository.watchers_count || repository.watchers || 0}`, inline: true }
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
    
    else if (event === 'member') {
      const { action, member, repository, sender } = payload;
      
      if (action !== 'added') {
        return res.status(200).send('OK');
      }
      
      const embed = {
        color: 0x9c3712,
        author: {
          name: sender.login,
          icon_url: sender.avatar_url,
          url: sender.html_url
        },
        title: 'Collaborator Added',
        url: repository.html_url,
        description: `${sender.login} added ${member.login} as a collaborator to ${repository.full_name}`,
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
    
    else if (event === 'commit_comment') {
      const { action, comment, repository, sender } = payload;
      
      if (action !== 'created') {
        return res.status(200).send('OK');
      }
      
      const embed = {
        color: 0x516989,
        author: {
          name: sender.login,
          icon_url: sender.avatar_url,
          url: sender.html_url
        },
        title: `${repository.full_name} - Commit Comment`,
        url: comment.html_url,
        description: `**${comment.commit_id?.slice(0, 7)}**\n\n${comment.body?.slice(0, 500) || '*No comment content*'}`,
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

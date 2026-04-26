const deliveryCache = new Map();

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

  function truncateMessage(message, maxLength = 60) {
    if (!message) return '';
    if (message.length <= maxLength) return message;
    
    const lastSpace = message.lastIndexOf(' ', maxLength - 3);
    if (lastSpace > 0) {
      return message.substring(0, lastSpace) + '...';
    }
    return message.substring(0, maxLength - 3) + '...';
  }

  async function sendToDiscord(embed) {
    const DISCORD_WEBHOOK_URL = process.env.DISCORD_GITHUB_WEBHOOK_URL;
    if (!DISCORD_WEBHOOK_URL) return;
    
    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] })
    });
  }

  try {
    const event = req.headers['x-github-event'];
    const deliveryId = req.headers['x-github-delivery'];
    const payload = req.body;
    const DISCORD_WEBHOOK_URL = process.env.DISCORD_GITHUB_WEBHOOK_URL;
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

    if (!DISCORD_WEBHOOK_URL) {
      console.error('DISCORD_GITHUB_WEBHOOK_URL not set');
      return res.status(500).send('Webhook not configured');
    }

    if (deliveryCache.has(deliveryId)) {
      const lastSeen = deliveryCache.get(deliveryId);
      if (Date.now() - lastSeen < 10000) {
        return res.status(200).send('OK');
      }
    }
    
    deliveryCache.set(deliveryId, Date.now());
    
    if (deliveryCache.size > 1000) {
      const now = Date.now();
      for (const [id, timestamp] of deliveryCache.entries()) {
        if (now - timestamp > 60000) {
          deliveryCache.delete(id);
        }
      }
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
      
      for (const commit of commits) {
        if (commit.stats?.additions) {
          totalAdditions += commit.stats.additions;
          totalDeletions += commit.stats.deletions;
        } else if (GITHUB_TOKEN) {
          try {
            const commitUrl = `https://api.github.com/repos/${repository.full_name}/commits/${commit.id}`;
            const response = await fetch(commitUrl, {
              headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}` }
            });
            const data = await response.json();
            if (data.stats) {
              totalAdditions += data.stats.additions || 0;
              totalDeletions += data.stats.deletions || 0;
            }
          } catch (err) {
            console.error(`Failed to fetch commit stats for ${commit.id}:`, err);
          }
        }
        
        [...(commit.added || []), ...(commit.modified || []), ...(commit.removed || [])].forEach(f => files.add(f));
      }
      
      const pusherUsername = pusher?.name || commits[0]?.author?.username || sender?.login || 'Unknown';
      const avatarUrl = sender?.avatar_url || `https://github.com/${pusherUsername}.png`;
      
      const commitMessages = commits.map(commit => {
        const shortHash = commit.id.slice(0, 7);
        const commitUrl = commit.url || `https://github.com/${repository.full_name}/commit/${commit.id}`;
        const message = commit.message.split('\n')[0];
        const truncatedMessage = truncateMessage(message, 60);
        return `[\`${shortHash}\`](${commitUrl}) ${truncatedMessage}`;
      }).join('\n');
      
      const fileCountText = files.size === 1 ? '1 File' : `${files.size} Files`;
      const additionsText = totalAdditions === 1 ? '1 Line' : `${totalAdditions} Lines`;
      const deletionsText = totalDeletions === 1 ? '1 Line' : `${totalDeletions} Lines`;
      
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
          { name: 'Changes', value: `${fileCountText}`, inline: true },
          { name: 'Additions', value: `${additionsText}`, inline: true },
          { name: 'Deletions', value: `${deletionsText}`, inline: true }
        ],
        footer: {
          text: `GitHub`,
          icon_url: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'
        },
        timestamp: new Date().toISOString()
      };

      await sendToDiscord(embed);
    }
    
    else if (event === 'status') {
      const { context, state, target_url, description, repository, sender, branches, sha } = payload;
      
      if (context !== 'Vercel') {
        return res.status(200).send('OK');
      }
      
      let color, statusText;
      
      if (state === 'success') {
        color = 0x2ecc71;
        statusText = 'Success';
      } else if (state === 'failure' || state === 'error') {
        color = 0xe74c3c;
        statusText = 'Failed';
      } else if (state === 'pending') {
        color = 0xf1c40f;
        statusText = 'Pending';
      } else {
        color = 0x95a5a6;
        statusText = state.toUpperCase();
      }
      
      const commitHash = sha?.slice(0, 7) || 'N/A';
      const branchName = branches?.[0]?.name || 'main';
      
      const vercelIconUrl = 'https://dka575ofm4ao0.cloudfront.net/pages-favicon_logos/original/160919/96x96.png';
      
      const embed = {
        color: color,
        author: {
          name: sender?.login || 'Vercel',
          icon_url: sender?.avatar_url || vercelIconUrl,
          url: sender?.html_url || 'https://vercel.com'
        },
        title: `Vercel Deployment ${statusText}`,
        url: target_url || repository?.html_url || 'https://vercel.com',
        description: description || `${state.toUpperCase()} for ${repository?.full_name || 'repository'}`,
        fields: [
          { name: 'Repository', value: repository?.full_name || 'Unknown', inline: true },
          { name: 'Commit', value: `\`${commitHash}\``, inline: true },
          { name: 'Branch', value: branchName, inline: true }
        ],
        footer: {
          text: `Vercel`,
          icon_url: vercelIconUrl
        },
        timestamp: new Date().toISOString()
      };

      await sendToDiscord(embed);
    }
    
    else if (event === 'pull_request') {
      const { action, pull_request, repository, sender } = payload;
      
      const relevantActions = ['opened', 'closed', 'reopened', 'ready_for_review', 'assigned', 'unassigned', 'labeled', 'unlabeled', 'locked', 'unlocked', 'converted_to_draft', 'review_requested', 'review_request_removed', 'synchronize', 'auto_merge_enabled', 'auto_merge_disabled', 'enqueued', 'dequeued'];
      
      if (!relevantActions.includes(action)) {
        return res.status(200).send('OK');
      }
      
      let color, title;
      switch(action) {
        case 'opened': color = 0x9c3712; title = 'Pull Request Opened'; break;
        case 'reopened': color = 0x9c3712; title = 'Pull Request Reopened'; break;
        case 'ready_for_review': color = 0x9c3712; title = 'Pull Request Ready for Review'; break;
        case 'closed': color = pull_request.merged ? 0x6e5494 : 0xe74c3c; title = pull_request.merged ? 'Pull Request Merged' : 'Pull Request Closed'; break;
        case 'assigned': color = 0x9c3712; title = 'Pull Request Assigned'; break;
        case 'unassigned': color = 0x9c3712; title = 'Pull Request Unassigned'; break;
        case 'labeled': color = 0x9c3712; title = 'Pull Request Labeled'; break;
        case 'unlabeled': color = 0x9c3712; title = 'Pull Request Unlabeled'; break;
        case 'locked': color = 0xe74c3c; title = 'Pull Request Locked'; break;
        case 'unlocked': color = 0x9c3712; title = 'Pull Request Unlocked'; break;
        case 'converted_to_draft': color = 0x95a5a6; title = 'Pull Request Converted to Draft'; break;
        case 'review_requested': color = 0x9c3712; title = 'Review Requested'; break;
        case 'review_request_removed': color = 0xe74c3c; title = 'Review Request Removed'; break;
        case 'synchronize': color = 0x516989; title = 'Pull Request Synchronized'; break;
        case 'auto_merge_enabled': color = 0x9c3712; title = 'Auto Merge Enabled'; break;
        case 'auto_merge_disabled': color = 0xe74c3c; title = 'Auto Merge Disabled'; break;
        case 'enqueued': color = 0x9c3712; title = 'Pull Request Enqueued'; break;
        case 'dequeued': color = 0xe74c3c; title = 'Pull Request Dequeued'; break;
        default: return res.status(200).send('OK');
      }
      
      const additionsText = pull_request.additions === 1 ? '1 Line' : `${pull_request.additions} Lines`;
      const deletionsText = pull_request.deletions === 1 ? '1 Line' : `${pull_request.deletions} Lines`;
      
      let description = `**${pull_request.title}**\n\n`;
      if (action === 'assigned') description += `Assigned to: ${pull_request.assignee?.login || 'Unknown'}`;
      else if (action === 'unassigned') description += `Unassigned from: ${pull_request.assignee?.login || 'Unknown'}`;
      else if (action === 'labeled') description += `Label: ${payload.label?.name || 'Unknown'}`;
      else if (action === 'unlabeled') description += `Label: ${payload.label?.name || 'Unknown'}`;
      else if (action === 'review_requested') description += `Reviewer: ${payload.requested_reviewer?.login || 'Unknown'}`;
      else if (action === 'review_request_removed') description += `Reviewer: ${payload.requested_reviewer?.login || 'Unknown'}`;
      else description += pull_request.body?.slice(0, 500) || '*No description provided*';
      
      const embed = {
        color: color,
        author: {
          name: sender?.login || pull_request.user.login,
          icon_url: sender?.avatar_url || pull_request.user.avatar_url,
          url: sender?.html_url || pull_request.user.html_url
        },
        title: `${repository.full_name} - ${title}`,
        url: pull_request.html_url,
        description: description,
        fields: [
          { name: 'Branch', value: `${pull_request.head.ref} → ${pull_request.base.ref}`, inline: true },
          { name: 'Commits', value: `${pull_request.commits}`, inline: true },
          { name: 'Changes', value: `${additionsText} / ${deletionsText}`, inline: true }
        ],
        footer: {
          text: `GitHub`,
          icon_url: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'
        },
        timestamp: new Date().toISOString()
      };

      await sendToDiscord(embed);
    }
    
    else if (event === 'issues') {
      const { action, issue, repository, sender, label, assignee } = payload;
      
      let color, title, description;
      switch(action) {
        case 'opened': color = 0x9c3712; title = 'Issue Opened'; description = `**${issue.title}**\n\n${issue.body?.slice(0, 500) || '*No description provided*'}`; break;
        case 'closed': color = 0xe74c3c; title = 'Issue Closed'; description = `**${issue.title}**`; break;
        case 'reopened': color = 0x9c3712; title = 'Issue Reopened'; description = `**${issue.title}**`; break;
        case 'assigned': color = 0x9c3712; title = 'Issue Assigned'; description = `**${issue.title}**\nAssigned to: ${assignee?.login || 'Unknown'}`; break;
        case 'unassigned': color = 0x9c3712; title = 'Issue Unassigned'; description = `**${issue.title}**\nUnassigned from: ${assignee?.login || 'Unknown'}`; break;
        case 'labeled': color = 0x9c3712; title = 'Issue Labeled'; description = `**${issue.title}**\nLabel: ${label?.name || 'Unknown'}`; break;
        case 'unlabeled': color = 0x9c3712; title = 'Issue Unlabeled'; description = `**${issue.title}**\nLabel: ${label?.name || 'Unknown'}`; break;
        case 'edited': color = 0x516989; title = 'Issue Edited'; description = `**${issue.title}**`; break;
        case 'deleted': color = 0xe74c3c; title = 'Issue Deleted'; description = `Issue #${issue.number} was deleted`; break;
        case 'transferred': color = 0x9c3712; title = 'Issue Transferred'; description = `**${issue.title}** was transferred`; break;
        case 'pinned': color = 0x9c3712; title = 'Issue Pinned'; description = `**${issue.title}** was pinned`; break;
        case 'unpinned': color = 0xe74c3c; title = 'Issue Unpinned'; description = `**${issue.title}** was unpinned`; break;
        case 'milestoned': color = 0x9c3712; title = 'Issue Milestoned'; description = `**${issue.title}**\nMilestone: ${issue.milestone?.title || 'Unknown'}`; break;
        case 'demilestoned': color = 0xe74c3c; title = 'Issue Demilestoned'; description = `**${issue.title}**`; break;
        case 'locked': color = 0xe74c3c; title = 'Issue Locked'; description = `**${issue.title}** was locked`; break;
        case 'unlocked': color = 0x9c3712; title = 'Issue Unlocked'; description = `**${issue.title}** was unlocked`; break;
        default: return res.status(200).send('OK');
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

      await sendToDiscord(embed);
    }
    
    else if (event === 'issue_comment') {
      const { action, issue, comment, repository, sender } = payload;
      
      if (!['created', 'edited', 'deleted'].includes(action)) {
        return res.status(200).send('OK');
      }
      
      let color, title;
      if (action === 'created') { color = 0x6D9EDC; title = 'Issue Comment Created'; }
      else if (action === 'edited') { color = 0x516989; title = 'Issue Comment Edited'; }
      else { color = 0xe74c3c; title = 'Issue Comment Deleted'; }
      
      const embed = {
        color: color,
        author: {
          name: sender.login,
          icon_url: sender.avatar_url,
          url: sender.html_url
        },
        title: `${repository.full_name} - ${title}`,
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

      await sendToDiscord(embed);
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

      await sendToDiscord(embed);
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

      await sendToDiscord(embed);
    }
    
    else if (event === 'release') {
      const { action, release, repository, sender } = payload;
      
      const relevantActions = ['published', 'created', 'edited', 'deleted', 'unpublished'];
      if (!relevantActions.includes(action)) {
        return res.status(200).send('OK');
      }
      
      let color, title;
      switch(action) {
        case 'published': color = 0x9c3712; title = 'Release Published'; break;
        case 'created': color = 0x9c3712; title = 'Release Created'; break;
        case 'edited': color = 0x516989; title = 'Release Edited'; break;
        case 'unpublished': color = 0xe74c3c; title = 'Release Unpublished'; break;
        default: color = 0xe74c3c; title = 'Release Deleted';
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

      await sendToDiscord(embed);
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

      await sendToDiscord(embed);
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

      await sendToDiscord(embed);
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

      await sendToDiscord(embed);
    }
    
    else if (event === 'member') {
      const { action, member, repository, sender, changes } = payload;
      
      let color, title, description;
      if (action === 'added') {
        color = 0x9c3712;
        title = 'Collaborator Added';
        description = `${sender.login} added ${member.login} as a collaborator to ${repository.full_name}`;
      } else if (action === 'removed') {
        color = 0xe74c3c;
        title = 'Collaborator Removed';
        description = `${sender.login} removed ${member.login} from ${repository.full_name}`;
      } else if (action === 'edited') {
        color = 0x516989;
        title = 'Collaborator Permissions Changed';
        description = `${sender.login} changed permissions for ${member.login} in ${repository.full_name}`;
        if (changes?.permission) {
          description += `\nFrom: ${changes.permission.from} → To: ${changes.permission.to}`;
        }
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
        title: title,
        url: repository.html_url,
        description: description,
        footer: {
          text: `GitHub`,
          icon_url: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'
        },
        timestamp: new Date().toISOString()
      };

      await sendToDiscord(embed);
    }
    
    else if (event === 'commit_comment') {
      const { action, comment, repository, sender } = payload;
      
      if (!['created', 'edited', 'deleted'].includes(action)) {
        return res.status(200).send('OK');
      }
      
      let color, title;
      if (action === 'created') { color = 0x516989; title = 'Commit Comment Created'; }
      else if (action === 'edited') { color = 0x516989; title = 'Commit Comment Edited'; }
      else { color = 0xe74c3c; title = 'Commit Comment Deleted'; }
      
      const embed = {
        color: color,
        author: {
          name: sender.login,
          icon_url: sender.avatar_url,
          url: sender.html_url
        },
        title: `${repository.full_name} - ${title}`,
        url: comment.html_url,
        description: `**${comment.commit_id?.slice(0, 7)}**\n\n${comment.body?.slice(0, 500) || '*No comment content*'}`,
        footer: {
          text: `GitHub`,
          icon_url: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'
        },
        timestamp: new Date().toISOString()
      };

      await sendToDiscord(embed);
    }
    
    else if (event === 'branch_protection_configuration') {
      const { action, repository, sender } = payload;
      
      const embed = {
        color: action === 'enabled' ? 0x9c3712 : 0xe74c3c,
        author: {
          name: sender.login,
          icon_url: sender.avatar_url,
          url: sender.html_url
        },
        title: action === 'enabled' ? 'Branch Protections Enabled' : 'Branch Protections Disabled',
        url: repository.html_url,
        description: `${sender.login} ${action === 'enabled' ? 'enabled' : 'disabled'} all branch protections for ${repository.full_name}`,
        footer: {
          text: `GitHub`,
          icon_url: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'
        },
        timestamp: new Date().toISOString()
      };

      await sendToDiscord(embed);
    }
    
    else if (event === 'branch_protection_rule') {
      const { action, rule, repository, sender } = payload;
      
      let title;
      if (action === 'create') title = 'Branch Protection Rule Created';
      else if (action === 'delete') title = 'Branch Protection Rule Deleted';
      else title = 'Branch Protection Rule Edited';
      
      const embed = {
        color: action === 'delete' ? 0xe74c3c : 0x9c3712,
        author: {
          name: sender.login,
          icon_url: sender.avatar_url,
          url: sender.html_url
        },
        title: title,
        url: repository.html_url,
        description: `${sender.login} ${action === 'create' ? 'created' : action === 'delete' ? 'deleted' : 'edited'} protection rule for ${repository.full_name}\nPattern: \`${rule?.pattern || 'N/A'}\``,
        footer: {
          text: `GitHub`,
          icon_url: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'
        },
        timestamp: new Date().toISOString()
      };

      await sendToDiscord(embed);
    }
    
    else if (event === 'code_scanning_alert') {
      const { action, alert, repository, sender } = payload;
      
      let color, title;
      if (action === 'created') { color = 0xe74c3c; title = 'Code Scanning Alert Created'; }
      else if (action === 'fixed') { color = 0x2ecc71; title = 'Code Scanning Alert Fixed'; }
      else if (action === 'closed') { color = 0x95a5a6; title = 'Code Scanning Alert Closed'; }
      else if (action === 'reopened') { color = 0xf1c40f; title = 'Code Scanning Alert Reopened'; }
      else { return res.status(200).send('OK'); }
      
      const embed = {
        color: color,
        author: {
          name: sender.login,
          icon_url: sender.avatar_url,
          url: sender.html_url
        },
        title: title,
        url: alert.html_url,
        description: `**${alert.rule?.name || 'Unknown rule'}**\n${alert.rule?.description?.slice(0, 200) || ''}\nSeverity: ${alert.rule?.severity || 'N/A'}`,
        fields: [
          { name: 'Repository', value: repository.full_name, inline: true },
          { name: 'Tool', value: alert.tool?.name || 'N/A', inline: true }
        ],
        footer: {
          text: `GitHub`,
          icon_url: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'
        },
        timestamp: new Date().toISOString()
      };

      await sendToDiscord(embed);
    }
    
    else if (event === 'dependabot_alert') {
      const { action, alert, repository, sender } = payload;
      
      let color, title;
      switch(action) {
        case 'created': color = 0xe74c3c; title = 'Dependabot Alert Created'; break;
        case 'dismissed': color = 0x95a5a6; title = 'Dependabot Alert Dismissed'; break;
        case 'fixed': color = 0x2ecc71; title = 'Dependabot Alert Fixed'; break;
        case 'reopened': color = 0xf1c40f; title = 'Dependabot Alert Reopened'; break;
        case 'auto_dismissed': color = 0x95a5a6; title = 'Dependabot Alert Auto-Dismissed'; break;
        case 'auto_reopened': color = 0xf1c40f; title = 'Dependabot Alert Auto-Reopened'; break;
        default: return res.status(200).send('OK');
      }
      
      const embed = {
        color: color,
        author: {
          name: sender.login,
          icon_url: sender.avatar_url,
          url: sender.html_url
        },
        title: title,
        url: alert.html_url,
        description: `**${alert.security_advisory?.summary || alert.security_vulnerability?.package?.name || 'Unknown'}**\nSeverity: ${alert.security_advisory?.severity || alert.security_vulnerability?.severity || 'N/A'}`,
        fields: [
          { name: 'Repository', value: repository.full_name, inline: true },
          { name: 'Package', value: alert.security_vulnerability?.package?.name || 'N/A', inline: true }
        ],
        footer: {
          text: `GitHub`,
          icon_url: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'
        },
        timestamp: new Date().toISOString()
      };

      await sendToDiscord(embed);
    }
    
    else if (event === 'deploy_key') {
      const { action, key, repository, sender } = payload;
      
      const embed = {
        color: action === 'created' ? 0x9c3712 : 0xe74c3c,
        author: {
          name: sender.login,
          icon_url: sender.avatar_url,
          url: sender.html_url
        },
        title: action === 'created' ? 'Deploy Key Created' : 'Deploy Key Deleted',
        url: repository.html_url,
        description: `${sender.login} ${action === 'created' ? 'added' : 'removed'} deploy key "${key?.title || 'Unknown'}" in ${repository.full_name}`,
        footer: {
          text: `GitHub`,
          icon_url: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'
        },
        timestamp: new Date().toISOString()
      };

      await sendToDiscord(embed);
    }
    
    else if (event === 'discussion') {
      const { action, discussion, repository, sender } = payload;
      
      const embed = {
        color: action === 'deleted' ? 0xe74c3c : 0x9c3712,
        author: {
          name: sender.login,
          icon_url: sender.avatar_url,
          url: sender.html_url
        },
        title: `Discussion ${action.charAt(0).toUpperCase() + action.slice(1)}`,
        url: discussion.html_url,
        description: `**${discussion.title}**\n${discussion.body?.slice(0, 300) || ''}`,
        fields: [
          { name: 'Repository', value: repository.full_name, inline: true },
          { name: 'Category', value: discussion.category?.name || 'N/A', inline: true }
        ],
        footer: {
          text: `GitHub`,
          icon_url: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'
        },
        timestamp: new Date().toISOString()
      };

      await sendToDiscord(embed);
    }
    
    else if (event === 'discussion_comment') {
      const { action, comment, discussion, repository, sender } = payload;
      
      const embed = {
        color: action === 'deleted' ? 0xe74c3c : 0x6D9EDC,
        author: {
          name: sender.login,
          icon_url: sender.avatar_url,
          url: sender.html_url
        },
        title: `Discussion Comment ${action.charAt(0).toUpperCase() + action.slice(1)}`,
        url: comment.html_url,
        description: `**${discussion.title}**\n\n${comment.body?.slice(0, 500) || '*No content*'}`,
        fields: [
          { name: 'Repository', value: repository.full_name, inline: true }
        ],
        footer: {
          text: `GitHub`,
          icon_url: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'
        },
        timestamp: new Date().toISOString()
      };

      await sendToDiscord(embed);
    }
    
    else if (event === 'label') {
      const { action, label, repository, sender } = payload;
      
      let title;
      if (action === 'created') title = 'Label Created';
      else if (action === 'edited') title = 'Label Edited';
      else title = 'Label Deleted';
      
      const embed = {
        color: action === 'deleted' ? 0xe74c3c : 0x9c3712,
        author: {
          name: sender.login,
          icon_url: sender.avatar_url,
          url: sender.html_url
        },
        title: title,
        url: repository.html_url,
        description: `${sender.login} ${action} label "${label?.name || 'Unknown'}" in ${repository.full_name}`,
        fields: [
          { name: 'Color', value: label?.color ? `#${label.color}` : 'N/A', inline: true }
        ],
        footer: {
          text: `GitHub`,
          icon_url: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'
        },
        timestamp: new Date().toISOString()
      };

      await sendToDiscord(embed);
    }
    
    else if (event === 'milestone') {
      const { action, milestone, repository, sender } = payload;
      
      const embed = {
        color: action === 'deleted' ? 0xe74c3c : 0x9c3712,
        author: {
          name: sender.login,
          icon_url: sender.avatar_url,
          url: sender.html_url
        },
        title: `Milestone ${action.charAt(0).toUpperCase() + action.slice(1)}`,
        url: milestone.html_url,
        description: `**${milestone.title}**\n${milestone.description?.slice(0, 200) || ''}\nDue: ${milestone.due_on ? new Date(milestone.due_on).toLocaleDateString() : 'Not set'}`,
        fields: [
          { name: 'Repository', value: repository.full_name, inline: true },
          { name: 'Open Issues', value: `${milestone.open_issues}`, inline: true },
          { name: 'Closed Issues', value: `${milestone.closed_issues}`, inline: true }
        ],
        footer: {
          text: `GitHub`,
          icon_url: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'
        },
        timestamp: new Date().toISOString()
      };

      await sendToDiscord(embed);
    }
    
    else if (event === 'package') {
      const { action, package, repository, sender } = payload;
      
      const embed = {
        color: action === 'updated' ? 0x516989 : 0x9c3712,
        author: {
          name: sender.login,
          icon_url: sender.avatar_url,
          url: sender.html_url
        },
        title: `Package ${action === 'published' ? 'Published' : 'Updated'}`,
        url: package.html_url,
        description: `**${package.name}**\nPackage: ${package.package_version?.name || 'N/A'}\nRegistry: ${package.package_type || 'N/A'}`,
        fields: [
          { name: 'Repository', value: repository.full_name, inline: true }
        ],
        footer: {
          text: `GitHub`,
          icon_url: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'
        },
        timestamp: new Date().toISOString()
      };

      await sendToDiscord(embed);
    }
    
    else if (event === 'page_build') {
      const { build, repository, sender } = payload;
      
      const embed = {
        color: build.status === 'built' ? 0x2ecc71 : 0xe74c3c,
        author: {
          name: sender?.login || 'GitHub',
          icon_url: sender?.avatar_url || 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'
        },
        title: `Pages Build ${build.status === 'built' ? 'Succeeded' : 'Failed'}`,
        url: repository.html_url,
        description: `Pages site for ${repository.full_name} ${build.status === 'built' ? 'built successfully' : 'failed to build'}\nCommit: ${build.commit?.slice(0, 7) || 'N/A'}`,
        footer: {
          text: `GitHub`,
          icon_url: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'
        },
        timestamp: new Date().toISOString()
      };

      await sendToDiscord(embed);
    }
    
    else if (event === 'pull_request_review') {
      const { action, review, pull_request, repository, sender } = payload;
      
      let color;
      if (review.state === 'approved') color = 0x2ecc71;
      else if (review.state === 'changes_requested') color = 0xe74c3c;
      else color = 0x516989;
      
      const embed = {
        color: color,
        author: {
          name: sender.login,
          icon_url: sender.avatar_url,
          url: sender.html_url
        },
        title: `Pull Request Review ${action}`,
        url: review.html_url,
        description: `**${pull_request.title}**\nState: ${review.state}\n${review.body?.slice(0, 300) || ''}`,
        fields: [
          { name: 'Repository', value: repository.full_name, inline: true },
          { name: 'PR Number', value: `#${pull_request.number}`, inline: true }
        ],
        footer: {
          text: `GitHub`,
          icon_url: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'
        },
        timestamp: new Date().toISOString()
      };

      await sendToDiscord(embed);
    }
    
    else if (event === 'pull_request_review_comment') {
      const { action, comment, pull_request, repository, sender } = payload;
      
      const embed = {
        color: action === 'deleted' ? 0xe74c3c : 0x6D9EDC,
        author: {
          name: sender.login,
          icon_url: sender.avatar_url,
          url: sender.html_url
        },
        title: `PR Review Comment ${action}`,
        url: comment.html_url,
        description: `**${pull_request.title}**\n\n${comment.body?.slice(0, 500) || '*No content*'}`,
        fields: [
          { name: 'Repository', value: repository.full_name, inline: true },
          { name: 'File', value: comment.path || 'N/A', inline: true }
        ],
        footer: {
          text: `GitHub`,
          icon_url: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'
        },
        timestamp: new Date().toISOString()
      };

      await sendToDiscord(embed);
    }
    
    else if (event === 'repository') {
      const { action, repository, sender } = payload;
      
      let color;
      if (action === 'created') color = 0x9c3712;
      else if (action === 'deleted') color = 0xe74c3c;
      else if (action === 'archived') color = 0x95a5a6;
      else if (action === 'unarchived') color = 0x9c3712;
      else if (action === 'publicized') color = 0x9c3712;
      else if (action === 'privatized') color = 0xe74c3c;
      else color = 0x516989;
      
      const embed = {
        color: color,
        author: {
          name: sender.login,
          icon_url: sender.avatar_url,
          url: sender.html_url
        },
        title: `Repository ${action.charAt(0).toUpperCase() + action.slice(1)}`,
        url: repository.html_url,
        description: `${sender.login} ${action} repository ${repository.full_name}`,
        footer: {
          text: `GitHub`,
          icon_url: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'
        },
        timestamp: new Date().toISOString()
      };

      await sendToDiscord(embed);
    }
    
    else if (event === 'repository_ruleset') {
      const { action, ruleset, repository, sender } = payload;
      
      let title;
      if (action === 'create') title = 'Repository Ruleset Created';
      else if (action === 'delete') title = 'Repository Ruleset Deleted';
      else title = 'Repository Ruleset Edited';
      
      const embed = {
        color: action === 'delete' ? 0xe74c3c : 0x9c3712,
        author: {
          name: sender.login,
          icon_url: sender.avatar_url,
          url: sender.html_url
        },
        title: title,
        url: repository.html_url,
        description: `${sender.login} ${action}d ruleset "${ruleset?.name || 'Unknown'}" in ${repository.full_name}`,
        footer: {
          text: `GitHub`,
          icon_url: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'
        },
        timestamp: new Date().toISOString()
      };

      await sendToDiscord(embed);
    }
    
    else if (event === 'secret_scanning_alert') {
      const { action, alert, repository, sender } = payload;
      
      let color;
      if (action === 'created') color = 0xe74c3c;
      else if (action === 'resolved') color = 0x2ecc71;
      else if (action === 'reopened') color = 0xf1c40f;
      else color = 0x95a5a6;
      
      const embed = {
        color: color,
        author: {
          name: sender.login,
          icon_url: sender.avatar_url,
          url: sender.html_url
        },
        title: `Secret Scanning Alert ${action}`,
        url: alert.html_url,
        description: `**${alert.secret_type}**\nLocation: ${alert.location?.path || 'N/A'}\nLine: ${alert.location?.start_line || 'N/A'}`,
        fields: [
          { name: 'Repository', value: repository.full_name, inline: true },
          { name: 'Resolution', value: alert.resolution || 'N/A', inline: true }
        ],
        footer: {
          text: `GitHub`,
          icon_url: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'
        },
        timestamp: new Date().toISOString()
      };

      await sendToDiscord(embed);
    }
    
    else if (event === 'team_add') {
      const { team, repository, sender } = payload;
      
      const embed = {
        color: 0x9c3712,
        author: {
          name: sender.login,
          icon_url: sender.avatar_url,
          url: sender.html_url
        },
        title: 'Team Added to Repository',
        url: repository.html_url,
        description: `${sender.login} added team "${team.name}" to ${repository.full_name}\nPermission: ${team.permission || 'N/A'}`,
        footer: {
          text: `GitHub`,
          icon_url: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'
        },
        timestamp: new Date().toISOString()
      };

      await sendToDiscord(embed);
    }
    
    else if (event === 'gollum') {
      const { pages, repository, sender } = payload;
      
      const pageUpdates = pages.map(page => `- ${page.action}: [${page.title}](${page.html_url})`).join('\n');
      
      const embed = {
        color: 0x516989,
        author: {
          name: sender.login,
          icon_url: sender.avatar_url,
          url: sender.html_url
        },
        title: 'Wiki Updated',
        url: repository.html_url,
        description: `${sender.login} updated wiki pages in ${repository.full_name}\n\n${pageUpdates}`,
        footer: {
          text: `GitHub`,
          icon_url: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'
        },
        timestamp: new Date().toISOString()
      };

      await sendToDiscord(embed);
    }
    
    else if (event === 'meta') {
      const { action, hook, repository, sender } = payload;
      
      if (action === 'deleted') {
        const embed = {
          color: 0xe74c3c,
          author: {
            name: sender.login,
            icon_url: sender.avatar_url,
            url: sender.html_url
          },
          title: 'Webhook Deleted',
          url: repository?.html_url || 'https://github.com',
          description: `${sender.login} deleted webhook "${hook?.name || 'Unknown'}" from ${repository?.full_name || 'repository'}`,
          footer: {
            text: `GitHub`,
            icon_url: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'
          },
          timestamp: new Date().toISOString()
        };

        await sendToDiscord(embed);
      }
    }
    
    else if (event === 'security_and_analysis') {
      const { changes, repository, sender } = payload;
      
      const features = [];
      if (changes?.security_and_analysis?.advanced_security?.from !== undefined) {
        features.push(`Advanced Security: ${changes.security_and_analysis.advanced_security.from ? 'disabled' : 'enabled'}`);
      }
      if (changes?.security_and_analysis?.secret_scanning?.from !== undefined) {
        features.push(`Secret Scanning: ${changes.security_and_analysis.secret_scanning.from ? 'disabled' : 'enabled'}`);
      }
      if (changes?.security_and_analysis?.dependabot_security_updates?.from !== undefined) {
        features.push(`Dependabot Security Updates: ${changes.security_and_analysis.dependabot_security_updates.from ? 'disabled' : 'enabled'}`);
      }
      
      const embed = {
        color: 0x516989,
        author: {
          name: sender.login,
          icon_url: sender.avatar_url,
          url: sender.html_url
        },
        title: 'Security & Analysis Features Changed',
        url: repository.html_url,
        description: `${sender.login} changed security settings for ${repository.full_name}\n\n${features.join('\n')}`,
        footer: {
          text: `GitHub`,
          icon_url: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'
        },
        timestamp: new Date().toISOString()
      };

      await sendToDiscord(embed);
    }
    
    else if (event === 'issue_dependencies') {
      const { action, added_dependencies, removed_dependencies, repository, sender } = payload;
      
      const changes = [];
      if (added_dependencies?.length) {
        changes.push(`Added dependencies: ${added_dependencies.map(d => `#${d.issue_number}`).join(', ')}`);
      }
      if (removed_dependencies?.length) {
        changes.push(`Removed dependencies: ${removed_dependencies.map(d => `#${d.issue_number}`).join(', ')}`);
      }
      
      const embed = {
        color: 0x516989,
        author: {
          name: sender.login,
          icon_url: sender.avatar_url,
          url: sender.html_url
        },
        title: `Issue Dependencies ${action}`,
        url: repository.html_url,
        description: `${sender.login} ${action} issue dependencies in ${repository.full_name}\n\n${changes.join('\n')}`,
        footer: {
          text: `GitHub`,
          icon_url: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'
        },
        timestamp: new Date().toISOString()
      };

      await sendToDiscord(embed);
    }
    
    else if (event === 'public') {
      const { repository, sender } = payload;
      
      const embed = {
        color: 0x9c3712,
        author: {
          name: sender.login,
          icon_url: sender.avatar_url,
          url: sender.html_url
        },
        title: 'Repository Made Public',
        url: repository.html_url,
        description: `${sender.login} made ${repository.full_name} public`,
        footer: {
          text: `GitHub`,
          icon_url: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'
        },
        timestamp: new Date().toISOString()
      };

      await sendToDiscord(embed);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error');
  }
};

const core = require('@actions/core');
const github = require('@actions/github');
const axios = require("axios");

const requiredEnvironmentVariables = [
    "DISCORD_WEBHOOK",
    "MESSAGE_TEMPLATE",
    "ACT_GITHUB_TOKEN"
]
const ENTRY_REGEXP = /(.*) (@\w+) (\(#\d{4}\))/
const applyTemplate = async (template, tag, changelog) => {
    return template.replaceAll('{TAG}', tag)
        .replaceAll('{CHANGELOG}', changelog)
}

(async () => {
    // Validate, all required environment variables are present
    requiredEnvironmentVariables.forEach(variable => {
        const value = process.env[variable]
        if (!value || value.length < 1) {
            throw Error(`Missing environment variable ${variable}`)
        }
    })

    const tag = github.context.payload.release.tag_name
    const octokit = github.getOctokit(process.env['ACT_GITHUB_TOKEN'])
    const changelog = (await octokit.request("GET /repos/{owner}/{repo}/releases/tags/{tag}", {
        headers: {
          authorization: `token ${process.env['ACT_GITHUB_TOKEN']}`
        },
        'owner': github.context.payload.repository.owner,
        'repo': github.context.payload.repository.name,
        'tag': tag
    })).data.body

    let discordChangelog = ''
    for (let line of changelog.split("\r\n")) {
        line = line.trim()
        if (line.startsWith('##')) {
            if (discordChangelog !== '') {
                discordChangelog += '\n\n'
            }
            discordChangelog += line.substring(3) + '\n\n' // trim '## '
            continue
        }
        const match = line.match(ENTRY_REGEXP)
        discordChangelog += `${match[1]} ${match[3]}\n`
    }


    await axios.post(process.env['DISCORD_WEBHOOK'], {
        content: applyTemplate(process.env['MESSAGE_TEMPLATE'], tag, discordChangelog)
    })
})().catch(err => core.setFailed(err)).then(() => core.info('Message sent to discord'))
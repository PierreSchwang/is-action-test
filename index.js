const core = require('@actions/core');
const github = require('@actions/github');
const axios = require("axios");

const requiredEnvironmentVariables = [
    "DISCORD_WEBHOOK",
    "MESSAGE_TEMPLATE",
    "ACT_GITHUB_TOKEN"
]
const ENTRY_REGEXP = /(.*) (@\w+) (\(#\d{4}\))/
const applyTemplate = (template, tag, changelog) => {
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
    core.info(`Preparing release message for ${tag}`)
    const url = `https://api.github.com/repos/${github.context.payload.repository.full_name}/releases/tags/${tag}`
    core.info(`url: ${url}`)
    const changelog = (await axios.get(url, {
        headers: {
            authorization: `token ${process.env['ACT_GITHUB_TOKEN']}`
        }
    })).data.body
    let discordChangelog = ''
    for (let line of changelog.split("\r\n")) {
        if (!(line = line.trim())) {
            continue
        }
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
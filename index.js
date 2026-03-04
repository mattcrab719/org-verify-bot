import {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';

import fetch from 'node-fetch';
import fs from 'fs';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const VERIFY_CHANNEL_ID = "1474529990786682931";
const VERIFIED_ROLE_ID = "1473835159097835831";
const LOG_CHANNEL_ID = "1474231704133697729";

const VERIFIED_FILE = "./verified.json";
const PENDING_FILE = "./pending.json";

function load(file) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, "[]");
  return JSON.parse(fs.readFileSync(file));
}

function save(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function generateCode() {
  return "ORG-" + Math.floor(10000 + Math.random() * 90000);
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName('verify')
      .setDescription('Start verification')
      .addStringOption(option =>
        option.setName('url')
          .setDescription('Full Looksmax profile URL')
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName('confirm')
      .setDescription('Confirm verification')
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: '10' }).setToken(TOKEN);
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });

  console.log("Commands registered.");
});


// 🔔 Welcome Message
client.on('guildMemberAdd', async (member) => {
  const channel = member.guild.channels.cache.get(VERIFY_CHANNEL_ID);
  if (!channel) return;

  channel.send(
`👋 Welcome ${member}!

To access the server:

1️⃣ Go to your Looksmax profile.
2️⃣ Open your profile page.
3️⃣ Copy your FULL profile link.

Example:
https://looksmax.org/members/yourname.123456/

Then type:
/verify <paste link>`
  );
});


client.on('interactionCreate', async interaction => {

  // Button interaction
  if (interaction.isButton()) {
    if (interaction.customId.startsWith("copy_")) {
      const code = interaction.customId.split("_")[1];
      return interaction.reply({
        content: `📋 Copy this code:\n\`\`\`\nNormie Hate Member | ${code}\n\`\`\``,
        ephemeral: true
      });
    }
  }

  if (!interaction.isChatInputCommand()) return;

  if (interaction.channelId !== VERIFY_CHANNEL_ID) {
    return interaction.reply({
      content: "❌ Use this inside the verify channel.",
      ephemeral: true
    });
  }

  const verified = load(VERIFIED_FILE);
  const pending = load(PENDING_FILE);

  if (interaction.commandName === 'verify') {

    const url = interaction.options.getString('url');

    if (!url.startsWith("https://looksmax.org/members/"))
      return interaction.reply({ content: "❌ Invalid Looksmax profile URL.", ephemeral: true });

    const match = url.match(/members\/(.+)\.(\d+)\//);
    if (!match)
      return interaction.reply({ content: "❌ Could not extract username and ID.", ephemeral: true });

    const username = match[1];
    const memberId = match[2];
    const discordId = interaction.user.id;

    if (verified.find(v => v.discordId === discordId))
      return interaction.reply({ content: "❌ You are already verified.", ephemeral: true });

    if (verified.find(v => v.memberId === memberId))
      return interaction.reply({ content: "❌ That Looksmax account is already linked.", ephemeral: true });

    const code = generateCode();

    pending.push({ discordId, username, memberId, url, code });
    save(PENDING_FILE, pending);

    const button = new ButtonBuilder()
      .setCustomId(`copy_${code}`)
      .setLabel("Copy Code")
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    return interaction.reply({
      content:
`🛡️ **Ownership Verification Started**

Set your Looksmax custom title to:

\`\`\`
Normie Hate Member | ${code}
\`\`\`

Press the button below to copy it easily.

After saving your profile, type:
/confirm`,
      components: [row],
      ephemeral: true
    });
  }

  if (interaction.commandName === 'confirm') {

    const discordId = interaction.user.id;
    const entry = pending.find(p => p.discordId === discordId);

    if (!entry)
      return interaction.reply({ content: "❌ No pending verification found.", ephemeral: true });

    try {
      const response = await fetch(entry.url);
      const html = await response.text();

      if (!html.includes(entry.code) || !html.includes("Normie Hate Member"))
        return interaction.reply({
          content: "❌ Required title not found. Make sure it matches exactly.",
          ephemeral: true
        });

      verified.push({
        discordId,
        username: entry.username,
        memberId: entry.memberId
      });

      save(VERIFIED_FILE, verified);
      save(PENDING_FILE, pending.filter(p => p.discordId !== discordId));

      await interaction.member.roles.add(VERIFIED_ROLE_ID);

      // 📝 LOG CHANNEL
      const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel) {
        logChannel.send(
`✅ **User Verified**
Discord: <@${discordId}>
Looksmax: ${entry.username}
Member ID: ${entry.memberId}`
        );
      }

      await interaction.reply({
        content: "✅ Ownership confirmed! You are now verified.",
        ephemeral: true
      });

      // 🧹 Delete the user's last verify message (if exists)
      const messages = await interaction.channel.messages.fetch({ limit: 10 });
      const userVerifyMessage = messages.find(m =>
        m.author.id === discordId && m.content.includes("/verify")
      );

      if (userVerifyMessage) userVerifyMessage.delete().catch(() => {});

    } catch (err) {
      console.error(err);
      return interaction.reply({ content: "⚠️ Error checking profile.", ephemeral: true });
    }
  }
});

client.login(TOKEN);
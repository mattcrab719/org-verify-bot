import {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  EmbedBuilder
} from 'discord.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const VERIFY_CHANNEL_ID = "1474529990786682931";
const VERIFIED_ROLE_ID = "1473835159097835831";
const LOG_CHANNEL_ID = "1474231704133697729";

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName('verify')
      .setDescription('Verify your Looksmax profile')
      .addStringOption(option =>
        option.setName('url')
          .setDescription('Your looksmax.org members profile URL')
          .setRequired(true)
      )
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: '10' }).setToken(TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: commands
  });

  console.log("Commands registered.");
});

client.on('interactionCreate', async interaction => {

  // =========================
  // VERIFY COMMAND
  // =========================
  if (interaction.isChatInputCommand() && interaction.commandName === 'verify') {

    if (interaction.channelId !== VERIFY_CHANNEL_ID) {
      return interaction.reply({
        content: "❌ Use this inside the verify channel.",
        ephemeral: true
      });
    }

    const url = interaction.options.getString('url');

    // Validate looksmax.org link
    const validLinkRegex =
      /^https?:\/\/(www\.)?looksmax\.org\/members\/[A-Za-z0-9._-]+\/?$/;

    if (!validLinkRegex.test(url)) {
      return interaction.reply({
        content: "❌ Invalid Looksmax profile link.",
        ephemeral: true
      });
    }

    // Give verified role
    const role = interaction.guild.roles.cache.get(VERIFIED_ROLE_ID);
    if (role) {
      await interaction.member.roles.add(role);
    }

    // Send to staff log channel
    const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);

    if (logChannel) {

      const embed = new EmbedBuilder()
        .setTitle("New Verification Request")
        .setColor("Blue")
        .addFields(
          { name: "User", value: `<@${interaction.user.id}>` },
          { name: "Profile Link", value: url }
        )
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`real_${interaction.user.id}`)
          .setLabel("Account Real ✅")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId(`fake_${interaction.user.id}`)
          .setLabel("Account Fake ❌")
          .setStyle(ButtonStyle.Danger)
      );

      await logChannel.send({
        embeds: [embed],
        components: [row]
      });
    }

    return interaction.reply({
      content: "✅ Verified successfully! Staff have been notified.",
      ephemeral: true
    });
  }

  // =========================
  // BUTTON HANDLER
  // =========================
  if (interaction.isButton()) {

    if (!interaction.member.permissions.has(
      PermissionsBitField.Flags.Administrator
    )) {
      return interaction.reply({
        content: "❌ No permission.",
        ephemeral: true
      });
    }

    const [type, userId] = interaction.customId.split("_");

    const member = await interaction.guild.members.fetch(userId).catch(() => null);
    if (!member) {
      return interaction.reply({
        content: "User not found.",
        ephemeral: true
      });
    }

    if (type === "fake") {
      await member.kick("Marked as fake by staff");
      return interaction.reply({
        content: "❌ User kicked.",
        ephemeral: true
      });
    }

    if (type === "real") {
      return interaction.reply({
        content: "✅ Marked as real.",
        ephemeral: true
      });
    }
  }
});

client.login(TOKEN);


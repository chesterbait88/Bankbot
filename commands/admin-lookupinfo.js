// admin-lookupinfo.js
const { SlashCommandBuilder } = require('discord.js');
const bank = require('../bank.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin-lookupinfo')
    .setDescription('Lookup a user’s information from the balances table (Admin only).')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to lookup')
        .setRequired(true)
    ),
    
  async execute(interaction) {
    // Ensure the command is run by an admin.
    if (!interaction.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
      return interaction.reply({ content: '🚨 You do not have permission to use this command.', flags: 64 });
    }

    // Get the target user from the command option.
    const targetUser = interaction.options.getUser('user');
    const info = await bank.lookupUserInfo(targetUser.id);

    if (!info) {
      return interaction.reply({ content: `No info found for <@${targetUser.id}>.`, flags: 64 });
    }

    // Build the reply message.
    let reply = `**User Info for ${targetUser.tag}**\n\n`;
    reply += `**Username:** ${info.username || 'Not set'}\n`;
    reply += `**Balance:** ${info.balance} NS\n`;
    reply += `**Facebook Nation Name:** ${info.nationUsername || 'Not set'}\n`;
    reply += `**Pirate Name:** ${info.pirateName || 'Not set'}\n`;
    reply += `**Real Name:** ${info.realName || 'Not set'}\n`;
    reply += `**Ship Name:** ${info.shipName || 'Not set'}\n`;
    reply += `**Email:** ${info.email || 'Not set'}\n`;
    reply += `**Phone Number:** ${info.phoneNumber || 'Not set'}\n`;

    // Reply with an ephemeral message using flags: 64.
    await interaction.reply({ content: reply, flags: 64 });
  }
};

// admin-balance.js
const { SlashCommandBuilder } = require('discord.js');
const bank = require('../bank.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin-balance')
    .setDescription('Check a user’s balance (Admin only).')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to check')
        .setRequired(true)
    ),

  async execute(interaction) {
    // Check for the required admin role.
    if (!interaction.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
      return interaction.reply({ 
        content: '🚨 You do not have permission to use this command.', 
         flags: 64  
      });
    }

    const adminId = interaction.user.id;
    const adminUsername = interaction.user.username;
    const targetUser = interaction.options.getUser('user');

    // Log the admin action: checking a user's balance.
    await bank.logAdminAction(
      adminId,
      adminUsername,
      'admin_balance',
      `Checked balance for user ${targetUser.tag} (${targetUser.id})`
    );

    // Get the target user's balance.
    const balance = await bank.getBalance(targetUser.id);

    // Reply with the user's balance in an ephemeral message.
    await interaction.reply({ 
      content: `**${targetUser.username}** has **${balance} NS**.`,
       flags: 64 
    });
  },
};
